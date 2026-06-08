# QA 리포트 — Monument Valley Clone

> 최종 업데이트: 2026-06-08  
> QA 범위: Phase 1 ~ Phase 5 + 2차 QA (전체 코드 재검토) + 3차 QA (GameManager 신규 코드 전체 검토) + 신규 블록 메커닉 기획 + 4차 QA (TeleportManager 포함 전체 재검토) + 5차 QA (텔레포트 미동작 버그 추적)

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
| QA-01 | P1 | ✅ 수정됨 | `midpointCinematicTween/Timeout` 멤버로 p1/p2 참조 저장, `unloadCurrent()`에서 kill/clearTimeout | `GameManager.ts` |
| QA-02 | P2 | ✅ 수정됨 | `goalClearTimeout` 멤버로 ID 저장, `unloadCurrent()`에서 취소 | `GameManager.ts` |
| QA-03 | P2 | ✅ 수정됨 | `teleportTo()` 후 `teleportDest`에 goal/midpoint 판정 추가 | `GameManager.ts` |
| QA-04 | P3 | ✅ 수정됨 | 미매칭 stageNum 진입 시 `currentStageNum` 미변경 + `console.warn` | `GameManager.ts` |
| QA-05 | P3 | ✅ 수정됨 | `azimuthTol` / `elevationTol` 숫자 입력 필드 추가 (기본값 2) | `LevelEditor.ts` |
| QA-06 | P1 | ✅ 수정됨 | Phase 8 리팩터링 회귀 — `_advance()` 마지막 노드에서 `onArrival` 이중 발동 → `tl.onComplete`에서 `_movePath.length > 0`일 때만 호출하도록 수정 | `CharacterController.ts:112` |

---

## 5차 QA 신규 버그 상세 (2026-06-08)

---

### QA-06 — Phase 8 회귀: `_advance()` `onArrival` 이중 발동 → 텔레포트 미동작 (`CharacterController.ts:93,114`)

#### 증상

텔레포터 패드에 도달해도 캐릭터가 이동하지 않는다. 순간적으로 목적지로 이동하지만 즉시 원위치로 돌아온다.

#### 원인 분석

Phase 8에서 `_startMove()` 내부의 단일 GSAP timeline을 `_advance()` 재귀 호출 방식으로 리팩터링하면서 `onArrival`이 **마지막 노드에 대해 두 번 호출**되는 회귀가 발생했다.

**`_advance()` 내 `onArrival` 호출 위치 두 곳:**

```
위치 1 — tl.onComplete (line 114):
  onComplete: () => {
    this.currentNode = node;
    this.onArrival?.(node.id);  ← 모든 노드(중간 포함)에서 발동
    this._advance();
  }

위치 2 — _advance() 최상단 (line 93):
  if (this._movePath.length === 0) {
    this.isMoving = false;
    this.onArrival?.(this.currentNode.id);  ← 경로 소진 시 발동
    ...
  }
```

#### 실행 흐름 추적 (텔레포터 패드 A를 직접 클릭, path = [start, A])

```
_movePath = [A]

① _advance() 첫 호출
   node = A (shift), _movePath = []
   GSAP 애니메이션 시작

② tl.onComplete 발동 (위치 1)
   currentNode = A
   onArrival("A") → GameManager: teleportTo(dest) → currentNode = dest  ✓
   _advance() 재귀 호출

③ _advance() 두 번째 호출 (위치 2)
   isMoving = true (아직 false 아님) → early return 없음
   _movePath.length === 0 → 진입
   isMoving = false
   onArrival(currentNode.id) → onArrival("dest") 발동  ← 역방향 텔레포트
     getTeleportDest("dest") = "A"
     teleportTo(A) → currentNode = A, 캐릭터 원위치
   pendingTarget 없음 → 종료

결과: 캐릭터가 A에 머무름 (텔레포트 불동)
```

#### 파생 버그 — 경유 텔레포터 (path = [start, A, afterA, dest])

패드 A가 최종 목적지가 아니라 경유 노드인 경우:

```
② tl.onComplete (중간 노드 A)
   onArrival("A") → teleportTo(dest) → currentNode = dest
   _advance() 재귀

③ _advance()
   _movePath = [afterA, dest] (아직 남아있음)
   isMoving = true → 위치 2 진입 안 함
   node = afterA (shift)
   GSAP: dest → afterA 방향으로 캐릭터 이동  ← 엉뚱한 방향으로 이동
```

결과: 텔레포트 후 원래 경로의 나머지 노드를 향해 잘못된 방향으로 이동.

#### 근본 원인

`tl.onComplete` (위치 1)에서 **중간 노드용** `onArrival`을 발동하고, `_advance()` (위치 2)에서 **최종 도달용** `onArrival`을 발동하는 이중 구조가 문제다. `_movePath`의 마지막 노드는 두 경로 모두 통과하므로 `onArrival`이 두 번 호출된다.

#### 수정 방향

`tl.onComplete` (위치 1)에서 `_movePath`가 비어있는 경우(= 현재 노드가 최종 목적지) `onArrival`을 호출하지 않고 `_advance()` (위치 2)에 위임한다:

```typescript
// CharacterController.ts — tl.onComplete 수정
onComplete: () => {
  this.currentNode = node;
  // 중간 노드에만 발동. 마지막 노드는 _advance()의 '경로 소진' 분기에서 처리.
  if (this._movePath.length > 0) {
    this.onArrival?.(node.id);
  }
  this._advance();
},
```

이렇게 하면 `onArrival`은 노드당 정확히 한 번만 호출된다:
- 중간 노드: `tl.onComplete`에서 호출 (튜토리얼 트리거 유지)
- 최종 노드: `_advance()` 위치 2에서 호출

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

## 4차 QA 신규 버그 상세 (2026-06-08)

---

### QA-01 — `onMidpointReached()` proxy tween 미종료 — NEW-04 불완전 수정 (`GameManager.ts:544,588`)

NEW-04 수정으로 `unloadCurrent()`에 아래 코드가 추가되었으나:

```typescript
gsap.killTweensOf(this.renderer.camera.position);
gsap.killTweensOf(this.orbit.target);
```

`onMidpointReached()`의 p1/p2 tween은 내부 proxy 객체(`{ t: 0 }`)를 GSAP 타겟으로 사용하고, `cam.position`과 `orbit.target`을 `onUpdate`에서 **간접 조작**한다:

```typescript
const p1 = { t: 0 };  // ← GSAP이 직접 animate하는 타겟은 이 객체
gsap.to(p1, {
  t: 1,
  onUpdate: () => {
    cam.position.lerpVectors(origCamPos, panCamPos, p1.t);  // 간접 조작
    orbit.target.lerpVectors(origTarget, panTarget, p1.t);  // 간접 조작
  },
  onComplete: () => {
    // Phase 3: setTimeout이 900ms 후 p2 tween 시작
    setTimeout(() => {
      const p2 = { t: 0 };
      gsap.to(p2, { ... onComplete: () => { orbit.enabled = true; } });
    }, 900);
  },
});
```

`gsap.killTweensOf(cam.position)`은 `cam.position` 객체를 타겟으로 하는 tween을 종료하지만, `p1` tween의 타겟은 로컬 `{ t: 0 }` 객체이므로 **종료되지 않는다**.

**재현 경로:**
1. 미드포인트 도달 → p1 tween 시작 (카메라 패닝)
2. p1 완료 → Phase 2 링 scale-in → setTimeout(900ms) 시작
3. 900ms 이내에 스테이지 전환 (Skip 또는 Next Stage)
4. `unloadCurrent()` 실행 — p1은 이미 완료, p2 tween은 아직 미시작
5. 900ms 경과 → setTimeout 콜백 발동 → **새 레벨의 카메라/orbit를 p2 tween이 조작**
6. p2 완료 시 `orbit.enabled = true` 가 불필요하게 실행 (이미 true지만 의도치 않은 시점)

또한 p1 진행 중 전환 시에도 `gsap.killTweensOf(cam.position)`으로는 p1을 종료할 수 없으므로, `onComplete` → `setTimeout` 체인 전체가 새 레벨에 영향을 미친다.

**수정 방향:**
- `GameManager`에 `midpointCinematicTween`, `midpointCinematicTimeout` 멤버 변수를 두어 p1/p2 tween 참조와 setTimeout ID를 저장
- `unloadCurrent()`에서 `tween.kill()` + `clearTimeout()` 호출

---

### QA-02 — `onGoalReached()` setTimeout 미취소 (`GameManager.ts:631`)

NEW-02에서 `HUD.showClear()`의 setTimeout은 수정되었으나, `onGoalReached()` 자체의 외부 setTimeout이 취소되지 않는다:

```typescript
// GameManager.ts:631
setTimeout(() => {
  if (this.isTutorial) {
    this.hud.showClear();
    setTimeout(() => { this.titleScreen.show(); }, 1400);
  } else {
    this.hud.showClear(onNext, onSelect);
  }
}, 800);
```

**재현 경로:**
1. 골 도달 (`onGoalReached` 호출)
2. 800ms 이내에 "Stage Select" 버튼(Skip 등 다른 경로) 클릭 → `unloadCurrent()` → 새 레벨 로드
3. 800ms 경과 → setTimeout 발동 → **새 레벨 HUD에 이전 레벨의 Stage Clear 화면 표시**

튜토리얼의 경우 내부에 추가 setTimeout(1400ms)이 있어 `this.titleScreen.show()`가 잘못된 시점에 실행될 수 있다.

`HUD.reset()`이 `unloadCurrent()`에서 호출되어 clear 화면을 지우지만, 이후 800ms에 setTimeout이 발동되면 다시 clear 화면이 나타난다.

**수정 방향:** `goalClearTimeout` 멤버 변수로 setTimeout ID를 저장하고 `unloadCurrent()`에서 취소.

---

### QA-03 — Teleport 도착지 == goal 블록 시 클리어 불가 (`GameManager.ts:267`)

`onArrival` 콜백에서 teleport 발동 시 즉시 `return`하여 goal/midpoint 판정을 건너뛴다:

```typescript
onArrival: (nodeId) => {
  const teleportDest = this.graph!.getTeleportDest(nodeId);
  if (teleportDest) {
    ...
    this.controller!.teleportTo(destNode);
    return; // ← 도착지에 대한 goal/midpoint 판정 없음
  }
  // 이 아래 판정은 실행되지 않음
  if (nodeId === this.goalBlockId ...) { this.onGoalReached(); }
}
```

`teleportTo()`는 캐릭터 위치만 이동하고 `onArrival`을 재발동하지 않으므로, **teleport 도착지가 goal 블록이면 클리어 판정이 영구 스킵**된다.

현재 내장 레벨(스테이지 10)의 teleporter 목적지가 goal과 다른 위치이므로 재현되지 않지만, 에디터로 `teleporter.nodeB = goalBlockId` 구성 시 반드시 재현된다.

**QA 체크리스트 항목 추가:**
- [ ] teleport 도착지 == goal 설정 시 클리어 가능 여부 확인
- [ ] teleport 도착지 == midpoint 설정 시 정상 동작 여부 확인

**수정 방향:** `teleportTo()` 호출 후 `teleportDest`에 대한 goal/midpoint 판정을 추가 수행.

---

### QA-04 — `loadStage()` silent fail (`GameManager.ts:160`)

```typescript
private loadStage(stageNum: number): void {
  this.currentStageNum = stageNum;       // 먼저 업데이트
  const custom = CustomLevelStore.getByStage(stageNum);
  if (custom) { this.loadCustomLevel(custom.data); return; }
  if (this.builtinIds[stageNum]) { this.loadLevel(this.builtinIds[stageNum]); return; }
  // 두 조건 모두 미충족 → currentStageNum만 변경된 채로 함수 종료
}
```

custom도 builtin도 아닌 stageNum 진입 시(예: `getNextStageNum()`이 잘못된 번호 반환) 레벨 로드 없이 `currentStageNum`만 변경된다. 이후 `getNextStageNum()`이 이 오염된 값을 기준으로 계산하여 연쇄 오동작 가능.

**수정 방향:** 조건 미충족 시 `currentStageNum`을 이전 값으로 롤백하거나 early return 추가.

---

### QA-05 — 에디터 illusion tolerance 입력 UI 부재 (`LevelEditor.ts:443`)

```typescript
this.illusionConns.push({
  nodeA, nodeB,
  azimuth, azimuthTol: 2,     // 하드코딩
  elevation, elevationTol: 2, // 하드코딩
});
```

에디터 폼에 azimuth/elevation 입력 필드는 있지만 tolerance 입력 필드가 없어 항상 2도로 고정 생성된다. 레벨 디자인 가이드(tolerance 2도 권장)와는 일치하지만, 특수 케이스(넓은 각도 허용이 필요한 착시)에서 에디터만으로 조정이 불가능하다.

**수정 방향:** 폼에 `azimuthTol` / `elevationTol` 숫자 입력 필드 추가 (기본값 2).

---

## Phase 8 — 신규 메커닉 구현 (2026-06-08)

| 항목 | 파일 | 상태 |
|------|------|------|
| `PathGraph.enableNode/disableNode` — disabled 노드 경로 제외 | `PathGraph.ts` | ✅ 완료 |
| `SwitchManager` — Type A(spawn) / Type B(move) 분기 처리 | `SwitchManager.ts` (신규) | ✅ 완료 |
| `ElevatorManager` — auto/trigger 모드, 레일 시각화 | `ElevatorManager.ts` (신규) | ✅ 완료 |
| `LevelData`에 `switches`, `elevators` 필드 추가 | `Level.ts` | ✅ 완료 |
| `GameManager` — 3종 매니저 초기화/언로드 연동 | `GameManager.ts` | ✅ 완료 |
| `CharacterController.onDepart` — hold 스위치 해제 트리거 | `CharacterController.ts` | ✅ 완료 |

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

## Elevation 60° 상한 제한 QA 평가 (2026-06-08)

**제안:** OrbitControls의 elevation을 최대 60°로 제한하여 의도치 않은 착시 연결 활성화 방지

---

### 기존 레벨 호환성 검사

Three.js 각도 체계에서 elevation 60° 제한 = `minPolarAngle = Math.PI / 6` (30°).

| 레벨 | 최대 activateElevation | 60° 제한 후 도달 가능 |
|------|----------------------|-------------------|
| custom_2 | 30.0° | ✅ |
| custom_3 | 23.9° | ✅ |
| custom_4 | 56.6° | ✅ |
| custom_5 | 25.4° | ✅ |
| custom_9 | 36.6° | ✅ |
| custom_10 | 56.9° | ✅ |

전 레벨 최대값 56.9° < 60°. **기존 착시 연출 파괴 없음.**

---

### 카메라 플라이-인 호환성 검사

`loadLevel` / `loadCustomLevel` 인트로 시작 위치 `(cx+22, 16, cz+12)` 기준:

```
horizDist = sqrt(22² + 12²) ≈ 25.1
elevation = atan2(16, 25.1) ≈ 32.6°  → 60° 미만 ✅
```

인트로 도착 위치 `(cx+12, 8, cz+6)`:

```
horizDist = sqrt(12² + 6²) ≈ 13.4
elevation = atan2(8, 13.4) ≈ 30.8°  → 60° 미만 ✅
```

플라이-인 시작·종료 모두 60° 이하. `orbit.enabled = false` 구간이므로 제약이 적용되지 않지만, `orbit.enabled = true` 복귀 후 스냅 없음.

---

### QA 리스크 및 수정 필요 지점

**[필수] `unloadCurrent()` — `minPolarAngle` 리셋값 불일치 (`GameManager.ts:531`)**

현재:
```typescript
this.orbit.minPolarAngle = 0;   // ← 0으로 리셋하면 제한이 풀림
```

60° 제한을 전 레벨에 걸쳐 유지하려면 생성자와 `unloadCurrent()` 양쪽을 수정해야 한다:
```typescript
// 생성자
this.orbit.minPolarAngle = Math.PI / 6;

// unloadCurrent()
this.orbit.minPolarAngle = Math.PI / 6;  // 0 → Math.PI / 6
```

이 수정을 빠뜨리면 레벨 전환 시마다 제한이 해제되어 다음 레벨에서 90°까지 가능해진다.

**[참고] LevelEditor는 별도 OrbitControls 인스턴스 사용**

`LevelEditor.ts`는 독립적인 `this.orbit`을 가지며 GameManager의 orbit과 무관하다. 에디터에서는 제한 없이 90°까지 회전 가능 — 레벨 설계 시 착시 각도 측정에 유리하므로 **에디터는 현행 유지 권장**.

**[레벨 디자인 제약] 60° 초과 activateElevation 사용 불가**

`minPolarAngle` 제한 후 카메라가 60° 이상 elevation에 도달할 수 없으므로, 향후 레벨에서 `activateElevation > 60°`인 착시 커넥션은 **영구적으로 활성화 불가**. 레벨 디자인 가이드에 명시 필요.

**[경미] orbit 비활성화 구간(fly-in, 시네마틱) 중 60° 초과 허용**

`orbit.enabled = false`인 동안에는 `minPolarAngle` 제약이 동작하지 않는다. GSAP tween이 카메라를 60° 이상으로 이동시킬 수 있으나, 현재 모든 시네마틱의 목표 위치가 60° 미만이므로 실질적 영향 없음.

---

### 종합 판정: ✅ 도입 권장

착시 오발 방지 효과가 명확하고 기존 레벨 전체와 호환된다. `unloadCurrent()` 한 곳의 수정 필수.

---

### 레벨 디자인 가이드 추가 내용

`activateElevation`은 **60° 이하**로 설계할 것. 60°를 초과하면 게임 내에서 해당 각도에 도달할 수 없어 착시가 영구 비활성화됨.

---

## 신규 기획 아이디어 QA 평가 (2026-06-08)

아래 5가지 아이디어를 QA 관점에서 평가한다.  
평가 기준: 기존 아키텍처 충돌 여부 / 구현 리스크 / 사용자 경험 / 잠재적 버그 가능성

---

### 아이디어 1 — 위협 요소 (Moving Hazard)

**개요:** 블록 위를 순찰하는 적/장애물. 접촉 시 리스폰.

**평가: ⚠️ 조건부 검토**

Monument Valley는 조급함 없이 퍼즐을 탐색하는 장르다. 위협 요소는 액션 게임의 시간 압박 메커닉으로, **게임의 핵심 톤을 훼손**할 가능성이 높다.

아키텍처 충돌 리스크:

| 항목 | 리스크 |
|------|------|
| 적 이동 경로 | PathGraph는 플레이어 길찾기용 — 적 전용 순찰 경로 시스템이 별도 필요 |
| RotatingSection 위 적 처리 | 섹션 회전 시 적 위치를 매 프레임 재계산해야 하며, graph.refresh()와 동기화 필요 |
| Elevator/Switch와 조합 | 적이 이동하는 블록 위에 있을 때 처리 정의 없음 — 충돌 케이스 폭발 |
| 충돌 판정 타이밍 | CharacterController는 노드 도착 기반 — 이동 중 적과의 충돌 판정 지점 모호 |
| 모바일 반응속도 | 터치 지연(~100ms)으로 실시간 회피 플레이가 불공평하게 느껴질 수 있음 |
| 리스폰 상태 | unloadCurrent/reset 시 적 상태 초기화 보장 필요 |
| Teleporter + 적 | 적이 teleporter 위에 올라갈 때 처리 정의 필요 |

**QA 판정:** 아키텍처 복잡도와 장르 적합성 모두에서 리스크가 크다. 도입하려면 적 전용 매니저(`HazardManager`) 설계부터 시작해야 하며, 현재 Phase에서는 권장하지 않는다.

---

### 아이디어 2 — 별 수집 (Star Collection)

**개요:** 레벨에 별을 배치. 모든 별을 먹어야 골 도달 가능.

**평가: ✅ 도입 권장**

Monument Valley 원작의 수집 요소와 방향이 일치하며, 기존 아키텍처에 **가장 자연스럽게 얹을 수 있는** 메커닉이다.

기존 구조와의 적합성:

| 항목 | 평가 |
|------|------|
| onArrival 콜백 | 별 수집 판정을 onArrival에 추가하면 충분 — 구조 변경 최소 |
| goal 잠금 조건 | 현재 `midpointReached` 패턴을 확장하면 `starsRemaining` 카운터로 구현 가능 |
| 시각 표현 | 기존 TorusGeometry 마커 패턴 재활용 가능 |
| 에디터 지원 | LADDERS/TELEPORTERS와 동일한 패턴으로 STARS 섹션 추가 가능 |

**잠재적 QA 리스크:**

- [ ] RotatingSection 위 별: 섹션 회전 시 별 mesh가 따라가는지 확인 (별을 section.pivot 하위에 추가해야 함)
- [ ] Teleporter 도착 후 별 수집: QA-03과 동일한 구조 — `onArrival` 재설계 필요
- [ ] 레벨 재시작 시 별 상태 초기화 — dispose에서 별 mesh 제거 확인
- [ ] 별 0개 레벨(별 없는 일반 레벨)에서 정상 동작 보장 (하위 호환)
- [ ] 별 위치가 non-walkable 블록 위일 때 — 경로 없이 별에 도달 불가 상태 방지

**레벨 데이터 스키마 제안:**
```typescript
stars?: Array<{ nodeId: string }>;
// goal 조건: starsCollected === stars.length 일 때만 도달 가능
```

---

### 아이디어 3 — 블록 테두리 선 제거 (Seamless Surface)

**개요:** 인접 블록 간 경계선을 제거해 하나의 면처럼 보이게.

**평가: ⚠️ 절반 권장 — 게임/에디터 분리 적용**

착시 연출에서 블록이 이어져 보이는 효과를 강화한다는 장점이 있다. 그러나 전면 제거는 다음 리스크를 동반한다.

| 항목 | 평가 |
|------|------|
| 착시 효과 강화 | ✅ 경계선이 없으면 멀리서 하나의 덩어리처럼 보여 착시 품질 향상 |
| 블록 구분 불가 | ⚠️ 같은 색 블록이 이어질 때 플레이어가 어디까지 이동 가능한지 시각적으로 파악 어려움 |
| non-walkable 블록 구분 | ⚠️ 현재 walkable/non-walkable 구분이 시각 없이는 불투명해짐 — 플레이어 혼란 |
| 에디터 작업성 | ⚠️ 에디터에서도 선이 없으면 블록 경계 구분이 어려워 레벨 제작 불편 |

**권장 방향:** 게임 플레이 화면에서만 테두리 선 투명도를 낮추되(opacity: 0 ~ 0.03), **에디터에서는 현행 opacity 유지**. 또는 walkable 블록만 경계 제거, non-walkable은 유지하는 방식으로 구분 단서를 남긴다.

**QA 리스크:**
- [ ] `Block.ts`의 엣지 머티리얼 opacity 변경이 BUG-15 수정(transparent: true)과 충돌하지 않는지 확인
- [ ] 색상이 다른 블록이 인접할 때 경계가 자연스럽게 처리되는지 확인 (색상 차이가 경계 역할을 대체해야 함)

---

### 아이디어 4 — 삼각형 등 비직사각형 블록

**개요:** BoxGeometry 외 삼각형 프리즘 등 다른 형태 블록 추가.

**평가: ❌ 현 시점 도입 비권장**

기존 아키텍처 전반에 걸쳐 **BoxGeometry 가정이 깊숙이 박혀 있어** 충돌 범위가 넓다.

| 항목 | 충돌 내용 |
|------|---------|
| PathGraph.build() | `xzDist <= XZ_THRESHOLD (1.1)` — 정사각형 1×1 블록 기준 상수. 삼각형의 실질 접촉 거리가 다름 |
| PathGraph.addSectionNodes() | 노드 위치를 `mesh.getWorldPosition + halfHeight`로 계산 — 삼각형 블록의 top surface 중심이 다름 |
| InputManager raycaster | `intersectObjects`로 mesh 탐지 — 삼각형 mesh의 userData 설정이 Box와 동일 방식인지 확인 필요 |
| 에디터 그리드 배치 | 현재 14×14 정사각형 그리드 — 삼각형 블록 배치 좌표계 설계 필요 |
| 캐릭터 착지 위치 | `node.position.y = wp.y + halfHeight` — 삼각형 블록 상면이 경사면일 경우 캐릭터가 공중에 뜨거나 묻힘 |
| RotatingSection 조합 | 섹션 안에 삼각형 블록이 있을 때 회전 후 인접 판정 오류 가능 |
| LevelEditor.buildPanel() | `Block()` 생성자가 `size: [1, 0.5, 1]` 고정 — 형태 파라미터 체계 재설계 필요 |

삼각형 블록 하나를 추가하려면 PathGraph, Block, LevelEditor, CharacterController, RotatingSection 전체를 수정해야 한다. 현재 메커닉(스위치, 엘리베이터, 텔레포터) 안정화 후 별도 Major 리팩터링으로 접근해야 한다.

---

### 종합 평가

| 아이디어 | 권장도 | 이유 |
|---------|------|------|
| 위협 요소 (적) | ⚠️ 비권장 | 장르 톤 훼손, 아키텍처 충돌 다수 |
| 별 수집 | ✅ 권장 | 원작 감성 일치, 기존 구조 재활용 가능 |
| 테두리 선 제거 | ⚠️ 조건부 | 에디터 제외, 게임 화면만 적용 검토 |
| 삼각형 블록 | ❌ 비권장 | 전 아키텍처 수정 필요, 리스크 과대 |

**다음 Phase 권장 순서:** 별 수집 → 테두리 선 조정 → 위협 요소(재검토) → 삼각형 블록(Major ver.)

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
4. 그 값을 `activateAzimuth`에 입력, `tolerance`는 2도 권장

### 히스테리시스

- 활성화: `|azimuth - activateAzimuth| < tolerance`
- 비활성화: `|azimuth - activateAzimuth| > tolerance × 2`
- 경계에서 경로가 깜빡이는 현상 방지
