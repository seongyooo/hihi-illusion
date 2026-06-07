export class HUD {
  private levelNameEl:    HTMLElement;
  private overlayEl:      HTMLElement;
  private clearEl:        HTMLElement;
  private clearButtonsEl: HTMLElement;
  private debugEl:        HTMLElement;
  private skipPointerDownX = 0;
  private skipPointerDownY = 0;
  private skipPointerDown:  ((e: PointerEvent) => void) | null = null;
  private skipPointerUp:    ((e: PointerEvent) => void) | null = null;
  private clearBtnTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(container: HTMLElement) {
    this.levelNameEl = document.createElement('div');
    this.levelNameEl.className = 'hud-level-name';
    container.appendChild(this.levelNameEl);

    this.overlayEl = document.createElement('div');
    this.overlayEl.className = 'hud-overlay';
    container.appendChild(this.overlayEl);

    this.clearEl = document.createElement('div');
    this.clearEl.className = 'hud-clear';
    this.clearEl.textContent = 'Stage Clear';
    container.appendChild(this.clearEl);

    this.clearButtonsEl = document.createElement('div');
    this.clearButtonsEl.className = 'hud-clear-buttons';
    container.appendChild(this.clearButtonsEl);

    this.debugEl = document.createElement('div');
    this.debugEl.className = 'hud-debug';
    container.appendChild(this.debugEl);
    this.debugEl.style.display = 'none';
  }

  setLevelName(name: string): void {
    this.levelNameEl.textContent = name;
  }

  enableSkip(cb: () => void): void {
    this.disableSkip();

    this.skipPointerDown = (e: PointerEvent) => {
      this.skipPointerDownX = e.clientX;
      this.skipPointerDownY = e.clientY;
    };
    this.skipPointerUp = (e: PointerEvent) => {
      const dist = Math.hypot(e.clientX - this.skipPointerDownX, e.clientY - this.skipPointerDownY);
      if (dist < 8) cb();
    };

    this.levelNameEl.classList.add('hud-level-name--skippable');
    this.levelNameEl.addEventListener('pointerdown', this.skipPointerDown);
    this.levelNameEl.addEventListener('pointerup',   this.skipPointerUp);
  }

  disableSkip(): void {
    if (this.skipPointerDown) {
      this.levelNameEl.removeEventListener('pointerdown', this.skipPointerDown);
      this.skipPointerDown = null;
    }
    if (this.skipPointerUp) {
      this.levelNameEl.removeEventListener('pointerup', this.skipPointerUp);
      this.skipPointerUp = null;
    }
    this.levelNameEl.classList.remove('hud-level-name--skippable');
  }

  setDebug(azimuth: number, elevation: number, connected: boolean): void {
    this.debugEl.style.display = 'block';
    this.debugEl.textContent =
      `azimuth: ${azimuth.toFixed(1)}°  |  elevation: ${elevation.toFixed(1)}°  |  path: ${connected ? '✓ OPEN' : '✗ closed'}`;
    this.debugEl.style.color = connected ? '#7fff7f' : '#ffffff';
  }

  showClear(onNextStage?: () => void, onStageSelect?: () => void): void {
    this.overlayEl.classList.add('visible');
    this.clearEl.classList.add('visible');

    if (onNextStage || onStageSelect) {
      this.clearBtnTimeout = setTimeout(() => {
        this.clearBtnTimeout = null;
        this.clearButtonsEl.innerHTML = '';

        if (onStageSelect) {
          const selectBtn = document.createElement('button');
          selectBtn.className = 'hud-clear-btn hud-clear-btn--secondary';
          selectBtn.textContent = 'Total Stage';
          selectBtn.addEventListener('click', onStageSelect);
          this.clearButtonsEl.appendChild(selectBtn);
        }

        if (onNextStage) {
          const nextBtn = document.createElement('button');
          nextBtn.className = 'hud-clear-btn';
          nextBtn.textContent = 'Next Stage';
          nextBtn.addEventListener('click', onNextStage);
          this.clearButtonsEl.appendChild(nextBtn);
        }

        this.clearButtonsEl.classList.add('visible');
      }, 1000);
    }
  }

  reset(): void {
    if (this.clearBtnTimeout !== null) {
      clearTimeout(this.clearBtnTimeout);
      this.clearBtnTimeout = null;
    }
    this.overlayEl.classList.remove('visible');
    this.clearEl.classList.remove('visible');
    this.clearButtonsEl.classList.remove('visible');
    this.clearButtonsEl.innerHTML = '';
    this.levelNameEl.textContent = '';
    this.debugEl.style.display = 'none';
    this.disableSkip();
  }
}
