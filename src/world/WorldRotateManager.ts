import * as THREE from 'three';
import gsap from 'gsap';
import type { PathGraph } from './PathGraph';

export interface MapRotateDef {
  /** 밟으면 회전이 트리거되는 노드 ID */
  nodeId: string;
  /** 회전 축 */
  axis: 'x' | 'y';
  /** 회전 각도 (라디안) */
  angle: number;
  /** X축 회전 전용: 회전 중심 Y 좌표 (미지정 시 맵 Y 중심) */
  pivotY?: number;
}

const ROTATE_DURATION = 1.1;

export class WorldRotateManager {
  private defs:        MapRotateDef[]     = [];
  private cumAngles:   Map<string, number> = new Map(); // nodeId → 누적 회전값
  private isAnimating  = false;
  private _mapFlipped  = false;

  private flipPivot:   THREE.Object3D | null = null;
  private levelGroup:  THREE.Group    | null = null;
  private graph:       PathGraph      | null = null;

  private beforeRotate:     (() => void) | null = null;
  private onRotateUpdate:   (() => void) | null = null;
  private onRotateComplete: (() => void) | null = null;

  /**
   * @param defs        레벨 JSON의 mapRotateBlocks
   * @param graph       PathGraph (회전 완료 후 refresh)
   * @param levelGroup  Level.getGroup() — 블록들이 담긴 내부 그룹
   * @param flipPivot   Level.getFlipPivot() — 회전 피벗 오브젝트 (levelGroup의 부모)
   * @param bounds      레벨 경계박스 (피벗 자동 계산용)
   */
  setup(
    defs:       MapRotateDef[],
    graph:      PathGraph,
    levelGroup: THREE.Group,
    flipPivot:  THREE.Object3D,
    bounds:     THREE.Box3,
    callbacks: {
      beforeRotate?:    () => void;
      onRotateUpdate?:  () => void;
      onRotateComplete?: () => void;
    } = {},
  ): void {
    this.defs        = defs;
    this.graph       = graph;
    this.flipPivot   = flipPivot;
    this.levelGroup  = levelGroup;
    this.cumAngles   = new Map();
    this.isAnimating = false;

    this.beforeRotate     = callbacks.beforeRotate    ?? null;
    this.onRotateUpdate   = callbacks.onRotateUpdate  ?? null;
    this.onRotateComplete = callbacks.onRotateComplete ?? null;

    // 맵 XZ 중심 계산
    const cx = (bounds.min.x + bounds.max.x) / 2;
    const cz = (bounds.min.z + bounds.max.z) / 2;
    const cy = (bounds.min.y + bounds.max.y) / 2;

    // X축 회전용 pivotY: 정의된 값 우선, 없으면 맵 Y 중심
    const firstXDef = defs.find(d => d.axis === 'x');
    const pivotY = firstXDef?.pivotY ?? cy;

    // flipPivot을 회전 중심에, levelGroup을 반대 오프셋
    // Y축 회전: XZ 중심 기준 / X축 회전: XZ 중심 + pivotY 기준
    flipPivot.position.set(cx, pivotY, cz);
    levelGroup.position.set(-cx, -pivotY, -cz);
  }

  /** CharacterController.onArrival에서 호출 */
  onArrival(nodeId: string): void {
    if (this.isAnimating) return;
    const def = this.defs.find(d => d.nodeId === nodeId);
    if (!def) return;
    this.beforeRotate?.();
    this._rotate(def);
  }

  /** X축 누적 회전이 홀수 번 (180° 단위) 적용되어 블록 위아래가 전환된 상태인지 */
  isMapFlipped(): boolean {
    return this._mapFlipped;
  }

  /** 해당 nodeId가 mapRotateBlock인지 */
  has(nodeId: string): boolean {
    return this.defs.some(d => d.nodeId === nodeId);
  }

  /** 각 축 누적 회전값 (라디안) */
  getTotalAngle(nodeId: string): number {
    return this.cumAngles.get(nodeId) ?? 0;
  }

  private _rotate(def: MapRotateDef): void {
    if (!this.flipPivot) return;

    const prev  = this.cumAngles.get(def.nodeId) ?? 0;
    const next  = prev + def.angle;
    this.cumAngles.set(def.nodeId, next);

    this.isAnimating = true;
    const prop = def.axis === 'x' ? 'x' : 'y';

    gsap.to(this.flipPivot.rotation, {
      [prop]:   next,
      duration: ROTATE_DURATION,
      ease:     'power2.inOut',
      onUpdate: () => { this.onRotateUpdate?.(); },
      onComplete: () => {
        this.isAnimating = false;
        // X축 180° 회전마다 위아래 전환 → flipped 요소 접근 가능 여부 토글
        if (def.axis === 'x') {
          const turns = Math.round(Math.abs(def.angle) / Math.PI);
          if (turns % 2 === 1) this._mapFlipped = !this._mapFlipped;
        }
        this.graph?.refresh();
        this.onRotateComplete?.();
      },
    });
  }

  dispose(): void {
    if (this.flipPivot) {
      gsap.killTweensOf(this.flipPivot.rotation);
      this.flipPivot.rotation.set(0, 0, 0);
      this.flipPivot.position.set(0, 0, 0);
    }
    if (this.levelGroup) {
      this.levelGroup.position.set(0, 0, 0);
    }
    this.defs        = [];
    this.cumAngles   = new Map();
    this.isAnimating = false;
    this._mapFlipped = false;
    this.flipPivot   = null;
    this.levelGroup  = null;
    this.graph       = null;
    this.beforeRotate     = null;
    this.onRotateUpdate   = null;
    this.onRotateComplete = null;
  }
}
