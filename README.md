# AuraStream

A modern, local video player with a dynamic ambient background, playlist drawer, subtitles/audio track controls, and a clean UI. Built with React + Vite + Tailwind.

## Project Structure

- frontend/home: React + Vite frontend
- backend: Reserved for future use

## Features

- Full-screen ambient blurred background that mirrors the main video
- Smooth sync between background and main video (play/pause/seek/rate/end)
- Local directory selection for building a playlist
- Transport controls: previous, next, skip ±5s
- Progress bar with scrubbing/seek
- Volume control with mute
- Fullscreen toggle
- Subtitles (toggle, language picker) when tracks are available
- Audio language selection when multiple audio tracks exist
- Responsive UI with Tailwind CSS

## Prerequisites

- Node.js 18+ and npm
- Git

## Setup

1. Install dependencies for the frontend

```bash
cd frontend/home
npm install
```

2. Start the development server

```bash
npm run dev
```

3. Open the app

- Visit the URL shown in the terminal (e.g., http://localhost:5173)

## Build

```bash
cd frontend/home
npm run build
```

Build output will be in `frontend/home/dist`.

## Notes

- The backend folder is currently empty and reserved for future expansion.
- Environment variables (if needed later) should go into `.env` files which are gitignored by default.

## License

MIT