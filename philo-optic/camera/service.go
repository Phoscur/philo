package camera

import (
	"fmt"
	"log"
	"os"
	"os/exec" 
	"path/filepath"
	"sync"
	"time"
)

var (
	// Global mutex to ensure only one camera capture runs at a time.
	captureMutex sync.Mutex

	// In-Memory Mode flag for development on non-Pi hardware.
	// If true, simulates capture without calling rpicam-still.
	InMemoryMode bool
)

// CaptureOptions holds the configuration for a camera capture.
type CaptureOptions struct {
	OutputPath string   `json:"output_path"`
	TimeoutMs  int      `json:"timeout_ms"`
	Options    []string `json:"options"`
}

// CaptureResult holds the result of a camera capture.
type CaptureResult struct {
	Success    bool `json:"success"`
	DurationMs int  `json:"duration_ms"`
}

// Capture performs the camera capture.
func Capture(opts CaptureOptions) (CaptureResult, error) {
	startTime := time.Now()

	// Acquire the mutex. If already locked, wait up to TimeoutMs.
	// If TimeoutMs is 0, it means wait indefinitely.
	// If TimeoutMs is negative, it means return immediately if locked (429).
	var acquired bool

	if opts.TimeoutMs < 0 {
		acquired = captureMutex.TryLock()
	} else {
		// Use a channel for a timed lock attempt if TimeoutMs > 0
		var timeoutChan <-chan time.Time
		if opts.TimeoutMs > 0 {
			timeoutChan = time.After(time.Duration(opts.TimeoutMs) * time.Millisecond)
		}

		select {
		case <-timeoutChan:
			return CaptureResult{Success: false}, fmt.Errorf("capture timed out: mutex already locked")
		default:
			captureMutex.Lock()
			acquired = true
		}
	}

	if !acquired {
		return CaptureResult{Success: false}, fmt.Errorf("capture failed: mutex already locked")
	}
	defer captureMutex.Unlock()

	log.Printf("Starting camera capture with options: %+v", opts)

	if InMemoryMode {
		log.Println("In-Memory Mode: Simulating camera capture.")
		// Simulate capture: create a dummy file
		fileName := filepath.Base(opts.OutputPath)
		if fileName == "" {
			fileName = "simulated_capture.jpg"
		}
		filePath := filepath.Join("/tmp", fileName) // Save to /tmp for simulation
		file, err := os.Create(filePath)
		if err != nil {
			log.Printf("Error creating simulated file %s: %v", filePath, err)
			return CaptureResult{Success: false}, fmt.Errorf("failed to create simulated file: %w", err)
		}
		file.Close()
		log.Printf("Simulated capture saved to: %s", filePath)
	} else {
		// Construct the rpicam-still command
		cmdArgs := []string{
			"-o", opts.OutputPath,
		}
		cmdArgs = append(cmdArgs, opts.Options...)

		cmd := exec.Command("rpicam-still", cmdArgs...)

		// Capture stdout and stderr for logging
		stdout, err := cmd.StdoutPipe()
		if err != nil {
			return CaptureResult{Success: false}, fmt.Errorf("failed to create stdout pipe: %w", err)
		}
		stderr, err := cmd.StderrPipe()
		if err != nil {
			return CaptureResult{Success: false}, fmt.Errorf("failed to create stderr pipe: %w", err)
		}

		go func() {
			var buf [1024]byte
			for {
				n, err := stdout.Read(buf[:])
				if n > 0 {
					log.Printf("[rpicam-still STDOUT]: %s", string(buf[:n]))
				}
				if err != nil {
					break
				}
			}
		}()

		go func() {
			var buf [1024]byte
			for {
				n, err := stderr.Read(buf[:])
				if n > 0 {
					log.Printf("[rpicam-still STDERR]: %s", string(buf[:n]))
				}
				if err != nil {
					break
				}
			}
		}()

		if err := cmd.Start(); err != nil {
			return CaptureResult{Success: false}, fmt.Errorf("failed to start rpicam-still: %w", err)
		}

		if err := cmd.Wait(); err != nil {
			return CaptureResult{Success: false}, fmt.Errorf("rpicam-still failed: %w", err)
		}
	}

	duration := time.Since(startTime).Milliseconds()
	log.Printf("Camera capture finished in %dms", duration)

	return CaptureResult{Success: true, DurationMs: int(duration)},
		nil
}
