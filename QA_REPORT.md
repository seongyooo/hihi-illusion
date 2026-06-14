# QA 리포트 — Monument Valley Clone

> 최종 업데이트: 2026-06-15  
> QA 범위: Phase 1 ~ Phase 5 + 2차 QA (전체 코드 재검토) + 3차 QA (GameManager 신규 코드 전체 검토) + 신규 블록 메커닉 기획 + 4차 QA (TeleportManager 포함 전체 재검토) + 5차 QA (텔레포트 미동작 버그 추적) + 6차 QA (StarManager 신규 구현 검토) + 7차 QA (Stage 11 / 반응형 UI / EditorLobby 삭제 버튼) + 8차 QA (GraphicsSettings / SettingsScreen / SettingsPreview / 품질 전환 전체 검토) + 9차 QA (Pressure Switch Type A spawn gate / Stage 12 / LevelEditor SWITCHES 섹션) + 10차 QA (Stage 13 / Stage 15 "Double Key" / StageSelectUI 리팩터 / SwitchManager 내부 버그 수정) + 11차 QA (QA-SP1/SP2 dispose 수정 검증) + 12차 QA (registry auto-discovery / initialCamera / Stage 15 리디자인 / LevelEditor 스위치 per-target moveTarget) + 13차 QA (PatrolManager 신규 / 음수 방향 / CharacterController 인접성 검사 / StarManager 블록 부모화) + **14차 QA (mapRotateBlocks / 에디터 상태 표시 / gravity flip 착시 / 요소 재배치)**

---

## 14차 QA (2026-06-15) — mapRotateBlocks / 에디터 상태 표시 / gravity flip 착시 / 요소 재배치

### 변경 내용
1. 에디터 로드 시 gravityFlip / mapRotate 블록 색상 복원
2. 선택 패널에 현재 설정 상태 표시 및 편집 가능하도록 개선
3. Gravity flip 후 착시 작동 (IllusionManager.setFlipped)
4. Map Rotate 완료 후 요소(goalGlow/goalMarker/midpointMarker/텔레포터 링) 재배치

### 결과

| ID | 항목 | 판정 |
|----|------|------|
| QA14-01 | 에디터 로드 시 gravityFlip 블록 청록색 복원 | ✅ 정상 |
| QA14-02 | 에디터 로드 시 mapRotate 블록 주황색 복원 | ✅ 정상 |
| QA14-03 | 선택 블록이 start이면 패널에 ✓ START 표시 | ✅ 정상 |
| QA14-04 | 선택 블록이 goal이면 ✓ GOAL / ✓ FLIPPED GOAL 표시 | ✅ 정상 |
| QA14-05 | gravity flip 버튼 ON/OFF 상태 텍스트·색상 반영 | ✅ 정상 |
| QA14-06 | mapRotate 선택 시 기존 axis/angle/pivotY 값 inputs에 채움 | ✅ 정상 |
| QA14-07 | mapRotate Add / Update / Remove 버튼 전환 | ✅ 정상 |
| QA14-08 | IllusionManager.setFlipped() — currentElevation 부호 반전 | ✅ 정상 |
| QA14-09 | gravity flip 시 illusionMgr.setFlipped(newFlipped) 호출 | ✅ 정상 |
| QA14-10 | _refreshWorldElements() null 가드 완전성 | ✅ 정상 |
| QA14-11 | _refreshWorldElements() GSAP killTweensOf 처리 | ✅ 정상 |
| QA14-12 | TeleportManager.repositionRings() worldToLocal 변환 | ✅ 정상 |
| QA14-13 | unloadCurrent() cleanup 완전성 | ✅ 정상 |
| QA14-14 | TypeScript 컴파일 | ✅ 에러 없음 |

### 경미한 이슈 (게임플레이 영향 없음)

**[QA14-W1] TeleportManager.reposition() — 데드 코드 + 색상 버그**
- `reposition()` 메서드 내부에서 `nodeColors`를 clear한 뒤 재생성하므로 저장된 색상을 복구할 수 없어 항상 `PAIR_COLORS[0]`만 사용됨
- **실제 영향**: 없음 — 해당 메서드는 현재 GameManager 어디서도 호출되지 않음 (`repositionRings()`만 사용)
- 권장: 데드 코드 제거

**[QA14-W2] updateSelectedPanel() else 분기 — 이전 블록 입력값 잔류**
- 블록 미선택 시 `colorInput`, `walkableInput`, `spikeInput`, `spikeTypeSelect`를 기본값으로 초기화하지 않음
- **실제 영향**: 없음 — `selectedBlock`이 null이므로 해당 입력을 건드려도 데이터 변경 없음. 시각적 혼란만 가능
- 권장: 미선택 분기에 기본값 리셋 추가

### 종합 판정

**게임플레이 영향 버그: 없음 (PASS)**

---

## 13차 QA (2026-06-14) — PatrolManager 신규 / 음수 방향 / CharacterController 인접성 검사 / StarManager 블록 부모화

### 변경 내용

| 항목 | 파일 |
|------|------|
| `PatrolManager.ts` — 신규 파일: axis `'-x'|'-y'|'-z'` 음수 방향 지원, 인게임 점선 제거 | `PatrolManager.ts` |
| `LevelEditor.ts` — 2D 캔버스 축 오버레이 제거, 3D `ArrowHelper` 축 레이블로 교체; 패트롤 axis 드롭다운 ±6방향 추가 | `LevelEditor.ts` |
| `CharacterController.ts` — `_advance()` 인접성 검사 추가: `prev.neighbors.includes(node)` 실패 시 `stop()` | `CharacterController.ts` |
| `StarManager.ts` — 별 메시를 `scene.add` → `node.mesh.add`(블록 자식)로 변경, 파티클 위치 `getWorldPosition()`, `dispose()` `removeFromParent()` | `StarManager.ts` |
| `Level.ts` — `LevelData.patrols[].axis` 타입 `'x'|'y'|'z'` → `'x'|'-x'|'y'|'-y'|'z'|'-z'` | `Level.ts` |

---

### 정상 확인 항목

| 항목 | 확인 위치 | 결과 |
|------|---------|------|
| `PatrolDef.axis` — `'-x'|'-y'|'-z'` 포함 6종 타입 정의 | `PatrolManager.ts:7` | ✅ |
| `_startLoop()` — `sign = axis.startsWith('-') ? -1 : 1`으로 부호 추출, `baseAxis = axis.replace('-','')` | `PatrolManager.ts:74-75` | ✅ |
| target 계산 — `originX + (baseAxis === 'x' ? sign * distance : 0)` 3축 올바름 | `PatrolManager.ts:77-79` | ✅ |
| `dispose()` — `tween.kill()` → `mesh.position.set(origin*)` 위치 복원 | `PatrolManager.ts:63-70` | ✅ |
| `update()` — `tween.isActive()` 중일 때만 50ms 스로틀로 `graph.refresh()` | `PatrolManager.ts:48-60` | ✅ |
| `_buildAxisArrows()` — 원점 (-1,0.05,-1)에 X(빨강)/Z(파랑)/Y(초록) ArrowHelper 추가 | `LevelEditor.ts:2335-2370` | ✅ |
| `_updateAxisLabels()` — 매 프레임 팁 위치 camera.project()로 HTML 레이블 갱신 | `LevelEditor.ts:2373-2385` | ✅ |
| 패트롤 axis 드롭다운 — `+X/-X/+Z/-Z/+Y/-Y` 6개 옵션 | `LevelEditor.ts:1120-1131` | ✅ |
| 목적지 pick — `baseAxis = axis.replace('-','')` 추출 후 거리 계산 | `LevelEditor.ts:1155-1161` | ✅ |
| 미리보기 화살표 — `sign * 1`로 음수 방향 화살표 표시 | `LevelEditor.ts:1200-1207` | ✅ |
| `_rebuildPatrolArrows()` — 음수 axis 부호 추출 후 ArrowHelper 방향 벡터 생성 | `LevelEditor.ts:1824-1841` | ✅ |
| `CharacterController._advance()` — `prev.neighbors.includes(node)` 실패 시 `stop()` → `currentNode` = prev 유지 | `CharacterController.ts:159-163` | ✅ |
| `stop()` 후 `update()` — `currentNode`(prev)의 `getWorldPosition()`으로 정착 | `CharacterController.ts:88-93` | ✅ |
| 고정 블록 이동 — neighbors 변하지 않으므로 기존 pathfinding 무영향 | `PathGraph.ts:129-151` | ✅ |
| `StarManager._createStarMesh()` — `mesh.position.set(0, localY, 0)` 로컬 좌표, `node.mesh.add(mesh)` | `StarManager.ts:42-43` | ✅ |
| 패트롤 블록 이동 시 별 자동 추종 — Three.js 씬 그래프 부모화로 처리 | `StarManager.ts:43` | ✅ |
| `tryCollect()` — `mesh.getWorldPosition(wp)` 월드 좌표로 파티클 버스트 위치 변환 | `StarManager.ts:121-123` | ✅ |
| `dispose()` — `mesh.removeFromParent()` (블록 자식이든 씬 직속이든 처리) | `StarManager.ts:165,174` | ✅ |
| `repositionStar()` — `mesh.parent !== node.mesh` 시 재부모화 | `StarManager.ts:90-93` | ✅ |

---

### 신규 버그

---

#### QA-P01 — `unloadCurrent()` StarManager double-dispose: `level.dispose()` → `starMgr.dispose()` 순서 역전 필요 (`GameManager.ts:987,995`) — **P2**

`StarManager`가 별 메시를 블록 메시(`node.mesh`)의 자식으로 부모화하면서 dispose 순서가 충돌한다.

현재 `unloadCurrent()` 실행 순서:

```typescript
// GameManager.ts
this.level.dispose();    // line 987 — group.traverse()로 별 geometry/material 먼저 dispose
// ...
this.starMgr?.dispose(); // line 995 — 이미 dispose된 geometry/material 재 dispose
```

`Level.dispose()`는 `this.group.traverse(child => { if (child instanceof THREE.Mesh) { child.geometry.dispose(); ... } })` 를 호출한다. 별 메시는 블록 그룹(level.group의 자손 THREE.Mesh)이므로 traverse가 이를 방문해 geometry/material을 먼저 해제한다. 이후 `StarManager.dispose()`가 동일 geometry/material을 다시 dispose 시도한다.

WebGL에서 이미 삭제된 버퍼를 재삭제하는 것은 대부분 무음 실패하지만 일부 WebGL 구현에서 오류 로그가 발생하며, 별 collect 도중(collectingMeshes) 레벨 언로드 시 타이밍에 따라 문제가 생길 수 있다.

**수정 방향:**
```typescript
// unloadCurrent() 내 순서 교체
this.starMgr?.dispose();  // ← 먼저 블록에서 제거 + 리소스 해제
this.starMgr = null;
// ...
this.level.dispose();      // ← 이후 블록 메시 해제 (별은 이미 제거됨)
```

---

#### QA-P02 — `LevelEditor.dispose()` 3D 축 화살표 미정리 (`LevelEditor.ts:2704`) — **P3**

`_buildAxisArrows()`에서 생성한 `THREE.ArrowHelper` 객체 3개가 `LevelEditor.dispose()`에서 씬에서 제거되지 않는다. `patrolArrows`는 정리되고 있으나 `axisArrows`는 누락됐다.

```typescript
// dispose() — 현재 (패트롤 화살표만 정리)
for (const arr of this.patrolArrows) this.scene.remove(arr);
this.patrolArrows = [];
// axisArrows 정리 없음 ← 버그
```

ArrowHelper는 내부적으로 LineSegments + Mesh(cone)를 가지므로 geometry와 material이 GPU에 남는다. 에디터가 열렸다 닫힐 때마다 3개씩 누적된다.

**수정 방향:**
```typescript
for (const arr of this.axisArrows) this.scene.remove(arr);
this.axisArrows = [];
```

---

#### QA-P03 — `CharacterController`: 패트롤 블록 탑승 애니메이션 완료 후 위치 스냅 (`CharacterController.ts:188`) — **P4**

`_advance()`에서 GSAP는 `node.position.x/y/z`를 **호출 시점**에 캡처해 고정값으로 트위닝한다. 0.25s 애니메이션 동안 패트롤 블록이 이동하면, 캐릭터는 블록의 T0 위치로 애니메이션 완료 후 `update()`가 블록의 T1 현재 위치로 즉시 스냅한다.

이동 속도(duration ≥ 1.0s)와 애니메이션 길이(0.25s) 차이를 고려하면 최대 스냅 거리는 0.25 / duration × distance units이다. duration=1.5, distance=3 기준 최대 약 0.5 units. 빠른 패트롤 블록에서 시각적으로 감지될 수 있다.

**권장 조치:** `_advance()`에서 패트롤 노드로 이동하는 마지막 스텝에 한해 `mesh.getWorldPosition()`으로 실시간 좌표를 읽거나, 패트롤 블록 탑승 전 블록이 정지(repeatDelay 구간)할 때까지 대기하는 로직 추가. 현재 게임 규모에서는 P4(미관 이슈)로 분류.

---

### 13차 QA 신규 버그 요약

| ID | 우선순위 | 상태 | 내용 | 파일 |
|---|---|---|---|---|
| QA-P01 | P2 | ✅ 수정 | `unloadCurrent()` 에서 `starMgr.dispose()` → `level.dispose()` 순서 교체 | `GameManager.ts` |
| QA-P02 | P3 | ✅ 수정 | `LevelEditor.dispose()`에 `axisArrows` 정리 루프 추가 | `LevelEditor.ts` |
| QA-P03 | P4 | ✅ 수정 | `_advance()` onComplete에서 `node.mesh.getWorldPosition()`으로 즉시 동기화 | `CharacterController.ts` |

---

## 12차 QA (2026-06-10) — registry auto-discovery / initialCamera / Stage 15 리디자인 / LevelEditor per-target moveTarget

### 변경 내용

| 항목 | 파일 |
|------|------|
| `registry.ts` — `import.meta.glob` 자동 탐색, `CUSTOM_STAGE_NUMS` 배열 export | `registry.ts` |
| `StageSelectUI` — `BUILTIN_STAGE_NUMS = new Set(CUSTOM_STAGE_NUMS)` 자동 파생 | `StageSelectUI.ts` |
| `GameManager` — `builtinIds` `CUSTOM_STAGE_NUMS` 자동 파생, `_startCameraFlyIn()` 헬퍼 추출 + `initialCamera` 지원 | `GameManager.ts` |
| `Level.ts` — `LevelData.initialCamera` 인터페이스 추가 | `Level.ts` |
| `LevelEditor` — 스위치 per-target `moveTarget` 리팩터, CAMERA 패널 추가, `loadBuiltinStage` glob 자동 탐색, select hover/emissive 수정 | `LevelEditor.ts` |
| `EditorLobby` — `CUSTOM_STAGE_NUMS` 자동 파생 | `EditorLobby.ts` |
| `level_custom_1~13, 15.json` — `initialCamera` 필드 추가 (모든 스테이지) | `levels/*.json` |
| `level_custom_5.json` — illusion 2쌍 추가 (b007↔b003, b007↔b002) | `level_custom_5.json` |
| `level_custom_15.json` — Stage 15 "Double Key" 리디자인: b007/b008 제거, b015/b016 추가, b009 3-target move 스위치 | `level_custom_15.json` |

---

### 정상 확인 항목

| 항목 | 확인 위치 | 결과 |
|------|---------|------|
| `CUSTOM_STAGE_NUMS` — `import.meta.glob` 키에서 숫자 파싱, 오름차순 정렬 | `registry.ts:10-15` | ✅ |
| `BUILTIN_STAGE_NUMS` — `CUSTOM_STAGE_NUMS`에서 자동 파생 → QA-T04 해소 | `StageSelectUI.ts:4` | ✅ |
| `builtinIds` — `CUSTOM_STAGE_NUMS`에서 `Object.fromEntries` 파생 | `GameManager.ts:276` | ✅ |
| `loadBuiltinStage` — 하드코딩 fileMap → `import.meta.glob` 자동 탐색 | `LevelEditor.ts:1831` | ✅ |
| `EditorLobby` — `CUSTOM_STAGE_NUMS` 순회로 카드 자동 생성 | `EditorLobby.ts:57` | ✅ |
| `LevelData.initialCamera` 인터페이스 정의 | `Level.ts:102-108` | ✅ |
| `_startCameraFlyIn()` — `initialCamera` 있으면 구면 좌표 → finalPos 계산, 없으면 기본값 | `GameManager.ts:636` | ✅ |
| `updatePreview()` 좌표 공식과 `_startCameraFlyIn()` 공식 일치 (sin/cos 동일) | `LevelEditor.ts:856`, `GameManager.ts:647` | ✅ |
| Capture 버튼 역산 공식 — `atan2(off.x, off.z)` → azimuth 올바름 | `LevelEditor.ts:879` | ✅ |
| SwitchConn `targetNodeIds: string[]` → `targets: SwitchTarget[]` 리팩터 | `LevelEditor.ts:31-34` | ✅ |
| 에디터 스위치 편집 시 `swPendingTargets = sw.targets.map(t => ({...t}))` 복원 | `LevelEditor.ts:1172` | ✅ |
| `exportLevelData()` — `targets.map(t => {...moveTarget: t.moveTarget})` per-target 내보내기 | `LevelEditor.ts:1667` | ✅ |
| `loadFromLevelData()` 그룹핑 키 — moveTarget 제외 `switchNodeId|mode|type` | `LevelEditor.ts:1773` | ✅ |
| `setBlockEmissive()` — `Array.isArray` 분기로 단일 material도 처리 | `LevelEditor.ts:1334` | ✅ |
| `updateSelectHover()` — select 도구일 때 hover 하이라이트 | `LevelEditor.ts:1425` | ✅ |
| `clearHoverHighlight()` — 선택 블록이면 선택 색(0x222244)으로 복원 | `LevelEditor.ts:1520` | ✅ |
| Stage 15 b009→b010 이동: [7.5,0.25,3.5]→[5.5,0.25,3.5] (b011 인접 XZ=1.0) | `level_custom_15.json:244-252` | ✅ |
| Stage 15 b009→b015 이동: [7.5,0.25,6.5]→[6.5,0.25,6.5] (b006 인접 XZ=1.0) | `level_custom_15.json:254-264` | ✅ |
| Stage 15 b009→b016 이동: [3.5,0.25,6.5]→[4.5,0.25,6.5] (b006 인접 XZ=1.0) | `level_custom_15.json:265-276` | ✅ |
| Stage 15 전체 경로: b001→b003(spawn)→b006(mid)→b009(move×3)→b015(★)→b016(★)→b011→b010→b012→b013(★)→b014(goal) | `level_custom_15.json` | ✅ |
| b015/b016 초기 위치 — 어떤 walkable 블록과도 XZ=1.0 이내 인접 없음 (고립) | `level_custom_15.json` | ✅ |
| b011→b010(이동 전) XZ=√8 ≈ 2.83 비인접 / b011→b010(이동 후) XZ=1.0 인접 | `level_custom_15.json` | ✅ |
| b011→b012 XZ=2.0 비인접 (b010 필수 경유 보장) | `level_custom_15.json` | ✅ |

---

### 신규 버그

---

#### QA-T07 — Stage 15 illusionConnections에 존재하지 않는 노드 b007, b008 참조 (`level_custom_15.json:278-290`) — **P1**

리디자인에서 b007, b008 블록이 삭제됐으나 `illusionConnections`의 두 항목이 갱신되지 않았다.

```json
// 현재 (버그)
{ "nodeA": "b007", "nodeB": "b013", ... }   ← b007 블록 없음
{ "nodeA": "b008", "nodeB": "b012", ... }   ← b008 블록 없음
```

IllusionManager는 nodeId로 블록 메시를 조회한다. b007/b008가 없으면 조회 결과가 `undefined`가 되어 런타임 오류 또는 무음 실패가 발생한다.

리디자인 후 b015/b016은 이동 후 b006 인접 블록으로 직접 도달 가능하므로 환상 연결 자체가 불필요하다. 두 illusion 항목을 **삭제**하는 것이 올바른 수정이다.

---

#### QA-T08 — `_startCameraFlyIn()` startPos Y 계산 오류 (`GameManager.ts:660`) — **P4**

```typescript
// 현재 (버그)
const startPos = [
  cx + (finalPos[0] - cx) * 1.8,
  finalPos[1] * 1.8,          ← targetY != 0일 때 부정확
  cz + (finalPos[2] - cz) * 1.8,
];

// 올바른 수정
const startPos = [
  cx + (finalPos[0] - cx) * 1.8,
  targetY + (finalPos[1] - targetY) * 1.8,
  cz + (finalPos[2] - cz) * 1.8,
];
```

현재 모든 레벨의 `targetY: 0`이므로 잠재 버그. `targetY != 0` 레벨 추가 시 인트로 카메라 시작 높이가 어긋난다.

---

#### QA-T09 — `registry.ts` 자동 파생으로 커스텀 `title` / `backgroundColor` 손실 (`registry.ts:27-30`) — **P4**

자동 파생 LEVELS 항목의 `title`이 전부 `"Stage N"`으로 통일되고, `backgroundColor`가 `'#E8EEF5'`로 고정된다.

| 스테이지 | 기존 title | 기존 backgroundColor |
|---------|-----------|----------------------|
| Stage 1 | "The Prologue" | `#F5F0E8` |
| Stage 7 | "The Relay" | `#E8F0EE` |
| Stage 8 | "The Elevator" | `#F0EDE8` |
| Stage 9 | "Mirage" | `#EDE8F0` |
| Stage 10 | "Convergence" | `#E8EBF0` |
| Stage 12 | "Pressure Gate" | `#E8F0EE` |
| Stage 15 | "Double Key" | `#ECF0EA` |

현재 `LevelMeta.title`은 `EditorLobby` 카드 표시에 사용하지 않는 것으로 변경됨 (EditorLobby도 `CUSTOM_STAGE_NUMS`로 리팩터). `LevelMeta.backgroundColor`는 StageSelectUI 프리뷰에 사용될 경우 영향 있음. 레벨 JSON `name` / `backgroundColor` 필드는 GameManager에서 직접 사용하므로 인게임 표시는 무영향.

**권장 조치:** 영향도 낮음. 단, `LevelMeta.backgroundColor`가 StageSelectUI 카드 배경색에 쓰일 경우 추후 JSON `backgroundColor` 필드를 읽어 LevelMeta에 반영하는 방식으로 해소.

---

#### QA-T10 — `rebuildCameraPanel()` 호출 후 preview 텍스트 미갱신 (`LevelEditor.ts:1197`) — **P4**

`loadFromLevelData()` → `rebuildCameraPanel()` 호출 시 슬라이더 값은 업데이트되지만, `updatePreview()` 함수가 `buildSection` 클로저 내 지역 변수라 `rebuildCameraPanel()`에서 접근 불가. 결과적으로 레벨 로드 후 카메라 패널의 "pos offset: (...)" 텍스트가 이전 값 또는 기본값을 표시한다.

**권장 조치:** `previewEl`을 클래스 멤버로 올리거나, `rebuildCameraPanel()` 내에서 직접 offset 계산 후 갱신.

---

### 12차 QA 신규 버그 요약

| ID | 우선순위 | 상태 | 내용 | 파일 |
|---|---|---|---|---|
| QA-T07 | P1 | 🔴 미수정 | Stage 15 illusionConnections에 b007/b008 존재하지 않는 노드 참조 — IllusionManager 런타임 오류 가능 | `level_custom_15.json:278-290` |
| QA-T08 | P4 | 🔴 미수정 | `_startCameraFlyIn()` startPos Y = `finalPos[1]*1.8` — targetY≠0 시 부정확 (현재 레벨 전부 targetY=0이므로 잠재 버그) | `GameManager.ts:660` |
| QA-T09 | P4 | ⚠️ 유지보수 | registry 자동 파생으로 커스텀 title/backgroundColor 손실 — 인게임 영향 없음, EditorLobby 카드명 손실 | `registry.ts:27-30` |
| QA-T10 | P4 | 🔴 미수정 | 레벨 로드 후 카메라 패널 preview 텍스트 미갱신 (updatePreview 클로저 밖에서 접근 불가) | `LevelEditor.ts:1197` |

---

## 11차 QA (2026-06-10) — QA-SP1/SP2 dispose 수정 / QA-T02 name / QA-T05 illusion 분리 검증

### 변경 내용

| 항목 | 파일 |
|------|------|
| `SwitchManager.dispose()` — spawn targetMesh `traverse` 기반 geometry/material 해제 + scale tween 취소 | `SwitchManager.ts:276-287` |
| `level_custom_13.json` — `name` "Custom Level" → "Stage 13" | `level_custom_13.json:3` |
| `level_custom_13.json` — b015↔b024 azimuth -182.8°, b015↔b023 azimuth -176.8°로 3° 분리 | `level_custom_13.json:548,555` |

---

### 정상 확인 항목

| 항목 | 확인 위치 | 결과 |
|------|---------|------|
| `gsap.killTweensOf(state.targetMesh.scale)` dispose 진입 시 scale tween 취소 | `SwitchManager.ts:278` | ✅ |
| `traverse()` — `THREE.Mesh` 자식 순회하여 geometry.dispose() + material.dispose() 호출 | `SwitchManager.ts:280-286` | ✅ |
| `traverse` 방식이 `Object3D` 직접 접근(`.geometry`) 보다 안전 — 계층 구조 있는 블록도 처리 | `SwitchManager.ts:280` | ✅ |
| `level_custom_13.json` name = "Stage 13" | `level_custom_13.json:3` | ✅ |
| b015↔b024 활성 범위 [-184.8°, -180.8°] / b015↔b023 활성 범위 [-178.8°, -174.8°] — 2° 간격, 중복 없음 | `level_custom_13.json:548,555` | ✅ |
| `attachedMeshes`는 각 매니저(StarManager 등)에서 별도 dispose — SwitchManager에서 dispose 불필요 | `SwitchManager.ts:290` | ✅ |
| `despawnTarget()` onComplete 중 dispose 호출 시: `killTweensOf(scale)` → tween 중단(onComplete 미호출) → `removeFromParent()` 정상 처리 | `SwitchManager.ts:234,278` | ✅ |

---

### 신규 버그

---

#### QA-T06 — `dispose()` move 타입 targetMesh.position tween 미취소 (`SwitchManager.ts:269`)

`dispose()` 내에 `gsap.killTweensOf(state.targetMesh.scale)` (spawn용)은 추가됐으나, `move` 타입 스위치의 `position` tween 취소가 없다.

`moveTarget()` tween의 클로저:

```typescript
gsap.to(mesh.position, {
  onUpdate:   () => { graph.refresh(); },       // 레벨 언로드 후에도 호출 가능
  onComplete: () => { state.isMoving = false; graph.refresh(); },
});
```

레벨 언로드(`dispose()`) 이후에도 `onUpdate` / `onComplete`가 발화하면 이미 해제된 `graph`에 `refresh()` 호출이 일어난다. PathGraph가 내부적으로 Three.js 구조를 참조한다면 크래시 가능성이 있다.

**수정 방향:**
```typescript
// dispose() 내, targetMesh 처리 앞에 추가
if (state.def.type === 'move' && state.targetMesh) {
  gsap.killTweensOf(state.targetMesh.position);
}
```

---

### 11차 QA 신규 버그 요약

| ID | 우선순위 | 상태 | 내용 | 파일 |
|---|---|---|---|---|
| QA-T06 | P2 | 🔴 미수정 | `dispose()` move 타입 `position` tween 미취소 — 언로드 후 `graph.refresh()` 호출 가능 | `SwitchManager.ts:269` |

---

## 10차 QA (2026-06-10) — Stage 13 / Stage 15 "Double Key" / StageSelectUI 리팩터 / SwitchManager 내부 버그 수정

### 변경 내용

| 항목 | 파일 |
|------|------|
| `registry.ts` — `custom_stage_13`, `custom_stage_15` 등록 | `registry.ts` |
| `StageSelectUI` — `BUILTIN_STAGES` 숫자 → `BUILTIN_STAGE_NUMS` Set 리팩터 (13, 15 포함) | `StageSelectUI.ts` |
| `GameManager` — `builtinIds[13]`, `builtinIds[15]` 등록 확인 | `GameManager.ts` |
| `LevelEditor` — `fileMap[13]`, `fileMap[15]` 등록 | `LevelEditor.ts` |
| `SwitchManager.despawnTarget()` — scale-in 진행 중 despawn 시 `gsap.killTweensOf(mesh.scale)` 추가 | `SwitchManager.ts:187` |
| `level_custom_13.json` — Stage 13 "대규모 스폰 + 환상 레이어" 레벨 | `levels/level_custom_13.json` (기존 파일) |
| `level_custom_15.json` — Stage 15 "Double Key" 신규 레벨 | `levels/level_custom_15.json` (신규) |

---

### 정상 확인 항목

| 항목 | 확인 위치 | 결과 |
|------|---------|------|
| `BUILTIN_STAGE_NUMS` Set에 1~13, 15 포함 (14 제외) | `StageSelectUI.ts:4` | ✅ |
| 스테이지 선택 UI: stage 14 → disabled/locked | `StageSelectUI.ts:44` | ✅ |
| `builtinIds[13]` = `'custom_stage_13'` 등록 | `GameManager.ts:291` | ✅ |
| `builtinIds[15]` = `'custom_stage_15'` 등록 | `GameManager.ts:292` | ✅ |
| `fileMap[13]`, `fileMap[15]` 에디터 로드 경로 등록 | `LevelEditor.ts:1468-1469` | ✅ |
| `registry.ts` `custom_stage_13` / `custom_stage_15` 등록 | `registry.ts:90-100` | ✅ |
| `despawnTarget()` — `gsap.killTweensOf(mesh.scale)` scale-out 전 취소 | `SwitchManager.ts:187` | ✅ |
| Stage 15 `character.startNodeId` = `b001` 존재 | `level_custom_15.json` | ✅ |
| Stage 15 `midpoint.blockId` = `b006` 존재 | `level_custom_15.json` | ✅ |
| Stage 15 `goal.blockId` = `b014` 존재 | `level_custom_15.json` | ✅ |
| Stage 15 switch1 switchNodeId `b003` 존재, targetNodeId `b004` 존재 | `level_custom_15.json` | ✅ |
| Stage 15 switch2 switchNodeId `b003` 존재, targetNodeId `b005` 존재 | `level_custom_15.json` | ✅ |
| Stage 15 switch3 switchNodeId `b009` 존재 (move type), moveTarget `[5.5,0.25,3.5]` 설정 | `level_custom_15.json` | ✅ |
| Stage 15 star nodeId `b007`, `b008`, `b013` 모두 블록 목록에 존재 | `level_custom_15.json` | ✅ |
| Stage 13 `character.startNodeId` = `b001` 존재 | `level_custom_13.json` | ✅ |
| Stage 13 `midpoint.blockId` = `b017` 존재 (스폰 타겟) | `level_custom_13.json` | ✅ |
| Stage 13 `goal.blockId` = `b025` 존재 (일반 블록, 스폰 타겟 아님) | `level_custom_13.json` | ✅ |
| Stage 13 별 nodeId `b015`, `b023`, `b024` 모두 blocks에 존재 | `level_custom_13.json` | ✅ |
| Stage 13 스위치 switchNodeId `b004` — `b004`는 blocks에 일반 블록으로 존재 (자기 자신을 타겟으로 삼지 않음) | `level_custom_13.json` | ✅ |
| `midpointMarker` 설정 순서 — SwitchManager.setup() 이전에 위치 계산 후, _linkSwitchAttachments()에서 숨김 | `GameManager.ts:381-384, 537-569` | ✅ |

---

### Stage 15 "Double Key" 레벨 설계 검증

```
b001(start) → b002 → b003(switch: spawn b004+b005)
                          ↓ b004 spawns ↓ b005 spawns
                       b004 → b005 → b006(midpoint)
                                      ↙     ↘
                                b007(★)    b008(★)
                                      ↘
                                  b009(switch: move b010)
                                      ↓
                                   b011 → b010(moved) → b012 → b013(★) → b014(goal)
```

**환상 연결:**
- `b007↔b013`: azimuth 0.0°, tol ±4°, elevation 15° (정북 방향 시점)
- `b008↔b012`: azimuth -166°, tol ±4°, elevation 14° (남동 방향 시점)

| 경로 | XZ 거리 | 연결 여부 |
|------|---------|---------|
| b001↔b002 | 1.0 | ✅ |
| b002↔b003 | 1.0 | ✅ (switch 발동) |
| b003↔b004 (스폰 후) | 1.0 | ✅ |
| b004↔b005 (스폰 후) | 1.0 | ✅ |
| b005↔b006 | 1.0 | ✅ (midpoint) |
| b006↔b007 | 1.0 | ✅ (★) |
| b006↔b008 | 1.0 | ✅ (★) |
| b006↔b009 | 1.0 | ✅ (move switch) |
| b009↔b011 | 1.0 | ✅ (b010 이동 전후 무관) |
| b011↔b010 (이동 전) | √8 ≈ 2.83 | ❌ |
| b011↔b010 (이동 후 [5.5,3.5]) | 1.0 | ✅ |
| b010↔b012 (이동 후) | 1.0 | ✅ |
| b012↔b013 | 1.0 | ✅ (★) |
| b013↔b014 | 1.0 | ✅ (goal) |
| b007↔b013 (직접) | 4.0 | ❌ (환상 필요) |
| b008↔b012 (직접) | ≈4.1 | ❌ (환상 필요) |

퍼즐 흐름: 스위치(b003) → 스폰(b004+b005) → 별(b007,b008) → 스위치(b009) → 이동(b010) → 별(b013) → 골(b014) ✅

---

### Stage 13 레벨 설계 검증

**구조:** 단일 스위치 b004가 토글로 13개 블록을 일괄 스폰. 스폰 전 이동 가능 블록: b001, b003, b004, b005, b025.

```
b001 → b003 → b004(switch: 13개 스폰) → b005 → b025(goal, 항상 가시)
                     ↓ (스폰 후)
       b006, b007, b008, b010, b012, b013, b014, b015
       b017(midpoint), b018, b022, b023, b024
       (복잡한 환상 연결 74개로 상호 연결)
```

| 항목 | 결과 |
|------|------|
| b004→b005 (XZ=1.0) | ✅ |
| b005→b025 (XZ=1.0) — midpoint 미도달 시 goal 미발동 | ✅ |
| b017(midpoint) — 스폰 전 removeFromParent, midpointMarker가 _linkSwitchAttachments에서 숨겨짐 | ✅ |
| b017 스폰 후 midpointMarker visible=true 복원 | ✅ |
| 사다리 연결 b010↔b012, b012↔b013, b013↔b014, b014↔b015 — 스폰 후 enableNode + refresh | ✅ |
| 13개 스위치 상태 toggleLocked=true → 재발동 불가 | ✅ |

---

### 신규 버그

---

#### QA-T01 — Stage 15 `move` 타입 스위치(b010) 우회 가능 (설계 검토 필요) (`level_custom_15.json`)

`move` 스위치(b009→b010 이동)가 b013(★)→b014(goal) 도달을 위한 유일한 경로로 의도되었을 가능성이 있으나, 환상 `b008↔b012` (azimuth -166°)를 이용하면 b010 이동 없이 b008→b012→b013→b014 직행이 가능하다.

```
[우회 경로]
b006 → b008(★) → [illusion -166°] → b012 → b013(★) → b014(goal)
```

b009 스위치를 밟지 않아도 b013 도달 및 골 클리어가 가능하다. 레벨 이름 "Double Key"가 두 개의 spawn 스위치를 지칭한다면 move 스위치는 보조 경로로 의도된 것일 수 있다. 하지만 `move` 메커닉 학습을 목적으로 설계한 경우 교육적 효과가 감소한다.

**권장 조치:** 의도된 멀티-패스 설계인지 확인. move 스위치를 강제하려면 b008↔b012 환상 연결 제거 또는 azimuth 조정 필요.

---

#### QA-T02 — Stage 13 JSON 내부 `name` 필드가 "Custom Level" (`level_custom_13.json:3`)

`level_custom_13.json`의 `name` 필드가 `"Custom Level"`로 설정되어 있어, 인게임 HUD 레벨명(`.hud.setLevelName(data.name)`)에 "Custom Level"이 표시된다. registry의 `title: 'Stage 13'`과 불일치.

```json
// level_custom_13.json
"name": "Custom Level"  ← HUD에 표시되는 값
```

**수정 방향:**
```json
"name": "Stage 13"
```

---

#### QA-T03 — `SwitchManager` dispose()가 여전히 QA-SP1/SP2 미수정 상태

이번 커밋에서 `despawnTarget()`의 scale-in 취소(SwitchManager.ts:187)는 추가되었으나, `dispose()` 내의 두 기존 이슈는 여전히 미수정:

- **QA-SP1**: spawn targetMesh의 geometry/material 미해제 (`SwitchManager.ts:231`)
- **QA-SP2**: `dispose()` 시 `targetMesh.scale` tween 미취소 (`SwitchManager.ts:230`)

Stage 13은 스폰 타겟이 13개로, 레벨 언로드 시 GPU 누수 규모가 Stage 12보다 크다(블록 하나당 BoxGeometry + MeshLambertMaterial × 6 = 78개 미해제 리소스).

---

#### QA-T04 — `StageSelectUI`와 `GameManager.builtinIds` 동기화 미보장 (유지보수 위험)

스테이지 표시 여부(`BUILTIN_STAGE_NUMS`)와 스테이지 로드 가능 여부(`builtinIds`)가 두 파일에 별도로 관리된다.

| 파일 | 역할 |
|------|------|
| `StageSelectUI.ts:4` | UI에서 버튼 활성화 여부 결정 |
| `GameManager.ts:278` | 실제 레벨 파일 로드 |
| `LevelEditor.ts:1455` | 에디터 내장 스테이지 로드 |
| `registry.ts` | Vite 동적 import 경로 |

신규 스테이지 추가 시 4곳을 모두 수동 업데이트해야 한다. 하나라도 누락되면 버튼은 활성화되지만 레벨이 로드되지 않거나(GameManager 누락), 에디터에서 열리지 않는다(LevelEditor 누락). 현재는 13, 15 모두 4곳에 정상 등록되어 있음 ✅.

**권장 조치:** `registry.ts`를 단일 진실 출처(source of truth)로 삼아 `LEVELS` 배열에서 파생하도록 StageSelectUI / GameManager 리팩터 (장기).

---

#### QA-T05 — Stage 13 환상 연결 74개 중 동일 방향·고도 중복 항목 존재

`b015↔b024` (azimuth -179.8°, elevation 18.3°)와 `b015↔b023` (azimuth -179.8°, elevation 18.3°)가 동일한 각도 조건을 공유한다 (`level_custom_13.json:547-563`). IllusionManager는 azimuth/elevation이 동시에 활성화 조건을 충족하면 두 환상 경로가 동시에 켜지도록 처리하므로 기능 버그는 아니다. 그러나 플레이어 입장에서 두 경로가 동시에 활성화되어 어떤 블록으로 이동할지 혼란을 줄 수 있다.

**권장 조치:** 두 연결의 방위각을 3-5° 분리하여 각각 개별 시점에서만 활성화되도록 조정.

---

### despawnTarget() 내부 수정 검증

`despawnTarget()`에서 scale-in tween 취소 코드 추가 — hold 모드에서 캐릭터가 스폰 애니메이션(0.4s) 완료 전에 블록을 떠날 경우 scale-in과 scale-out이 충돌하는 버그를 차단.

```typescript
// SwitchManager.ts:187 — 신규 추가
// BUG-04: spawn scale-in 애니메이션이 진행 중일 수 있으므로 먼저 취소
gsap.killTweensOf(mesh.scale);
```

| 항목 | 결과 |
|------|------|
| `despawnTarget()` 진입 시 scale-in tween 취소 | ✅ |
| 이후 scale-out tween 정상 실행 | ✅ |
| Stage 13처럼 toggle 모드 전용이면 `deactivate()` 미호출 → 해당 경로 비통과 (무해) | ✅ |

> ⚠️ `dispose()` 내에는 여전히 `gsap.killTweensOf(state.targetMesh.scale)` 미추가 (QA-SP2).

---

### 10차 QA 신규 버그 요약

| ID | 우선순위 | 상태 | 내용 | 파일 |
|---|---|---|---|---|
| QA-T01 | P3 | 🔴 미수정 | Stage 15 move 스위치(b010) — 환상 b008↔b012로 우회 가능 (설계 의도 확인 필요) | `level_custom_15.json` |
| QA-T02 | P4 | ✅ 수정됨 | Stage 13 JSON `name` 필드 = "Custom Level" → "Stage 13" 수정 | `level_custom_13.json:3` |
| QA-T03 | P2 | ✅ 수정됨 | QA-SP1/SP2 수정 — `dispose()` targetMesh geometry/material 해제 + scale tween 취소 | `SwitchManager.ts:230-233` |
| QA-T04 | P4 | ⚠️ 유지보수 | 스테이지 등록 4곳 수동 동기화 필요 (StageSelectUI, GameManager, LevelEditor, registry) | 복수 파일 |
| QA-T05 | P4 | ✅ 수정됨 | b015↔b024 방위각 -182.8°, b015↔b023 방위각 -176.8°로 3° 분리 | `level_custom_13.json:548,555` |

---

## 버그 트래킹

| ID | 우선순위 | 상태 | 내용 | 파일 |
|---|---|---|---|---|
| QA-SP1 | P2 | ✅ 수정됨 | `SwitchManager.dispose()` spawn 타입 targetMesh geometry/material 해제 추가 (`traverse` 방식) | `SwitchManager.ts:280-286` |
| QA-SP2 | P4 | ✅ 수정됨 | `SwitchManager.dispose()` targetMesh.scale tween `killTweensOf()` 추가 | `SwitchManager.ts:278` |
| QA-T01 | P3 | ✅ 설계 변경으로 해소 | Stage 15 리디자인으로 b008 삭제 — 해당 환상 우회 경로 소멸 (QA-T07 참조) | `level_custom_15.json` |
| QA-T02 | P4 | 🔴 미수정 | Stage 13 JSON `name` = "Custom Level" — HUD 레벨명 불일치 (되돌려짐) | `level_custom_13.json:3` |
| QA-T04 | P4 | ✅ 수정됨 | `CUSTOM_STAGE_NUMS` 자동 파생으로 4곳 동기화 해소 | `registry.ts`, `StageSelectUI.ts`, `GameManager.ts`, `LevelEditor.ts` |
| QA-T05 | P4 | 🔴 미수정 | b015↔b024 / b015↔b023 방위각 -179.8° 중복 (수정 후 되돌려짐) | `level_custom_13.json:548,555` |
| QA-T06 | P2 | 🔴 미수정 | `dispose()` move 타입 `position` tween 미취소 — 언로드 후 `graph.refresh()` 호출 가능 | `SwitchManager.ts:269` |
| QA-T07 | P1 | 🔴 미수정 | Stage 15 illusionConnections에 b007/b008 존재하지 않는 노드 참조 — 런타임 오류 가능 | `level_custom_15.json:278-290` |
| QA-T08 | P4 | 🔴 미수정 | `_startCameraFlyIn()` startPos Y 계산 — targetY≠0 시 부정확 (현재 잠재 버그) | `GameManager.ts:660` |
| QA-T09 | P4 | ⚠️ 유지보수 | registry 자동 파생으로 커스텀 title/backgroundColor 손실 — 인게임 영향 없음 | `registry.ts:27-30` |
| QA-T10 | P4 | 🔴 미수정 | 레벨 로드 후 카메라 패널 preview 텍스트 미갱신 | `LevelEditor.ts:1197` |
| QA-13 | P2 | ✅ 수정됨 | `Renderer.applyQuality()` 반복 호출 시 이전 환경맵 텍스처 미해제 — GPU 메모리 누수 | `Renderer.ts:87` |
| QA-14 | P2 | ✅ 수정됨 | `_swapSceneMaterials()` Standard→Lambert 변환 시 `emissive`/`emissiveIntensity` 미복사 — 발광 효과 소실 | `GameManager.ts:923` |
| QA-15 | P3 | ✅ 수정됨 | `SettingsScreen.resetAll()` Enhanced Rendering 체크박스·저장값 미초기화 | `SettingsScreen.ts:399` |
| QA-16 | P4 | ✅ 수정됨 | `SettingsPreview` RAF 루프가 설정 화면 숨김 후에도 계속 실행 — 불필요한 GPU 렌더링 | `SettingsPreview.ts:189` |
| QA-17 | P4 | ✅ 수정됨 | `Renderer.ts` `visualViewport` resize 리스너 미정리 (기존 LOW-03 패턴 재발) | `Renderer.ts:54` |
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
| QA-07 | P2 | ✅ 수정됨 | StarManager — 텔레포트 목적지 노드의 별 미수집 → `teleportTo` 후 `tryCollect(teleportDest)` 추가 | `GameManager.ts` |
| QA-08 | P2 | ✅ 수정됨 | StarManager — RotatingSection 회전 시 별 mesh 위치 미갱신 → `onSectionSnap`에서 `refreshPositions()` 호출 | `StarManager.ts`, `GameManager.ts` |
| QA-09 | P3 | ✅ 수정됨 | 별 미수집 상태로 goal 도달 시 피드백 없음 → `_tryGoalReached()` 헬퍼로 분기, 힌트 2초 표시 | `GameManager.ts` |
| QA-10 | P3 | ✅ 수정됨 | `StarManager.dispose()` scale tween 미종료 → `collectingMeshes` Set 추적, dispose 시 강제 종료 | `StarManager.ts` |

---

## 9차 QA (2026-06-09) — Pressure Switch Type A (spawn gate) / Stage 12 / LevelEditor SWITCHES 섹션

### 변경 내용 (커밋 87027bf)

| 항목 | 파일 |
|------|------|
| `SwitchManager` — `removeFromParent()` 수정, `targetOrigParent` 추가, `attachedMeshes` 연동 | `SwitchManager.ts` |
| `StarManager` — `getStarMesh()` API 추가 | `StarManager.ts` |
| `TeleportManager` — `nodeRings` 맵 + `getRingsForNode()` API 추가 | `TeleportManager.ts` |
| `GameManager` — `_linkSwitchAttachments()` 추가, `builtinIds[12]` 등록 | `GameManager.ts` |
| `LevelEditor` — SWITCHES 섹션 추가 (DEV 전용) | `LevelEditor.ts` |
| Stage 12 `level_custom_12.json` 추가 — "Pressure Gate" (toggle spawn 시연) | `levels/level_custom_12.json` |
| `StageSelectUI` — `BUILTIN_STAGES = 12` | `StageSelectUI.ts` |
| `EditorLobby` — Stage 12 카드 추가 | `EditorLobby.ts` |
| `levels/registry.ts` — `custom_stage_12` 등록 | `registry.ts` |

---

### 정상 확인 항목

| 항목 | 확인 위치 | 결과 |
|------|---------|------|
| `scene.remove()` 대신 `removeFromParent()` 사용 (버그 수정) | `SwitchManager.ts:77,191,227` | ✅ |
| `targetOrigParent` 포착 시점 — `removeFromParent()` 이전 | `SwitchManager.ts:69` | ✅ |
| `spawnTarget()` — `origParent.add(mesh)` 후 `mesh.scale.set(0,0,0)` + gsap scale-in | `SwitchManager.ts:158-164` | ✅ |
| `despawnTarget()` — scale-out 후 `onComplete`에서 `mesh.scale.set(1,1,1)` 복원 | `SwitchManager.ts:191` | ✅ |
| `attachMeshes()` — 비활성 상태면 즉시 `visible=false` 설정 | `SwitchManager.ts:99-106` | ✅ |
| `spawnTarget()` / `despawnTarget()` — attached 메시 show/hide | `SwitchManager.ts:170-172, 183-184` | ✅ |
| `attachedMeshes.clear()` in `dispose()` | `SwitchManager.ts:231` | ✅ |
| `_linkSwitchAttachments()` 호출 위치 — `_initLevelObjects` 마지막 (모든 mgr 초기화 후) | `GameManager.ts:469` | ✅ |
| `getStarMesh()` — `starMeshes.get(nodeId)` 반환 | `StarManager.ts:64` | ✅ |
| `getRingsForNode()` — `nodeRings.get(nodeId) ?? []` 반환 | `TeleportManager.ts:68` | ✅ |
| `nodeRings.clear()` in `dispose()` | `TeleportManager.ts:93` | ✅ |
| `fileMap[12]` 등록 | `LevelEditor.ts` | ✅ |
| Stage 12 character.startNodeId `b001` 존재 | `level_custom_12.json` | ✅ |
| Stage 12 goal.blockId `b008` 존재 | `level_custom_12.json` | ✅ |
| Stage 12 switch.switchNodeId `b004` 존재 | `level_custom_12.json` | ✅ |
| Stage 12 switch.targetNodeId `b005` 존재 | `level_custom_12.json` | ✅ |
| Stage 12 star.nodeId `b007` 존재 | `level_custom_12.json` | ✅ |
| Stage 12 b005(spawn target) 없이 b001→b004까지 경로 확인 (XZ ≤ 1.1) | `level_custom_12.json` | ✅ |
| Stage 12 b004→b006 직접 연결 불가 (XZ 거리 = 2.0 > 1.1) — 스위치 강제 | `level_custom_12.json` | ✅ |
| Stage 12 b005 스폰 후 b004→b005→b006→b007→b006→b008 완성 경로 | `level_custom_12.json` | ✅ |
| Stage 12 b007(star) ↔ b008(goal) 비인접 (XZ ≈ 1.41 > 1.1) — 반드시 b006 경유 | `level_custom_12.json` | ✅ |
| `BUILTIN_STAGES = 12` | `StageSelectUI.ts:4` | ✅ |
| `builtinIds[12]` 등록 | `GameManager.ts:228` | ✅ |
| `EditorLobby` Stage 12 카드 | `EditorLobby.ts:68` | ✅ |
| `registry.ts` `custom_stage_12` 등록 | `registry.ts` | ✅ |

---

### 신규 버그

---

#### QA-SP1 — `SwitchManager.dispose()` spawn targetMesh geometry/material 미해제 (`SwitchManager.ts:226`)

`SwitchManager.dispose()`는 spawn 타입 타깃 블록을 씬에서 제거만 하고 GPU 리소스를 해제하지 않는다.

```typescript
// SwitchManager.ts:226
if (state.targetMesh) {
  state.targetMesh.removeFromParent(); // ← geometry/material dispose 없음
}
```

`Level.dispose()`는 `level.group.traverse(child => { if instanceof Mesh → dispose })`로 정리하지만, **spawn 타겟 블록은 `setup()` 시 `removeFromParent()`로 이미 `level.group`에서 제거된 상태**다. 따라서 `Level.dispose()`의 traverse 범위에 포함되지 않아 geometry/material이 GPU에 잔류한다.

```
Level.dispose() 시:
  level.group.traverse()
    ↓ b001~b004, b006~b008 → 정상 해제 ✅
    ↗ b005 → level.group에 없음 (SwitchManager가 이미 제거) → 미해제 ❌
```

**재현:** Stage 12 플레이 후 다른 스테이지로 이동 시 매 레벨 언로드마다 b005의 BoxGeometry + 6개 MeshLambertMaterial (per-face) 잔류.

**수정 방향:**

```typescript
// SwitchManager.ts dispose() 내
if (state.targetMesh) {
  state.targetMesh.removeFromParent();
  // spawn 타입은 Level.dispose() 범위 밖 → 직접 해제
  if (state.def.type === 'spawn') {
    state.targetMesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        const mats = Array.isArray(child.material) ? child.material : [child.material];
        mats.forEach(m => (m as THREE.Material).dispose());
      }
    });
  }
}
```

---

#### QA-SP2 — `despawnTarget()` / `dispose()` scale-out GSAP tween 진행 중 dispose 시 `killTweensOf()` 미호출 (`SwitchManager.ts:187`)

`despawnTarget()`이 진행 중(scale-out 0.3s)일 때 레벨이 언로드(`unloadCurrent()`)되면:

1. `switchMgr.dispose()` → `state.targetMesh.removeFromParent()` (mesh 제거)
2. 기존 `gsap.to(mesh.scale, { onComplete: () => { mesh.removeFromParent(); mesh.scale.set(1,1,1) } })` 계속 실행
3. 0.3s 후 tween `onComplete` → `mesh.removeFromParent()` (harmless), `mesh.scale.set(1,1,1)` (harmless)

실제 크래시나 데이터 손상은 없으나 의도치 않은 tween이 레벨 언로드 이후에도 실행된다.

`spawnTarget()`의 scale-in tween(0.4s)도 동일한 상황이 발생 가능.

**수정 방향:**

```typescript
// SwitchManager.ts dispose() 내, removeFromParent() 이전에 추가
if (state.targetMesh) {
  gsap.killTweensOf(state.targetMesh.scale); // ← 추가
  state.targetMesh.removeFromParent();
  ...
}
```

---

### Stage 12 레벨 설계 검증

```
b001(start) → b002 → b003 → b004(switch)
                               ↓ toggle spawn b005
                             b005 → b006 ←→ b007(star)
                                      ↓
                                    b008(goal, 별 필요)
```

| 경로 | XZ 거리 | 연결 여부 |
|------|---------|---------|
| b001↔b002 | 1.0 | ✅ |
| b002↔b003 | 1.0 | ✅ |
| b003↔b004 | 1.0 | ✅ |
| b004↔b006 (스폰 전) | **2.0** | ❌ (통행 불가 → 스위치 강제) |
| b004↔b005 (스폰 후) | 1.0 | ✅ |
| b005↔b006 | 1.0 | ✅ |
| b006↔b007 | 1.0 | ✅ |
| b007↔b008 | ≈1.41 | ❌ (b006 경유 필수) |
| b006↔b008 | 1.0 | ✅ |

퍼즐 흐름: 스위치(b004) → 스폰(b005) → 별(b007) 수집 → 골(b008) 도달 ✅

---

### LevelEditor SWITCHES 섹션 검증

| 항목 | 확인 위치 | 결과 |
|------|---------|------|
| switchNodeId / targetNodeId 입력 폼 | `LevelEditor.ts` | ✅ |
| mode (hold/toggle) 선택 | `LevelEditor.ts` | ✅ |
| type (spawn/move) 선택 | `LevelEditor.ts` | ✅ |
| "Use Selected as Switch Node" 헬퍼 | `LevelEditor.ts` | ✅ |
| `rebuildSwitchList()` 연동 | `LevelEditor.ts` | ✅ |
| type=move 시 `moveTarget` 입력 UI 없음 | `LevelEditor.ts` | ⚠️ 기존 기획 이슈 (별도 추적) |

type=move 선택 후 저장 시 `moveTarget` 필드가 없어 SwitchManager에서 `!state.def.moveTarget` 분기로 무시됨 — 기존 기획 체크리스트에 명시된 항목으로 현재 미노출 처리.

---

### 9차 QA 신규 버그 요약

| ID | 우선순위 | 상태 | 내용 | 파일 |
|---|---|---|---|---|
| QA-SP1 | P2 | 🔴 미수정 | `dispose()` spawn targetMesh geometry/material 미해제 (GPU 누수) | `SwitchManager.ts:226` |
| QA-SP2 | P4 | 🔴 미수정 | `despawnTarget()` / `dispose()` scale-out tween 중 `killTweensOf()` 미호출 | `SwitchManager.ts:187,218` |

---

## 8차 QA (2026-06-09) — GraphicsSettings / SettingsScreen / SettingsPreview / 품질 전환

### 변경 내용

| 항목 | 파일 |
|------|------|
| `GraphicsSettings` — localStorage 기반 설정 영속성 | `src/core/GraphicsSettings.ts` (신규) |
| `SettingsScreen` — 품질·색상·조명 설정 UI | `src/ui/SettingsScreen.ts` (신규) |
| `SettingsPreview` — 설정 미리보기 Three.js 씬 | `src/ui/SettingsPreview.ts` (신규) |
| `TitleScreen` — SETTINGS 버튼 추가 | `src/ui/TitleScreen.ts` |
| `Renderer` — `applyQuality()`, `applyLightingOverrides()`, `applyBackgroundColor()` 분리 | `src/core/Renderer.ts` |
| `GameManager` — SettingsScreen 연동, `_swapSceneMaterials()` 추가 | `src/core/GameManager.ts` |
| `Block` — `GraphicsSettings.enhanced` 기반 머티리얼 분기 | `src/world/Block.ts` |

---

### 정상 확인 항목

| 항목 | 확인 위치 | 결과 |
|------|---------|------|
| `TitleScreen.onSettings` 콜백 연결 | `GameManager.ts:122` | ✅ |
| `settingsScreen.onClose` → `titleScreen.show()` | `GameManager.ts:127` | ✅ |
| `onQualityChange` → `applyQuality` + `applyLightingOverrides` + `_swapSceneMaterials` + `applyBackgroundColor` 4단계 적용 | `GameManager.ts:132` | ✅ |
| `onLightChange` → `GraphicsSettings` 저장 + `applyLightingOverrides()` | `GameManager.ts:142` | ✅ |
| `onBgColorChange(null)` → `getEffectiveBgColor()` 폴백 처리 | `GameManager.ts:151` | ✅ |
| `onBlockColorChange` → 로드 중인 레벨 즉시 재색상 (`level?.recolorAllBlocks`) | `GameManager.ts:154` | ✅ |
| 레벨 로드 시 `blockColorOverride` 재적용 | `GameManager.ts:266` | ✅ |
| 튜토리얼 레벨에서 색상 오버라이드 미적용 (분기 처리) | `GameManager.ts:259` | ✅ |
| `Block` 생성 시 `blockColorOverride` 반영 | `Block.ts:50` | ✅ |
| `SettingsPreview.refresh()` — `envTexture` null 체크로 중복 PMREM 생성 방지 | `SettingsPreview.ts:126` | ✅ |
| `SettingsPreview.dispose()` — geometry·material·envTexture·renderer 정리 | `SettingsPreview.ts:161` | ✅ |
| `resetAll()` — 색상·조명 양방향 동기화 (UI 상태 + GraphicsSettings + 콜백) | `SettingsScreen.ts:399` | ✅ |
| `GraphicsSettings.resetColors/resetLights()` localStorage 키 전체 제거 | `GraphicsSettings.ts:84` | ✅ |
| `toHex6()` 3자리 hex 확장 처리 | `SettingsScreen.ts:441` | ✅ |
| `unloadCurrent()` 후 `minPolarAngle` 유지 (`Math.PI / 6`) | `GameManager.ts:671` | ✅ |
| `applyQuality()` 후 `applyLightingOverrides()` 재호출로 저장된 오버라이드 복원 | `GameManager.ts:136` | ✅ |
| `applyBackgroundColor()` fog 색상 동기 처리 | `Renderer.ts:140` | ✅ |

---

### 신규 버그

---

#### QA-13 — `Renderer.applyQuality()` 환경맵 텍스처 메모리 누수 (`Renderer.ts:87`)

`applyQuality(true)` 호출 시 매번 새 `RoomEnvironment`와 PMREM 텍스처를 생성하지만, `scene.environment`에 이미 할당된 **이전 텍스처를 dispose하지 않는다**.

```typescript
// Renderer.ts:87-90 (enhanced=true 경로)
const env = new RoomEnvironment();
const envTexture = this.pmremGenerator.fromScene(env).texture;
env.dispose();
this.scene.environment = envTexture; // ← 이전 scene.environment 텍스처 GPU에 잔류
```

`enhanced=false` 경로도 동일:

```typescript
// Renderer.ts:105
this.scene.environment = null; // ← 이전 텍스처 dispose 없이 참조만 끊김
```

**재현 경로:**
1. Settings 진입 → Enhanced Rendering 토글 ON (envTexture A 생성)
2. Enhanced Rendering 토글 OFF (`scene.environment = null`, A는 GPU에 잔류)
3. Enhanced Rendering 토글 ON (envTexture B 생성)
4. A는 영구 누수

Settings 화면이 타이틀에서만 열리므로 레벨 로드/언로드와 무관하게 누수 발생.

**수정 방향:**

```typescript
// applyQuality() 최상단에 추가
if (this.scene.environment) {
  (this.scene.environment as THREE.Texture).dispose();
  this.scene.environment = null;
}
```

---

#### QA-14 — `_swapSceneMaterials()` `emissive` / `emissiveIntensity` 미복사 (`GameManager.ts:923`)

Standard→Lambert 변환 시 `emissive` 색상과 `emissiveIntensity`를 복사하지 않는다.

```typescript
// GameManager.ts:923-931 (enhanced=false, Standard→Lambert)
if (!enhanced && m instanceof THREE.MeshStandardMaterial) {
  const next = new THREE.MeshLambertMaterial({
    color:       m.color.clone(),
    transparent: m.transparent,
    opacity:     m.opacity,
    // ← emissive: m.emissive.clone()  누락
    // ← emissiveIntensity: m.emissiveIntensity  누락
  });
  m.dispose();
  return next;
}
```

`SwitchManager`의 스위치 발판, `TeleportManager`의 텔레포트 링, `ElevatorManager`의 레일 등 씬 내 emissive를 사용하는 오브젝트가 standard 모드로 전환되면 **발광 효과가 소실**된다.

**현재 영향 범위:**
Settings는 타이틀 화면에서만 접근 가능하므로 전환 시 씬에 게임 오브젝트가 없음 → **현재 플로우에서는 재현 안 됨**. 그러나 설정이 인게임에서 접근 가능해질 경우 즉시 발현되는 **잠재 버그**다.

**수정 방향:**

```typescript
if (!enhanced && m instanceof THREE.MeshStandardMaterial) {
  const next = new THREE.MeshLambertMaterial({
    color:              m.color.clone(),
    transparent:        m.transparent,
    opacity:            m.opacity,
    emissive:           m.emissive.clone(),        // ← 추가
    emissiveIntensity:  m.emissiveIntensity,        // ← 추가
  });
  m.dispose();
  return next;
}
```

Lambert→Standard 경로도 동일하게 `emissive` 복사 필요.

---

#### QA-15 — `SettingsScreen.resetAll()` Enhanced Rendering 미초기화 (`SettingsScreen.ts:399`)

```typescript
private resetAll(): void {
  GraphicsSettings.resetColors();   // ✅
  GraphicsSettings.resetLights();   // ✅
  // ❌ GraphicsSettings.enhanced 리셋 없음
  // ❌ this.qualityCheckbox.checked = false 없음
  // ❌ this.onQualityChange(false) 콜백 미호출
  ...
}
```

"RESET ALL" 버튼이 색상·조명은 초기화하지만 Enhanced Rendering은 그대로 유지한다. 사용자는 전체 초기화로 이해하여 렌더링 품질이 리셋되지 않으면 혼란을 느낄 수 있다.

**수정 방향 (옵션 A — 완전 초기화):**

```typescript
// resetAll() 상단에 추가
GraphicsSettings.enhanced = false;
this.qualityCheckbox.checked = false;
this.onQualityChange(false);
```

**수정 방향 (옵션 B — 버튼 명칭 변경):**

"RESET ALL" → "RESET COLORS & LIGHTING" 으로 변경하여 범위를 명시.

---

#### QA-16 — `SettingsPreview` RAF 루프 미정지 (`SettingsPreview.ts:189`)

`SettingsPreview`는 생성자에서 RAF 루프를 시작(`startLoop()`)하고 화면을 닫아도 멈추지 않는다.

```typescript
// SettingsPreview.ts:189
private startLoop(): void {
  const loop = () => {
    this.rafId = requestAnimationFrame(loop);
    this.renderer.render(this.scene, this.camera); // ← hide 후에도 계속 실행
  };
  loop();
}
```

`SettingsScreen.hide()` 후 캔버스가 CSS로 숨겨지지만 `render()` 호출은 매 프레임 계속된다. 게임 플레이 중에는 main render loop + preview render loop 두 개가 동시에 돌아간다.

**재현 조건:** Settings를 한 번이라도 연 후 닫고 레벨 플레이.

**수정 방향:**

```typescript
// SettingsPreview에 메서드 추가
pauseLoop(): void { cancelAnimationFrame(this.rafId); this.rafId = 0; }
resumeLoop(): void { if (this.rafId === 0) this.startLoop(); }
```

```typescript
// SettingsScreen에 연동
show(): void {
  requestAnimationFrame(() => this.el.classList.add('visible'));
  this.preview.resumeLoop();  // ← 추가
}
hide(): void {
  this.el.classList.remove('visible');
  this.preview.pauseLoop();   // ← 추가
}
```

---

#### QA-17 — `Renderer.ts` `visualViewport` resize 리스너 미정리 (`Renderer.ts:54`)

```typescript
// Renderer.ts:53-54
window.addEventListener('resize', () => this.onResize(container));
window.visualViewport?.addEventListener('resize', () => this.onResize(container));
```

`visualViewport` 리스너가 추가됐으나 정리 메서드가 없다. 기존 LOW-03(`window resize`) 패턴의 재발이며, Renderer 인스턴스가 단일이므로 **실질 영향은 낮음**. 그러나 모바일 softKeyboard 노출/숨김 시 `visualViewport` resize가 자주 발동되어 `onResize()`가 불필요하게 호출될 수 있다.

**수정 방향:** 필요하다면 `Renderer.dispose()` 메서드를 추가하고 두 리스너 모두 제거.

---

### _swapSceneMaterials 설계 안전망 분석

현재 `_swapSceneMaterials()`는 `settingsScreen.onQualityChange` 콜백에서만 호출되며, Settings는 타이틀 화면에서만 열린다(→ `this.level === null`). 따라서 호출 시 씬에는 `DirectionalLight`, `HemisphereLight`, `AmbientLight`만 존재하고 Mesh가 없어 traverse가 사실상 no-op이다.

**안전 조건:** Settings 진입 경로가 타이틀 화면으로 제한되는 한, QA-14의 emissive 소실 버그는 발현되지 않는다. 하지만 인게임 설정 접근이 추가될 경우 즉시 발현되므로 예방적 수정이 권장된다.

---

### 8차 QA 신규 버그 요약

| ID | 우선순위 | 상태 | 내용 | 파일 |
|---|---|---|---|---|
| QA-13 | P2 | ✅ 수정됨 | `applyQuality()` 환경맵 텍스처 누수 | `Renderer.ts:87` |
| QA-14 | P2 | ✅ 수정됨 | `_swapSceneMaterials()` emissive 미복사 (잠재 버그) | `GameManager.ts:923` |
| QA-15 | P3 | ✅ 수정됨 | `resetAll()` Enhanced Rendering 미초기화 | `SettingsScreen.ts:399` |
| QA-16 | P4 | ✅ 수정됨 | SettingsPreview RAF 미정지 (hide 후에도 렌더링 지속) | `SettingsPreview.ts:189` |
| QA-17 | P4 | ✅ 수정됨 | `visualViewport` resize 리스너 미정리 | `Renderer.ts:54` |

---

## 7차 QA (2026-06-09) — Stage 11 / 반응형 UI / EditorLobby 삭제 버튼

### 변경 내용 (커밋 70af6d8)

| 항목 | 파일 |
|------|------|
| Stage 11 (`level_custom_11.json`) 추가 | `registry.ts`, `GameManager.ts`, `LevelEditor.ts`, `StageSelectUI.ts`, `EditorLobby.ts` |
| EditorLobby — 커스텀 스테이지 Delete 버튼 추가 | `EditorLobby.ts` |
| 반응형 UI 스케일링 — `clamp()`/`vw`, safe-area-inset | `style.css` |
| Block 테두리 선 완전 제거 (EdgesGeometry + LineSegments 삭제) | `Block.ts` |

---

### 정상 확인 항목

| 항목 | 확인 위치 | 결과 |
|------|---------|------|
| Stage 11 블록 refs (character, goal, midpoint) | `level_custom_11.json` | ✅ |
| Stage 11 teleporter 노드 참조 (`b041`, `b013`) | `level_custom_11.json` | ✅ |
| Stage 11 star 노드 참조 (`b015`, `b014`, `b030`) | `level_custom_11.json` | ✅ |
| Stage 11 ladder 노드 참조 (10쌍) | `level_custom_11.json` | ✅ |
| `CustomLevelStore.delete()` 메서드 존재 | `CustomLevelStore.ts:27` | ✅ |
| `EditorLobby.rebuildGrid()` 메서드 존재 | `EditorLobby.ts:113` | ✅ |
| `.editor-btn.danger` CSS 정의 | `style.css:460` | ✅ |
| `.editor-lobby__card-btns` CSS 정의 | `style.css:599` | ✅ |
| Block `LineSegments` 제거 후 dispose 안전성 | `Level.ts:168`, `LevelEditor.ts:976` | ✅ (부작용 없음, 오히려 메모리 누수 해소) |
| ElevatorManager `LineSegments` — 별도 명시적 dispose | `ElevatorManager.ts:130` | ✅ |
| `BUILTIN_STAGES = 11` 반영 | `StageSelectUI.ts:3` | ✅ |
| `GameManager.builtinIds[11]` 추가 | `GameManager.ts:170` | ✅ |
| `LevelEditor.fileMap[11]` 추가 | `LevelEditor.ts:1323` | ✅ |
| CSS `clamp()`/`vw` 문법 이상 없음 | `style.css` | ✅ |
| safe-area-inset (star-counter, back btn) | `style.css:41,290` | ✅ |

---

### 신규 버그

| ID | 우선순위 | 상태 | 내용 | 파일 |
|---|---|---|---|---|
| QA-11 | P3 | ⚠️ 데이터 결함 | `level_custom_11.json` — 존재하지 않는 블록 `b025`를 illusionConnections 2개가 참조. PathGraph `if (a && b)` 가드로 크래시는 없으나 해당 착시 연결 영구 비활성. | `level_custom_11.json` |
| QA-12 | P4 | 기존 이슈 | `TutorialSequencer.ts:26` — `RevealId` 타입 미사용 TS 경고. 이번 변경과 무관. | `TutorialSequencer.ts` |

---

### Block 테두리 선 완전 제거 — 부수 효과 분석

**변경:** `EdgesGeometry` + `LineBasicMaterial` + `LineSegments` 생성 코드 전체 삭제.

**긍정적 부수 효과 — 기존 메모리 누수 해소:**

`Level.dispose()` 및 `LevelEditor.dispose()` 양쪽 모두 `traverse` + `instanceof THREE.Mesh` 패턴으로만 정리했기 때문에, `LineSegments`(Mesh가 아닌 Object3D)는 레벨 언로드 시 `geometry.dispose()` / `material.dispose()`가 호출되지 않았다.

```typescript
// Level.ts:168 — LineSegments는 이 분기에 진입하지 않음
this.group.traverse(child => {
  if (child instanceof THREE.Mesh) {  // LineSegments ≠ Mesh → 스킵
    child.geometry.dispose();
    child.material.forEach(m => m.dispose());
  }
});
```

블록 수 × 레벨 전환 횟수만큼 `EdgesGeometry` + `LineBasicMaterial` 인스턴스가 GPU에 누적됐을 것. LineSegments 삭제로 이 누수가 완전히 해소됨.

**ElevatorManager의 `LineSegments`(레일)는 별도 명시적 dispose로 정상 처리됨** (`ElevatorManager.ts:130`).

---

### QA-11 상세 — `b025` 스테일 참조

```json
// level_custom_11.json — 문제 illusionConnections
{ "nodeA": "b039", "nodeB": "b025", "activateAzimuth": -29.9, ... }
{ "nodeA": "b039", "nodeB": "b025", "activateAzimuth": -39.7, ... }
```

`b025`는 blocks 배열에 존재하지 않음 (실제 블록 목록: b012~b016, b022, b024, b027, b030, b032~b033, b035~b037, b039~b043).

**영향:** 해당 2개 착시 연결이 절대 활성화되지 않음. `PathGraph.buildEdges()`의 `if (a && b)` 가드로 런타임 오류는 없음.

**수정 방향:** `b025` 대신 실제 존재하는 블록 ID로 교체하거나, 의도적으로 비활성 상태를 원한다면 해당 2개 항목 제거. (현재 사용자 요청으로 그대로 유지)

---

### 신규 기획 아이디어 평가 (2026-06-09)

---

#### 압력 스위치 A타입 — 블록 소환 (Spawn Gate)

**평가: ✅ 강력 권장**

기존 `SwitchManager` + `PathGraph.enableNode/disableNode` 패턴이 이미 구현돼 있어 **골격 코드가 존재**한다. GSAP scale-in 연출(`back.out`)은 기존 StarManager와 동일한 패턴으로 재활용 가능. "밟는 동안만 유지(hold)" vs "영구 활성(toggle)" 두 모드로 퍼즐 설계 폭이 크게 늘어남.

**구현 우선순위: 1순위** — 임팩트/구현 비용 비율 최고.

**QA 리스크:**
- [ ] `hold` 모드: 블록 위에 캐릭터가 있는 상태에서 스위치 해제 시 캐릭터 처리 (낙하 또는 차단)
- [ ] `toggle` 모드: 레벨 재시작 시 초기 상태(미소환) 복원 확인
- [ ] `graph.enableNode()` 호출 타이밍 — scale-in 애니 완료 전 경로 탐색 허용 여부

---

#### 압력 스위치 B타입 — 블록 이동 (Move Gate)

**평가: ✅ 권장 (A타입 이후 구현)**

"스위치를 밟으면 길이 열리고 동시에 다른 길이 막힌다"는 복잡한 퍼즐 구성이 가능. 그러나 블록 이동 시 StarManager 위치 갱신, PathGraph 재계산, 캐릭터 push 처리 등 연동 항목이 많아 A타입보다 구현 비용이 높음.

**구현 우선순위: 3순위** — A타입 안정화 후 진행 권장.

**QA 리스크:**
- [ ] 이동 tween 중 캐릭터가 해당 블록 위에 있을 때 함께 이동하는지 확인
- [ ] `hold` 모드: 복귀 tween과 이동 tween 충돌 방지 (`gsap.killTweensOf(mesh)` 선행)
- [ ] 복수 스위치가 동일 블록을 각기 다른 위치로 이동시킬 때 우선순위 정의
- [ ] 레벨 재시작 시 블록 원위치 복원

---

#### 중력 반전 / 벽면 이동

**평가: ⚠️ 현재 아키텍처와 충돌 심함 — 시각적 트릭으로 대체 권장**

PathGraph, Character 이동, 카메라 모두 "+Y = 위" 전제로 설계돼 있어 실제 중력 반전은 전 시스템 재설계 수준의 작업.

**현실적 대안:** 특정 스위치를 누르면 카메라가 180° 회전 + 별도 "천장 블록 레이어" 활성화. 시각적으로 뒤집힌 느낌을 주되 내부 로직은 Y축 그대로 유지. 이 방향은 카메라 트윈 + `graph.enableNode/disableNode` 조합으로 구현 가능.

**구현 우선순위: 보류** — 아이디어는 유효하나 현재 Phase에서는 범위 초과.

---

#### 가로 이동 승강기 (X축 Elevator)

**평가: ✅ 권장**

기존 `ElevatorManager`가 Y축 전용인데 `movementAxis: 'x' | 'y' | 'z'` 파라미터 하나 추가로 확장 가능. "타이밍 맞게 타고 내리는" 구조는 퍼즐에 리듬감을 부여함.

**구현 우선순위: 2순위** — 기존 ElevatorManager 확장이므로 비교적 단순.

**선결 과제:** 현재 캐릭터가 승강기와 함께 이동하는 물리(블록 mesh 이동 시 캐릭터가 자동으로 따라오는지)를 `CharacterController.update()` 흐름에서 확인 필요.

**QA 리스크:**
- [ ] X축 이동 중 PathGraph 엣지 재계산 타이밍 (너무 잦은 `graph.refresh()` 는 병목)
- [ ] 승강기가 이동 중 다른 블록과 겹칠 때 인접 엣지 오삽입 방지
- [ ] `auto` 왕복 모드에서 레벨 언로드 시 tween 강제 종료 (`gsap.killTweensOf(mesh)`)

---

### 구현 우선순위 요약

| 순위 | 아이디어 | 근거 |
|------|---------|------|
| 1 | 압력 스위치 A타입 (블록 소환) | 기존 SwitchManager 골격 재활용, 임팩트 최고 |
| 2 | 가로 이동 승강기 | ElevatorManager 파라미터 확장, 단순 |
| 3 | 압력 스위치 B타입 (블록 이동) | A타입 이후, 연동 항목 다수 |
| 보류 | 중력 반전 | 시각적 트릭으로 대체 권장, 실구현은 전면 재설계 |

---

## 6차 QA (2026-06-08) — StarManager 신규 구현 검토

### 수정 확인

| 항목 | 확인 위치 | 결과 |
|------|---------|------|
| QA-06 `_movePath.length > 0` 가드 | `CharacterController.ts:116` | ✅ |
| Elevation 60° — 생성자 `minPolarAngle` | `GameManager.ts:93` | ✅ |
| Elevation 60° — `unloadCurrent()` 유지 | `GameManager.ts:554` | ✅ |
| `AudioManager.playStarCollect()` 존재 | `AudioManager.ts:70` | ✅ |
| `HUD.reset()` → `hideStarCounter()` | `HUD.ts:136` | ✅ |
| `StarManager.dispose()` — 씬 정리 | `StarManager.ts:137` | ✅ |

---

## 6차 QA 신규 버그 상세 (2026-06-08)

---

### QA-07 — StarManager: 텔레포트 목적지 노드의 별 미수집 (`GameManager.ts:317`)

`onArrival` 콜백에서 별 수집(`tryCollect`) 판정은 teleport 분기 **이전**에 source 노드에 대해서만 수행된다:

```typescript
// GameManager.ts onArrival
if (this.starMgr?.tryCollect(nodeId)) { ... }      // source pad 기준 (line 312)

const teleportDest = this.graph!.getTeleportDest(nodeId);
if (teleportDest) {
  this.controller!.teleportTo(destNode);
  // QA-03: goal/midpoint 판정은 있지만 별 수집 판정 없음
  return;                                            // ← 여기서 종료 (line 332)
}
```

`teleportTo(destNode)` 이후 목적지 노드에 대한 `tryCollect(teleportDest)` 호출이 없다. **teleporter 패드를 통해 별 위에 도착해도 별이 수집되지 않는다.**

**수정 방향:** `teleportTo` 호출 직후 목적지 노드에 대한 별 수집 판정 추가:
```typescript
this.controller!.teleportTo(destNode);
if (this.starMgr?.tryCollect(teleportDest)) {
  this.hud.updateStarCounter(...);
  this.audio.playStarCollect();
}
```

---

### QA-08 — StarManager: RotatingSection 회전 시 별 위치 미갱신 (`StarManager.ts:31`)

`_createStarMesh()`에서 별은 **씬 루트에 world position 절댓값으로 고정**된다:

```typescript
// StarManager.ts:43
node.mesh.getWorldPosition(wp);
mesh.position.set(wp.x, baseY, wp.z); // 씬 루트 고정
this.scene.add(mesh);                 // section.pivot 하위가 아님
```

RotatingSection이 회전하여 `graph.refresh()`가 호출되어도 StarManager에는 알림이 없다. 별 mesh는 원래 위치에 그대로 남아 **블록과 분리**된다.

`repositionStar()` 메서드가 존재하지만, 현재 TutorialSequencer에서만 호출되며 일반 RotatingSection 회전에는 연동되지 않는다.

**재현 조건:** RotatingSection 위에 별을 배치한 레벨에서 섹션 회전 시 재현. 현재 내장 레벨에 `stars` 필드가 없어 즉시 재현 불가.

**수정 방향:** `onSectionSnap` 콜백에서 `graph.refresh()` 후 해당 섹션 블록의 별 위치를 `repositionStar()`로 갱신. 또는 별 mesh를 씬 루트가 아닌 `section.pivot` 하위에 추가하는 방식.

---

### QA-09 — 별 미수집 상태로 goal 도달 시 사용자 피드백 없음 (`GameManager.ts:339`)

```typescript
if (nodeId === this.goalBlockId && ... && (this.starMgr?.allCollected() ?? true)) {
  this.onGoalReached(); // 별이 남아있으면 진입 안 함
}
// else: 아무것도 하지 않음
```

별을 다 모으지 않은 상태에서 goal 블록을 밟아도 **클리어 불가 이유가 표시되지 않는다**. 플레이어는 왜 클리어가 안 되는지 알 방법이 없다.

**수정 방향:** `allCollected()`가 false일 때 HUD에 일시적 힌트 표시:
```typescript
} else if (this.starMgr && !this.starMgr.allCollected()) {
  // 예: HUD에 "★ 별을 모두 수집하세요" 잠시 표시
}
```

---

### QA-10 — `StarManager.dispose()` scale tween 미종료 (`StarManager.ts:116,137`)

`tryCollect()` 실행 시 별의 scale-down tween(0.28s)이 시작되고 mesh는 `starMeshes`에서 즉시 제거된다:

```typescript
// StarManager.ts:116
this.starMeshes.delete(nodeId);  // starMeshes에서 제거
gsap.to(mesh.scale, {
  x: 0, y: 0, z: 0,
  duration: 0.28,
  onComplete: () => {
    this.scene.remove(mesh);
    mesh.geometry.dispose();
    (mesh.material as THREE.Material).dispose();
  },
});
```

`dispose()` (레벨 언로드)가 0.28s 이내에 호출되면:
1. `starMeshes`에 이미 없어서 `dispose()`가 이 mesh를 찾지 못함
2. `gsap.killTweensOf(mesh.scale)` 미호출
3. 0.28s 뒤 tween onComplete가 실행되어 이미 언로드된 씬 객체에 접근

씬 참조가 유효하면 실제 크래시는 없지만, 언로드 후 씬을 건드리는 코드가 실행되는 것은 의도치 않은 동작이다.

**수정 방향:** `dispose()` 내에서 이미 제거된 수집 중인 별의 tween도 종료할 수 있도록, 수집된 mesh를 별도 Set에 임시 보관하거나 `gsap.globalTimeline.kill()`을 활용.

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

---

## 미구현 기능 백로그 (2026-06-14)

향후 구현을 위한 기획 메모. 우선순위 순으로 정렬.

---

### 🔴 BACKLOG-01 — 180도 중력 반전 블록

**개요**
특정 블록 위에 올라가면 캐릭터가 천장에 붙어 걷는 것처럼 보이는 블록.  
에셔 계단 착시 컨셉과 가장 잘 어울리는 요소.

**구현 방향**
- `BlockData`에 `gravityFlip?: true` 플래그 추가
- `onArrival`에서 감지 → 전환 연출 후 `isFlipped` 상태 토글
- 카메라: `camera.up`을 `(0, -1, 0)`으로 GSAP 트윈 (약 0.6s)
- 캐릭터 위치: 블록 `topY` 기준 → `bottomY - characterHeight` 기준으로 전환
- OrbitControls: `up` 변경 시 조작이 뒤집히므로, 뒤집힌 상태에서 `rotateSpeed`에 `-1` 곱하기 필요

**주요 리스크**
- OrbitControls가 `camera.up` 변경에 민감 → 전환 중 일시적으로 수동 제어 필요
- 90도 회전(옆 벽 걷기)보다는 쉽지만, PathGraph Y 기준 위치 계산 수정 필요
- 반전 구역과 일반 구역 경계 블록 처리 로직 필요

**에디터 지원**
- `gravityFlip` 체크박스 (SELECTED BLOCK 패널)
- 에디터 뷰에서 뒤집힌 블록 시각 표시 (파란색 화살표 등)

---

### 🟠 BACKLOG-02 — 적(Enemy) 시스템

**개요**
경로 위를 왕복하는 적 캐릭터. 착시를 활용해 적을 다른 경로로 보낼 수 있음.  
착시 퍼즐 컨셉과 시너지가 가장 강한 요소.

**구현 방향**
- `EnemyManager` 클래스 신규 작성
  - `enemies: Enemy[]` 배열 관리
  - 각 Enemy는 `nodeA ↔ nodeB` 사이를 왕복 (PathGraph 기반)
  - `update(dt)` 메서드로 매 프레임 이동 처리
- `LevelData`에 `enemies?: Array<{ nodeA: string; nodeB: string; speed?: number }>` 추가
- 플레이어와 같은 노드에 도달하면 → `_respawn()` 호출 (가시 블록과 동일 처리)
- 착시 연동: `IllusionManager` 활성화 시 적의 PathGraph 연결도 변경 → 적이 착시 경로로 이동

**주요 리스크**
- 적 이동에 PathGraph를 재사용하면 graph.refresh() 타이밍 충돌 가능
- 착시로 적을 보내는 로직은 IllusionManager와 EnemyManager 간 이벤트 연동 필요
- 적 메시 디자인 (Character 재사용 vs 별도 모델)

**에디터 지원**
- ENEMIES 섹션 추가 (nodeA, nodeB, speed 입력)
- 에디터 뷰에서 왕복 경로를 화살표로 시각화

---

### 🟡 BACKLOG-03 — 움직이는 블록 (Patrol Block)

**개요**
Y축 또는 X/Z축 방향으로 자동 왕복하는 블록.  
플레이어가 타이밍에 맞춰 올라타는 플랫포머 요소.

**구현 방향**
- 기존 `ElevatorManager`를 참고해 `PatrolBlock` 구현
- `LevelData.patrols?: Array<{ nodeId, axis: 'x'|'y'|'z', distance, duration }>` 추가
- GSAP 트윈으로 왕복 애니메이션 (yoyo: true)
- 블록 이동 시 위에 올라탄 캐릭터도 함께 이동 (SwitchManager의 `isPlayerOnMovingBlock` 패턴 참고)

**주요 리스크**
- 캐릭터가 블록과 함께 이동할 때 PathGraph 노드 위치 동기화 필요
- 다른 블록/착시와 조합 시 충돌 케이스 증가

---

### 🟢 BACKLOG-04 — 상자 밀기 (Push Box)

**개요**
블록 위에 상자가 있고, 플레이어가 밀어서 이동시킬 수 있는 퍼즐 요소.  
스위치 위에 상자를 밀어놓는 등 퍼즐 조합 가능.

**구현 방향**
- `BoxEntity` 클래스: 현재 노드 위치, 메시 관리
- 플레이어가 상자가 있는 노드로 이동 시도 → 상자가 반대편 노드로 밀려남
- `CharacterController.moveTo()` 에서 목적 노드에 상자가 있으면 push 시도
- 상자가 밀릴 수 없는 위치(엣지, 다른 상자)면 이동 차단

**주요 리스크**
- PathGraph와 상자 위치의 실시간 동기화 복잡도 높음
- 착시 + 상자 조합 시 예외 케이스 다수 예상

---

### ℹ️ 구현 시 공통 고려사항

- 모든 신규 메커닉은 **에디터(LevelEditor)에도 함께 추가** 필요
- `LevelData` 인터페이스 변경 시 기존 JSON 하위 호환성 유지 (optional 필드로 추가)
- 신규 매니저 클래스는 `GameManager.unloadCurrent()`에서 반드시 dispose 처리
- 모바일 성능 고려: 적/패트롤 블록 개수 제한 또는 프레임 스킵 적용 검토
- 경계에서 경로가 깜빡이는 현상 방지
