import * as THREE from 'three';
import gsap from 'gsap';
import type { PathNode } from '../world/PathGraph';
import type { ParticleSystem } from '../fx/ParticleSystem';

// 텔레포터 쌍마다 순서대로 배정되는 색상 팔레트
const PAIR_COLORS = [
  0x44DDEE, // 청록
  0xFF6B6B, // 산호
  0x6BCB77, // 초록
  0xFFD93D, // 황금
  0xC77DFF, // 보라
  0xFF9A3C, // 주황
];

export class TeleportManager {
  private parent:     THREE.Object3D;
  private particles:  ParticleSystem;
  private rings:      THREE.Mesh[] = [];
  // nodeId → 해당 패드의 색상 (playEffect에서 재사용)
  private nodeColors: Map<string, number> = new Map();
  // nodeId → 해당 노드 위의 링 메시 목록 (SwitchManager 연동용)
  private nodeRings:  Map<string, THREE.Mesh[]> = new Map();

  constructor(parent: THREE.Object3D, particles: ParticleSystem) {
    this.parent    = parent;
    this.particles = particles;
  }

  setupPads(pairs: Array<[PathNode, PathNode]>): void {
    pairs.forEach(([a, b], i) => {
      const color = PAIR_COLORS[i % PAIR_COLORS.length];
      this.nodeColors.set(a.id, color);
      this.nodeColors.set(b.id, color);
      this.createPadRings(a, color);
      this.createPadRings(b, color);
    });
  }

  private createPadRings(node: PathNode, color: number): void {
    const wp = new THREE.Vector3();
    node.mesh.getWorldPosition(wp);
    const baseY = wp.y + node.halfHeight;

    if (!this.nodeRings.has(node.id)) this.nodeRings.set(node.id, []);

    for (let i = 0; i < 2; i++) {
      const geo = new THREE.TorusGeometry(0.24, 0.04, 8, 24);
      const mat = new THREE.MeshLambertMaterial({ color });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(wp.x, baseY + 0.25 + i * 0.18, wp.z);
      this.parent.add(ring);
      this.rings.push(ring);
      this.nodeRings.get(node.id)!.push(ring);

      const dir = i % 2 === 0 ? 1 : -1;
      gsap.to(ring.rotation, {
        z: dir * Math.PI * 2,
        duration: 2.0 + i * 0.7,
        repeat: -1,
        ease: 'none',
      });
    }
  }

  /** 맵 회전 후 모든 링을 새 월드 좌표로 재배치 */
  reposition(pairs: Array<[PathNode, PathNode]>): void {
    // 기존 링 제거
    this.dispose();
    // 노드 목록에서 다시 생성
    for (const [a, b] of pairs) {
      const color = PAIR_COLORS[0]; // 색상은 nodeColors에서 복구 불가하므로 재설정
      this.nodeColors.set(a.id, color);
      this.nodeColors.set(b.id, color);
      this.createPadRings(a, color);
      this.createPadRings(b, color);
    }
  }

  /** 맵 회전 후 모든 링 위치를 노드 새 월드 좌표 기준으로 업데이트 (parent 로컬 좌표로 변환) */
  repositionRings(nodes: PathNode[]): void {
    const wp = new THREE.Vector3();
    for (const node of nodes) {
      const rings = this.nodeRings.get(node.id);
      if (!rings) continue;
      node.mesh.getWorldPosition(wp);
      const baseY = wp.y + node.halfHeight;
      rings.forEach((ring, i) => {
        const worldPos = new THREE.Vector3(wp.x, baseY + 0.25 + i * 0.18, wp.z);
        ring.position.copy(this.parent.worldToLocal(worldPos));
      });
    }
  }

  /** 해당 노드 위의 패드 링 목록을 반환. SwitchManager 연동용. */
  getRingsForNode(nodeId: string): THREE.Mesh[] {
    return this.nodeRings.get(nodeId) ?? [];
  }

  playEffect(fromNode: PathNode, toNode: PathNode): void {
    const color = this.nodeColors.get(fromNode.id) ?? 0x44DDEE;
    const burst = (node: PathNode, delay: number) => {
      const wp = new THREE.Vector3();
      node.mesh.getWorldPosition(wp);
      wp.y += node.halfHeight;
      setTimeout(() => this.particles.burst(wp, color, 22, 1.8, 0.55), delay);
    };
    burst(fromNode, 0);
    burst(toNode, 120);
  }

  dispose(): void {
    for (const ring of this.rings) {
      gsap.killTweensOf(ring.rotation);
      ring.removeFromParent();
      ring.geometry.dispose();
      (ring.material as THREE.Material).dispose();
    }
    this.rings = [];
    this.nodeColors.clear();
    this.nodeRings.clear();
  }
}
