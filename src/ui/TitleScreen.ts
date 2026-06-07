export class TitleScreen {
  private el: HTMLElement;
  onPlay: () => void = () => {};
  onDev: () => void = () => {};

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'title-screen';

    const title = document.createElement('h1');
    title.className = 'title-screen__title';
    title.textContent = 'ILLUSION';
    this.el.appendChild(title);

    const btn = document.createElement('button');
    btn.className = 'title-screen__play';
    btn.textContent = 'PLAY';
    btn.addEventListener('click', () => this.onPlay());
    this.el.appendChild(btn);

    const devBtn = document.createElement('button');
    devBtn.className = 'title-screen__dev';
    devBtn.textContent = 'DEV';
    devBtn.addEventListener('click', () => this.onDev());
    this.el.appendChild(devBtn);

    container.appendChild(this.el);
  }

  show(): void {
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
