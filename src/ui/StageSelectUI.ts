import { CustomLevelStore } from '../editor/CustomLevelStore';
import { CUSTOM_STAGE_NUMS } from '../levels/registry';
import { ProgressStore }     from '../core/ProgressStore';

const TOTAL_STAGES       = 30;
const BUILTIN_STAGE_NUMS = new Set(CUSTOM_STAGE_NUMS);

export class StageSelectUI {
  private el: HTMLElement;
  onSelect:   (stageNum: number) => void = () => {};
  onBack:     () => void = () => {};
  onTutorial: () => void = () => {};

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
}
