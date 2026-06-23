import * as THREE from 'three';
import gsap from 'gsap';
import type { PathGraph } from './PathGraph';

export interface MapRotateDef {
  nodeId: string;
  axis: 'x' | 'z';
  angle: number;
  pivotY?: number;
}

const ROTATE_DURATION = 1.1;

export class WorldRotateManager {
  private defs:       MapRotateDef[]    = [];
  private blockStates: Map<string, number> = new Map(); // nodeId → 0 or 1 (toggle)
  private isAnimating  = false;
  private _mapFlipped  = false;

  private flipPivot:   THREE.Object3D | null = null;
  private levelGroup:  THREE.Group    | null = null;
  private graph:       PathGraph      | null = null;

  private beforeRotate:     (() => void) | null = null;
  private onRotateUpdate:   (() => void) | null = null;
  private onRotateComplete: ((up: THREE.Vector3) => void) | null = null;

  setup(
    defs:       MapRotateDef[],
    graph:      PathGraph,
    levelGroup: THREE.Group,
    flipPivot:  THREE.Object3D,
    bounds:     THREE.Box3,
    callbacks: {
      beforeRotate?:     () => void;
      onRotateUpdate?:   () => void;
      onRotateComplete?: (up: THREE.Vector3) => void;
    } = {},
  ): void {
    this.defs        = defs;
    this.graph       = graph;
    this.flipPivot   = flipPivot;
    this.levelGroup  = levelGroup;
    this.blockStates = new Map();
    this.isAnimating = false;

    this.beforeRotate     = callbacks.beforeRotate    ?? null;
    this.onRotateUpdate   = callbacks.onRotateUpdate  ?? null;
    this.onRotateComplete = callbacks.onRotateComplete ?? null;

    const cx = (bounds.min.x + bounds.max.x) / 2;
    const cz = (bounds.min.z + bounds.max.z) / 2;
    const cy = (bounds.min.y + bounds.max.y) / 2;

    const firstTiltDef = defs.find(d => d.axis === 'x' || d.axis === 'z');
    const pivotY = firstTiltDef?.pivotY ?? cy;

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

  isMapFlipped(): boolean { return this._mapFlipped; }
  has(nodeId: string): boolean { return this.defs.some(d => d.nodeId === nodeId); }

  private _computeAxisTotal(axis: 'x' | 'z'): number {
    let total = 0;
    for (const d of this.defs) {
      if (d.axis !== axis) continue;
      total += (this.blockStates.get(d.nodeId) ?? 0) * d.angle;
    }
    return total;
  }

  private _updateMapFlipped(): void {
    const xTotal = this._computeAxisTotal('x');
    const zTotal = this._computeAxisTotal('z');
    const xFlips = Math.round(Math.abs(xTotal) / Math.PI) % 2;
    const zFlips = Math.round(Math.abs(zTotal) / Math.PI) % 2;
    this._mapFlipped = (xFlips + zFlips) % 2 === 1;
  }

  private _rotate(def: MapRotateDef): void {
    if (!this.flipPivot) return;

    // Toggle this block's state
    const cur = this.blockStates.get(def.nodeId) ?? 0;
    this.blockStates.set(def.nodeId, 1 - cur);

    // Target = sum of all active blocks on this axis
    const axisTarget = this._computeAxisTotal(def.axis);

    this.isAnimating = true;

    gsap.to(this.flipPivot.rotation, {
      [def.axis]: axisTarget,
      duration:   ROTATE_DURATION,
      ease:       'power2.inOut',
      onUpdate: () => { this.onRotateUpdate?.(); },
      onComplete: () => {
        this.isAnimating = false;
        this._updateMapFlipped();

        // Compute world-space "up" from current pivot rotation
        const q  = new THREE.Quaternion().setFromEuler(this.flipPivot!.rotation);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);

        this.graph?.refresh(up);
        this.onRotateComplete?.(up);
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
    this.blockStates = new Map();
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
