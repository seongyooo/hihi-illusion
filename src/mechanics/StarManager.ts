import * as THREE from 'three';
import gsap from 'gsap';
import type { PathNode } from '../world/PathGraph';
import type { ParticleSystem } from '../fx/ParticleSystem';

export class StarManager {
  private particles: ParticleSystem;
  // nodeId → 3D 메시 (수집 전까지 유지)
  private starMeshes:    Map<string, THREE.Mesh> = new Map();
  // QA-10: scale-down 애니메이션 중인 메시 — dispose 시 강제 종료 대상
  private collectingMeshes: Set<THREE.Mesh> = new Set();
  private collectedIds: Set<string> = new Set();
  private flippedStarIds: Set<string> = new Set();
  private total = 0;

  constructor(_scene: THREE.Scene, particles: ParticleSystem) {
    this.particles = particles;
  }

  setup(
    stars: Array<{ nodeId: string; flipped?: boolean; face?: [number, number, number] }>,
    getNode: (id: string) => PathNode | undefined,
  ): void {
    this.total = stars.length;
    for (const star of stars) {
      const node = getNode(star.nodeId);
      if (!node) continue;
      if (star.flipped) this.flippedStarIds.add(star.nodeId);
      this._createStarMesh(star.nodeId, node, !!star.flipped, star.face);
    }
  }

  private _createStarMesh(
    nodeId: string,
    node: PathNode,
    flipped = false,
    face?: [number, number, number],
  ): void {
    const geo = new THREE.OctahedronGeometry(0.17, 0);
    const mat = new THREE.MeshLambertMaterial({
      color:            0xFFD700,
      emissive:         0xFFAA00,
      emissiveIntensity: 0.45,
    });
    const mesh = new THREE.Mesh(geo, mat);

    const HOVER = 0.38; // distance above face surface

    // Determine local offset direction and magnitude
    let lx = 0, ly = 0, lz = 0;
    if (face) {
      // Explicit face normal — normalize and scale by halfSize along that axis
      const [fx, fy, fz] = face;
      const len = Math.sqrt(fx*fx + fy*fy + fz*fz) || 1;
      const nx = fx/len, ny = fy/len, nz = fz/len;
      const hs = node.halfSize;
      const halfOnFace = Math.abs(nx)*hs.x + Math.abs(ny)*hs.y + Math.abs(nz)*hs.z;
      lx = nx * (halfOnFace + HOVER);
      ly = ny * (halfOnFace + HOVER);
      lz = nz * (halfOnFace + HOVER);
    } else if (flipped) {
      // Bottom face (gravity flip mechanic)
      ly = -(node.halfHeight + HOVER);
    } else {
      // Default: top face
      ly = node.halfHeight + HOVER;
    }

    mesh.position.set(lx, ly, lz);
    node.mesh.add(mesh);  // scene 직접 추가 대신 블록 메시의 자식으로 부모화
    this.starMeshes.set(nodeId, mesh);

    // 자전
    gsap.to(mesh.rotation, {
      y:        Math.PI * 2,
      duration: 2.2,
      repeat:   -1,
      ease:     'none',
    });

    // 둥실 떠오르기/내려가기 (face 방향 또는 기본 Y 방향)
    const mag = Math.hypot(lx, ly, lz) || 1;
    const floatDir = face
      ? { x: lx + (lx/mag)*0.15, y: ly + (ly/mag)*0.15, z: lz + (lz/mag)*0.15 }
      : { y: ly + (flipped ? -0.15 : 0.15) };
    gsap.to(mesh.position, {
      ...floatDir,
      duration: 1.0,
      yoyo:     true,
      repeat:   -1,
      ease:     'sine.inOut',
    });
  }

  /** 해당 노드의 별 메시를 반환 (없으면 undefined). SwitchManager 연동용. */
  getStarMesh(nodeId: string): THREE.Mesh | undefined {
    return this.starMeshes.get(nodeId);
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
    const flipped = this.flippedStarIds.has(nodeId);
    const localY = flipped ? -(node.halfHeight + 0.38) : (node.halfHeight + 0.38);

    // 부모가 바뀐 경우(튜토리얼 블록 소환 등) 다시 부모화
    if (mesh.parent !== node.mesh) {
      mesh.removeFromParent();
      node.mesh.add(mesh);
    }

    gsap.killTweensOf(mesh.position);
    gsap.killTweensOf(mesh.rotation);
    mesh.position.set(0, localY, 0);
    mesh.visible = true;

    gsap.to(mesh.position, {
      y: localY + (flipped ? -0.15 : 0.15), duration: 1.0, yoyo: true, repeat: -1, ease: 'sine.inOut',
    });
    gsap.to(mesh.rotation, {
      y: Math.PI * 2, duration: 2.2, repeat: -1, ease: 'none',
    });
  }

  /**
   * 해당 노드에 별이 있으면 수집 처리.
   * isEffectiveFlipped: 맵 회전으로 인한 flip 상태. 별의 flipped 여부와 일치해야만 수집 가능.
   */
  tryCollect(nodeId: string, isEffectiveFlipped: boolean): boolean {
    if (this.flippedStarIds.has(nodeId) && !isEffectiveFlipped) return false;
    if (this.collectedIds.has(nodeId)) return false;
    const mesh = this.starMeshes.get(nodeId);
    if (!mesh) return false;

    this.collectedIds.add(nodeId);
    this.starMeshes.delete(nodeId);

    // 파티클 버스트 — 별이 블록 자식이므로 월드 좌표로 변환
    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    this.particles.burst(wp, 0xFFD700, 18, 1.5, 0.5);

    // 크기 0으로 축소 후 제거 (QA-10: collectingMeshes로 추적)
    gsap.killTweensOf(mesh.position);
    gsap.killTweensOf(mesh.rotation);
    this.collectingMeshes.add(mesh);
    gsap.to(mesh.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.28,
      ease: 'back.in',
      onComplete: () => {
        this.collectingMeshes.delete(mesh);
        mesh.removeFromParent();
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

  /** 모든 미수집 별 메시의 가시성을 일괄 설정 */
  setAllVisible(visible: boolean): void {
    for (const mesh of this.starMeshes.values()) {
      mesh.visible = visible;
    }
  }

  /**
   * 미수집 별 메시를 모두 현재 노드 위치로 재배치한다.
   * QA-08: RotatingSection 스냅 완료 후 호출.
   */
  refreshPositions(getNode: (id: string) => PathNode | undefined): void {
    for (const nodeId of this.starMeshes.keys()) {
      const node = getNode(nodeId);
      if (!node) continue;
      this.repositionStar(nodeId, node);
    }
  }

  dispose(): void {
    for (const mesh of this.starMeshes.values()) {
      gsap.killTweensOf(mesh.position);
      gsap.killTweensOf(mesh.rotation);
      mesh.removeFromParent();  // 블록 자식이거나 씬 직속이거나 모두 처리
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.starMeshes.clear();

    // QA-10: scale-down 중인 메시도 강제 종료
    for (const mesh of this.collectingMeshes) {
      gsap.killTweensOf(mesh.scale);
      mesh.removeFromParent();
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.collectingMeshes.clear();

    this.collectedIds.clear();
    this.flippedStarIds.clear();
    this.total = 0;
  }
}
