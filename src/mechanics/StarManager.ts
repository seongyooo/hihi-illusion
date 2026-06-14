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
  private total = 0;

  constructor(_scene: THREE.Scene, particles: ParticleSystem) {
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
    // 블록 로컬 좌표 기준 — 부모화하면 블록(패트롤 포함)이 움직일 때 자동으로 따라감
    const localY = node.halfHeight + 0.38;

    const geo = new THREE.OctahedronGeometry(0.17, 0);
    const mat = new THREE.MeshLambertMaterial({
      color:            0xFFD700,
      emissive:         0xFFAA00,
      emissiveIntensity: 0.45,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, localY, 0);
    node.mesh.add(mesh);  // scene 직접 추가 대신 블록 메시의 자식으로 부모화
    this.starMeshes.set(nodeId, mesh);

    // 자전
    gsap.to(mesh.rotation, {
      y:        Math.PI * 2,
      duration: 2.2,
      repeat:   -1,
      ease:     'none',
    });
    // 둥실 떠오르기 (로컬 Y 기준)
    gsap.to(mesh.position, {
      y:        localY + 0.15,
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
    const localY = node.halfHeight + 0.38;

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
      y: localY + 0.15, duration: 1.0, yoyo: true, repeat: -1, ease: 'sine.inOut',
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
   * 중력 반전 후 모든 별 메시의 로컬 Y 오프셋을 뒤집는다.
   * 반전 시: 블록 아래쪽(로컬 -Y) 에 배치돼야 플레이어 관점에서 "위"처럼 보임.
   */
  repositionForFlip(isFlipped: boolean, getNode: (id: string) => PathNode | undefined): void {
    const sign = isFlipped ? -1 : 1;
    for (const [nodeId, mesh] of this.starMeshes) {
      const node = getNode(nodeId);
      if (!node) continue;
      const localY = sign * (node.halfHeight + 0.38);
      gsap.killTweensOf(mesh.position);
      mesh.position.y = localY;
      gsap.to(mesh.position, {
        y:        localY + sign * 0.15,
        duration: 1.0,
        yoyo:     true,
        repeat:   -1,
        ease:     'sine.inOut',
      });
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
    this.total = 0;
  }
}
