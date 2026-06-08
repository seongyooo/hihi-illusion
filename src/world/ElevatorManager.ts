import * as THREE from 'three';
import gsap from 'gsap';

import { PathGraph } from './PathGraph';

export interface ElevatorDef {
  nodeId:   string;
  bottomY:  number;
  topY:     number;
  duration: number;           // 편도 이동 시간(초)
  mode:     'auto' | 'trigger';
}

interface ElevatorState {
  def:       ElevatorDef;
  mesh:      THREE.Object3D;
  rail:      THREE.LineSegments;
  tween:     gsap.core.Tween | null;
  atTop:     boolean;
  moving:    boolean;
}

export class ElevatorManager {
  private states: ElevatorState[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  setup(defs: ElevatorDef[], graph: PathGraph): void {
    for (const def of defs) {
      const node = graph.getNode(def.nodeId);
      if (!node) continue;

      // 수직 레일 라인 시각화
      const rail = this.buildRail(node.mesh, def);
      this.scene.add(rail);

      this.states.push({
        def,
        mesh: node.mesh,
        rail,
        tween: null,
        atTop: false,
        moving: false,
      });
    }

    // auto 모드: 즉시 왕복 시작
    for (const state of this.states) {
      if (state.def.mode === 'auto') this.startAutoLoop(state, graph);
    }
  }

  /** 매 프레임 graph.refresh() — auto 모드 전용 (animate loop에서 호출) */
  update(graph: PathGraph): void {
    let needRefresh = false;
    for (const state of this.states) {
      if (state.def.mode === 'auto' && state.moving) needRefresh = true;
    }
    if (needRefresh) graph.refresh();
  }

  /** CharacterController의 onArrival에서 호출 — trigger 모드 */
  onCharacterArrive(nodeId: string, graph: PathGraph): void {
    for (const state of this.states) {
      if (state.def.nodeId !== nodeId) continue;
      if (state.def.mode !== 'trigger') continue;
      if (state.moving) return;
      this.triggerMove(state, graph);
    }
  }

  private startAutoLoop(state: ElevatorState, graph: PathGraph): void {
    const { mesh, def } = state;
    state.moving = true;

    state.tween = gsap.to(mesh.position, {
      y: def.topY,
      duration: def.duration,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      onRepeat: () => { graph.refresh(); },
    });
  }

  private triggerMove(state: ElevatorState, graph: PathGraph): void {
    const { mesh, def } = state;
    const destY = state.atTop ? def.bottomY : def.topY;
    state.moving = true;

    state.tween = gsap.to(mesh.position, {
      y: destY,
      duration: def.duration,
      ease: 'power2.inOut',
      onUpdate: () => { graph.refresh(); },
      onComplete: () => {
        state.atTop  = !state.atTop;
        state.moving = false;
        state.tween  = null;
        graph.refresh();
      },
    });
  }

  private buildRail(elevatorMesh: THREE.Object3D, def: ElevatorDef): THREE.LineSegments {
    const wp = new THREE.Vector3();
    elevatorMesh.getWorldPosition(wp);
    const x = wp.x;
    const z = wp.z;

    const positions = new Float32Array([
      x - 0.3, def.bottomY, z,
      x - 0.3, def.topY,    z,
      x + 0.3, def.bottomY, z,
      x + 0.3, def.topY,    z,
    ]);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({ color: 0xAAAAAA, opacity: 0.5, transparent: true });
    return new THREE.LineSegments(geo, mat);
  }

  dispose(): void {
    for (const state of this.states) {
      if (state.tween) state.tween.kill();
      this.scene.remove(state.rail);
      state.rail.geometry.dispose();
      (state.rail.material as THREE.Material).dispose();
    }
    this.states = [];
  }
}
