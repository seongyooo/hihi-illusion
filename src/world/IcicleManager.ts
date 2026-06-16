import * as THREE from 'three';
import gsap from 'gsap';
import type { IcicleDef } from './Level';
import type { PathNode } from './PathGraph';

const HIT_RADIUS     = 0.35;
const ICICLE_LENGTH  = 0.55;
const FALL_DISTANCE  = 6;
const FALL_DURATION  = 0.45;
const RESPAWN_DELAY  = 1.0;

interface IcicleState {
  def:    IcicleDef;
  group:  THREE.Group;
  hangY:  number;
  x:      number;
  z:      number;
  active: boolean;
  timer:  ReturnType<typeof setTimeout> | null;
}

export class IcicleManager {
  private icicles: IcicleState[] = [];
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

  setup(defs: IcicleDef[]): void {
    for (const def of defs) {
      const pos = this.getNodePos(def.nodeId);
      if (!pos) {
        console.warn(`[IcicleManager] node not found: ${def.nodeId}`);
        continue;
      }

      // 블록 아랫면 Y (표준 블록 높이 0.5)
      const hangY = pos.y - 0.5;
      const group = this._buildMesh(def.color ?? '#aaddff');
      group.position.set(pos.x, hangY, pos.z);
      this.parent.add(group);

      const state: IcicleState = {
        def, group,
        hangY, x: pos.x, z: pos.z,
        active: false,
        timer: null,
      };
      this.icicles.push(state);
      this._scheduleNext(state, def.startDelay ?? 0);
    }
  }

  /** 매 프레임 낙하 중 충돌 체크 */
  isPlayerHit(node: PathNode): boolean {
    const p = node.position;
    for (const s of this.icicles) {
      if (!s.active) continue;
      s.group.getWorldPosition(this._tmp);
      // 고드름 중간 지점 기준으로 체크
      this._tmp.y -= ICICLE_LENGTH * 0.4;
      const dx = this._tmp.x - p.x;
      const dy = this._tmp.y - p.y;
      const dz = this._tmp.z - p.z;
      if (dx*dx + dy*dy + dz*dz < HIT_RADIUS * HIT_RADIUS) return true;
    }
    return false;
  }

  dispose(): void {
    for (const s of this.icicles) {
      if (s.timer !== null) clearTimeout(s.timer);
      gsap.killTweensOf(s.group.position);
      s.group.removeFromParent();
      s.group.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
    this.icicles = [];
  }

  // ── private ──────────────────────────────────────────────────────────────

  private _scheduleNext(state: IcicleState, delay: number): void {
    const warningTime = state.def.warningTime ?? 0.5;

    state.timer = setTimeout(() => {
      state.timer = null;
      this._warn(state, warningTime, () => {
        // 낙하 시작
        state.active = true;
        state.group.visible = true;
        state.group.position.set(state.x, state.hangY, state.z);

        gsap.to(state.group.position, {
          y: state.hangY - FALL_DISTANCE,
          duration: FALL_DURATION,
          ease: 'power2.in',
          onComplete: () => {
            state.active = false;
            state.group.visible = false;
            // 잠시 후 재출현 → 다음 사이클
            state.timer = setTimeout(() => {
              state.timer = null;
              state.group.position.set(state.x, state.hangY, state.z);
              state.group.visible = true;
              this._scheduleNext(state, state.def.interval);
            }, RESPAWN_DELAY * 1000);
          },
        });
      });
    }, delay * 1000);
  }

  /** 낙하 전 좌우 흔들림 경고 */
  private _warn(state: IcicleState, duration: number, onDone: () => void): void {
    const amp   = 0.045;
    const steps = Math.max(2, Math.round(duration / 0.09));
    gsap.killTweensOf(state.group.position);
    gsap.to(state.group.position, {
      x: state.x + amp,
      duration: duration / steps,
      ease: 'none',
      repeat: steps - 1,
      yoyo: true,
      onComplete: () => {
        state.group.position.x = state.x;
        onDone();
      },
    });
  }

  /** 고드름 메시 생성 (뾰족한 아래쪽) */
  private _buildMesh(colorHex: string): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(colorHex);

    // 메인 고드름 — 위가 넓고 아래가 뾰족
    const mainMat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.88 });
    const mainGeo = new THREE.ConeGeometry(0.085, ICICLE_LENGTH, 6, 1);
    const main    = new THREE.Mesh(mainGeo, mainMat);
    // ConeGeometry 기본 tip=+Y → tip이 -Y 방향이 되도록 뒤집기
    main.rotation.x = Math.PI;
    main.position.y = -ICICLE_LENGTH / 2;
    group.add(main);

    // 작은 보조 고드름 (옆에 붙어있는 느낌)
    const subMat = new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.65 });
    const subGeo = new THREE.ConeGeometry(0.05, ICICLE_LENGTH * 0.62, 5, 1);
    const sub    = new THREE.Mesh(subGeo, subMat);
    sub.rotation.x = Math.PI;
    sub.position.set(0.1, -ICICLE_LENGTH * 0.31, 0.04);
    group.add(sub);

    // 윗면 납작한 캡 (블록 아랫면에 붙어있는 느낌)
    const capMat = new THREE.MeshLambertMaterial({ color: new THREE.Color(colorHex).multiplyScalar(0.7) });
    const capGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.05, 6);
    const cap    = new THREE.Mesh(capGeo, capMat);
    cap.position.y = -0.025;
    group.add(cap);

    return group;
  }
}
