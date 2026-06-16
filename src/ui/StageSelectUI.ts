import { CustomLevelStore } from '../editor/CustomLevelStore';
import { CUSTOM_STAGE_NUMS } from '../levels/registry';
import { ProgressStore }     from '../core/ProgressStore';

const PAGE_SIZE          = 30;
const BUILTIN_STAGE_NUMS = new Set(CUSTOM_STAGE_NUMS);

export class StageSelectUI {
  private el: HTMLElement;
  private currentChapter = 1;
  onSelect:   (stageNum: number) => void = () => {};
  onBack:     () => void = () => {};
  onTutorial: () => void = () => {};

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'stage-select';

    const backBtn = document.createElement('button');
    backBtn.className = 'stage-select__back';
    backBtn.textContent = '← Chapters';
    backBtn.addEventListener('click', () => this.onBack());
    this.el.appendChild(backBtn);

    container.appendChild(this.el);
  }

  private buildGrid(): void {
    const back = this.el.querySelector('.stage-select__back');
    this.el.innerHTML = '';
    if (back) this.el.appendChild(back);

    const title = document.createElement('h2');
    title.className = 'stage-select__title';
    title.textContent = `CHAPTER ${this.currentChapter}`;
    this.el.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'stage-select__grid';

    const startStage = (this.currentChapter - 1) * PAGE_SIZE + 1;
    const endStage   = this.currentChapter * PAGE_SIZE;

    for (let i = startStage; i <= endStage; i++) {
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
        btn.classList.add('locked', 'locked--progress');
        btn.disabled = true;
        btn.title = '이전 스테이지를 클리어하세요';
      } else {
        btn.classList.add('locked');
        btn.disabled = true;
      }

      grid.appendChild(btn);
    }

    this.el.appendChild(grid);

    // 튜토리얼 다시하기 버튼
    if (this.currentChapter === 1 && ProgressStore.isTutorialDone()) {
      const tutorialBtn = document.createElement('button');
      tutorialBtn.className = 'stage-select__tutorial-btn';
      tutorialBtn.textContent = '튜토리얼 다시하기';
      tutorialBtn.addEventListener('click', () => this.onTutorial());
      this.el.appendChild(tutorialBtn);
    }
  }

  show(chapter = 1): void {
    this.currentChapter = chapter;
    this.buildGrid();
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
