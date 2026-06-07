export class TutorialHint {
  private el: HTMLElement;

  constructor(container: HTMLElement) {
    this.el           = document.createElement('div');
    this.el.className = 'tutorial-hint';
    container.appendChild(this.el);
  }

  showStep(step: 1 | 2): void {
    const messages: Record<1 | 2, string> = {
      1: '블록을 클릭해 이동하세요',
      2: '카메라를 드래그해 시점을 회전하세요',
    };
    this.el.textContent = messages[step];
    this.el.classList.add('visible');
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
