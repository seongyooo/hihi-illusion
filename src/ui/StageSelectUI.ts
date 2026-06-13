import { CustomLevelStore } from '../editor/CustomLevelStore';
import { CUSTOM_STAGE_NUMS } from '../levels/registry';
import { ProgressStore }     from '../core/ProgressStore';

const TOTAL_STAGES       = 30;
const BUILTIN_STAGE_NUMS = new Set(CUSTOM_STAGE_NUMS);

const DEV_UNLOCK_TAPS  = 10;   // 연타 횟수
const DEV_RESET_MS     = 3000; // 이 시간 안에 안 누르면 카운터 초기화

export class StageSelectUI {
  private el: HTMLElement;
  onSelect:   (stageNum: number) => void = () => {};
  onBack:     () => void = () => {};
  onTutorial: () => void = () => {};

  private tapCount    = 0;
  private tapTimer:   ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'stage-select';

    const backBtn = document.createElement('button');
    backBtn.className = 'stage-select__back';
    backBtn.textContent = '← Main';
    backBtn.addEventListener('click', () => this.onBack());
    this.el.appendChild(backBtn);

    this.buildGrid();
    container.appendChild(this.el);
  }

  private buildGrid(): void {
    const back = this.el.querySelector('.stage-select__back');
    this.el.innerHTML = '';
    if (back) this.el.appendChild(back);

    const title = document.createElement('h2');
    title.className = 'stage-select__title';
    title.textContent = 'SELECT STAGE';
    title.style.cursor = 'default';
    title.addEventListener('click', () => this.onTitleTap(title));
    this.el.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'stage-select__grid';

    for (let i = 1; i <= TOTAL_STAGES; i++) {
      const btn = document.createElement('button');
      btn.className = 'stage-select__cell';
      btn.textContent = String(i);

      const isBuiltin  = BUILTIN_STAGE_NUMS.has(i);
      const isCustom   = !isBuiltin && !!CustomLevelStore.getByStage(i);
      const hasContent = isBuiltin || isCustom;
      const isUnlocked = ProgressStore.isUnlocked(i);

      if (hasContent && isUnlocked) {
        btn.addEventListener('click', () => this.onSelect(i));
        if (isCustom) btn.title = CustomLevelStore.getByStage(i)!.data.name;
      } else if (hasContent && !isUnlocked) {
        // 콘텐츠는 있지만 아직 잠긴 스테이지
        btn.classList.add('locked', 'locked--progress');
        btn.disabled = true;
        btn.title = '이전 스테이지를 클리어하세요';
      } else {
        // 콘텐츠 없음
        btn.classList.add('locked');
        btn.disabled = true;
      }

      grid.appendChild(btn);
    }

    this.el.appendChild(grid);

    // 튜토리얼 다시하기 버튼 (튜토리얼 완료한 경우에만 표시)
    if (ProgressStore.isTutorialDone()) {
      const tutorialBtn = document.createElement('button');
      tutorialBtn.className = 'stage-select__tutorial-btn';
      tutorialBtn.textContent = '튜토리얼 다시하기';
      tutorialBtn.addEventListener('click', () => this.onTutorial());
      this.el.appendChild(tutorialBtn);
    }
  }

  show(): void {
    this.buildGrid();  // rebuild so custom stages and progress are reflected
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
  }

  private onTitleTap(titleEl: HTMLElement): void {
    // 타이머 리셋
    if (this.tapTimer !== null) clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => {
      this.tapCount = 0;
      this.tapTimer = null;
    }, DEV_RESET_MS);

    this.tapCount++;

    // 진행 피드백: 남은 횟수 표시
    if (this.tapCount < DEV_UNLOCK_TAPS) {
      titleEl.textContent = `SELECT STAGE ${'·'.repeat(this.tapCount)}`;
      return;
    }

    // 10번 달성 → 전체 잠금 해제
    clearTimeout(this.tapTimer!);
    this.tapTimer = null;
    this.tapCount = 0;

    ProgressStore.unlockAll(TOTAL_STAGES);

    // 타이틀 플래시 효과
    titleEl.textContent = '🔓 ALL STAGES UNLOCKED';
    titleEl.style.color = '#FFD700';
    setTimeout(() => {
      titleEl.textContent = 'SELECT STAGE';
      titleEl.style.color = '';
      this.buildGrid();
    }, 1500);
  }
}
