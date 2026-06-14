import type * as THREE from 'three';
import gsap from 'gsap';
import { PathGraph } from './PathGraph';

export interface PatrolDef {
  nodeId:   string;
  axis:     'x' | '-x' | 'y' | '-y' | 'z' | '-z';
  distance: number;  // 편도 이동 거리 (units, 양수)
  duration: number;  // 편도 이동 시간 (초)
}

interface PatrolState {
  def:      PatrolDef;
  mesh:     THREE.Object3D;
  tween:    gsap.core.Tween | null;
  originX:  number;
  originY:  number;
  originZ:  number;
}

export class PatrolManager {
  private states:     PatrolState[] = [];
  private lastRefresh = 0;

  // scene 인수는 하위 호환성을 위해 유지
  constructor(_scene: THREE.Scene) {}

  setup(defs: PatrolDef[], graph: PathGraph): void {
    for (const def of defs) {
      const node = graph.getNode(def.nodeId);
      if (!node) continue;

      const mesh = node.mesh;
      const ox   = mesh.position.x;
      const oy   = mesh.position.y;
      const oz   = mesh.position.z;

      const state: PatrolState = {
        def, mesh, tween: null,
        originX: ox, originY: oy, originZ: oz,
      };
      this.states.push(state);
      this._startLoop(state, graph);
    }
  }

  /** 매 프레임 호출 — 이동 중일 때 PathGraph를 50ms 스로틀로 갱신 */
  update(graph: PathGraph): void {
    if (this.states.length === 0) return;
    let moving = false;
    for (const s of this.states) {
      if (s.tween?.isActive()) moving = true;
    }
    if (!moving) return;
    const now = performance.now();
    if (now - this.lastRefresh >= 50) {
      graph.refresh();
      this.lastRefresh = now;
    }
  }

  dispose(): void {
    for (const s of this.states) {
      s.tween?.kill();
      s.tween = null;
      // 블록을 원래 위치로 복원 (Level.dispose() 이전이면 무의미하지만 안전 처리)
      s.mesh.position.set(s.originX, s.originY, s.originZ);
    }
    this.states = [];
  }

  private _startLoop(state: PatrolState, graph: PathGraph): void {
    const { mesh, def, originX, originY, originZ } = state;
    const sign     = def.axis.startsWith('-') ? -1 : 1;
    const baseAxis = def.axis.replace('-', '') as 'x' | 'y' | 'z';
    const target = {
      x: originX + (baseAxis === 'x' ? sign * def.distance : 0),
      y: originY + (baseAxis === 'y' ? sign * def.distance : 0),
      z: originZ + (baseAxis === 'z' ? sign * def.distance : 0),
    };

    state.tween = gsap.to(mesh.position, {
      x: target.x,
      y: target.y,
      z: target.z,
      duration:    def.duration,
      ease:        'power3.inOut', // 끝지점 근처에서 뚜렷하게 감속
      yoyo:        true,
      repeat:      -1,
      repeatDelay: 0.35,           // 각 끝지점에서 0.35초 정지
      onRepeat: () => { graph.refresh(); },
    });
  }

}
