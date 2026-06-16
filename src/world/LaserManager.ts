import * as THREE from 'three';
import gsap from 'gsap';
import type { LaserDef } from './Level';
import type { PathNode } from './PathGraph';

/** 플레이어 노드 중심이 빔 선분에 이 거리 이내면 사망 */
const HIT_RADIUS = 0.55;

interface LaserState {
  def:    LaserDef;
  active: boolean;
  posA:   THREE.Vector3;   // 발사체 A 위치 (매 프레임 갱신)
  posB:   THREE.Vector3;   // 발사체 B 위치
  group:  THREE.Group;     // 빔 + 캡 전체 그룹
  core:   THREE.Mesh;      // 얇은 코어 빔
  glow:   THREE.Mesh;      // 넓은 글로우 빔
  capA:   THREE.Mesh;
  capB:   THREE.Mesh;
}

export class LaserManager {
  private lasers: Map<string, LaserState> = new Map();
  private parent: THREE.Object3D;
  private getEmitterPos: (blockId: string) => THREE.Vector3 | null;

  private readonly _tmp = new THREE.Vector3();
  private readonly _dir = new THREE.Vector3();

  /**
   * @param parent       빔이 소속될 씬/그룹 (levelGroup 권장 — 맵 회전 시 함께 움직임)
   * @param getEmitterPos 블록 ID → 월드 좌표 (블록 윗면 Y) 반환 함수
   */
  constructor(
    parent: THREE.Object3D,
    getEmitterPos: (blockId: string) => THREE.Vector3 | null,
  ) {
    this.parent        = parent;
    this.getEmitterPos = getEmitterPos;
  }

  setup(defs: LaserDef[]): void {
    for (const def of defs) {
      const posA = this.getEmitterPos(def.emitterAId);
      const posB = this.getEmitterPos(def.emitterBId);
      if (!posA || !posB) {
        console.warn(`[LaserManager] emitter not found: ${def.emitterAId} / ${def.emitterBId}`);
        continue;
      }

      const color = new THREE.Color(def.color ?? '#FF2020');
      const group = new THREE.Group();
      this.parent.add(group);

      // 코어 빔 (얇은 실린더, 길이 1 → scale.y 로 조정)
      const coreGeo = new THREE.CylinderGeometry(0.028, 0.028, 1, 8, 1);
      const coreMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 });
      const core = new THREE.Mesh(coreGeo, coreMat);
      group.add(core);

      // 글로우 빔 (넓은 실린더)
      const glowGeo = new THREE.CylinderGeometry(0.09, 0.09, 1, 8, 1);
      const glowMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, depthWrite: false });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      group.add(glow);

      // 엔드 캡 (발광 구체)
      const capGeo = new THREE.SphereGeometry(0.1, 10, 8);
      const capMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9 });
      const capA = new THREE.Mesh(capGeo, capMat);
      const capB = new THREE.Mesh(capGeo, capMat.clone() as THREE.MeshBasicMaterial);
      group.add(capA);
      group.add(capB);

      const state: LaserState = {
        def,
        active: true,
        posA: posA.clone(),
        posB: posB.clone(),
        group, core, glow, capA, capB,
      };

      this._applyGeometry(state);
      this.lasers.set(def.id, state);

      // 글로우 펄스 애니메이션
      gsap.to(glowMat, { opacity: 0.06, duration: 0.55, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    }
  }

  /** 매 프레임: 이미터가 이동했으면 빔 위치 갱신 */
  update(): void {
    for (const state of this.lasers.values()) {
      if (!state.active) continue;
      const newA = this.getEmitterPos(state.def.emitterAId);
      const newB = this.getEmitterPos(state.def.emitterBId);
      if (!newA || !newB) continue;
      state.posA.copy(newA);
      state.posB.copy(newB);
      this._applyGeometry(state);
    }
  }

  /** 플레이어 노드가 활성 레이저에 닿는지 */
  isNodeInLaser(node: PathNode): boolean {
    for (const state of this.lasers.values()) {
      if (!state.active) continue;
      if (this._hitTest(node.position, state.posA, state.posB)) return true;
    }
    return false;
  }

  setActive(id: string, active: boolean): void {
    const s = this.lasers.get(id);
    if (!s) return;
    s.active       = active;
    s.group.visible = active;
  }

  toggleLaser(id: string): void {
    const s = this.lasers.get(id);
    if (!s) return;
    this.setActive(id, !s.active);
  }

  dispose(): void {
    for (const s of this.lasers.values()) {
      gsap.killTweensOf(s.glow.material);
      gsap.killTweensOf(s.core.material);
      s.group.removeFromParent();
      s.core.geometry.dispose();
      (s.core.material as THREE.Material).dispose();
      s.glow.geometry.dispose();
      (s.glow.material as THREE.Material).dispose();
      s.capA.geometry.dispose();
      (s.capA.material as THREE.Material).dispose();
      s.capB.geometry.dispose();
      (s.capB.material as THREE.Material).dispose();
    }
    this.lasers.clear();
  }

  // ── private ──────────────────────────────────────────────────────────────

  /** 빔 실린더 위치/방향/길이 적용 */
  private _applyGeometry(s: LaserState): void {
    const { posA, posB, core, glow, capA, capB } = s;

    this._tmp.addVectors(posA, posB).multiplyScalar(0.5);
    const length = posA.distanceTo(posB);

    this._dir.subVectors(posB, posA);
    const dirNorm = length > 0.001 ? this._dir.clone().normalize() : new THREE.Vector3(0, 1, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dirNorm);

    for (const mesh of [core, glow]) {
      mesh.position.copy(this._tmp);
      mesh.scale.set(1, length, 1);
      mesh.quaternion.copy(q);
    }

    capA.position.copy(posA);
    capB.position.copy(posB);
  }

  /** 점 p가 선분 [a,b]에서 HIT_RADIUS 이내인지 — 완전 로컬 연산 */
  private _hitTest(p: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3): boolean {
    // AB 벡터 (스칼라 성분)
    const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
    const apx = p.x - a.x, apy = p.y - a.y, apz = p.z - a.z;
    const len2 = abx*abx + aby*aby + abz*abz;
    if (len2 < 0.001) return false;

    // 선분 위 투영 비율 (0~1 클램프)
    const t = (apx*abx + apy*aby + apz*abz) / len2;
    if (t < 0 || t > 1) return false;

    // 선분 위 가장 가까운 점까지 거리²
    const dx = p.x - (a.x + t * abx);
    const dy = p.y - (a.y + t * aby);
    const dz = p.z - (a.z + t * abz);
    return dx*dx + dy*dy + dz*dz < HIT_RADIUS * HIT_RADIUS;
  }
}
