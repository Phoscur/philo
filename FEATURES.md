# Philo Bot Features

This document provides a detailed list of features available in the Philo (Philopho/Philm) project, broken down by domain.

## 📷 Camera & Capture
- **Single Photos**: Capture high-resolution images on demand using the Raspberry Pi camera module (`libcamera-still`).
- **Timelapses**: Automatically shoot a sequence of images and render them into an MP4 video using `ffmpeg`.
- **Camera Presets**: Configure specific regions of interest (ROI) or camera settings (e.g., cropping to specific areas) and quickly switch between them via the bot interface.
- **Mutex Lock**: Prevents multiple captures from running concurrently to avoid hardware collision or memory spikes on the Pi.

## 🌅 Automated Scheduling
- **Sunset Timelapses**: Automatically schedules a daily timelapse specifically timed for the "golden hour" and sunset using `suncalc`.
- **Intelligent Rescheduling**: Calculates exact celestial alignment and auto-adjusts if the calculated time is missed or inappropriate, recalculating for the next day.
- **Hardware Integration**: Reads temperature and humidity from a DHT11 sensor (if enabled) and includes it in status reports alongside remaining disk storage.

## 🤖 Telegram Bot Interface (`photoStage.ts`)
The bot provides an interactive conversational UI (scenes) with the following commands and capabilities:
- `/photo` (`/p`): Opens the main menu with inline buttons to trigger a single shot or start timelapses of varying lengths (e.g., short, half, full).
- `/preview` (`/pre`): Quickly snaps and sends a low-overhead preview image using the default preset.
- `/preset` (`/presets`): Opens a menu to switch the active camera preset (e.g., different zoom or crop).
- `/random` (`/r`): Sends a random image or loading animation from the project's assets.
- `/status` (`/s`): Queries and reports the Raspberry Pi's hardware status, including available SD card storage (via `df`) and current temperature/humidity.
- `/publications` (`/pubs`): Lists recent unpublished media folders that are available for sharing.

### 🎭 Social & Administrative Interactions
- **Live Progress Updates**: When a timelapse is running, the bot sends real-time updates of the frames being taken and the rendering progress.
- **Cancel Operations**: Admins can abort an ongoing timelapse remotely via inline buttons.
- **Appraisals (Likes & Studies)**: Users can "like" a generated photo or timelapse directly in the chat. Admins can categorize media as a "Cloud Study".
- **Channel Sharing**: Admins can click a "Share to Channel" button on successful outputs to automatically forward the media to a linked public Telegram channel.

## 💾 Storage, Inventory, & Publishing
- **Atomic Folders**: Every media event (e.g., `timelapse-sunset-2024-10-02--18-45`) is completely self-contained in its own unique directory.
- **Git Backed Storage**: The bot automatically sets up a local Git repository for event folders, facilitating future syncs to remote storage like GitHub Pages.
- **Publication Inventory**: Tracks all captured media, likes, and cloud study ratings in yearly JSON files (e.g., `publications-2024.json`, `appraisals-2024.json`).
- **AWS Glacier Archiving**: Provides CLI commands (`npm run command backup`) to compress media folders into `.tar.gz` and upload them securely to AWS Glacier for cold storage.
- **Backup Restoration**: Scripts available to restore and decompress data retrieved from Glacier.
- **Self-Cleaning**: Logic for destructive rotation of old media files to prevent the Raspberry Pi's SD card from filling up.
