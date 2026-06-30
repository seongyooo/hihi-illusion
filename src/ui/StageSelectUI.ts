import { CustomLevelStore } from '../editor/CustomLevelStore';
import { CUSTOM_STAGE_NUMS } from '../levels/registry';
import { ProgressStore }     from '../core/ProgressStore';
import { renderStagePreview } from './StagePreviewRenderer';
import { WORLDS, getWorldById } from '../levels/worlds';

const BUILTIN_STAGE_NUMS = new Set(CUSTOM_STAGE_NUMS);

export class StageSelectUI {
  private el: HTMLElement;
  private tooltip: HTMLElement;
  private tooltipImg: HTMLImageElement;
  private tooltipLabel: HTMLElement;
  private hideTooltipTimer = 0;
  private currentWorldId = 1;
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

    // ── 미리보기 툴팁 ──────────────────────────────────────────────
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'stage-preview-tooltip';

    this.tooltipImg = document.createElement('img');
    this.tooltipImg.className = 'stage-preview-tooltip__img';

    this.tooltipLabel = document.createElement('div');
    this.tooltipLabel.className = 'stage-preview-tooltip__label';

    this.tooltip.appendChild(this.tooltipImg);
    this.tooltip.appendChild(this.tooltipLabel);
    this.el.appendChild(this.tooltip);

    container.appendChild(this.el);
  }

  private buildGrid(): void {
    const back = this.el.querySelector('.stage-select__back');
    this.el.innerHTML = '';
    if (back) this.el.appendChild(back);
    this.el.appendChild(this.tooltip); // 툴팁 재부착

    const world = getWorldById(this.currentWorldId) ?? WORLDS[0];

    const header = document.createElement('div');
    header.className = 'stage-select__world-header';

    const title = document.createElement('h2');
    title.className = 'stage-select__title';
    title.textContent = world.name;

    const subtitle = document.createElement('p');
    subtitle.className = 'stage-select__subtitle';
    subtitle.textContent = world.subtitle;

    header.appendChild(title);
    header.appendChild(subtitle);
    this.el.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'stage-select__grid';

    for (let i = world.startStage; i <= world.endStage; i++) {
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

        // 미리보기 호버 이벤트
        btn.addEventListener('mouseenter', () => this._showPreview(i, btn));
        btn.addEventListener('mouseleave', () => this._scheduleHide());
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
    if (world.hasTutorial && ProgressStore.isTutorialDone()) {
      const tutorialBtn = document.createElement('button');
      tutorialBtn.className = 'stage-select__tutorial-btn';
      tutorialBtn.textContent = '튜토리얼 다시하기';
      tutorialBtn.addEventListener('click', () => this.onTutorial());
      this.el.appendChild(tutorialBtn);
    }
  }

  private async _showPreview(stageNum: number, anchor: HTMLElement): Promise<void> {
    clearTimeout(this.hideTooltipTimer);

    // 로딩 상태
    this.tooltipImg.src = '';
    this.tooltipImg.alt = 'Loading...';
    this.tooltipLabel.textContent = `Stage ${stageNum}`;
    this._positionTooltip(anchor);
    this.tooltip.classList.add('visible');

    try {
      const dataURL = await renderStagePreview(stageNum);
      // 호버 중인 상태가 여전히 유효한지 확인
      if (this.tooltip.classList.contains('visible')) {
        this.tooltipImg.src = dataURL;
        this.tooltipImg.alt = `Stage ${stageNum} preview`;
      }
    } catch {
      // 미리보기 실패 시 조용히 숨김
      this.tooltip.classList.remove('visible');
    }
  }

  private _scheduleHide(): void {
    this.hideTooltipTimer = window.setTimeout(() => {
      this.tooltip.classList.remove('visible');
    }, 120);
  }

  private _positionTooltip(anchor: HTMLElement): void {
    const anchorRect    = anchor.getBoundingClientRect();
    const containerRect = this.el.getBoundingClientRect();

    // 툴팁 예상 크기 (CSS에서 width: 256px 고정)
    const TW = 270;
    const TH = 210;

    let left = anchorRect.right - containerRect.left + 10;
    let top  = anchorRect.top  - containerRect.top  - 8;

    // 오른쪽 넘침 → 왼쪽에 배치
    if (anchorRect.right + TW + 10 > containerRect.right) {
      left = anchorRect.left - containerRect.left - TW - 10;
    }

    // 아래쪽 넘침 → 위로 밀어올림
    if (top + TH > containerRect.height) {
      top = containerRect.height - TH - 8;
    }
    if (top < 8) top = 8;

    this.tooltip.style.left = `${left}px`;
    this.tooltip.style.top  = `${top}px`;
  }

  show(worldId = 1): void {
    this.currentWorldId = worldId;
    this.buildGrid();
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
    this.tooltip.classList.remove('visible');
  }
}
