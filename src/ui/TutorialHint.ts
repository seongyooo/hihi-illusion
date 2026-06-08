export class TutorialHint {
  private instructionEl: HTMLElement;
  private mainTextEl:    HTMLElement;
  private subTextEl:     HTMLElement;

  constructor(container: HTMLElement) {
    this.instructionEl           = document.createElement('div');
    this.instructionEl.className = 'tutorial-instruction';

    this.mainTextEl           = document.createElement('div');
    this.mainTextEl.className = 'tutorial-instruction__main';
    this.instructionEl.appendChild(this.mainTextEl);

    this.subTextEl           = document.createElement('div');
    this.subTextEl.className = 'tutorial-instruction__sub';
    this.instructionEl.appendChild(this.subTextEl);

    container.appendChild(this.instructionEl);
  }

  /** 화면 상단 중앙에 지시문을 표시한다 */
  showInstruction(main: string, sub = ''): void {
    this.mainTextEl.textContent  = main;
    this.subTextEl.textContent   = sub;
    this.subTextEl.style.display = sub ? '' : 'none';
    this.instructionEl.classList.add('visible');
  }

  hideInstruction(): void {
    this.instructionEl.classList.remove('visible');
  }

  /** 상단 중앙에 짧은 힌트를 표시한다 (sub 없이) */
  showHint(text: string): void {
    this.showInstruction(text);
  }

  hideHint(): void {
    this.hideInstruction();
  }

  /** 모두 숨김 (레벨 언로드 시) */
  hide(): void {
    this.hideInstruction();
  }

  // 하위 호환
  showStep(step: 1 | 2): void {
    const messages: Record<1 | 2, string> = {
      1: '블록을 탭해 이동하세요',
      2: '카메라를 드래그해 시점을 바꿀 수 있어요',
    };
    this.showInstruction(messages[step]);
  }
}
