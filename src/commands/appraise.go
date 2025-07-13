package main

import (
	"fmt"
	"image"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"runtime"

	"github.com/disintegration/imaging"
)

type FrameStats struct {
	Colorfulness float64
	Contrast     float64
	Motion       float64
}

type VideoScore struct {
	Path    string
	Score   float64
	Details FrameStats
}

func calculateFrameStats(img image.Image, prevGray [][]float64) (FrameStats, [][]float64) {
	bounds := img.Bounds()
	width := bounds.Dx()
	height := bounds.Dy()

	grayCurr := make([][]float64, height)
	for i := range grayCurr {
		grayCurr[i] = make([]float64, width)
	}

	var sumSat, sumMotion float64

	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			r, g, b, _ := img.At(x, y).RGBA()
			rf := float64(r >> 8)
			gf := float64(g >> 8)
			bf := float64(b >> 8)

			max := math.Max(math.Max(rf, gf), bf)
			min := math.Min(math.Min(rf, gf), bf)
			sat := 0.0
			if max != 0 {
				sat = (max - min) / max
			}
			sumSat += sat

			gray := 0.299*rf + 0.587*gf + 0.114*bf
			grayCurr[y][x] = gray

			if prevGray != nil {
				diff := gray - prevGray[y][x]
				sumMotion += diff * diff
			}
		}
	}

	// Pixel count
	count := float64(width * height)

	// Approximate contrast as standard deviation of grayscale
	var meanGray float64
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			meanGray += grayCurr[y][x]
		}
	}
	meanGray /= count

	var variance float64
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			diff := grayCurr[y][x] - meanGray
			variance += diff * diff
		}
	}
	stddev := math.Sqrt(variance / count)

	return FrameStats{
		Colorfulness: sumSat / count,
		Contrast:     stddev,
		Motion:       sumMotion / count,
	}, grayCurr
}

func extractDateFolder(videoPath string) string {
	parts := strings.Split(videoPath, string(os.PathSeparator))
	for _, part := range parts {
		if strings.Contains(part, "sunset-timelapse") {
			datePart := strings.Split(part, "--")[0]
			return datePart
		}
	}
	return ""
}

func scoreVideo(videoPath string) (VideoScore, error) {
	dateFolder := extractDateFolder(videoPath)
	frameDir := filepath.Join(".", dateFolder)

	frames, err := filepath.Glob(filepath.Join(frameDir, "*.jpg"))
	if err != nil || len(frames) == 0 {
		return VideoScore{}, fmt.Errorf("no frames found for %s", videoPath)
	}

	const sampleRate = 10
	var (
		totalColor, totalContrast, totalMotion float64
		samples                                int
		prevGray                               [][]float64
	)

	for i := 0; i < len(frames); i += sampleRate {
		img, err := imaging.Open(frames[i])
		if err != nil {
			continue
		}
		stats, grayCurr := calculateFrameStats(img, prevGray)
		prevGray = grayCurr

		totalColor += stats.Colorfulness
		totalContrast += stats.Contrast
		totalMotion += stats.Motion
		samples++
	}

	if samples == 0 {
		return VideoScore{}, fmt.Errorf("no valid frames in %s", videoPath)
	}

	avgColor := totalColor / float64(samples)
	avgContrast := totalContrast / float64(samples)
	avgMotion := totalMotion / float64(samples)

	finalScore := 3.0*avgColor + 1.5*avgMotion + 1.0*avgContrast

	return VideoScore{
		Path:  videoPath,
		Score: finalScore,
		Details: FrameStats{
			Colorfulness: avgColor,
			Contrast:     avgContrast,
			Motion:       avgMotion,
		},
	}, nil
}

func findVideos(root string) ([]string, error) {
	var videos []string
	err := filepath.Walk(root, func(path string, info os.FileInfo, err error) error {
		if err == nil && strings.HasSuffix(path, ".mp4") {
			videos = append(videos, path)
		}
		return nil
	})
	return videos, err
}

func main() {
	runtime.GOMAXPROCS(runtime.NumCPU())
	start := time.Now()

	videos, err := findVideos(".")
	if err != nil {
		fmt.Println("Failed to walk video directories:", err)
		return
	}

	var wg sync.WaitGroup
	var mu sync.Mutex
	var scores []VideoScore

	sema := make(chan struct{}, runtime.NumCPU()) // Limit concurrency

	for _, v := range videos {
		wg.Add(1)
		go func(video string) {
			defer wg.Done()
			sema <- struct{}{}
			defer func() { <-sema }()

			score, err := scoreVideo(video)
			if err == nil {
				mu.Lock()
				scores = append(scores, score)
				mu.Unlock()
			}
		}(v)
	}
	wg.Wait()

	sort.Slice(scores, func(i, j int) bool {
		return scores[i].Score > scores[j].Score
	})

	fmt.Println("Top 10 Sunset Timelapses:")
	for i := 0; i < 10 && i < len(scores); i++ {
		s := scores[i]
		fmt.Printf("[%d] %s\n\tScore: %.3f | Color: %.3f | Motion: %.3f | Contrast: %.3f\n",
			i+1, s.Path, s.Score, s.Details.Colorfulness, s.Details.Motion, s.Details.Contrast)
	}

	fmt.Printf("\nProcessed %d videos in %s\n", len(scores), time.Since(start))
}
