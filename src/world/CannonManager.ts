import * as THREE from 'three';
import gsap from 'gsap';
import type { CannonDef } from './Level';
import type { PathNode } from './PathGraph';

const HIT_RADIUS = 0.32;

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

    const ballGeo = new THREE.BoxGeometry(0.18, 0.18, 0.18);
    const ballMat = new THREE.MeshLambertMaterial({ color: 0x222233 });
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
    // 날아가면서 살짝 회전
    gsap.to(ball.rotation, {
      x: Math.PI * 4 * (dirVec.z !== 0 ? 1 : 0),
      z: Math.PI * 4 * (dirVec.x !== 0 ? 1 : 0),
      duration,
      ease: 'none',
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

    // 메인 블록 (일반 블록과 동일한 비율 0.5h)
    const bodyMat = new THREE.MeshLambertMaterial({ color });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.82, 0.46, 0.82), bodyMat);
    body.position.y = 0.23;
    body.castShadow = true;
    group.add(body);

    // 발사 방향 표시: 앞면에 돌출된 작은 큐브 노치
    const notchMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(color).multiplyScalar(1.5) });
    const notch = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 0.22), notchMat);
    notch.position.set(dir.x * 0.44, 0.23, dir.z * 0.44);
    group.add(notch);

    // 윗면 발광 인디케이터 (방향 화살표 대신 작은 밝은 큐브)
    const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2.5) });
    const glow = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.14), glowMat);
    glow.position.set(dir.x * 0.2, 0.5, dir.z * 0.2);
    group.add(glow);

    return group;
  }
}
