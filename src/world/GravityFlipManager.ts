import * as THREE from 'three';
import gsap from 'gsap';
import type { PathGraph } from './PathGraph';

export interface GravityFlipDef {
  /** 밟으면 중력 반전이 트리거되는 노드 ID */
  triggerNodeId: string;
  /** Y축 반전 기준 좌표 (이 높이를 중심으로 상하가 뒤집힘) */
  pivotY: number;
}

const FLIP_DURATION = 1.1; // 애니메이션 시간 (초)

interface FlipState {
  def:         GravityFlipDef;
  isFlipped:   boolean;
  isAnimating: boolean;
  pivotZ:      number; // 자동 계산된 Z 중심 (맵 뒤집힐 때 Z도 반전됨)
}

export class GravityFlipManager {
  private states:         FlipState[]    = [];
  private graph:          PathGraph | null     = null;
  private flipPivot:      THREE.Object3D | null = null;
  private beforeFlip:     (() => void)   | null = null;
  private onFlipUpdate:   (() => void)   | null = null;
  private onFlipComplete: (() => void)   | null = null;

  /**
   * @param defs             레벨 JSON의 gravityFlips 배열
   * @param graph            PathGraph (플립 완료 후 refresh)
   * @param levelGroup       Level.getGroup() — 실제 블록이 들어있는 내부 그룹
   * @param flipPivot        Level.getFlipPivot() — 회전 피벗 오브젝트 (레벨그룹의 부모)
   * @param callbacks.beforeFlip     플립 직전 호출 (캐릭터 이동 중단 등)
   * @param callbacks.onFlipComplete 플립 완료 후 호출 (마커 재배치 등)
   */
  setup(
    defs: GravityFlipDef[],
    graph: PathGraph,
    levelGroup: THREE.Group,
    flipPivot: THREE.Object3D,
    callbacks: {
      beforeFlip?:     () => void;
      onFlipUpdate?:   () => void;
      onFlipComplete?: () => void;
    } = {},
  ): void {
    this.graph          = graph;
    this.flipPivot      = flipPivot;
    this.beforeFlip     = callbacks.beforeFlip    ?? null;
    this.onFlipUpdate   = callbacks.onFlipUpdate  ?? null;
    this.onFlipComplete = callbacks.onFlipComplete ?? null;

    for (const def of defs) {
      // 맵 전체 Z 범위 중심을 pivotZ로 계산
      const box    = new THREE.Box3().setFromObject(levelGroup);
      const pivotZ = (box.min.z + box.max.z) / 2;

      // flipPivot / levelGroup 계층 구조 초기화
      // flipPivot을 (0, pivotY, pivotZ)에 위치시키고
      // levelGroup을 내부에서 반대 방향으로 오프셋 → 회전 전 월드 위치 유지
      flipPivot.position.set(0, def.pivotY, pivotZ);
      levelGroup.position.set(0, -def.pivotY, -pivotZ);

      this.states.push({ def, isFlipped: false, isAnimating: false, pivotZ });
    }
  }

  /** CharacterController.onArrival에서 호출 */
  onArrival(nodeId: string): void {
    for (const state of this.states) {
      if (state.def.triggerNodeId === nodeId && !state.isAnimating) {
        this.beforeFlip?.();
        this._flip(state);
        return;
      }
    }
  }

  /** 현재 중력이 반전된 상태인지 반환 */
  isFlipped(): boolean {
    return this.states.some(s => s.isFlipped);
  }

  /** 플립 피벗 좌표 반환 (착시 연결 재계산용) */
  getPivotInfo(): { pivotY: number; pivotZ: number } | null {
    if (this.states.length === 0) return null;
    return { pivotY: this.states[0].def.pivotY, pivotZ: this.states[0].pivotZ };
  }

  private _flip(state: FlipState): void {
    if (!this.flipPivot) return;

    state.isAnimating = true;
    const going = !state.isFlipped;
    const targetX = going ? Math.PI : 0; // 복구 시 0으로 돌아옴

    gsap.to(this.flipPivot.rotation, {
      x:        targetX,
      duration: FLIP_DURATION,
      ease:     'power2.inOut',
      onUpdate: () => { this.onFlipUpdate?.(); },
      onComplete: () => {
        state.isFlipped   = going;
        state.isAnimating = false;
        // 플립 완료 후 PathGraph 재계산 (새 월드 좌표로 이웃 관계 갱신)
        this.graph?.refresh();
        this.onFlipComplete?.();
      },
    });
  }

  dispose(): void {
    if (this.flipPivot) {
      gsap.killTweensOf(this.flipPivot.rotation);
      // 레벨 언로드 시 회전 초기화 (다음 레벨 로드에 영향 없도록)
      this.flipPivot.rotation.x = 0;
    }
    this.states         = [];
    this.graph          = null;
    this.flipPivot      = null;
    this.beforeFlip     = null;
    this.onFlipUpdate   = null;
    this.onFlipComplete = null;
  }
}
