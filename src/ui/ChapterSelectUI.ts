import { WORLDS } from '../levels/worlds';
import { ProgressStore } from '../core/ProgressStore';

export class ChapterSelectUI {
  private el: HTMLElement;
  onSelect: (worldId: number) => void = () => {};
  onBack:   () => void = () => {};

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'chapter-select';

    const backBtn = document.createElement('button');
    backBtn.className = 'stage-select__back';
    backBtn.textContent = '← Main';
    backBtn.addEventListener('click', () => this.onBack());
    this.el.appendChild(backBtn);

    container.appendChild(this.el);
  }

  private buildCards(): void {
    const back = this.el.querySelector('.stage-select__back');
    this.el.innerHTML = '';
    if (back) this.el.appendChild(back);

    const title = document.createElement('h2');
    title.className = 'chapter-select__title';
    title.textContent = 'SELECT WORLD';
    this.el.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'chapter-select__grid';

    const unlocked = ProgressStore.getUnlockedStages();

    for (const world of WORLDS) {
      const { startStage, endStage, color } = world;
      const stageCount = endStage - startStage + 1;
      const isLocked   = !unlocked.has(startStage);

      let cleared = 0;
      for (let s = startStage; s <= endStage; s++) {
        if (unlocked.has(s + 1)) cleared++;
      }
      // 마지막 월드 마지막 스테이지 클리어 처리
      if (unlocked.has(endStage + 1) || (world.id === WORLDS.length && cleared === stageCount - 1 && unlocked.has(endStage))) {
        cleared = Math.min(cleared, stageCount);
      }

      const card = document.createElement('button');
      card.className = 'chapter-select__card';
      card.style.background  = color.bg;
      card.style.borderColor = isLocked ? 'rgba(245,240,232,0.1)' : color.border;

      if (isLocked) {
        card.classList.add('chapter-select__card--locked');
        card.disabled = true;
      } else {
        card.addEventListener('click', () => this.onSelect(world.id));
      }

      // 월드 번호 (대형)
      const num = document.createElement('div');
      num.className = 'chapter-select__card-num';
      num.textContent = String(world.id).padStart(2, '0');
      num.style.color = isLocked ? 'rgba(245,240,232,0.2)' : color.accent;
      card.appendChild(num);

      // 월드 이름
      const name = document.createElement('div');
      name.className = 'chapter-select__card-name';
      name.textContent = world.name;
      card.appendChild(name);

      // 월드 부제
      const subtitle = document.createElement('div');
      subtitle.className = 'chapter-select__card-subtitle';
      subtitle.textContent = world.subtitle;
      card.appendChild(subtitle);

      // 스테이지 범위
      const range = document.createElement('div');
      range.className = 'chapter-select__card-range';
      range.textContent = `Stage ${startStage} – ${endStage}`;
      card.appendChild(range);

      if (isLocked) {
        const lock = document.createElement('div');
        lock.className = 'chapter-select__card-lock';
        lock.textContent = '🔒';
        card.appendChild(lock);
      } else {
        const progressWrap = document.createElement('div');
        progressWrap.className = 'chapter-select__progress-wrap';

        const progressBar = document.createElement('div');
        progressBar.className = 'chapter-select__progress-bar';
        progressBar.style.background = color.border;
        progressBar.style.width = `${Math.round((cleared / stageCount) * 100)}%`;
        progressWrap.appendChild(progressBar);
        card.appendChild(progressWrap);

        const progressLabel = document.createElement('div');
        progressLabel.className = 'chapter-select__progress-label';
        progressLabel.textContent = `${cleared} / ${stageCount}`;
        card.appendChild(progressLabel);
      }

      grid.appendChild(card);
    }

    this.el.appendChild(grid);
  }

  show(): void {
    this.buildCards();
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
