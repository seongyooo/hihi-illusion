import * as THREE from 'three';
import gsap from 'gsap';
import type { CannonDef } from './Level';
import type { PathNode } from './PathGraph';

const HIT_RADIUS = 0.48;

interface CannonState {
  def:          CannonDef;
  group:        THREE.Group;
  origin:       THREE.Vector3;   // 발사 시작 위치 (월드)
  dirVec:       THREE.Vector3;
  interval:     ReturnType<typeof setInterval> | null;
  startTimeout: ReturnType<typeof setTimeout> | null;
}

interface Cannonball {
  mesh: THREE.Mesh;
}

export class CannonManager {
  private cannons: Map<string, CannonState> = new Map();
  private balls:   Cannonball[] = [];
  private parent:  THREE.Object3D;
  private getNodePos: (nodeId: string) => THREE.Vector3 | null;

  private readonly _tmp = new THREE.Vector3();

  constructor(
    parent: THREE.Object3D,
    getNodePos: (nodeId: string) => THREE.Vector3 | null,
  ) {
    this.parent     = parent;
    this.getNodePos = getNodePos;
  }

  setup(defs: CannonDef[]): void {
    for (const def of defs) {
      const pos = this.getNodePos(def.nodeId);
      if (!pos) {
        console.warn(`[CannonManager] node not found: ${def.nodeId}`);
        continue;
      }

      const dirVec = this._dirFromStr(def.direction);
      const color  = new THREE.Color(def.color ?? '#555566');
      const group  = this._buildCannonMesh(color, dirVec);

      // 대포 메시를 블록 윗면에 배치
      group.position.set(pos.x, pos.y, pos.z);
      this.parent.add(group);

      // 포탄 발사 기준 위치 (블록 윗면 Y에서 포신 높이만큼 위)
      const origin = new THREE.Vector3(pos.x, pos.y + 0.18, pos.z);

      const state: CannonState = { def, group, origin, dirVec, interval: null, startTimeout: null };
      this.cannons.set(def.id, state);

      const startFire = () => {
        state.startTimeout = null;
        this._fire(state);
        state.interval = setInterval(() => this._fire(state), def.interval * 1000);
      };

      const delay = (def.startDelay ?? 0) * 1000;
      if (delay > 0) {
        state.startTimeout = setTimeout(startFire, delay);
      } else {
        startFire();
      }
    }
  }

  /** 매 프레임: 이미 날아간 포탄 중 제거된 것 정리 */
  update(): void {
    this.balls = this.balls.filter(b => b.mesh.parent !== null);
  }

  /** 플레이어 노드가 날아오는 포탄에 닿는지 */
  isPlayerHit(node: PathNode): boolean {
    const p = node.position;
    for (const ball of this.balls) {
      if (!ball.mesh.parent) continue;
      ball.mesh.getWorldPosition(this._tmp);
      const dx = this._tmp.x - p.x;
      const dy = this._tmp.y - p.y;
      const dz = this._tmp.z - p.z;
      if (dx*dx + dy*dy + dz*dz < HIT_RADIUS * HIT_RADIUS) return true;
    }
    return false;
  }

  dispose(): void {
    for (const s of this.cannons.values()) {
      if (s.interval !== null)     clearInterval(s.interval);
      if (s.startTimeout !== null) clearTimeout(s.startTimeout);
      s.group.removeFromParent();
      s.group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
    for (const ball of this.balls) {
      gsap.killTweensOf(ball.mesh.position);
      ball.mesh.removeFromParent();
      ball.mesh.geometry.dispose();
      (ball.mesh.material as THREE.Material).dispose();
    }
    this.balls = [];
    this.cannons.clear();
  }

  // ── private ─────────────────────────────────────────────────────────────

  private _fire(state: CannonState): void {
    const { origin, dirVec, def } = state;
    const range    = def.range  ?? 10;
    const speed    = def.speed  ?? 4;
    const duration = range / speed;

    const ballGeo = new THREE.SphereGeometry(0.13, 8, 6);
    const ballMat = new THREE.MeshBasicMaterial({ color: 0x222233 });
    const ball    = new THREE.Mesh(ballGeo, ballMat);
    ball.position.copy(origin);
    this.parent.add(ball);

    const target = origin.clone().addScaledVector(dirVec, range);

    const ballObj: Cannonball = { mesh: ball };
    this.balls.push(ballObj);

    gsap.to(ball.position, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration,
      ease: 'none',
      onComplete: () => {
        ball.removeFromParent();
        ball.geometry.dispose();
        (ball.material as THREE.Material).dispose();
      },
    });
  }

  private _dirFromStr(dir: 'x+' | 'x-' | 'z+' | 'z-'): THREE.Vector3 {
    switch (dir) {
      case 'x+': return new THREE.Vector3(1,  0, 0);
      case 'x-': return new THREE.Vector3(-1, 0, 0);
      case 'z+': return new THREE.Vector3(0,  0, 1);
      case 'z-': return new THREE.Vector3(0,  0, -1);
    }
  }

  private _buildCannonMesh(color: THREE.Color, dir: THREE.Vector3): THREE.Group {
    const group = new THREE.Group();
    const mat   = new THREE.MeshLambertMaterial({ color });

    // 받침대
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.14, 0.44), mat.clone() as THREE.MeshLambertMaterial);
    base.position.y = 0.07;
    group.add(base);

    // 몸통 (원기둥)
    const bodyGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.22, 8);
    const body    = new THREE.Mesh(bodyGeo, mat.clone() as THREE.MeshLambertMaterial);
    body.position.y = 0.25;
    group.add(body);

    // 포신 (방향으로 회전된 원기둥)
    const barrelGeo = new THREE.CylinderGeometry(0.07, 0.09, 0.48, 8);
    const barrel    = new THREE.Mesh(barrelGeo, mat.clone() as THREE.MeshLambertMaterial);
    // 기본 cylinder은 Y축. dir 방향으로 회전
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    barrel.quaternion.copy(q);
    // 포신 끝이 dir 방향으로 나오도록 위치 설정
    barrel.position.set(dir.x * 0.24, 0.22, dir.z * 0.24);
    group.add(barrel);

    return group;
  }
}
