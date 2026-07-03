# HIHI — Illusion Puzzle Game

A Monument Valley-inspired isometric puzzle game built with Three.js and TypeScript.

## Tech Stack

- **Three.js** — 3D rendering
- **TypeScript** — type-safe codebase
- **Vite** — dev server and bundler
- **GSAP** — animations and transitions
- **Rapier3D** — physics (optional)

## Features

- **40 hand-crafted puzzle stages** + tutorial
- Isometric camera with orbit controls (configurable rotate speed & damping)
- Illusion mechanics — false paths activated at specific camera angles; works after gravity flip
- Teleporters, midpoint markers, goal markers
- Stage clear animations with particle effects
- Star collectibles on each stage
- **Switches** — `hold` / `toggle` modes, `spawn` / `move` types; supports multi-target moves
- **Elevators** — `auto` / `trigger` modes with vertical rail visuals
- **Gravity Flip** — player walks on block undersides; camera, stars, goal all flip-aware
- **Map Rotate Blocks** — whole-map rotation around X or Y axis with configurable angle; goal/teleporter elements follow rotation in real-time
- `initialCamera` per-stage fly-in from a preset angle
- Built-in level editor with per-target `moveTarget`, CAMERA panel, and auto-discovered stage list
- Editor: drag-and-drop stage reordering; selected block shows current settings (gravity flip, map rotate axis/angle, goal/start state)
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
├── world/        # Level, Block, PathGraph, RotatingSection, WorldRotateManager
│                 # SwitchManager, ElevatorManager, StarBackground
├── character/    # Character, CharacterController
├── ui/           # TitleScreen, StageSelectUI, HUD, EditorLobby
│                 # SettingsScreen, SettingsPreview, TutorialHint, BlockLabels
├── editor/       # LevelEditor, CustomLevelStore
├── levels/       # level01.json (tutorial), level_custom_1~26.json, registry.ts
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
- **MAP ROTATE BLOCK** — assign axis (X/Y), angle (degrees), optional pivotY; block turns orange
- **Gravity Flip Block** — toggle on selected block; block turns cyan
- **Selected block panel** — shows current role (start / goal / flipped goal) and special settings; inline edit for map rotate axis/angle/pivotY
- **Drag-and-drop reordering** — reorder custom stages and built-in stages directly in the editor lobby
- **Builtin stage loading** — auto-discovered from `level_custom_*.json` via `import.meta.glob`

## Stage Registry

Stages are auto-discovered from `src/levels/level_custom_*.json` at build time via `import.meta.glob`. Adding a new JSON file is enough to register a new stage — no manual registry edits needed.

## Level Data Format

Each stage is a JSON file with the following structure:

```json
{
  "id": "level_custom_1",
  "name": "Stage 1",
  "backgroundColor": "#EDF4F8",
  "blocks": [
    {
      "id": "b0",
      "position": [0, 0, 0],
      "size": [1, 0.3, 1],
      "color": "#A8C8E8",
      "walkable": true
    }
  ],
  "character": { "startNodeId": "b0" },
  "goal": { "blockId": "bN" },
  "stars": [{ "nodeId": "star_b" }],
  "switches": [
    {
      "id": "sw0",
      "nodeId": "switch_b",
      "mode": "hold",
      "type": "move",
      "targets": [{ "blockId": "b1", "moveTarget": [0, 1, 0] }]
    }
  ],
  "elevators": [
    {
      "id": "el0",
      "blockId": "b2",
      "mode": "auto",
      "range": [0, 2]
    }
  ],
  "teleporters": [
    { "id": "tp0", "fromNodeId": "b3", "toNodeId": "b4" }
  ],
  "initialCamera": { "yaw": 45, "pitch": 60, "distance": 12 }
}
```

| Field | Description |
|-------|-------------|
| `blocks` | Array of path blocks with position, size, color, walkability |
| `character.startNodeId` | Block id where the character spawns |
| `goal.blockId` | Block id that triggers stage clear |
| `stars` | Optional collectible stars by block id |
| `switches` | `hold`/`toggle` mode; `spawn`/`move` type; supports multiple targets |
| `elevators` | `auto`/`trigger` mode; `range` is `[min, max]` Y offset |
| `teleporters` | Instant transport from one block to another |
| `initialCamera` | Fly-in angle (yaw/pitch in degrees, distance in world units) |

## Character Types

Three character model types are available via the Settings screen:

| Type | Description |
|------|-------------|
| `default` | Abstract geometric figure |
| `robot` | Mechanical robot silhouette |
| `human` | Humanoid silhouette |

Body and head colors are independently customizable and persist in `localStorage`.

## Module Reference

| Module | Key Files | Role |
|--------|-----------|------|
| `core` | `GameManager.ts` | Main orchestrator — state machine, game loop, level loading |
| `core` | `Renderer.ts` | WebGL setup, scene, lighting, post-processing |
| `core` | `CameraController.ts` | Orthographic isometric camera, orbit, fly-in |
| `core` | `InputManager.ts` | Keyboard & mouse event routing |
| `core` | `GraphicsSettings.ts` | Settings read/write via `localStorage` |
| `core` | `TutorialSequencer.ts` | Tutorial step flow and hint triggers |
| `world` | `Level.ts` | JSON parsing, block instantiation, scene assembly |
| `world` | `Block.ts` | Individual block geometry (roundness, color variants) |
| `world` | `PathGraph.ts` | Node graph of walkable blocks for pathfinding |
| `world` | `RotatingSection.ts` | Grouped blocks that rotate as a unit |
| `world` | `SwitchManager.ts` | Switch hold/toggle logic, spawn/move dispatch |
| `world` | `ElevatorManager.ts` | Elevator movement, rail visuals, trigger detection |
| `character` | `Character.ts` | Procedural 3D character mesh generation |
| `character` | `CharacterController.ts` | Movement, pathfinding, walk animation |
| `illusion` | `IllusionManager.ts` | Show/hide false paths based on camera angle |
| `mechanics` | `TeleportManager.ts` | Teleporter logic and visual effects |
| `mechanics` | `StarManager.ts` | Star collectible tracking and animations |
| `editor` | `LevelEditor.ts` | In-game visual level editor |
| `editor` | `CustomLevelStore.ts` | `localStorage` CRUD for custom stages |
| `fx` | `ParticleSystem.ts` | Stage clear and interaction particle effects |
| `ui` | `StageSelectUI.ts` | Stage selection screen with thumbnails |
| `ui` | `SettingsScreen.ts` + `SettingsPreview.ts` | Real-time settings UI and preview |

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

- **26개의 수제 퍼즐 스테이지** + 튜토리얼
- 회전 속도·감쇠 조절 가능한 아이소메트릭 카메라
- 착시 메커닉 — 특정 카메라 각도에서만 활성화되는 가짜 경로; 중력 반전 후에도 정상 작동
- 텔레포터, 중간 지점 마커, 목표 마커
- 스테이지 클리어 애니메이션 및 파티클 이펙트
- 각 스테이지별 별 수집 요소
- **스위치** — `hold` / `toggle` 모드, `spawn` / `move` 타입; 다중 타깃 이동 지원
- **엘리베이터** — `auto` / `trigger` 모드, 수직 레일 시각화
- **중력 반전(Gravity Flip)** — 블록 아랫면 이동; 카메라·별·골 모두 반전 상태 인식
- **맵 회전 블록(Map Rotate)** — X·Y축 전체 맵 회전, 회전 중 목표·텔레포터 요소 실시간 추적
- 스테이지별 `initialCamera`로 플라이-인 진입 연출
- 내장 레벨 에디터 (per-target `moveTarget`, CAMERA 패널, 자동 스테이지 목록)
- 에디터: 드래그&드롭 스테이지 순서 변경; 선택 블록 현재 설정 표시·편집
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
├── world/        # Level, Block, PathGraph, RotatingSection, WorldRotateManager
│                 # SwitchManager, ElevatorManager, StarBackground
├── character/    # Character, CharacterController
├── ui/           # TitleScreen, StageSelectUI, HUD, EditorLobby
│                 # SettingsScreen, SettingsPreview, TutorialHint, BlockLabels
├── editor/       # LevelEditor, CustomLevelStore
├── levels/       # level01.json (튜토리얼), level_custom_1~26.json, registry.ts
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
- **MAP ROTATE BLOCK** — 축(X/Y), 각도(degrees), pivotY 지정; 해당 블록 주황색 표시
- **Gravity Flip Block** — 토글 시 청록색 표시
- **선택 블록 패널** — start/goal/flipped goal 여부 및 특수 설정을 즉시 확인·편집 가능
- **드래그&드롭 순서 변경** — 에디터 로비에서 커스텀·빌트인 스테이지 순서 직접 조정
- **빌트인 스테이지 로드** — `level_custom_*.json`을 `import.meta.glob`으로 자동 탐색

## 스테이지 레지스트리

스테이지는 빌드 시 `src/levels/level_custom_*.json`을 `import.meta.glob`으로 자동 탐색합니다. JSON 파일을 추가하는 것만으로 새 스테이지가 등록되며, 레지스트리를 수동으로 편집할 필요가 없습니다.

## 레벨 데이터 형식

각 스테이지는 아래 구조의 JSON 파일로 정의됩니다:

```json
{
  "id": "level_custom_1",
  "name": "Stage 1",
  "backgroundColor": "#EDF4F8",
  "blocks": [
    {
      "id": "b0",
      "position": [0, 0, 0],
      "size": [1, 0.3, 1],
      "color": "#A8C8E8",
      "walkable": true
    }
  ],
  "character": { "startNodeId": "b0" },
  "goal": { "blockId": "bN" },
  "stars": [{ "nodeId": "star_b" }],
  "switches": [
    {
      "id": "sw0",
      "nodeId": "switch_b",
      "mode": "hold",
      "type": "move",
      "targets": [{ "blockId": "b1", "moveTarget": [0, 1, 0] }]
    }
  ],
  "elevators": [
    {
      "id": "el0",
      "blockId": "b2",
      "mode": "auto",
      "range": [0, 2]
    }
  ],
  "teleporters": [
    { "id": "tp0", "fromNodeId": "b3", "toNodeId": "b4" }
  ],
  "initialCamera": { "yaw": 45, "pitch": 60, "distance": 12 }
}
```

| 필드 | 설명 |
|------|------|
| `blocks` | 위치·크기·색상·이동 가능 여부를 가진 경로 블록 배열 |
| `character.startNodeId` | 캐릭터가 스폰되는 블록 id |
| `goal.blockId` | 스테이지 클리어를 트리거하는 블록 id |
| `stars` | 수집 가능한 별(블록 id 기준, 선택 사항) |
| `switches` | `hold`/`toggle` 모드; `spawn`/`move` 타입; 다중 타깃 지원 |
| `elevators` | `auto`/`trigger` 모드; `range`는 `[최소, 최대]` Y 오프셋 |
| `teleporters` | 한 블록에서 다른 블록으로 순간이동 |
| `initialCamera` | 플라이-인 각도 (yaw/pitch는 도 단위, distance는 월드 단위) |

## 캐릭터 타입

설정 화면에서 3종의 캐릭터 모델을 선택할 수 있습니다:

| 타입 | 설명 |
|------|------|
| `default` | 추상적인 기하학적 형태 |
| `robot` | 기계적인 로봇 실루엣 |
| `human` | 인간형 실루엣 |

몸통과 머리 색상을 각각 커스터마이징할 수 있으며, `localStorage`에 저장됩니다.

## 착시 자동 감지 시스템

### 개요

레벨 JSON에 `illusionConnections`를 수동으로 등록할 필요 없이, 레벨 로드 시 모든 walkable 블록 쌍에 대해 **착시가 성립하는 카메라 각도를 자동으로 계산**합니다. 블록을 배치하기만 하면 기하학적으로 착시가 가능한 모든 경우가 자동 등록됩니다.

### 원리

두 블록 A와 B 사이에 틈이 있을 때, 카메라가 **마주보는 면(face)의 중심점을 잇는 방향**에서 보면 틈이 가려져 연결된 것처럼 보입니다.

```
[블록 A] ──face→face──► [블록 B]
              ↑
      이 방향에서 카메라가 보면
      두 블록이 화면에서 맞닿아 보임
```

카메라가 이 방향에 위치했을 때의 **방위각(azimuth)** 과 **고도각(elevation)** 을 계산하는 공식:

```
A의 윗면 기준 face 중심점 FA, FB를 구한 뒤:
  azimuth   = atan2(FB.x - FA.x, FB.z - FA.z)
  elevation = atan2(FB.y - FA.y, horiz_dist(FA, FB))
```

### 블록이 대각선 방향에 있을 때 — 두 가지 시점

B가 A의 대각선 방향에 있으면 X축 면 쌍과 Z축 면 쌍 각각에서 착시가 성립합니다.

예: A(3.5, 6.5) → B(6.5, 8.5)

| face 쌍 | FA 위치 | FB 위치 | 계산 azimuth | 실측값 |
|---------|---------|---------|-------------|--------|
| X축 쌍 | A의 +x면 (4.0, 6.5) | B의 -x면 (6.0, 8.5) | **45.0°** | 45.9° |
| Z축 쌍 | A의 +z면 (3.5, 7.0) | B의 -z면 (6.5, 8.0) | **71.6°** | 71.3° |

기존에 수동으로 같은 블록 쌍에 각도를 여러 개 등록했던 이유가 바로 이것입니다. X축·Z축 두 면 쌍이 각각 다른 시점에서 착시를 만들기 때문입니다.

### 블록 센터가 아닌 면 중심점을 쓰는 이유

블록 센터 기준으로 계산하면 (`atan2(B.x - A.x, B.z - A.z)`) 위 예시에서 56.3°가 나옵니다. 하지만 실제로 착시가 보이는 각도는 45.9°와 71.3°였습니다. 착시는 블록의 **면이 맞닿아 보이는** 현상이므로 면 중심점 기준으로 계산해야 정확합니다.

### 구현 위치

- `src/core/GameManager.ts` — `_buildAutoIllusionConns()`: 레벨 로드 시 자동 각도 계산
- `src/illusion/IllusionManager.ts`: 매 프레임 카메라 각도와 비교해 활성/비활성 결정
- `src/world/PathGraph.ts` — `setIllusionEdge()`: 레퍼런스 카운팅으로 동일 쌍의 복수 활성 조건 안전 처리

---

## 모듈 레퍼런스

| 모듈 | 주요 파일 | 역할 |
|------|-----------|------|
| `core` | `GameManager.ts` | 메인 오케스트레이터 — 상태 머신, 게임 루프, 레벨 로딩 |
| `core` | `Renderer.ts` | WebGL 설정, 씬, 조명, 포스트 프로세싱 |
| `core` | `CameraController.ts` | 직교 아이소메트릭 카메라, 오빗, 플라이-인 |
| `core` | `InputManager.ts` | 키보드·마우스 이벤트 라우팅 |
| `core` | `GraphicsSettings.ts` | `localStorage` 기반 설정 읽기/쓰기 |
| `core` | `TutorialSequencer.ts` | 튜토리얼 단계 흐름 및 힌트 트리거 |
| `world` | `Level.ts` | JSON 파싱, 블록 인스턴스 생성, 씬 구성 |
| `world` | `Block.ts` | 개별 블록 지오메트리 (모서리, 색상 변형) |
| `world` | `PathGraph.ts` | 경로 탐색을 위한 이동 가능 블록 노드 그래프 |
| `world` | `RotatingSection.ts` | 하나의 단위로 회전하는 블록 그룹 |
| `world` | `SwitchManager.ts` | 스위치 hold/toggle 로직, spawn/move 디스패치 |
| `world` | `ElevatorManager.ts` | 엘리베이터 이동, 레일 시각화, 트리거 감지 |
| `character` | `Character.ts` | 절차적 3D 캐릭터 메시 생성 |
| `character` | `CharacterController.ts` | 이동, 경로 탐색, 걷기 애니메이션 |
| `illusion` | `IllusionManager.ts` | 카메라 각도에 따른 가짜 경로 표시/숨김 |
| `mechanics` | `TeleportManager.ts` | 텔레포터 로직 및 시각 효과 |
| `mechanics` | `StarManager.ts` | 별 수집 추적 및 애니메이션 |
| `editor` | `LevelEditor.ts` | 인게임 비주얼 레벨 에디터 |
| `editor` | `CustomLevelStore.ts` | 커스텀 스테이지 `localStorage` CRUD |
| `fx` | `ParticleSystem.ts` | 스테이지 클리어·상호작용 파티클 이펙트 |
| `ui` | `StageSelectUI.ts` | 썸네일이 있는 스테이지 선택 화면 |
| `ui` | `SettingsScreen.ts` + `SettingsPreview.ts` | 실시간 설정 UI 및 미리보기 |
