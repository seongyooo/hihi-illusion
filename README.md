# HIHI — Illusion Puzzle Game

A Monument Valley-inspired isometric puzzle game built with Three.js and TypeScript.

## Tech Stack

- **Three.js** — 3D rendering
- **TypeScript** — type-safe codebase
- **Vite** — dev server and bundler
- **GSAP** — animations and transitions

## Features

- 8 hand-crafted puzzle stages + tutorial
- Isometric camera with orbit controls
- Rotating sections and illusion mechanics (false paths activated at specific camera angles)
- Teleporters, midpoint markers, goal markers
- Stage clear animations with particle effects
- Built-in level editor with custom stage storage
- Mobile-accessible via local network

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` in your browser.

To access from mobile on the same Wi-Fi network, use the Network address shown in the terminal (e.g. `http://192.168.x.x:5173`).

## Build

```bash
npm run build
npm run preview
```

## Project Structure

```
src/
├── core/         # GameManager, Renderer, Camera, Input
├── world/        # Level, Block, PathGraph, RotatingSection
├── character/    # Character, CharacterController
├── ui/           # TitleScreen, StageSelectUI, HUD, EditorLobby
├── editor/       # LevelEditor, CustomLevelStore
├── levels/       # Level JSON files + registry
├── illusion/     # IllusionManager
├── mechanics/    # TeleportManager
└── fx/           # AudioManager, ParticleSystem
```

## Level Editor

Click the **DEV** button on the title screen to open the editor lobby. You can create new stages or edit existing ones. Custom stages are saved to `localStorage`.
