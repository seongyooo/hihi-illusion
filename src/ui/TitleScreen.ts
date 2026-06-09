export class TitleScreen {
  private el: HTMLElement;
  onPlay:     () => void = () => {};
  onDev:      () => void = () => {};
  onSettings: () => void = () => {};

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'title-screen';

    const title = document.createElement('h1');
    title.className = 'title-screen__title';
    title.textContent = 'ILLUSION';
    this.el.appendChild(title);

    const playBtn = document.createElement('button');
    playBtn.className = 'title-screen__play';
    playBtn.textContent = 'PLAY';
    playBtn.addEventListener('click', () => this.onPlay());
    this.el.appendChild(playBtn);

    const devBtn = document.createElement('button');
    devBtn.className = 'title-screen__dev';
    devBtn.textContent = 'DEV';
    devBtn.addEventListener('click', () => this.onDev());
    this.el.appendChild(devBtn);

    const settingsBtn = document.createElement('button');
    settingsBtn.className = 'title-screen__settings-btn';
    settingsBtn.textContent = 'SETTINGS';
    settingsBtn.addEventListener('click', () => this.onSettings());
    this.el.appendChild(settingsBtn);

    container.appendChild(this.el);
  }

  show(): void {
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
