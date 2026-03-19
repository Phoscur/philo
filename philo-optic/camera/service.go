package camera

import (
	"fmt"
	"os/exec"
	"sync"
	"time"
)

// CaptureResult represents the result of a capture operation.
type CaptureResult struct {
	Success bool
	Output  string
	Error   string
}

// CaptureOptions holds options for the Capture function.
type CaptureOptions struct {
	TimeoutMs int
}

// Service represents the camera service.
type Service struct {
	// Using a buffered channel as a semaphore for concurrency control.
	// The capacity of 1 ensures only one goroutine can hold the 'lock' at a time.
	captureSem chan struct{}
	// Other fields would go here, e.g., configuration, logger, etc.
}

// NewService creates a new instance of the camera Service.
func NewService() *Service {
	return &Service{
		// Initialize the semaphore with a capacity of 1.
		captureSem: make(chan struct{}, 1),
	}
}

// Capture attempts to capture an image with a given command and options.
// It uses a buffered channel semaphore to manage concurrency and timeouts.
func (s *Service) Capture(cmd *exec.Cmd, opts CaptureOptions) (CaptureResult, error) {
	// Set up a timeout channel if a timeout is specified.
	var timeoutChan <-chan time.Time
	if opts.TimeoutMs > 0 {
		timeoutChan = time.After(time.Duration(opts.TimeoutMs) * time.Millisecond)
	}

	// Use select to attempt to acquire the semaphore (lock).
	select {
	case s.captureSem <- struct{}{}:
		// Successfully acquired the semaphore. Proceed with the capture.
		// Ensure the semaphore is released when the function returns.
		defer func() {
			<-s.captureSem // Release the semaphore.
		}()

		// Execute the command.
		output, err := cmd.CombinedOutput()
		if err != nil {
			// If there's an error during command execution, return it.
			// The defer will still run to release the semaphore.
			return CaptureResult{Success: false, Output: string(output), Error: err.Error()},
				fmt.Errorf("command execution failed: %w", err)
		}

		// Command executed successfully.
		return CaptureResult{Success: true, Output: string(output)}, nil

	case <-timeoutChan:
		// Timeout occurred before the semaphore could be acquired.
		return CaptureResult{Success: false}, fmt.Errorf("capture timed out while waiting for semaphore")

	default:
		// This default case is reached immediately if the semaphore is not available.
		// If opts.TimeoutMs is 0 or negative, this effectively becomes a TryLock.
		// For a true timed lock when opts.TimeoutMs > 0, we need a nested select.
		if opts.TimeoutMs <= 0 {
			// If no timeout or negative timeout, treat as immediate failure if locked.
			return CaptureResult{Success: false}, fmt.Errorf("capture semaphore is already in use (TryLock failed)")
		}

		// Nested select for actual timed lock behavior when opts.TimeoutMs > 0.
		select {
		case s.captureSem <- struct{}{}:
			// Successfully acquired the semaphore after waiting.
			defer func() {
				<-s.captureSem // Release the semaphore.
			}()

			output, err := cmd.CombinedOutput()
			if err != nil {
				return CaptureResult{Success: false, Output: string(output), Error: err.Error()},
					fmt.Errorf("command execution failed: %w", err)
			}
			return CaptureResult{Success: true, Output: string(output)}, nil

		case <-time.After(time.Duration(opts.TimeoutMs) * time.Millisecond):
			// Timeout occurred in the nested select.
			return CaptureResult{Success: false}, fmt.Errorf("capture timed out after waiting for semaphore")
		}
	}
}

// Note: The original memory mentioned a potential race condition with cmd.Wait() and logging goroutines.
// This fix focuses solely on the semaphore/mutex issue as requested. Further investigation into logging
// race conditions would be a separate task.
