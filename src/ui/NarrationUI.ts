import gsap from 'gsap';

/**
 * 인게임 나레이션 자막 컴포넌트.
 * 스테이지 로드 시 화면 하단에 영화 자막처럼 텍스트를 표시한다.
 */
export class NarrationUI {
  private el: HTMLElement;
  private textEl: HTMLElement;
  private tween: gsap.core.Tween | null = null;
  private showTimer = 0;

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'narration-subtitle';

    this.textEl = document.createElement('p');
    this.textEl.className = 'narration-subtitle__text';
    this.el.appendChild(this.textEl);

    container.appendChild(this.el);
  }

  /**
   * 나레이션 텍스트를 표시한다.
   * @param text 표시할 텍스트 (줄바꿈: \n)
   * @param delay 표시 전 대기 시간(초), 기본값 1.2
   */
  show(text: string, delay = 1.2): void {
    this.cancel();

    this.showTimer = window.setTimeout(() => {
      // \n → <br>
      this.textEl.innerHTML = text.replace(/\n/g, '<br>');
      gsap.set(this.el, { opacity: 0, display: 'flex' });

      this.tween = gsap.to(this.el, {
        opacity: 1,
        duration: 0.6,
        ease: 'power2.out',
        onComplete: () => {
          // 3.5초 유지 후 페이드 아웃
          this.tween = gsap.to(this.el, {
            opacity: 0,
            duration: 0.8,
            ease: 'power2.in',
            delay: 3.5,
            onComplete: () => {
              this.el.style.display = 'none';
              this.tween = null;
            },
          });
        },
      });
    }, delay * 1000);
  }

  /** 진행 중인 나레이션을 즉시 취소한다. */
  cancel(): void {
    clearTimeout(this.showTimer);
    if (this.tween) {
      this.tween.kill();
      this.tween = null;
    }
    gsap.killTweensOf(this.el);
    this.el.style.display = 'none';
  }
}
