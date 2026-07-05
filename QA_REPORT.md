# QA 리포트 — hihi

> 최종 업데이트: 2026-07-05  
> 이전 1~16차 QA 기록은 git 히스토리에 보존됨

---

## 18차 QA (2026-07-05) — 블록 시각 스케일 시스템 (BLOCK_XZ_VISUAL=0.88, BLOCK_Y_VISUAL=0.82)

### 점검 범위
- `src/world/Block.ts` — 스케일 상수 export, mesh-level scale 제거
- `src/world/Level.ts` — `scaleBlock()` 전처리, `getScaledBlocks()` 노출
- `src/core/GameManager.ts` — PathGraph / 착시 / 레이저 / 카메라 / 사다리 스케일 일관성
- `src/world/PathGraph.ts` — 상수 유효성 (XZ_THRESHOLD, MIN_XZ_DIST, SAME_FLOOR_Y)
- `src/world/WorldRotateManager.ts`, `SwitchManager.ts`, `ElevatorManager.ts`, `PatrolManager.ts`, `TeleportManager.ts`, `StarManager.ts`, `IllusionManager.ts`, `SeamMeshBuilder.ts`, `RotatingSection.ts`

### 결과 요약

| 등급 | 건수 |
|------|------|
| MAJOR | 3 |
| INFO | 3 |
| PASS | 12 |

---

### ~~BUG-18-01~~ — 카메라 fly-in 중심 좌표에 원본(비스케일) 블록 위치 사용 ✅ 수정됨 (2026-07-05)
**심각도:** MAJOR  
**파일:** `src/core/GameManager.ts:994-995`

**현상:**  
`_startCameraFlyIn()`에서 `data.zones`가 없는 레벨의 orbit target 중심을 원본 JSON 블록 위치 평균으로 계산한다.
```typescript
cx = data.blocks.reduce((s, b) => s + b.position[0], 0) / Math.max(data.blocks.length, 1);
cz = data.blocks.reduce((s, b) => s + b.position[2], 0) / Math.max(data.blocks.length, 1);
```
실제 블록은 `position * 0.88` 위치에 있으므로 카메라 타깃이 블록보다 약 **12% 먼 지점**을 향하게 된다.

**재현 조건:** `data.zones`가 없고 `data.initialCamera`도 없는 모든 레벨.

**수정 방향:**  
```typescript
const scaledBlocks = this.level!.getScaledBlocks();
cx = scaledBlocks.reduce((s, b) => s + b.position[0], 0) / Math.max(scaledBlocks.length, 1);
cz = scaledBlocks.reduce((s, b) => s + b.position[2], 0) / Math.max(scaledBlocks.length, 1);
```

---

### ~~BUG-18-02~~ — 조건부 사다리 메시가 원본(비스케일) 위치에 생성됨 ✅ 수정됨 (2026-07-05)
**심각도:** MAJOR  
**파일:** `src/core/GameManager.ts:550-553`, `1512-1519`

**현상:**  
스위치 활성화 시 나타나는 조건부 사다리 메시를 `getFinalBlockData(data, nodeId)`로 생성하는데, 내부에서 `data.blocks`(원본)을 참조한다.
```typescript
private getFinalBlockData(data: LevelData, nodeId: string): BlockData | null {
  const block = data.blocks.find(b => b.id === nodeId);  // ← 비스케일 위치
  ...
  return { ...block, position: sw.moveTarget };           // moveTarget도 비스케일
}
```
결과적으로 `buildLadderMesh(bdA, bdB)`가 원본 좌표 기준으로 사다리를 생성해 실제 블록 위치와 불일치한다.

**재현 조건:** `conditionalLadders`가 있는 레벨에서 스위치 활성화 시.

**수정 방향:**  
```typescript
private getFinalBlockData(nodeId: string): BlockData | null {
  const scaledMap = new Map(this.level!.getScaledBlocks().map(b => [b.id, b]));
  const block = scaledMap.get(nodeId);
  if (!block) return null;
  const sw = this._levelData?.switches?.find(s => s.targetNodeId === nodeId && s.type === 'move' && s.moveTarget);
  if (sw?.moveTarget) {
    return { ...block, position: [
      sw.moveTarget[0] * BLOCK_XZ_VISUAL,
      sw.moveTarget[1] * BLOCK_Y_VISUAL,
      sw.moveTarget[2] * BLOCK_XZ_VISUAL,
    ]};
  }
  return block;
}
```

---

### ~~BUG-18-03~~ — 레이저 emitter 높이 계산에 원본 size 사용 ✅ 수정됨 (2026-07-05)
**심각도:** MAJOR  
**파일:** `src/core/GameManager.ts:588-591`

**현상:**  
walkable 아닌 블록에서 레이저 emitter Y 위치를 계산할 때 원본 `bd.size[1]`(= 1.0)의 절반을 더한다.
```typescript
const bd = data.blocks.find(b => b.id === blockId);  // ← 비스케일
blk.mesh.getWorldPosition(wp);
wp.y += (bd?.size[1] ?? 1) / 2;  // 0.5 더함, 실제 상단은 +0.41
```
결과적으로 emitter가 블록 상단면보다 **0.09 유닛 높게** 계산된다.

**재현 조건:** 레이저가 있는 레벨, walkable 아닌 블록에서 레이저가 발사될 때.

**수정 방향:**  
```typescript
// 방법 A: 스케일된 블록 참조
const scaledMap = new Map(this.level!.getScaledBlocks().map(b => [b.id, b]));
const bd = scaledMap.get(blockId);
wp.y += (bd?.size[1] ?? BLOCK_Y_VISUAL) / 2;

// 방법 B: PathGraph node.halfHeight 직접 사용 (더 단순)
const node = this.graph?.getNode(blockId);
if (node) return node.position.clone();
```

---

### INFO-18-01 — PathGraph 상수 — 스케일 이후에도 유효
**파일:** `src/world/PathGraph.ts:14-16`

스케일 후 수치 검증:
- `XZ_THRESHOLD = 1.1`: 인접 거리 0.88 < 1.1 ✅, 2칸 1.76 > 1.1 ✅
- `MIN_XZ_DIST = 0.5`: 인접 0.88 > 0.5 ✅ (수직 적층 판정 정상)
- `SAME_FLOOR_Y = 0.15`: 동일 층 Y 차이 ≈ 0 ✅

코드 동작은 이상 없으나, 스케일 기반 주석이 없어 향후 혼란 가능.

---

### INFO-18-02 — `_buildAutoIllusionConns` 인접 필터 — 스케일 후 유효
**파일:** `src/core/GameManager.ts:1391-1392`

`xzDist <= 1.1 && yDiff < 0.15` 조건:
스케일된 인접 거리 0.88 < 1.1 → 인접 블록 올바르게 필터됨 ✅  
2칸 거리 1.76 > 1.1 → 착시 후보로 유지됨 ✅

---

### INFO-18-03 — RotatingSection — 스케일 미적용 (현재 레벨에서 미사용)
**파일:** `src/world/RotatingSection.ts:29-51`

`rotatingSections` 블록은 `localPosition`, `size`를 JSON 원본으로 사용하며 스케일 미적용. 현재 사용 중인 레벨 파일에 `rotatingSections`가 없으면 무영향. 향후 이 기능을 사용하는 레벨 제작 시 별도 스케일 처리 필요.

---

### PASS 항목

| 항목 | 파일 | 결론 |
|------|------|------|
| `Level.ts` scaleBlock | `Level.ts:278-291` | ✅ position·size 모두 정확히 스케일, scaledBlockMap 사용 |
| `Level.ts` 가시 메시 | `Level.ts:306` | ✅ `buildSpikesMesh(bd)` — scaledBlocks 기반 |
| `Level.ts` 사다리 메시 | `Level.ts:326` | ✅ `buildLadderMesh(bdA, bdB)` — scaledBlockMap 기반 |
| `Level.ts` 링 이펙트 | `Level.ts:347` | ✅ `_buildRingEffect(bd)` — scaledBlockMap 기반 |
| `Level.ts` SeamMesh | `Level.ts:362` | ✅ `this.levelBlocks = scaledBlocks` |
| `WorldRotateManager` bounds | `GameManager.ts:641` | ✅ `Box3.setFromObject(level.getGroup())` — 메시 월드 좌표 기반 |
| `PathGraph.build()` halfHeight | `PathGraph.ts:45-49` | ✅ 스케일된 `size[1]/2` 로 halfHeight 정확히 계산됨 |
| `_buildAutoIllusionConns` | `GameManager.ts:468` | ✅ `{ ...data, blocks: level.getScaledBlocks() }` 전달 |
| `_buildIllusionConnsWorldSpace` | `GameManager.ts:1319` | ✅ `level.getScaledBlocks()` 기반 변환 |
| `SwitchManager` | — | ✅ PathGraph 노드 위치 기반, 스케일 독립적 |
| `ElevatorManager` | — | ✅ PathGraph 노드 기반 |
| `PatrolManager` / `TeleportManager` / `StarManager` | — | ✅ 모두 PathNode 월드 좌표 기반 |

---

### 우선순위 요약

| 순위 | ID | 영향 |
|------|----|------|
| 1 | BUG-18-01 | 대부분 레벨에서 카메라 타깃 오프셋 |
| 2 | BUG-18-02 | conditionalLadders 있는 레벨의 사다리 위치 오류 |
| 3 | BUG-18-03 | 레이저 있는 레벨의 emitter 높이 미세 오차 |

---

## 17차 QA (2026-06-28) — side-face 마커 / CharacterController XZ 오프셋 / 에디터 goalFace 복원

### 점검 범위
- `src/core/GameManager.ts` — `_getMarkerDir`, `setupGoalMarker`, `setupMidpointMarker`, `_refreshWorldElements`, `_revealTutorialGoal`
- `src/character/CharacterController.ts` — XZ 오프셋 제거 수정 (62040b1)
- `src/editor/LevelEditor.ts` — goalFace 드롭다운 UI, compile/load/persist
- `src/world/Level.ts` — BUG-16-06 fix 검증

### 결과 요약

| 등급 | 건수 |
|------|------|
| MEDIUM | 1 |
| LOW | 2 |
| PASS (False Positive 제거) | 5 |

---

### ~~BUG-17-01~~ — `_refreshWorldElements()` 마커 quaternion 미갱신 ✅ 수정됨 (2026-06-28)
**심각도:** MEDIUM  
**파일:** `src/core/GameManager.ts:1344-1376`

**현상:**  
`_refreshWorldElements()`는 맵 회전 후 goalMarker / midpointMarker의 **position**을 `toLocal()`로 올바르게 갱신하지만, 링의 **quaternion** (방향)은 갱신하지 않는다. 초기 `setupGoalMarker()`에서 설정한 로컬 quaternion이 그대로 유지된 채 levelGroup이 회전하면, 링의 월드 공간 방향이 바뀌어 wrong face를 향하게 된다.

**재현 조건:**  
`mapRotateBlocks`가 있는 레벨에서 회전 블록을 밟으면 — goal/midpoint 링이 예상 면이 아닌 방향을 가리키며 틀어짐.

**수정 방향:**  
`_refreshWorldElements()`의 goalMarker / midpointMarker 블록 안에 각각 `quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir)` 갱신을 추가한다.

```typescript
// goalMarker 재배치 (GSAP 재시작)
if (goalMesh && this.goalMarker) {
  // ... position 갱신 (기존) ...
  this.goalMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);  // 추가
}

// midpointMarker 재배치
if (this.midpointBlockId && this.midpointMarker) {
  // ... position 갱신 (기존) ...
  this.midpointMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);  // 추가
}
```

---

### ~~BUG-17-02~~ — 에디터 레벨 로드 후 `goalFaceSelect` 초기값 미복원 ✅ 수정됨 (2026-06-28)
**심각도:** LOW  
**파일:** `src/editor/LevelEditor.ts:906-923`

**현상:**  
`loadCustomStage()` / `loadBuiltinStage()`에서 `loadFromLevelData()` 호출 후 `this.goalFace`가 올바르게 설정되지만, 이어서 `rebuildPanel()`이 호출되어 `buildPanel()`이 새 `goalFaceSelect` 드롭다운을 생성할 때 `value`를 `this.goalFace`로 초기화하지 않아 항상 "+Y (Top)"으로 표시된다.

**위험 시나리오:**  
`goal.face = [0,-1,0]`으로 저장된 레벨을 에디터에서 불러온 뒤, 드롭다운을 보지 않고 그냥 "Set as Goal"을 클릭하면 face가 `[0,1,0]`으로 덮어쓰여진다.

**수정 방향:**  
`buildPanel()`에서 goalFaceSelect 옵션 생성 직후 현재 `this.goalFace` / `this.goalFlipped` 값으로 드롭다운 초기값 설정:

```typescript
// 옵션 생성 직후
if (this.goalFace) {
  this.goalFaceSelect.value = this.goalFace.join(',');
} else {
  this.goalFaceSelect.value = this.goalFlipped ? '0,-1,0' : '0,1,0';
}
```

---

### ~~WARN-17-01~~ — `_revealTutorialGoal()` goalGlow position을 월드 좌표로 직접 설정 ✅ 수정됨 (2026-06-28)
**심각도:** LOW (현재 무해, 향후 위험)  
**파일:** `src/core/GameManager.ts:1575`

**현상:**  
`this.goalGlow.position.set(glowPos.x, glowPos.y, glowPos.z)` — `glowPos`는 월드 좌표이지만 goalGlow가 `level.getGroup()` 자식으로 등록되어 있어 로컬 좌표 기대. `_refreshWorldElements()`의 동일 로직은 `toLocal()` 사용(1341줄).

**현재 무해한 이유:**  
튜토리얼 레벨은 `mapRotateBlocks`가 없으므로 levelGroup 오프셋 상쇄 시 local ≈ world. 그러나 mapRotate 있는 레벨에 `_revealTutorialGoal`을 재사용할 경우 glowPos가 틀어짐.

**수정 방향:**  
```typescript
const group = this.level!.getGroup();
this.goalGlow.position.copy(group.worldToLocal(glowPos));
```

---

### PASS 항목 (False Positive 검토 완료)

| 항목 | 파일 | 결론 |
|------|------|------|
| `CharacterController.onComplete` `u.x*h` 오프셋 불일치 | `CharacterController.ts:224-226` | ✅ `_gravityUp`은 항상 (0,±1,0) → u.x=u.z=0 항상. 덧셈 항이 0이라 실제 영향 없음 |
| `_getMarkerDir` 반환 벡터 비정규화 | `GameManager.ts:1603` | ✅ `applyQuaternion`은 회전 연산(길이 보존) → 단위 벡터 유지 |
| `setFromUnitVectors(Z, (0,0,-1))` 반평행 예외 | `GameManager.ts:1631,1653` | ✅ Three.js r125+에서 반평행 케이스 내부 처리(수직 보조축 사용). ^0.184 사용 중 |
| `_refreshWorldElements` goalGlow `toLocal` 미사용 | `GameManager.ts:1341` | ✅ `this.goalGlow.position.copy(toLocal(gwp.x, gwp.y, gwp.z))` — 이미 사용 중 |
| BUG-16-02/04/05/06 수정 검증 | `GameManager.ts`, `LevelEditor.ts`, `Level.ts` | ✅ 모두 의도대로 수정됨. TypeScript 에러 없음 (`npx tsc --noEmit` 클린) |

---

### 우선순위 요약

| 순위 | ID | 영향 |
|------|----|------|
| 1 | BUG-17-01 | mapRotate 레벨에서 골/중간지점 링 방향 오류 (시각적 버그) |
| 2 | BUG-17-02 | 에디터에서 side-face goal 로드 후 드롭다운 표시 오류 |
| 3 | WARN-17-01 | 튜토리얼 goalGlow 위치 코드 일관성 (현재 무해) |
