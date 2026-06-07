# QA 리포트 — Monument Valley Clone

> 최종 업데이트: 2026-06-08  
> QA 범위: Phase 1 ~ Phase 5 + 2차 QA (전체 코드 재검토) + 3차 QA (GameManager 신규 코드 전체 검토) + 신규 블록 메커닉 기획

---

## 버그 트래킹

| ID | 우선순위 | 상태 | 내용 | 파일 |
|---|---|---|---|---|
| BUG-01 | P1 | ✅ 수정됨 | `tolerance` 1° → 2°로 소폭 상향 | `level03.json` |
| BUG-03 | P1 | ✅ 수정됨 | `playIllusionActivate()` 미호출 | `GameManager.ts:208` |
| BUG-04 | P1 | ✅ 수정됨 | 디버그 UI(BlockLabels, HUD setDebug) 항상 노출 | `GameManager.ts:65,193,688` |
| BUG-05 | P2 | ✅ 수정됨 | 인트로 fly-in 중 IllusionManager 예기치 않은 활성화 | `GameManager.ts:684` |
| BUG-06 | P2 | ✅ 수정됨 | 프레임 기반 디바운스 → `DEBOUNCE_MS = 100` 시간 기반으로 교체 | `IllusionManager.ts:74` |
| BUG-07 | P2 | ✅ 수정됨 | `goalGlowLight` 위치 하드코딩 → `getWorldPosition()` 동적 계산 | `GameManager.ts:218` |
| BUG-08 | P2 | ✅ 수정됨 | BUG-04 해소로 debug-only 코드 조건화 | `GameManager.ts` |
| BUG-09 | P3 | ✅ 수정됨 | `pulse()`에서 불필요한 `updateProjectionMatrix()` 호출 | `CameraController.ts:82,87` |
| BUG-10 | P3 | ✅ 수정됨 | 이동 중 클릭 입력 묵음 처리 (큐 없음) | `CharacterController.ts:29` |
| BUG-11 | P1 | ✅ 수정됨 | `main.ts`에 레벨 하드코딩 — `GameManager`로 전환 | `main.ts` |
| BUG-12 | P1 | ✅ 수정됨 | `Level.load()` 재호출 시 Three.js 리소스 미해제 | `Level.ts:146` |
| BUG-13 | P1 | ✅ 수정됨 | `HUD.reset()` 없음 — 레벨 재시작 시 클리어 화면 유지 | `HUD.ts:88` |
| BUG-14 | P2 | ✅ 수정됨 | `ParticleSystem.burst()` 독립 RAF — `active` 플래그로 중단 | `ParticleSystem.ts:50` |
| BUG-15 | P3 | ✅ 수정됨 | `Block.ts` 엣지 색상 alpha 무시 → `transparent: true, opacity: 0.09` | `Block.ts:45` |
| NEW-02 | P2 | ✅ 수정됨 | `showClear()` setTimeout 미취소 → 레벨 전환 후 버튼 잔류 | `HUD.ts:63` |
| NEW-03 | P2 | ✅ 수정됨 | `loadCustomLevel()` RotatingSection 그래프/인터랙션 누락 | `GameManager.ts:314` |
| NEW-04 | P2 | ✅ 수정됨 | 미드포인트 시네마틱 중 레벨 전환 시 cam/orbit tween 미종료 | `GameManager.ts:525` |
| NEW-05 | P3 | ✅ 수정됨 | `loadLevel`/`loadCustomLevel` 대규모 중복 코드 — DRY 위반 | `GameManager.ts` |

---

## 3차 QA 신규 버그 상세 (2026-06-07)

---

### NEW-02 — `HUD.showClear()` setTimeout 미취소 (`HUD.ts:63`)

`showClear(onNext, onSelect)` 호출 후 1000ms 뒤에 버튼을 DOM에 삽입하는 `setTimeout`이 실행됨.
`reset()`은 이 타이머를 취소하지 않으므로, 레벨 전환이 1000ms 이내에 발생하면 새 레벨 HUD에 이전 스테이지 버튼이 삽입됨.

**재현 경로:**
1. 스테이지 클리어 (`showClear` 호출)
2. 800ms 이내에 "Next Stage" 클릭 → 새 레벨 로드 → `HUD.reset()`
3. 1000ms 시점에 setTimeout 발동 → 새 레벨 HUD에 구 버튼 삽입

**수정:**
```typescript
// HUD.ts
private clearBtnTimeout: ReturnType<typeof setTimeout> | null = null;

showClear(onNextStage?: () => void, onStageSelect?: () => void): void {
  this.overlayEl.classList.add('visible');
  this.clearEl.classList.add('visible');

  if (onNextStage || onStageSelect) {
    this.clearBtnTimeout = setTimeout(() => {
      this.clearBtnTimeout = null;
      // ... 기존 버튼 생성 코드 ...
    }, 1000);
  }
}

reset(): void {
  if (this.clearBtnTimeout !== null) {
    clearTimeout(this.clearBtnTimeout);
    this.clearBtnTimeout = null;
  }
  // ... 기존 reset 코드 ...
}
```

---

### NEW-03 — `loadCustomLevel()` RotatingSection 지원 누락 (`GameManager.ts:314`)

`loadLevel()`과 `loadCustomLevel()`의 구현 차이:

| 항목 | `loadLevel` | `loadCustomLevel` |
|---|---|---|
| `graph.addSectionNodes()` 호출 | ✅ `L188-190` | ❌ 없음 |
| `interactTargets`에 section meshes 포함 | ✅ `L261-264` | ❌ walkable만 |
| `onSectionDrag` / `onSectionSnap` 구현 | ✅ `L274-287` | ❌ 빈 콜백 |

커스텀 레벨에 `rotatingSections`가 포함된 JSON을 업로드하면 그래프에 섹션 노드가 없고 드래그도 불가.
에디터 UI에서 직접 rotatingSections를 추가할 수 없지만 "Upload JSON" 경로로 진입 가능.

**수정 — `loadCustomLevel()` 내부에 추가:**
```typescript
// graph.setLadders() 이후
for (const section of this.level.sections) {
  this.graph.addSectionNodes(section.getWalkableEntries());
}

// interactTargets 수정
const interactTargets = [
  ...this.level.getWalkableMeshes(),
  ...this.level.sections.flatMap(s => s.getAllMeshes()),
];

// onSectionDrag, onSectionSnap — loadLevel과 동일하게 구현
onSectionDrag: (sectionId, deltaRad) => {
  const section = this.level!.sections.find(s => s.id === sectionId);
  section?.rotate(deltaRad);
},
onSectionSnap: (sectionId) => {
  const section = this.level!.sections.find(s => s.id === sectionId);
  if (section) {
    section.snapToNearest().then(() => {
      this.graph!.refresh();
      this.cameraCtrl.pulse(0.3);
    });
  }
},
```

---

### NEW-04 — 미드포인트 시네마틱 중 레벨 전환 시 cam/orbit tween 미종료 (`GameManager.ts:525`)

`onMidpointReached()`는 `orbit.enabled = false`로 카메라를 잠근 뒤 Phase 1 pan → 900ms `setTimeout` → Phase 2 return 순서로 GSAP 트윈을 실행함.

`unloadCurrent()`는 `gsap.killTweensOf(this.goalGlow)`만 종료하고 `cam.position` / `orbit.target` 트윈은 종료하지 않음. Phase 2 완료 시 `orbit.enabled = true`가 실행되어 새 레벨에서 orbit이 의도치 않게 잠금 해제되거나, 카메라가 구레벨 기준 보간 중간값으로 이동될 수 있음.

**수정 — `unloadCurrent()` 내에 추가:**
```typescript
private unloadCurrent(): void {
  if (!this.level) return;

  // cam/orbit 트윈 강제 종료 및 orbit 상태 초기화
  gsap.killTweensOf(this.renderer.camera.position);
  gsap.killTweensOf(this.orbit.target);
  this.orbit.enabled = true;

  // ... 기존 unloadCurrent 코드 ...
}
```

---

### NEW-05 — `loadLevel` / `loadCustomLevel` 대규모 중복 코드 (`GameManager.ts`)

두 메서드가 Level 생성, PathGraph 빌드, IllusionManager 생성, goalGlow 셋업, Character 생성 등 ~70%의 동일 코드를 공유함. NEW-03의 섹션 지원 누락도 이 중복 구조에서 비롯됨.

**수정 방향:** 공통 로직을 private `_initLevelObjects(data: LevelData)` 메서드로 추출. `loadLevel`과 `loadCustomLevel`은 각각의 고유 부분(orbit target 계산, 튜토리얼 힌트 등)만 담당.

---

## 수정 완료 항목 (Phase 1~5 + 3차 QA 이전)

| 항목 | 파일 | Phase |
|------|------|-------|
| `render()` `this` 바인딩 버그 | `Renderer.ts` | 1 |
| 멀티스텝 경로 회전 방향 오류 | `CharacterController.ts` | 2 |
| 카메라 드래그 중 `onBlockClick` 오발 | `InputManager.ts` | 4 |
| `raycaster.params.Line` 기본값(1.0) → 0.05 | `InputManager.ts` | 4 |
| `lockCount` 참조 카운트 (다중 잠금 해제 버그) | `CameraController.ts` | 4 |
| `transitionTo()` 진행 중 새 스냅 무시 → `currentTl.kill()` | `CameraController.ts` | 4 |
| `CharacterController.update()` 섹션 위 캐릭터 위치 추적 | `CharacterController.ts` | 3 |
| Goal 도달 판정 (`onGoalReached`) | `main.ts` | 4 |
| Goal 도달 시 HUD 표시 | `main.ts` | 4 |
| IllusionManager NDC → Azimuth 방식으로 전면 재작성 | `IllusionManager.ts` | 5 |
| BUG-01: `tolerance` 1° → 2° 상향 | `level03.json` | 5 |
| BUG-03: `playIllusionActivate()` 추가 | `GameManager.ts` | 6 |
| BUG-04: 디버그 UI 조건부 처리 (`?debug` 플래그) | `GameManager.ts` | 6 |
| BUG-05: 인트로 fly-in 중 IllusionManager 비활성 | `GameManager.ts` | 6 |
| BUG-06: 프레임 기반 디바운스 → 시간 기반 교체 | `IllusionManager.ts` | 6 |
| BUG-07: `goalGlowLight` 동적 위치 계산 | `GameManager.ts` | 6 |
| BUG-11: `main.ts` 하드코딩 → `GameManager` 도입 | `main.ts` | 6 |
| BUG-12: `Level.dispose()` 구현 | `Level.ts` | 6 |
| BUG-13: `HUD.reset()` 구현 | `HUD.ts` | 6 |
| BUG-14: `ParticleSystem` RAF 댕글링 참조 해소 | `ParticleSystem.ts` | 6 |
| BUG-15: `Block.ts` 엣지 투명도 수정 | `Block.ts` | 6 |
| BUG-09: `pulse()` 불필요한 `updateProjectionMatrix()` 제거 | `CameraController.ts` | 7 |
| BUG-10: 이동 중 클릭 큐(`pendingTarget`) 추가 | `CharacterController.ts` | 7 |
| NEW-02: `clearBtnTimeout` 추가, `reset()`에서 타이머 취소 | `HUD.ts` | 7 |
| NEW-03: `loadCustomLevel()` 섹션 노드/드래그/스냅 지원 추가 | `GameManager.ts` | 7 |
| NEW-04: `unloadCurrent()`에서 cam/orbit tween 강제 종료 | `GameManager.ts` | 7 |
| NEW-05: 중복 로직을 `_initLevelObjects()` 메서드로 추출 | `GameManager.ts` | 7 |

---

## 신규 블록 메커닉 기획 (2026-06-08)

Monument Valley 퍼즐 다양성 확장을 위한 3종 신규 메커닉.  
기존 `LevelData` / `PathGraph` / `CharacterController` 구조를 최대한 유지하며 얹는 방향으로 설계.

---

### 1. 순간이동 패드 (Teleport Pad)

**개념:** 두 패드를 연결. 캐릭터가 패드에 도착하는 순간 연결된 상대 패드로 이동.  
착시와 조합 — 한쪽 패드는 카메라를 돌려야 보임, 이동 후 도착 지점도 다른 시점.

**레벨 데이터 스키마 추가 (`LevelData`):**
```typescript
teleporters?: Array<{ nodeA: string; nodeB: string }>;
// 양방향. nodeA ↔ nodeB
```

**구현 포인트:**
- `PathGraph`에서 teleporter 쌍을 일반 엣지처럼 연결 (`setTeleporterEdge`)
- `CharacterController`의 `onArrival` 콜백에서 teleport 여부 확인 → 도착 즉시 위치 점프
- 비주얼: 패드 위에 회전하는 토러스 링 2개 (색상: 청록 `0x44DDEE`), 활성화 시 파티클 burst

**에디터 지원:**
- `TELEPORTERS` 섹션 추가 — nodeA / nodeB 입력 폼
- 연결된 패드 쌍을 선으로 시각화 (`THREE.Line`)

**QA 체크리스트:**
- [ ] 단방향 패드 (A→B만, B→A 불가) 지원 여부 결정
- [ ] 이동 중(`isMoving`) 패드 도달 시 teleport 타이밍 정확성
- [ ] 목적지 패드 위에 다른 오브젝트 있을 때 처리
- [ ] 레벨 언로드 시 패드 마커 dispose 확인

---

### 2. 압력 스위치 (Pressure Switch) — 2종

스위치 블록을 밟으면 연결된 타깃 블록에 변화가 발생. `mode`에 따라 토글/유지 선택.  
타깃 변화 방식은 **Type A (소환)** 와 **Type B (이동)** 두 가지로 분리.

**레벨 데이터 스키마 추가:**
```typescript
switches?: Array<{
  switchNodeId: string;
  targetNodeId: string;
  mode:         'hold' | 'toggle';
  // hold   — 밟는 동안만 활성 (캐릭터가 떠나면 원상 복귀)
  // toggle — 한 번 밟으면 영구 활성
  type:         'spawn' | 'move';
  // spawn  — Type A: 원래 없던 블록을 소환
  // move   — Type B: 기존 블록을 다른 위치로 이동
  moveTarget?:  [number, number, number]; // type='move' 전용: 이동할 절대 좌표
}>;
```

---

#### Type A — 블록 소환 (Spawn Gate)

**개념:** 스위치를 밟으면 씬에 존재하지 않던 블록이 새로 생성되어 경로가 열림.  
스위치에서 벗어나면(`hold`) 블록이 사라지며 경로 차단.

**구현 포인트:**
- `targetNodeId`로 지정된 블록은 레벨 로드 시 **씬에 추가하지 않음** (숨긴 상태)
- 활성화 시: `scene.add(block.mesh)` + `graph.enableNode(targetNodeId)`
- 비활성화 시: `scene.remove(block.mesh)` + `graph.disableNode(targetNodeId)`
- 소환 연출: `scale (0,0,0) → (1,1,1)` GSAP `back.out` 이징 + 파티클 burst

**비주얼:**
- 스위치: 상면 눌린 형태 (scale Y 0.6), 미활성 시 `emissive` 약하게 발광
- 소환 블록: 첫 등장 시 scale-in 애니메이션, 반투명 예고 머티리얼(점선 테두리)로 위치 암시 가능

**QA 체크리스트:**
- [ ] 소환 블록이 있던 자리에 캐릭터가 서 있는 상태에서 `hold` 해제 시 처리
- [ ] `toggle` 모드에서 블록 소환 후 레벨 재시작 시 초기 상태(미소환) 복원
- [ ] `graph.enableNode` 호출 전 인접 노드 엣지 재계산 타이밍 검증
- [ ] 레벨 언로드 시 소환 블록 dispose 누락 방지 (`scene.remove` + geometry/material `dispose()`)

---

#### Type B — 블록 이동 (Move Gate)

**개념:** 스위치를 밟으면 기존에 씬에 있던 블록이 `moveTarget` 좌표로 이동.  
이동 후 새 위치에서 경로가 열리고, 원래 위치의 경로는 차단됨.

**구현 포인트:**
- 활성화 시: 블록 mesh를 GSAP으로 `moveTarget` 위치로 이동 → 완료 후 `graph.refresh()`
- 비활성화 시(`hold`): 원래 위치로 복귀 tween → 완료 후 `graph.refresh()`
- 블록 이동 중 PathGraph는 이전 상태 유지 (tween 완료 후 갱신)
- `PathGraph`에 `disableNode` / `enableNode` 메서드 신규 추가 필요

**비주얼:**
- 스위치: Type A와 동일 형태, 색상으로만 구분 (소환: 청록 `0x44DDBB`, 이동: 주황 `0xFFAA44`)
- 이동 블록: 이동 중 trailing ghost 잔상 (이전 위치에 반투명 복사본)

**QA 체크리스트:**
- [ ] 블록 이동 tween 중 캐릭터가 해당 블록 위에 있을 때 처리 (`CharacterController.update()`가 따라가는지 확인)
- [ ] `hold` 모드에서 블록 이동 중 스위치 해제 시 — 복귀 tween과 이동 tween 충돌 방지 (`gsap.killTweensOf(mesh)` 선행)
- [ ] 이동 목적지에 이미 다른 블록이 있을 때 겹침 처리
- [ ] 복수 스위치가 동일 블록을 각기 다른 위치로 이동시킬 때 우선순위 정의
- [ ] 레벨 재시작 시 블록 원위치 복원

---

### 3. 승강기 (Elevator)

**개념:** Y축으로 두 높이를 왕복하는 블록. 캐릭터가 올라타면 함께 이동.  
`RotatingSection`의 수직 버전. 타이밍 기반 또는 트리거 기반 두 모드.

**레벨 데이터 스키마 추가:**
```typescript
elevators?: Array<{
  nodeId:      string;           // 승강기 블록 ID
  bottomY:     number;           // 하단 Y 위치
  topY:        number;           // 상단 Y 위치
  duration:    number;           // 편도 이동 시간 (초)
  mode:        'auto' | 'trigger';
  // auto    — 자동 왕복 (타이밍 퍼즐)
  // trigger — 캐릭터 탑승 시 이동, 목적지 도달 후 정지
}>;
```

**구현 포인트:**
- `ElevatorManager` 클래스 (또는 `GameManager` 인라인) — 매 프레임 GSAP tween 제어
- `auto` 모드: GSAP `yoyo: true, repeat: -1` 으로 왕복, 매 프레임 `graph.refresh()` 호출로 노드 위치 갱신
- `trigger` 모드: `onArrival`에서 승강기 노드 감지 → tween 실행 → 완료 후 PathGraph 갱신
- 캐릭터 탑승 중: `CharacterController.update()`가 이미 매 프레임 `currentNode.mesh.getWorldPosition`으로 캐릭터를 노드에 붙이므로 **별도 처리 불필요** — 블록 mesh만 움직이면 캐릭터가 자동으로 따라옴

**비주얼:**
- 승강기 블록 측면에 수직 레일 라인 (`THREE.LineSegments`)
- 이동 중 엣지 하이라이트 (emissive pulse)

**QA 체크리스트:**
- [ ] `auto` 모드에서 매 프레임 `graph.refresh()` 호출 비용 측정 (노드 수 많을 때 병목 가능)
- [ ] 승강기 이동 중 캐릭터 이동 명령 입력 시 처리 (이동 완료 후 실행 or 즉시 처리)
- [ ] 승강기가 다른 블록과 겹치는 높이에서 PathGraph 중복 엣지 방지
- [ ] 레벨 언로드 시 반복 tween (`repeat: -1`) 강제 종료 — `gsap.killTweensOf(mesh)`

---

### 아키텍처 변경 요약

| 파일 | 변경 유형 | 내용 |
|------|---------|------|
| `src/world/Level.ts` | 수정 | `LevelData`에 `teleporters`, `switches`, `elevators` 필드 추가 |
| `src/world/PathGraph.ts` | 수정 | `setTeleporterEdge()`, `enableNode()`, `disableNode()` 추가 |
| `src/world/ElevatorManager.ts` | 신규 | 승강기 tween 및 상태 관리 |
| `src/world/SwitchManager.ts` | 신규 | 스위치 상태 관리 — Type A(소환) / Type B(이동) 분기 처리 |
| `src/core/GameManager.ts` | 수정 | 3종 매니저 초기화 및 레벨 로드/언로드 연동 |
| `src/editor/LevelEditor.ts` | 수정 | 3종 편집 섹션 추가 (TELEPORTERS / SWITCHES / ELEVATORS) |

---

## 레벨 디자인 가이드

### Azimuth 측정 방법

1. 브라우저에서 게임 실행
2. 카메라를 "블록이 붙어 보이는" 각도로 직접 회전
3. 콘솔에서 현재 각도 확인:
   ```javascript
   Math.atan2(
     camera.position.x - orbit.target.x,
     camera.position.z - orbit.target.z
   ) * 180 / Math.PI
   ```
4. 그 값을 `activateAzimuth`에 입력, `tolerance`는 20~30도 권장

### 히스테리시스

- 활성화: `|azimuth - activateAzimuth| < tolerance`
- 비활성화: `|azimuth - activateAzimuth| > tolerance × 2`
- 경계에서 경로가 깜빡이는 현상 방지
