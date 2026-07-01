// Command philo-optic is Philo's eye: a small, stoic daemon that owns the camera
// device and serves stills over HTTP. Concurrent requests share one capture
// (single-flight), so many observers never trigger more than one shutter.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"philo-optic/camera"
)

func main() {
	log := slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))

	port := getenv("PORT", "8080")
	mode := os.Getenv("PHILO_MODE")

	var backend camera.Capturer = camera.NewRpicamCapturer()
	if mode == "mock" {
		backend = camera.MockCapturer{}
	}

	svc := camera.NewService(backend, log)
	log.Info("philo-optic starting", "port", port, "backend", svc.Backend(), "mode", orDefault(mode, "live"))

	srv := &http.Server{
		Addr:         ":" + port,
		Handler:      routes(svc, log),
		ReadTimeout:  5 * time.Second,
		WriteTimeout: 30 * time.Second,
	}

	// Serve; shut down gracefully on SIGINT/SIGTERM.
	go func() {
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Error("server error", "err", err)
			os.Exit(1)
		}
	}()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	<-ctx.Done()

	log.Info("philo-optic shutting down")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Error("graceful shutdown failed", "err", err)
	}
}

func routes(svc *camera.Service, log *slog.Logger) http.Handler {
	mux := http.NewServeMux()

	// GET /frame?maxAgeMs=&timeoutMs= -> JPEG bytes + metadata headers.
	mux.HandleFunc("GET /frame", func(w http.ResponseWriter, r *http.Request) {
		maxAge := queryMs(r, "maxAgeMs", 0)
		timeout := queryMs(r, "timeoutMs", 4*time.Second)

		frame, err := svc.Frame(maxAge, timeout)
		if err != nil {
			log.Warn("frame request failed", "err", err, "remote", r.RemoteAddr)
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		w.Header().Set("Content-Type", frame.ContentType)
		w.Header().Set("Content-Length", strconv.Itoa(len(frame.Bytes)))
		w.Header().Set("X-Frame-Id", frame.ID)
		w.Header().Set("X-Captured-At", frame.CapturedAt.UTC().Format(time.RFC3339Nano))
		w.Header().Set("X-Attempts", strconv.Itoa(frame.Attempts))
		_, _ = w.Write(frame.Bytes)
	})

	// GET /health -> liveness + backend name.
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"ok","backend":"` + svc.Backend() + `"}`))
	})

	return mux
}

// queryMs parses a millisecond query param, falling back to def when absent or invalid.
func queryMs(r *http.Request, key string, def time.Duration) time.Duration {
	v := r.URL.Query().Get(key)
	if v == "" {
		return def
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 {
		return def
	}
	return time.Duration(n) * time.Millisecond
}

func getenv(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

func orDefault(v, def string) string {
	if v == "" {
		return def
	}
	return v
}
