import * as THREE from 'three';
import gsap from 'gsap';
import type { PathNode } from '../world/PathGraph';
import type { ParticleSystem } from '../fx/ParticleSystem';

export class StarManager {
  private scene:     THREE.Scene;
  private particles: ParticleSystem;
  // nodeId → 3D 메시 (수집 전까지 유지)
  private starMeshes:   Map<string, THREE.Mesh> = new Map();
  private collectedIds: Set<string> = new Set();
  private total = 0;

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.scene     = scene;
    this.particles = particles;
  }

  setup(
    stars: Array<{ nodeId: string }>,
    getNode: (id: string) => PathNode | undefined,
  ): void {
    this.total = stars.length;
    for (const { nodeId } of stars) {
      const node = getNode(nodeId);
      if (!node) continue;
      this._createStarMesh(nodeId, node);
    }
  }

  private _createStarMesh(nodeId: string, node: PathNode): void {
    const wp = new THREE.Vector3();
    node.mesh.getWorldPosition(wp);
    const baseY = wp.y + node.halfHeight + 0.38;

    const geo = new THREE.OctahedronGeometry(0.17, 0);
    const mat = new THREE.MeshLambertMaterial({
      color:            0xFFD700,
      emissive:         0xFFAA00,
      emissiveIntensity: 0.45,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(wp.x, baseY, wp.z);
    this.scene.add(mesh);
    this.starMeshes.set(nodeId, mesh);

    // 자전
    gsap.to(mesh.rotation, {
      y:        Math.PI * 2,
      duration: 2.2,
      repeat:   -1,
      ease:     'none',
    });
    // 둥실 떠오르기
    gsap.to(mesh.position, {
      y:        baseY + 0.15,
      duration: 1.0,
      yoyo:     true,
      repeat:   -1,
      ease:     'sine.inOut',
    });
  }

  /**
   * 별 메시를 지하로 숨긴다.
   * 튜토리얼에서 블록을 underground로 내릴 때 별도 함께 숨기기 위해 사용.
   */
  hideStarMesh(nodeId: string): void {
    const mesh = this.starMeshes.get(nodeId);
    if (!mesh) return;
    gsap.killTweensOf(mesh.position);
    gsap.killTweensOf(mesh.rotation);
    mesh.visible = false;
  }

  /**
   * 별 메시를 블록의 현재 월드 위치로 재배치하고 애니메이션을 재시작한다.
   * 튜토리얼에서 블록이 지하에서 올라온 뒤 호출.
   */
  repositionStar(nodeId: string, node: PathNode): void {
    const mesh = this.starMeshes.get(nodeId);
    if (!mesh) return;
    const wp = new THREE.Vector3();
    node.mesh.getWorldPosition(wp);
    const baseY = wp.y + node.halfHeight + 0.38;

    gsap.killTweensOf(mesh.position);
    gsap.killTweensOf(mesh.rotation);
    mesh.position.set(wp.x, baseY, wp.z);
    mesh.visible = true;

    gsap.to(mesh.position, {
      y: baseY + 0.15, duration: 1.0, yoyo: true, repeat: -1, ease: 'sine.inOut',
    });
    gsap.to(mesh.rotation, {
      y: Math.PI * 2, duration: 2.2, repeat: -1, ease: 'none',
    });
  }

  /**
   * 해당 노드에 별이 있으면 수집 처리.
   * 수집됐으면 true, 이미 수집했거나 별 없으면 false 반환.
   */
  tryCollect(nodeId: string): boolean {
    if (this.collectedIds.has(nodeId)) return false;
    const mesh = this.starMeshes.get(nodeId);
    if (!mesh) return false;

    this.collectedIds.add(nodeId);
    this.starMeshes.delete(nodeId);

    // 파티클 버스트
    this.particles.burst(mesh.position.clone(), 0xFFD700, 18, 1.5, 0.5);

    // 크기 0으로 축소 후 제거
    gsap.killTweensOf(mesh.position);
    gsap.killTweensOf(mesh.rotation);
    gsap.to(mesh.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.28,
      ease: 'back.in',
      onComplete: () => {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      },
    });

    return true;
  }

  getCollected(): number { return this.collectedIds.size; }
  getTotal():     number { return this.total; }
  /** 별이 없는 레벨(total=0)은 항상 true */
  allCollected(): boolean { return this.collectedIds.size >= this.total; }

  dispose(): void {
    for (const mesh of this.starMeshes.values()) {
      gsap.killTweensOf(mesh.position);
      gsap.killTweensOf(mesh.rotation);
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.starMeshes.clear();
    this.collectedIds.clear();
    this.total = 0;
  }
}
