import * as THREE from 'three';
import gsap from 'gsap';
import type { PathGraph } from './PathGraph';

export interface GravityFlipDef {
  /** 플레이어가 밟으면 중력 반전이 트리거되는 노드 ID */
  triggerNodeId: string;
  /** 반전 완료 후 플레이어가 착지할 노드 ID (반전→원상복구 시에는 triggerNodeId가 착지) */
  landingNodeId: string;
  /** 함께 Y축 반전되는 블록 ID 목록 (walkable/non-walkable 모두 포함) */
  blockIds: string[];
  /** 반전 기준 Y 좌표 (pivotY 기준으로 블록 Y가 대칭 이동됨) */
  pivotY: number;
}

const FLIP_DURATION = 0.9;

interface MeshState {
  mesh:    THREE.Object3D;
  originY: number;
}

interface FlipState {
  def:         GravityFlipDef;
  meshes:      MeshState[];
  isFlipped:   boolean;
  isAnimating: boolean;
}

export class GravityFlipManager {
  private states:          FlipState[] = [];
  private graph:           PathGraph | null = null;
  private beforeFlip:      (() => void) | null = null;
  private onFlipComplete:  ((landingNodeId: string) => void) | null = null;

  /**
   * @param defs           레벨 JSON에서 로드한 GravityFlipDef 배열
   * @param graph          PathGraph (refresh 용)
   * @param getMesh        blockId → THREE.Object3D | null
   * @param callbacks.beforeFlip     플립 직전 호출 (캐릭터 이동 중단 등)
   * @param callbacks.onFlipComplete 플립 완료 후 착지 노드 ID와 함께 호출
   */
  setup(
    defs: GravityFlipDef[],
    graph: PathGraph,
    getMesh: (blockId: string) => THREE.Object3D | null,
    callbacks: {
      beforeFlip?:     () => void;
      onFlipComplete?: (landingNodeId: string) => void;
    } = {},
  ): void {
    this.graph          = graph;
    this.beforeFlip     = callbacks.beforeFlip    ?? null;
    this.onFlipComplete = callbacks.onFlipComplete ?? null;

    for (const def of defs) {
      const meshes: MeshState[] = [];
      for (const id of def.blockIds) {
        const mesh = getMesh(id);
        if (mesh) meshes.push({ mesh, originY: mesh.position.y });
      }
      this.states.push({ def, meshes, isFlipped: false, isAnimating: false });
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

  /** 현재 이 triggerNodeId에 대해 중력이 반전된 상태인지 반환 */
  isFlipped(triggerNodeId: string): boolean {
    return this.states.find(s => s.def.triggerNodeId === triggerNodeId)?.isFlipped ?? false;
  }

  private _flip(state: FlipState): void {
    state.isAnimating = true;
    const going   = !state.isFlipped;          // true = 정방향→반전, false = 반전→복구
    const pivotY  = state.def.pivotY;
    // 착지 노드: 정방향→반전은 landingNodeId, 반전→복구는 triggerNodeId
    const landingId = going ? state.def.landingNodeId : state.def.triggerNodeId;

    const tl = gsap.timeline({
      onComplete: () => {
        state.isFlipped   = going;
        state.isAnimating = false;
        // 블록 이동 완료 후 PathGraph 재계산 → 이웃 관계 갱신
        this.graph?.refresh();
        // 플레이어 착지 노드로 텔레포트
        this.onFlipComplete?.(landingId);
      },
    });

    for (const { mesh, originY } of state.meshes) {
      // 반전 시: newY = 2 * pivotY - originY  (pivotY 기준 대칭)
      // 복구 시: originY로 복원
      const targetY = going ? (2 * pivotY - originY) : originY;
      tl.to(mesh.position, {
        y:        targetY,
        duration: FLIP_DURATION,
        ease:     'power2.inOut',
      }, 0);
    }
  }

  dispose(): void {
    for (const state of this.states) {
      for (const { mesh } of state.meshes) {
        gsap.killTweensOf(mesh.position);
      }
    }
    this.states          = [];
    this.graph           = null;
    this.beforeFlip      = null;
    this.onFlipComplete  = null;
  }
}
