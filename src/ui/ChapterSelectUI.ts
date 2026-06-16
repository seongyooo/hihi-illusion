import { CUSTOM_STAGE_NUMS } from '../levels/registry';
import { ProgressStore } from '../core/ProgressStore';

const PAGE_SIZE = 30;

// 챕터별 색상 팔레트
const CHAPTER_COLORS = [
  { bg: 'rgba(80,60,180,0.18)',  border: 'rgba(140,120,255,0.45)', accent: '#a89aff' },
  { bg: 'rgba(180,80,60,0.18)',  border: 'rgba(255,140,100,0.45)', accent: '#ffb07a' },
  { bg: 'rgba(60,150,120,0.18)', border: 'rgba(90,220,180,0.45)',  accent: '#5ddcb4' },
  { bg: 'rgba(160,130,30,0.18)', border: 'rgba(240,210,60,0.45)',  accent: '#f0d44a' },
  { bg: 'rgba(80,140,200,0.18)', border: 'rgba(100,190,255,0.45)', accent: '#7dd0ff' },
];

export class ChapterSelectUI {
  private el: HTMLElement;
  onSelect: (chapter: number) => void = () => {};
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

  private getTotalChapters(): number {
    const maxStage = CUSTOM_STAGE_NUMS.length > 0 ? Math.max(...CUSTOM_STAGE_NUMS) : PAGE_SIZE;
    return Math.ceil(maxStage / PAGE_SIZE);
  }

  private buildCards(): void {
    // 기존 카드만 제거 (back 버튼 유지)
    const back = this.el.querySelector('.stage-select__back');
    this.el.innerHTML = '';
    if (back) this.el.appendChild(back);

    const title = document.createElement('h2');
    title.className = 'chapter-select__title';
    title.textContent = 'SELECT CHAPTER';
    this.el.appendChild(title);

    const grid = document.createElement('div');
    grid.className = 'chapter-select__grid';

    const totalChapters = this.getTotalChapters();
    const unlocked = ProgressStore.getUnlockedStages();

    for (let ch = 1; ch <= totalChapters; ch++) {
      const startStage = (ch - 1) * PAGE_SIZE + 1;
      const endStage   = ch * PAGE_SIZE;
      const palette    = CHAPTER_COLORS[(ch - 1) % CHAPTER_COLORS.length];

      // 챕터 첫 스테이지가 잠겨있으면 잠김
      const isLocked = !unlocked.has(startStage);

      // 이 챕터 범위에서 클리어한 스테이지 수 (잠금 해제 = 다음 스테이지가 언락됨)
      let cleared = 0;
      for (let s = startStage; s <= endStage; s++) {
        if (unlocked.has(s + 1) || (unlocked.has(s) && s === endStage)) cleared++;
      }
      // 마지막 스테이지 클리어 여부
      if (unlocked.has(endStage + 1)) cleared = PAGE_SIZE;

      const card = document.createElement('button');
      card.className = 'chapter-select__card';
      card.style.background   = palette.bg;
      card.style.borderColor  = isLocked ? 'rgba(245,240,232,0.1)' : palette.border;

      if (isLocked) {
        card.classList.add('chapter-select__card--locked');
        card.disabled = true;
      } else {
        card.addEventListener('click', () => this.onSelect(ch));
      }

      // 챕터 번호
      const num = document.createElement('div');
      num.className = 'chapter-select__card-num';
      num.textContent = String(ch).padStart(2, '0');
      num.style.color = isLocked ? 'rgba(245,240,232,0.2)' : palette.accent;
      card.appendChild(num);

      // 챕터 이름
      const name = document.createElement('div');
      name.className = 'chapter-select__card-name';
      name.textContent = `CHAPTER ${ch}`;
      card.appendChild(name);

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
        // 진행도 바
        const progressWrap = document.createElement('div');
        progressWrap.className = 'chapter-select__progress-wrap';

        const progressBar = document.createElement('div');
        progressBar.className = 'chapter-select__progress-bar';
        progressBar.style.background = palette.border;
        progressBar.style.width = `${Math.round((cleared / PAGE_SIZE) * 100)}%`;
        progressWrap.appendChild(progressBar);
        card.appendChild(progressWrap);

        const progressLabel = document.createElement('div');
        progressLabel.className = 'chapter-select__progress-label';
        progressLabel.textContent = `${cleared} / ${PAGE_SIZE}`;
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
