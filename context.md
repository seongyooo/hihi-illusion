# hihi 프로젝트 작업 컨텍스트

마지막 업데이트: 2026-06-24 (맵 회전 후 캐릭터 가시성 버그 수정)

---

## 현재 스테이지 구성

- **튜토리얼** (`level01.json`)
- **Stage 1 ~ 39** (`level_custom_1.json` ~ `level_custom_39.json`)
- 총 40개 스테이지

---

## Block Dividers 기능 (seam mesh)

### 개요
Settings에서 "Block Dividers" 토글로 인접 블록 사이 구분선(이음새)을 켜고 끌 수 있다.

### 구현 방식
- `GraphicsSettings.blockDividers` (localStorage 저장)
- `SeamMeshBuilder.buildSeamMesh()` — 인접 같은 색 블록 사이 내부 면을 제거하고 외부 면만 `PlaneGeometry`로 합쳐 단일 merged mesh 생성
- `Level.rebuildSeamMesh()` — seam mesh 재빌드 + 개별 블록 geometry 숨김/복원
- `Level._setBlockMeshesVisible()` — `userData.isBlock === true`인 geometry mesh만 show/hide (별·마커 등 그룹 자식은 유지)

### 제외 대상 (dynamicBlockIds + 항상 제외)
`buildSeamMesh`와 `_setBlockMeshesVisible` 에서 항상 개별 mesh를 유지하는 블록:
- **spike** 블록 (`b.isSpike`)
- **wedge** 블록 (`b.shape === 'wedge'`)
- **스위치 대상** (`switches[].targetNodeId` — spawn·move 모두)
- **엘리베이터** (`elevators[].nodeId`)
- **패트롤** (`patrols[].nodeId`)

### 수정 이력
| 날짜 | 문제 | 해결 |
|------|------|------|
| 2026-06-23 | 별이 안 보임 | `block.mesh.visible=false` 대신 `userData.isBlock` 자식만 숨김 |
| 2026-06-23 | move 블록 애니메이션 안 됨 | move/elevator/patrol 블록을 `dynamicBlockIds`로 seam mesh 제외 |
| 2026-06-23 | 골 도달 팽창 애니메이션 안 보임 | `onGoalReached`에서 blockDividers=false 시 일시 `visible=true`, goalMesh.scale yoyo 1→1.4/1.8→1 |
| 2026-06-23 | spawn 스위치 대상 블록이 미리 보임 | spawn 타입 스위치 대상도 `dynamicBlockIds`에 포함 |

---

## 관련 파일

| 파일 | 역할 |
|------|------|
| `src/world/SeamMeshBuilder.ts` | seam mesh 빌드 (buildSeamMesh, disposeSeamGroup) |
| `src/world/Level.ts` | rebuildSeamMesh, _setBlockMeshesVisible, _computeDynamicBlockIds |
| `src/core/GraphicsSettings.ts` | blockDividers getter/setter |
| `src/ui/SettingsScreen.ts` | Block Dividers 토글 UI |
| `src/core/GameManager.ts` | onBlockDividersChange 핸들러, onGoalReached 팽창 애니메이션 |

---

## 블록 교체 작업 (2026-06-23)

- 전체 744개 블록 `[1, 0.5, 1]` → `[1, 1, 1]` 변환 완료
- 변환 공식: `position[1] × 2` (floor index 유지, 간격 2배)
- 연동 필드 업데이트: switch moveTarget Y, Y축 patrol distance, initialCamera targetY
- 에디터 공식 업데이트: blockWorldPos cube 공식 `floor × 1.0 + 0.5`, floorY `floor × 1.0`, cubeMode 기본값 ON
- floor 0 Y 좌표 유지 (center=0.5), 에디터 currentFloor 최솟값 0 → -3으로 변경해 지하 3층 접근 가능

---

## 맵 회전 후 캐릭터 가시성 버그 수정 (2026-06-24)

### 버그
180° 맵 회전(`mapRotateBlocks`) 후 캐릭터가 블록 안에 묻혀 보이지 않는 현상.

### 원인
`gravityUp = (0,-1,0)`일 때 캐릭터 Y = `blockCenter.y + up.y * halfH = blockCenter.y - halfH` (블록 아랫면).
캐릭터 메시는 로컬 +Y 방향으로 뻗어 있으므로, 아랫면에 놓이면 메시 전체가 블록 안으로 들어가 카메라(위에서 내려다봄)에 보이지 않게 됨.

### 수정 (`src/character/CharacterController.ts`)
캐릭터 Y는 항상 `blockMeshWorldPos.y + halfH` (월드 +Y 윗면) 고정.

```typescript
// 수정 전: this._wp.y + u.y * h  (중력 방향 면)
// 수정 후: this._wp.y + h        (항상 world +Y 윗면)
```

이동 애니메이션 `targetY`도 수정:
```typescript
const targetY = node.position.y + (1 - u.y) * node.halfHeight;
// up.y=+1 → node.position.y (기존과 동일)
// up.y=-1 → node.position.y + 2*halfH (윗면으로 보정)
```

수정 위치: `update()`, `stop()`, `replaceCharacter()`, `teleportTo()`, `_advance()` tween + onComplete (총 5곳)

---

## 미완 / 알려진 한계

- seam mesh는 정적 위치 기준으로 빌드됨 → 동적 블록(elev·patrol·move·spawn) 주변에는 인접 블록 이음새가 남을 수 있음 (허용 범위)
- 카메라 각도에 따라 조명 차이로 블록 경계가 미세하게 보일 수 있음 (PlaneGeometry 방식의 한계)

