import * as THREE from 'three';
import gsap from 'gsap';

export interface CameraPreset {
  position: [number, number, number];
  lookAt:   [number, number, number];
}

export class CameraController {
  private camera:      THREE.OrthographicCamera;
  private orbitTarget: THREE.Vector3;
  private isAnimating = false;
  private currentTl:  gsap.core.Timeline | null = null;

  private readonly _lookAt = new THREE.Vector3();

  constructor(camera: THREE.OrthographicCamera, orbitTarget: THREE.Vector3) {
    this.camera      = camera;
    this.orbitTarget = orbitTarget;
  }

  transitionTo(preset: CameraPreset, duration = 1.2): Promise<void> {
    this.currentTl?.kill();
    this.isAnimating = true;

    const [px, py, pz] = preset.position;
    const [lx, ly, lz] = preset.lookAt;

    const startDir = new THREE.Vector3();
    this.camera.getWorldDirection(startDir);
    const lookTarget = {
      x: this.camera.position.x + startDir.x * 20,
      y: this.camera.position.y + startDir.y * 20,
      z: this.camera.position.z + startDir.z * 20,
    };

    return new Promise(resolve => {
      const tl = gsap.timeline({
        onComplete: () => {
          this.isAnimating = false;
          this.currentTl   = null;
          resolve();
        },
      });
      this.currentTl = tl;

      tl.to(this.camera.position, {
        x: px, y: py, z: pz,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => {
          this._lookAt.set(lookTarget.x, lookTarget.y, lookTarget.z);
          this.camera.lookAt(this._lookAt);
        },
      }, 0);

      tl.to(lookTarget, {
        x: lx, y: ly, z: lz,
        duration,
        ease: 'power2.inOut',
        onUpdate: () => {
          this._lookAt.set(lookTarget.x, lookTarget.y, lookTarget.z);
          this.camera.lookAt(this._lookAt);
        },
      }, 0);
    });
  }

  // Short dramatic wobble — section snap feedback
  pulse(intensity = 0.3, duration = 0.4): void {
    const orig = this.camera.position.clone();
    gsap.to(this.camera.position, {
      x: orig.x + intensity,
      y: orig.y - intensity * 0.5,
      z: orig.z + intensity,
      duration: duration * 0.3,
      ease: 'power2.out',
      yoyo: true,
      repeat: 1,
      onUpdate: () => {
        this.camera.lookAt(this.orbitTarget);
      },
      onComplete: () => {
        this.camera.position.copy(orig);
        this.camera.lookAt(this.orbitTarget);
      },
    });
  }

  /** Immediately kill the fly-in tween without resolving the Promise. */
  cancel(): void {
    this.currentTl?.kill();
    gsap.killTweensOf(this.camera.position);  // pulse() 트윈도 정리
    this.isAnimating = false;
    this.currentTl   = null;
  }

  get animating(): boolean { return this.isAnimating; }
}
