import { CustomLevelStore } from '../editor/CustomLevelStore';

const TOTAL_STAGES     = 30;
const BUILTIN_STAGES   = 11;  // stage 1-11 에만 실제 레벨 파일이 있음

export class StageSelectUI {
  private el: HTMLElement;
  onSelect: (stageNum: number) => void = () => {};
  onBack: () => void = () => {};

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
    // back 버튼 제외하고 나머지만 교체
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

      const isBuiltin = i <= BUILTIN_STAGES;
      const isCustom  = !isBuiltin && !!CustomLevelStore.getByStage(i);

      if (isBuiltin || isCustom) {
        btn.addEventListener('click', () => this.onSelect(i));
        if (isCustom) btn.title = CustomLevelStore.getByStage(i)!.data.name;
      } else {
        btn.classList.add('locked');
        btn.disabled = true;
      }

      grid.appendChild(btn);
    }

    this.el.appendChild(grid);
  }

  show(): void {
    this.buildGrid();  // rebuild so custom stages are reflected
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
