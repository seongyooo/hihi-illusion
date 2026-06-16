import { CustomLevelStore } from '../editor/CustomLevelStore';
import { CUSTOM_STAGE_NUMS } from '../levels/registry';
import { ProgressStore }     from '../core/ProgressStore';

const PAGE_SIZE          = 30;
const BUILTIN_STAGE_NUMS = new Set(CUSTOM_STAGE_NUMS);

export class StageSelectUI {
  private el: HTMLElement;
  private currentPage = 1;
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

  private getTotalStages(): number {
    const maxCustom = CUSTOM_STAGE_NUMS.length > 0
      ? Math.max(...CUSTOM_STAGE_NUMS)
      : 0;
    return Math.max(maxCustom, PAGE_SIZE);
  }

  private buildGrid(): void {
    const back = this.el.querySelector('.stage-select__back');
    this.el.innerHTML = '';
    if (back) this.el.appendChild(back);

    const totalStages = this.getTotalStages();
    const totalPages  = Math.ceil(totalStages / PAGE_SIZE);

    const title = document.createElement('h2');
    title.className = 'stage-select__title';
    title.textContent = totalPages > 1
      ? `SELECT STAGE  ·  ${this.currentPage} / ${totalPages}`
      : 'SELECT STAGE';
    this.el.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'stage-select__grid';

    const startStage = (this.currentPage - 1) * PAGE_SIZE + 1;
    const endStage   = Math.min(this.currentPage * PAGE_SIZE, totalStages);

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

    // 페이지 네비게이션
    if (totalPages > 1) {
      const nav = document.createElement('div');
      nav.className = 'stage-select__page-nav';

      const prevBtn = document.createElement('button');
      prevBtn.className = 'stage-select__page-btn';
      prevBtn.textContent = '← PREV';
      prevBtn.disabled = this.currentPage <= 1;
      prevBtn.addEventListener('click', () => {
        this.currentPage--;
        this.buildGrid();
      });

      const pageLabel = document.createElement('span');
      pageLabel.className = 'stage-select__page-label';
      pageLabel.textContent = `${this.currentPage} / ${totalPages}`;

      const nextBtn = document.createElement('button');
      nextBtn.className = 'stage-select__page-btn';
      nextBtn.textContent = 'NEXT →';
      nextBtn.disabled = this.currentPage >= totalPages;
      nextBtn.addEventListener('click', () => {
        this.currentPage++;
        this.buildGrid();
      });

      nav.appendChild(prevBtn);
      nav.appendChild(pageLabel);
      nav.appendChild(nextBtn);
      this.el.appendChild(nav);
    }

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
    this.currentPage = 1;
    this.buildGrid();
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
  }

}
