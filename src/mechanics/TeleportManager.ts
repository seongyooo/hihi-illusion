import * as THREE from 'three';
import gsap from 'gsap';
import type { PathNode } from '../world/PathGraph';
import type { ParticleSystem } from '../fx/ParticleSystem';

export class TeleportManager {
  private scene:     THREE.Scene;
  private particles: ParticleSystem;
  private rings:     THREE.Mesh[] = [];

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.scene     = scene;
    this.particles = particles;
  }

  setupPads(pairs: Array<[PathNode, PathNode]>): void {
    for (const [a, b] of pairs) {
      this.createPadRings(a);
      this.createPadRings(b);
    }
  }

  private createPadRings(node: PathNode): void {
    const wp = new THREE.Vector3();
    node.mesh.getWorldPosition(wp);
    const baseY = wp.y + node.halfHeight;

    for (let i = 0; i < 2; i++) {
      const geo = new THREE.TorusGeometry(0.24, 0.04, 8, 24);
      const mat = new THREE.MeshLambertMaterial({ color: 0x44DDEE });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(wp.x, baseY + 0.25 + i * 0.18, wp.z);
      this.scene.add(ring);
      this.rings.push(ring);

      const dir = i % 2 === 0 ? 1 : -1;
      gsap.to(ring.rotation, {
        z: dir * Math.PI * 2,
        duration: 2.0 + i * 0.7,
        repeat: -1,
        ease: 'none',
      });
    }
  }

  playEffect(fromNode: PathNode, toNode: PathNode): void {
    const burst = (node: PathNode, delay: number) => {
      const wp = new THREE.Vector3();
      node.mesh.getWorldPosition(wp);
      wp.y += node.halfHeight;
      setTimeout(() => this.particles.burst(wp, 0x44DDEE, 22, 1.8, 0.55), delay);
    };
    burst(fromNode, 0);
    burst(toNode, 120);
  }

  dispose(): void {
    for (const ring of this.rings) {
      gsap.killTweensOf(ring.rotation);
      this.scene.remove(ring);
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    }
    this.rings = [];
  }
}
