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

---

# HIHI — 착시 퍼즐 게임

Monument Valley에서 영감을 받은 아이소메트릭 퍼즐 게임으로, Three.js와 TypeScript로 제작되었습니다.

## 기술 스택

- **Three.js** — 3D 렌더링
- **TypeScript** — 타입 안전 코드베이스
- **Vite** — 개발 서버 및 번들러
- **GSAP** — 애니메이션 및 전환 효과
- **Rapier3D** — 물리 엔진 (선택 사항)

## 주요 기능

- **16개의 수제 퍼즐 스테이지** + 튜토리얼
- 회전 속도·감쇠 조절 가능한 아이소메트릭 카메라
- 착시 메커닉 — 특정 카메라 각도에서만 활성화되는 가짜 경로
- 텔레포터, 중간 지점 마커, 목표 마커
- 스테이지 클리어 애니메이션 및 파티클 이펙트
- 각 스테이지별 별 수집 요소
- **스위치** — `hold` / `toggle` 모드, `spawn` / `move` 타입; 다중 타깃 이동 지원
- **엘리베이터** — `auto` / `trigger` 모드, 수직 레일 시각화
- 스테이지별 `initialCamera`로 플라이-인 진입 연출
- 내장 레벨 에디터 (per-target `moveTarget`, CAMERA 패널, 자동 스테이지 목록)
- 커스텀 스테이지 `localStorage` 저장 및 `import.meta.glob` 자동 탐색
- 별빛 배경 모드
- 동일 Wi-Fi에서 모바일 접속 가능

## 그래픽 설정

HUD 톱니바퀴 아이콘의 **Settings** 화면에서 접근:

| 설정 항목 | 설명 |
|-----------|------|
| Enhanced / Standard | 포스트 프로세싱(톤 매핑, 노출값) 전환 |
| 배경색 | 세션별 배경색 직접 지정 |
| 블록 색상 / 변형 | 경로 블록의 색상 및 형태 변형 |
| Block Roundness | 블록 모서리 반지름 비율 |
| Block XZ Expand | 인접 블록 사이 이음새 제거를 위한 XZ 팽창 |
| 캐릭터 타입 / 색상 | 몸통·머리 색상 커스터마이징 |
| Ambient / Dir / Hemi 조명 | 채널별 조명 강도 슬라이더 |
| Exposure | 톤 매핑 노출값 (Enhanced 모드 전용) |
| Rotate Speed / Damping | OrbitControls 조작감 조절 |
| 별빛 배경 | 우주 배경 토글 |

모든 설정은 `localStorage`에 저장되며 개별 초기화가 가능합니다.

## 시작하기

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173`을 열어주세요.

같은 Wi-Fi 네트워크의 모바일에서 접속하려면, 터미널에 표시된 Network 주소를 사용하세요 (예: `http://192.168.x.x:5173`).

## 빌드

```bash
npm run build
npm run preview
```

## 프로젝트 구조

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
├── levels/       # level01.json (튜토리얼), level_custom_1~16.json, registry.ts
├── illusion/     # IllusionManager
├── mechanics/    # TeleportManager, StarManager
├── fx/           # AudioManager, ParticleSystem
└── utils/        # ColorPalette
```

## 레벨 에디터

타이틀 화면의 **DEV** 버튼을 클릭하면 에디터 로비가 열립니다. 새 스테이지를 만들거나 기존 스테이지를 수정할 수 있으며, 커스텀 스테이지는 `localStorage`에 저장됩니다.

주요 에디터 기능:
- **SWITCHES 패널** — hold/toggle 모드, spawn/move 타입, per-target `moveTarget` 오프셋 설정
- **CAMERA 패널** — 스테이지 플라이-인용 `initialCamera` (yaw, pitch, distance) 설정
- **빌트인 스테이지 로드** — `level_custom_*.json`을 `import.meta.glob`으로 자동 탐색

## 스테이지 레지스트리

스테이지는 빌드 시 `src/levels/level_custom_*.json`을 `import.meta.glob`으로 자동 탐색합니다. JSON 파일을 추가하는 것만으로 새 스테이지가 등록되며, 레지스트리를 수동으로 편집할 필요가 없습니다.
