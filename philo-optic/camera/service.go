package camera

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"strings"
	"sync"
	"time"
)

// Frame is a captured still plus its metadata.
type Frame struct {
	Bytes       []byte
	ContentType string
	CapturedAt  time.Time
	ID          string
	Attempts    int
}

// Service owns the single camera and serialises access. Concurrent requests for the
// SAME capture (same args) share ONE shutter (single-flight, shared photons); a global
// device lock guarantees only one physical capture runs at a time even across different
// presets. This is what lets the TS side drop its mutex.
type Service struct {
	backend    Capturer
	log        *slog.Logger
	retryDelay time.Duration

	mu       sync.Mutex
	last     map[string]*Frame // most recent successful capture per args key (maxAge reuse)
	inflight map[string]*call  // a capture currently in progress, per args key

	device sync.Mutex // only one physical shutter at a time, across all keys
}

// call is one in-flight capture that concurrent callers wait on and share.
type call struct {
	done  chan struct{}
	frame Frame
	err   error
}

// NewService builds the capture service around a backend.
func NewService(backend Capturer, log *slog.Logger) *Service {
	if log == nil {
		log = slog.Default()
	}
	return &Service{
		backend:    backend,
		log:        log,
		retryDelay: 300 * time.Millisecond,
		last:       map[string]*Frame{},
		inflight:   map[string]*call{},
	}
}

// Backend returns the active backend name (for /health).
func (s *Service) Backend() string { return s.backend.Name() }

// Frame returns a captured still for the given capture args.
//   - maxAge > 0: a cached frame (same args) this fresh or fresher is reused, no shutter.
//   - maxAge == 0: force a fresh capture (unless one with the same args is already in flight).
//   - timeout: how long a caller waits for the shared capture to land.
func (s *Service) Frame(args []string, maxAge, timeout time.Duration) (Frame, error) {
	key := strings.Join(args, "\x00")

	s.mu.Lock()

	// Fast path: a cached frame young enough for this caller.
	if maxAge > 0 {
		if f, ok := s.last[key]; ok && time.Since(f.CapturedAt) <= maxAge {
			out := *f
			s.mu.Unlock()
			return out, nil
		}
	}

	// Join a capture with the same args already in flight (single-flight coalescing):
	// one shutter, many waiters, all sharing the same result or the same error.
	if c, ok := s.inflight[key]; ok {
		s.mu.Unlock()
		select {
		case <-c.done:
			return c.frame, c.err
		case <-time.After(timeout):
			return Frame{}, fmt.Errorf("timed out after %s waiting for in-flight capture", timeout)
		}
	}

	// Become the leader for this key: everyone arriving now joins this call.
	c := &call{done: make(chan struct{})}
	s.inflight[key] = c
	s.mu.Unlock()

	frame, err := s.capture(args, timeout)

	s.mu.Lock()
	if err == nil {
		f := frame
		s.last[key] = &f
	}
	delete(s.inflight, key)
	c.frame = frame
	c.err = err
	close(c.done)
	s.mu.Unlock()

	return frame, err
}

// capture retries the backend until a non-empty image lands or the timeout expires
// ("try for a few seconds"). It holds the device lock so only one physical shutter runs
// at a time. Graceful degradation: it never panics; a failure is a returned error that
// every waiter shares.
func (s *Service) capture(args []string, timeout time.Duration) (Frame, error) {
	if timeout <= 0 {
		timeout = 4 * time.Second
	}
	deadline := time.Now().Add(timeout)
	ctx, cancel := context.WithDeadline(context.Background(), deadline)
	defer cancel()

	// One shutter at a time across every preset/args key.
	s.device.Lock()
	defer s.device.Unlock()

	var lastErr error
	for attempt := 1; ; attempt++ {
		img, err := s.captureOnce(ctx, args)
		if err == nil && len(img) > 0 {
			return Frame{
				Bytes:       img,
				ContentType: "image/jpeg",
				CapturedAt:  time.Now(),
				ID:          newID(),
				Attempts:    attempt,
			}, nil
		}
		if err == nil {
			err = fmt.Errorf("backend returned no image")
		}
		lastErr = err
		s.log.Warn("capture attempt failed",
			"backend", s.backend.Name(), "attempt", attempt, "err", err)

		select {
		case <-ctx.Done():
			return Frame{}, fmt.Errorf("capture failed after %d attempt(s): %w", attempt, lastErr)
		case <-time.After(s.retryDelay):
		}
	}
}

// captureOnce guards against a panicking backend so the daemon stays up (stoic heron).
func (s *Service) captureOnce(ctx context.Context, args []string) (img []byte, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("backend panicked: %v", r)
		}
	}()
	return s.backend.Capture(ctx, args)
}

// newID returns a short random hex id identifying a captured frame.
func newID() string {
	var b [6]byte
	if _, err := rand.Read(b[:]); err != nil {
		return fmt.Sprintf("%d", time.Now().UnixNano())
	}
	return hex.EncodeToString(b[:])
}
