import * as THREE from 'three';

interface Burst {
  points:   THREE.Points;
  geo:      THREE.BufferGeometry;
  mat:      THREE.PointsMaterial;
  vels:     [number, number, number][];
  arr:      Float32Array;
  start:    number;
  duration: number;
  count:    number;
}

export class ParticleSystem {
  private scene:   THREE.Scene;
  private active = true;
  private bursts: Burst[] = [];
  private rafId:  number | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  burst(
    position: THREE.Vector3,
    color:    number,
    count    = 20,
    speed    = 1.5,
    duration = 0.8
  ): void {
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));

    const mat = new THREE.PointsMaterial({
      color,
      size: 0.1,
      transparent: true,
      opacity: 1,
      depthWrite: false,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geo, mat);
    points.position.copy(position);
    this.scene.add(points);

    const vels: [number, number, number][] = Array.from({ length: count }, () => {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.random() * Math.PI;
      const r     = speed * (0.5 + Math.random() * 0.5);
      return [
        r * Math.sin(phi) * Math.cos(theta),
        r * Math.abs(Math.cos(phi)) + 0.5,
        r * Math.sin(phi) * Math.sin(theta),
      ];
    });

    this.bursts.push({ points, geo, mat, vels, arr: pos, start: performance.now(), duration, count });

    // 이미 실행 중인 루프가 없을 때만 시작 (모든 버스트를 하나의 RAF로 처리)
    if (this.rafId === null) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (): void => {
    if (!this.active) {
      this.clearAll();
      this.rafId = null;
      return;
    }

    const now = performance.now();
    this.bursts = this.bursts.filter(b => {
      const t = (now - b.start) / 1000 / b.duration;
      if (t >= 1) {
        this.scene.remove(b.points);
        b.geo.dispose();
        b.mat.dispose();
        return false;
      }
      const dt = t * b.duration;
      for (let i = 0; i < b.count; i++) {
        b.arr[i * 3]     = b.vels[i][0] * dt;
        b.arr[i * 3 + 1] = b.vels[i][1] * dt - 2.5 * dt * dt;
        b.arr[i * 3 + 2] = b.vels[i][2] * dt;
      }
      b.geo.attributes.position.needsUpdate = true;
      b.mat.opacity = 1 - t;
      return true;
    });

    if (this.bursts.length > 0) {
      this.rafId = requestAnimationFrame(this.tick);
    } else {
      this.rafId = null;
    }
  };

  private clearAll(): void {
    for (const b of this.bursts) {
      this.scene.remove(b.points);
      b.geo.dispose();
      b.mat.dispose();
    }
    this.bursts = [];
  }

  dispose(): void {
    this.active = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.clearAll();
  }

  reset(): void {
    this.active = true;
  }
}
