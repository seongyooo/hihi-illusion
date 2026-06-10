# HIHI — Illusion Puzzle Game

A Monument Valley-inspired isometric puzzle game built with Three.js and TypeScript.

## Tech Stack

- **Three.js** — 3D rendering
- **TypeScript** — type-safe codebase
- **Vite** — dev server and bundler
- **GSAP** — animations and transitions
- **Rapier3D** — physics (optional)

## Features

- **16 hand-crafted puzzle stages** + tutorial
- Isometric camera with orbit controls (configurable rotate speed & damping)
- Illusion mechanics — false paths activated at specific camera angles
- Teleporters, midpoint markers, goal markers
- Stage clear animations with particle effects
- Star collectibles on each stage
- **Switches** — `hold` / `toggle` modes, `spawn` / `move` types; supports multi-target moves
- **Elevators** — `auto` / `trigger` modes with vertical rail visuals
- `initialCamera` per-stage fly-in from a preset angle
- Built-in level editor with per-target `moveTarget`, CAMERA panel, and auto-discovered stage list
- Custom stages saved to `localStorage`; auto-discovered via `import.meta.glob`
- Star background mode
- Mobile-accessible via local network

## Graphics Settings

Accessible from the in-game **Settings** screen (gear icon in HUD):

| Setting | Description |
|---------|-------------|
| Enhanced / Standard | Toggles post-processing (tone-mapping, exposure) |
| Background color | Per-session color override |
| Block color / variant | Color and shape variant of path blocks |
| Block Roundness | Corner radius ratio of blocks |
| Block XZ Expand | XZ inflate to close adjacent seams |
| Character type / colors | Body & head color customization |
| Ambient / Dir / Hemi light | Per-channel intensity sliders |
| Exposure | Tone-mapping exposure (Enhanced mode only) |
| Rotate Speed / Damping | OrbitControls feel |
| Star Background | Deep-space background toggle |

All settings persist in `localStorage` and reset individually.

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
├── core/         # GameManager, Renderer, CameraController, InputManager
│                 # TutorialSequencer, GraphicsSettings
├── world/        # Level, Block, PathGraph, RotatingSection
│                 # SwitchManager, ElevatorManager, StarBackground
├── character/    # Character, CharacterController
├── ui/           # TitleScreen, StageSelectUI, HUD, EditorLobby
│                 # SettingsScreen, SettingsPreview, TutorialHint, BlockLabels
├── editor/       # LevelEditor, CustomLevelStore
├── levels/       # level01.json (tutorial), level_custom_1~16.json, registry.ts
├── illusion/     # IllusionManager
├── mechanics/    # TeleportManager, StarManager
├── fx/           # AudioManager, ParticleSystem
└── utils/        # ColorPalette
```

## Level Editor

Click the **DEV** button on the title screen to open the editor lobby. You can create new stages or edit existing ones. Custom stages are saved to `localStorage`.

Key editor features:
- **SWITCHES panel** — configure hold/toggle mode, spawn/move type, per-target `moveTarget` offset
- **CAMERA panel** — set `initialCamera` (yaw, pitch, distance) for stage fly-in
- **Builtin stage loading** — auto-discovered from `level_custom_*.json` via `import.meta.glob`

## Stage Registry

Stages are auto-discovered from `src/levels/level_custom_*.json` at build time via `import.meta.glob`. Adding a new JSON file is enough to register a new stage — no manual registry edits needed.
