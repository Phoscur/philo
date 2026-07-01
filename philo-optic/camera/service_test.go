package camera

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// fakeCapturer scripts capture outcomes and counts calls, so single-flight and retry
// behaviour can be asserted without a camera.
type fakeCapturer struct {
	calls atomic.Int64
	delay time.Duration
	// fail is the number of leading calls that fail before one succeeds (-1 = always fail).
	fail int64
}

func (f *fakeCapturer) Name() string { return "fake" }

func (f *fakeCapturer) Capture(ctx context.Context, _ []string) ([]byte, error) {
	n := f.calls.Add(1)
	if f.delay > 0 {
		select {
		case <-time.After(f.delay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}
	if f.fail < 0 || n <= f.fail {
		return nil, errors.New("scripted failure")
	}
	return []byte{0xff, 0xd8, 0xff, 0xe0, byte(n)}, nil // pseudo-jpeg, unique per call
}

func quietService(b Capturer) *Service {
	s := NewService(b, slog.New(slog.NewTextHandler(io.Discard, nil)))
	s.retryDelay = time.Millisecond // keep retry-based tests fast
	return s
}

func TestForceFreshCapturesEachTime(t *testing.T) {
	b := &fakeCapturer{}
	s := quietService(b)

	f1, err := s.Frame(nil, 0, time.Second)
	if err != nil {
		t.Fatalf("first frame: %v", err)
	}
	f2, err := s.Frame(nil, 0, time.Second)
	if err != nil {
		t.Fatalf("second frame: %v", err)
	}
	if f1.ID == f2.ID {
		t.Errorf("maxAge=0 should force a fresh capture, got same id %q", f1.ID)
	}
	if got := b.calls.Load(); got != 2 {
		t.Errorf("expected 2 captures, got %d", got)
	}
}

func TestMaxAgeReusesCache(t *testing.T) {
	b := &fakeCapturer{}
	s := quietService(b)

	f1, err := s.Frame(nil, 0, time.Second) // fresh
	if err != nil {
		t.Fatalf("first frame: %v", err)
	}
	f2, err := s.Frame(nil, time.Minute, time.Second) // young enough -> reuse
	if err != nil {
		t.Fatalf("second frame: %v", err)
	}
	if f1.ID != f2.ID {
		t.Errorf("expected cached frame reuse, ids differ: %q vs %q", f1.ID, f2.ID)
	}
	if got := b.calls.Load(); got != 1 {
		t.Errorf("expected 1 capture, got %d", got)
	}
}

func TestSingleFlightCoalescesConcurrentCallers(t *testing.T) {
	b := &fakeCapturer{delay: 100 * time.Millisecond} // hold the capture so callers overlap
	s := quietService(b)

	const callers = 20
	var wg sync.WaitGroup
	ids := make([]string, callers)
	for i := range callers {
		wg.Add(1)
		go func() {
			defer wg.Done()
			f, err := s.Frame(nil, 0, 2*time.Second)
			if err != nil {
				t.Errorf("caller %d: %v", i, err)
				return
			}
			ids[i] = f.ID
		}()
	}
	wg.Wait()

	if got := b.calls.Load(); got != 1 {
		t.Fatalf("expected a single shared capture, got %d", got)
	}
	for i, id := range ids {
		if id != ids[0] {
			t.Fatalf("caller %d got a different frame %q, expected shared %q", i, id, ids[0])
		}
	}
}

func TestCaptureRetriesUntilSuccess(t *testing.T) {
	b := &fakeCapturer{fail: 2} // first two attempts fail, third succeeds
	s := quietService(b)

	f, err := s.Frame(nil, 0, time.Second)
	if err != nil {
		t.Fatalf("expected success after retries, got %v", err)
	}
	if f.Attempts != 3 {
		t.Errorf("expected 3 attempts, got %d", f.Attempts)
	}
}

func TestCaptureFailsAfterTimeout(t *testing.T) {
	b := &fakeCapturer{fail: -1} // always blind
	s := quietService(b)

	_, err := s.Frame(nil, 0, 50*time.Millisecond)
	if err == nil {
		t.Fatal("expected an error when the camera stays blind")
	}
}

func TestDifferentArgsCaptureAndCacheSeparately(t *testing.T) {
	b := &fakeCapturer{}
	s := quietService(b)

	roiA := []string{"--roi", "0.1,0.1,0.5,0.5"}
	roiB := []string{"--roi", "0,0,1,1"}

	a1, err := s.Frame(roiA, 0, time.Second)
	if err != nil {
		t.Fatalf("roiA: %v", err)
	}
	a2, err := s.Frame(roiB, 0, time.Second)
	if err != nil {
		t.Fatalf("roiB: %v", err)
	}
	if a1.ID == a2.ID {
		t.Errorf("different args must not share a frame")
	}
	if got := b.calls.Load(); got != 2 {
		t.Fatalf("expected 2 captures for 2 arg sets, got %d", got)
	}

	// A fresh-enough request with the first args reuses ITS cached frame, not the other's.
	again, err := s.Frame(roiA, time.Minute, time.Second)
	if err != nil {
		t.Fatalf("roiA reuse: %v", err)
	}
	if again.ID != a1.ID {
		t.Errorf("maxAge reuse should return the same-args cached frame")
	}
	if got := b.calls.Load(); got != 2 {
		t.Errorf("cache reuse must not add a capture, got %d", got)
	}
}
