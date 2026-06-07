import * as THREE from 'three';

export class ParticleSystem {
  private scene:  THREE.Scene;
  private active = true;

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

    const start = performance.now();
    const arr   = geo.attributes.position.array as Float32Array;

    const tick = () => {
      if (!this.active) {
        this.scene.remove(points);
        geo.dispose();
        mat.dispose();
        return;
      }
      const t = (performance.now() - start) / 1000 / duration;
      if (t >= 1) {
        this.scene.remove(points);
        geo.dispose();
        mat.dispose();
        return;
      }
      const dt = t * duration;
      for (let i = 0; i < count; i++) {
        arr[i * 3]     = vels[i][0] * dt;
        arr[i * 3 + 1] = vels[i][1] * dt - 2.5 * dt * dt;
        arr[i * 3 + 2] = vels[i][2] * dt;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = 1 - t;
      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);
  }

  dispose(): void {
    this.active = false;
  }

  reset(): void {
    this.active = true;
  }
}
