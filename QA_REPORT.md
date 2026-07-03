# QA 리포트 — hihi

> 최종 업데이트: 2026-06-28  
> 이전 1~16차 QA 기록은 git 히스토리에 보존됨

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
