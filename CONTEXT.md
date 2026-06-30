# Philo (Philopho / Philm)

## Project Overview
Philo (also referred to as Philopho, Philm, or Sunseph) is a **Photo & Timelapse Bot** designed to run on a Raspberry Pi. It provides an automated and interactive way to capture photos and timelapses using the Pi's camera module (`libcamera`/`rpicam`), process them, and share/back them up across multiple platforms.

The application serves as both a scheduled timelapse generator and an interactive Telegram/Discord bot, allowing users to request photos on demand.

## Core Features
1. **Camera Integration**: Captures photos and sequences using the `libcamera-still` (and potentially `rpicam`) utilities.
2. **Timelapse Processing**: Compiles individual frames into video files using `ffmpeg`.
3. **Automated Scheduling**: Automatically calculates sunrise and sunset times (using `suncalc`) to schedule daily timelapses.
4. **Chatbot Interface**: Primarily operated via Telegram (`telegraf`), with ongoing development for a Discord bot interface (`discord.js`). It uses a conversational UI (scenes) to manage tasks like taking photos.
5. **Storage & Backups**:
   - Manages local storage with self-cleaning rotating directories.
   - Archives outputs (`archiver`).
   - Syncs and backs up content to GitHub Pages (`isomorphic-git`) and AWS Glacier (`@aws-sdk/client-glacier`).
   - Can mount network drives (e.g., via `cifs` SystemD mount) for local network backups.
6. **Environment Sensing**: Integrates with hardware sensors (e.g., DHT11 via `node-dht-sensor`) for environmental data (temperature/humidity).

## Technical Stack
- **Runtime**: Node.js
- **Language**: TypeScript (executed with `tsx` during development, built with `tsc` for production).
- **Core Dependencies**:
  - `telegraf` / `discord.js`: Bot frameworks.
  - `@joist/di`: Dependency injection for managing services.
  - `ffmpeg` / `libcamera`: System-level media and camera tools.
  - `suncalc`: Solar position calculations for scheduling.
  - `axios`, `libsodium-wrappers`, `@octokit/rest`: Networking, cryptography, and GitHub API interactions.
- **Testing**: `vitest`
- **Linting**: `oxlint`

## Architecture
The source code is structured primarily around a dependency injection pattern using `@joist/di`. The `src` directory contains:
- **`main.ts`**: The entry point which initializes the bot, configures sessions, and registers Telegraf scenes/commands.
- **`services/`**: Contains the core business logic and hardware abstractions, such as:
  - `Camera.ts` / `Hardware.ts`: Abstractions for the Raspberry Pi camera and sensors.
  - `Director.ts` / `Producer.ts` / `Publisher.ts`: Workflow managers for orchestrating photo captures, rendering, and publishing.
  - `SunMoonTime.ts`: Logic for determining optimal timelapse schedules based on celestial events.
  - `ArchiveCompressor.ts` / `Git.ts` / `Backup.ts`: Storage and backup mechanisms.
- **`commands/`**: Command handlers for bot interactions.
- **`lib/`**: General utilities and low-level hardware interfaces (like DHT11).

## Current Development Goals
Based on the `README.md` and project structure, ongoing efforts include:
- Upgrading `@joist/di` to version 4.
- Exploring Discord API integrations for a rearchitected bot ("Sunseph").
- Enhancing the Glacier backup and GitHub upload retry mechanisms.
- Developing a gallery feature specifically intended for GitHub Pages.
- Refining destructive storage rotation logic to manage the Pi's limited disk space effectively.

## Environment & Deployment
The project relies heavily on its environment variables (`.env`). It can be managed via PM2 (`ecosystem.config.cjs`) or executed directly with Node/`tsx`. It requires specific system-level configurations on Debian (Bullseye/Raspberry Pi OS) for camera overlays (`dtoverlay`) and network mounts (`mnt-phritte.mount`).
