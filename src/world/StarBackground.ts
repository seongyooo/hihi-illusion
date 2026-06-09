import * as THREE from 'three';
import gsap from 'gsap';

export const STAR_BG_COLOR = '#0A0B1A';  // 우주 배경색

interface StarBackgroundOptions {
  starCount?: number;
  radius?:    number;
}

export class StarBackground {
  private group:  THREE.Group;
  private points: THREE.Points;
  private geo:    THREE.BufferGeometry;
  private tween:  gsap.core.Tween | null = null;

  constructor(scene: THREE.Scene, { starCount = 1400, radius = 65 }: StarBackgroundOptions = {}) {
    const positions = new Float32Array(starCount * 3);
    const colors    = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount; i++) {
      // 구 표면 균등 분포
      const theta = Math.acos(2 * Math.random() - 1);
      const phi   = Math.random() * Math.PI * 2;
      positions[i * 3]     = radius * Math.sin(theta) * Math.cos(phi);
      positions[i * 3 + 1] = radius * Math.sin(theta) * Math.sin(phi);
      positions[i * 3 + 2] = radius * Math.cos(theta);

      // 별 밝기 (어두운 별 많고, 밝은 별 드물게)
      const bright = Math.pow(Math.random(), 1.8) * 0.75 + 0.25; // 0.25~1.0

      // 색조 변화: 60% 중성 흰색, 25% 쿨 블루, 15% 웜 옐로
      const roll = Math.random();
      let r = bright, g = bright, b = bright;
      if (roll < 0.25) {
        // 쿨 블루
        r *= 0.80;
        g *= 0.90;
        b *= 1.00;
      } else if (roll < 0.40) {
        // 웜 옐로
        r *= 1.00;
        g *= 0.95;
        b *= 0.75;
      }

      colors[i * 3]     = r;
      colors[i * 3 + 1] = g;
      colors[i * 3 + 2] = b;
    }

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    this.geo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

    const mat = new THREE.PointsMaterial({
      size:            1.5,
      sizeAttenuation: false,
      vertexColors:    true,
      transparent:     true,
      opacity:         1.0,
      depthWrite:      false,
    });

    this.points = new THREE.Points(this.geo, mat);
    this.group  = new THREE.Group();
    this.group.add(this.points);
    scene.add(this.group);

    // 아주 느린 자전 (240초 = 4분에 1바퀴)
    this.tween = gsap.to(this.group.rotation, {
      y:        Math.PI * 2,
      duration: 240,
      repeat:   -1,
      ease:     'none',
    });
  }

  setVisible(v: boolean): void {
    this.group.visible = v;
  }

  dispose(): void {
    this.tween?.kill();
    this.geo.dispose();
    (this.points.material as THREE.Material).dispose();
    this.group.removeFromParent();
  }
}
