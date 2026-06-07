# HIHI 프로젝트 진행 상황

## 프로젝트 개요

- **이름:** HIHI (Illusion Puzzle Game)
- **기술스택:** TypeScript + Three.js + Vite + GSAP
- **레포:** https://github.com/seongyooo/hihi-illusion
- **개발 서버:** `npm run dev` (`--host` 포함, 모바일 접속 가능)

---

## 스테이지 구성 (총 12 스테이지 + 튜토리얼)

| 파일 | ID | 이름 | 핵심 기믹 |
|---|---|---|---|
| level01.json | level_01 | Tutorial | 튜토리얼, 기본 이동 + 사다리 |
| level_custom_1.json | custom_stage_1 | The Prologue | 기본 이동 + 사다리 |
| level_custom_2.json | custom_stage_2 | The Bridge | 사다리 + 높이차 경로 |
| level_custom_3.json | custom_stage_3 | The Illusion | 사다리 + 높은 고도 이동 |
| level_custom_4.json | custom_stage_4 | Custom Level | 환상(illusion) 첫 등장 |
| level_custom_5.json | custom_stage_5 | Custom Level | 환상 + 미드포인트 |
| level_custom_6.json | custom_stage_6 | Custom Level | 환상 + 사다리 + 미드포인트 |
| level_custom_7.json | custom_stage_7 | Custom Level | 환상 복합 + 미드포인트 |
| level_custom_8.json | custom_stage_8 | Custom Level | **순간이동 첫 등장** |
| level_custom_9.json | custom_stage_9 | The Relay | 순간이동 ×2, 3섬 릴레이 |
| level_custom_10.json | custom_stage_10 | The Elevator | 순간이동으로 고지대 도착 → 사다리 하강 |
| level_custom_11.json | custom_stage_11 | Mirage | 순간이동 + 사다리 + 환상 + 미드포인트 |
| level_custom_12.json | custom_stage_12 | Convergence | 순간이동 ×2 + 사다리 + 환상 + 미드포인트 |

**참고:** level01.json은 튜토리얼 전용. 게임 시작 시 자동 로드되고 클리어하면 타이틀 화면으로 이동. stage 1~12는 타이틀 → PLAY → 스테이지 선택에서 진입.

---

## 게임 흐름

```
게임 시작
  → loadLevel('level_01') [튜토리얼]
  → 클리어 → TitleScreen
  → PLAY 버튼 → StageSelectUI (1~12 선택)
  → DEV 버튼 → EditorLobby (Stage 1~12 편집 가능)
```

---

## 수정된 주요 파일

| 파일 | 역할 |
|---|---|
| `src/levels/registry.ts` | 전체 레벨 ID/파일 매핑 (level_01 + custom_stage_1~12) |
| `src/core/GameManager.ts` | builtinIds 1~12, start()는 level_01 로드, 카메라 중심 동적 계산 |
| `src/ui/StageSelectUI.ts` | BUILTIN_STAGES = 12 |
| `src/ui/EditorLobby.ts` | builtinStages 배열 1~12 |
| `src/editor/LevelEditor.ts` | loadBuiltinStage fileMap 1~12 |
| `src/style.css` | 모바일 뷰포트 fix (position:fixed, overscroll-behavior:none) |
| `src/core/Renderer.ts` | visualViewport resize 이벤트 추가 |

---

## 다음 계획

### 13~16 스테이지 (압력 시스템 도입)
- 12 스테이지까지는 순간이동 + 환상 복합 기믹
- **13 스테이지부터 압력(pressure) 시스템 추가 예정**
- 압력 시스템: 특정 블록을 밟으면 다른 블록이 움직이거나 활성화되는 기믹
- 구현 전 기획 및 설계 필요

### 스테이지 업데이트 워크플로우

현재 맵 수정 방법:
1. 에디터에서 맵 수정
2. JSON 다운로드
3. `src/levels/`에 덮어쓰기
4. 새 파일이면 아래 4개 파일 수정 필요:
   - `src/levels/registry.ts`
   - `src/core/GameManager.ts` (builtinIds)
   - `src/editor/LevelEditor.ts` (fileMap)
   - `src/ui/EditorLobby.ts` (builtinStages)

개선 가능 방향:
- `public/levels/`로 이동 + fetch 방식으로 변경하면 JSON만 교체해도 됨 (아직 미적용)

---

## 모바일 접속

```bash
npm run dev
# 터미널에 뜨는 Network 주소로 모바일 접속
# 예: http://172.17.141.1:5173
# PC와 모바일이 같은 Wi-Fi여야 함
```

**배경:** localStorage는 기기별로 분리되어 모바일에서 PC에서 만든 맵을 못 봄.
→ JSON을 `src/levels/`에 직접 포함시켜 번들링하는 방식으로 해결.
