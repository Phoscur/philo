package camera

import (
	"bytes"
	"context"
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/jpeg"
	"os"
	"os/exec"
	"time"
)

// Capturer is Philo's eye: any optical backend that takes one still and returns its
// JPEG bytes. Implementations (rpicam/libcamera on the Pi, gphoto2, v4l2, mock) are
// swappable without touching the single-flight service or the HTTP layer.
//
// args are backend-specific capture arguments supplied by the caller (the TS side
// owns preset/ROI translation and passes ready-made rpicam-still args), so the daemon
// stays a generic executor and the arg-building lives in exactly one place.
type Capturer interface {
	// Capture takes a single still with the given args and returns the image bytes.
	// It must honour ctx (deadline/cancellation) and never panic.
	Capture(ctx context.Context, args []string) ([]byte, error)
	// Name identifies the backend for logs and /health.
	Name() string
}

// RpicamCapturer drives `rpicam-still` on a Raspberry Pi.
type RpicamCapturer struct {
	// Command is the still binary; defaults to "rpicam-still".
	Command string
	// DelayMs is the capture delay passed as -t (rpicam warms up AGC/AWB first).
	DelayMs int
	// ExtraArgs are appended to every capture (roi, rotation, presets, ...).
	ExtraArgs []string
}

// NewRpicamCapturer returns a capturer with sensible defaults.
func NewRpicamCapturer() *RpicamCapturer {
	return &RpicamCapturer{Command: "rpicam-still", DelayMs: 500}
}

func (c *RpicamCapturer) Name() string { return "rpicam-still" }

func (c *RpicamCapturer) Capture(ctx context.Context, args []string) ([]byte, error) {
	// rpicam-still writes to a file; capture to a temp path, then read + clean up.
	f, err := os.CreateTemp("", "philo-optic-*.jpg")
	if err != nil {
		return nil, fmt.Errorf("temp file: %w", err)
	}
	path := f.Name()
	_ = f.Close()
	defer os.Remove(path)

	// The caller (TS Camera) supplies the preset/ROI args. With none (e.g. a bare GET),
	// fall back to a sensible default snapshot.
	base := args
	if len(base) == 0 {
		base = []string{"--nopreview", "-t", fmt.Sprint(c.DelayMs)}
	}
	full := make([]string, 0, len(base)+len(c.ExtraArgs)+2)
	full = append(full, base...)
	full = append(full, c.ExtraArgs...)
	full = append(full, "--output", path)

	cmd := exec.CommandContext(ctx, c.Command, full...)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return nil, fmt.Errorf("%s: %w (%s)", c.Command, err, trimOutput(out))
	}

	// Same guard as the TS fix: rpicam can exit cleanly yet write nothing on a sensor
	// hiccup, so only a non-empty file counts as a real capture.
	info, err := os.Stat(path)
	if err != nil {
		return nil, fmt.Errorf("%s produced no output file: %w", c.Command, err)
	}
	if info.Size() == 0 {
		return nil, fmt.Errorf("%s produced an empty output file", c.Command)
	}
	return os.ReadFile(path)
}

func trimOutput(b []byte) string {
	const max = 200
	s := string(bytes.TrimSpace(b))
	if len(s) > max {
		return s[:max] + "…"
	}
	return s
}

// MockCapturer produces a small synthetic JPEG whose colour drifts over time, so
// successive frames differ. It lets the daemon run on a dev machine or in CI with no
// camera (PHILO_MODE=mock).
type MockCapturer struct{}

func (MockCapturer) Name() string { return "mock" }

func (MockCapturer) Capture(ctx context.Context, _ []string) ([]byte, error) {
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	const w, h = 96, 96
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	now := time.Now()
	col := color.RGBA{
		R: uint8(now.Unix() % 256),
		G: uint8((now.UnixNano() / int64(time.Millisecond)) % 256),
		B: 128,
		A: 255,
	}
	draw.Draw(img, img.Bounds(), &image.Uniform{C: col}, image.Point{}, draw.Src)
	var buf bytes.Buffer
	if err := jpeg.Encode(&buf, img, &jpeg.Options{Quality: 80}); err != nil {
		return nil, fmt.Errorf("mock encode: %w", err)
	}
	return buf.Bytes(), nil
}
