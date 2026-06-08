import * as THREE from 'three';
import gsap from 'gsap';

import { PathGraph } from './PathGraph';
import { ParticleSystem } from '../fx/ParticleSystem';

export interface SwitchDef {
  switchNodeId: string;
  targetNodeId: string;
  mode: 'hold' | 'toggle';
  type: 'spawn' | 'move';
  moveTarget?: [number, number, number];
}

interface SwitchState {
  def:          SwitchDef;
  active:       boolean;                // 현재 활성 여부
  toggleLocked: boolean;                // toggle 모드: 이미 발동됨
  switchMesh:   THREE.Mesh;             // 스위치 비주얼
  switchLight:  THREE.PointLight;
  targetMesh:   THREE.Object3D | null;  // 타깃 블록 mesh
  origPosition: THREE.Vector3;          // type=move: 원래 위치
  isMoving:     boolean;                // type=move: tween 진행 중
}

// 스위치 색상
const COLOR_SPAWN = 0x44DDBB;
const COLOR_MOVE  = 0xFFAA44;

export class SwitchManager {
  private states: SwitchState[] = [];
  private scene: THREE.Scene;
  private particles: ParticleSystem;

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.scene     = scene;
    this.particles = particles;
  }

  setup(
    defs: SwitchDef[],
    graph: PathGraph,
    getMesh: (id: string) => THREE.Object3D | undefined,
  ): void {
    for (const def of defs) {
      const switchNode = graph.getNode(def.switchNodeId);
      if (!switchNode) continue;

      const color = def.type === 'spawn' ? COLOR_SPAWN : COLOR_MOVE;

      // 스위치 비주얼: 눌린 형태 (scaleY 0.6) 의 납작한 박스
      const geo  = new THREE.BoxGeometry(0.5, 0.1, 0.5);
      const mat  = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.2 });
      const mesh = new THREE.Mesh(geo, mat);
      const wp   = new THREE.Vector3();
      switchNode.mesh.getWorldPosition(wp);
      mesh.position.set(wp.x, wp.y + switchNode.halfHeight + 0.05, wp.z);
      this.scene.add(mesh);

      // 약한 포인트 라이트
      const light = new THREE.PointLight(color, 0.3, 2.5);
      light.position.copy(mesh.position).y += 0.5;
      this.scene.add(light);

      const targetMesh = getMesh(def.targetNodeId) ?? null;
      const origPosition = targetMesh
        ? targetMesh.position.clone()
        : new THREE.Vector3();

      // type='spawn': 초기 상태에서 타깃 블록 숨김
      if (def.type === 'spawn' && targetMesh) {
        this.scene.remove(targetMesh);
        graph.disableNode(def.targetNodeId);
      }

      this.states.push({
        def,
        active: false,
        toggleLocked: false,
        switchMesh: mesh,
        switchLight: light,
        targetMesh,
        origPosition,
        isMoving: false,
      });
    }
  }

  /** CharacterController의 onArrival / onDepart 에서 호출 */
  onCharacterArrive(nodeId: string, graph: PathGraph): void {
    for (const state of this.states) {
      if (state.def.switchNodeId !== nodeId) continue;
      if (state.toggleLocked) continue; // toggle: 이미 영구 활성
      this.activate(state, graph);
    }
  }

  onCharacterDepart(nodeId: string, graph: PathGraph): void {
    for (const state of this.states) {
      if (state.def.switchNodeId !== nodeId) continue;
      if (state.def.mode === 'toggle') continue; // toggle: 해제 없음
      if (!state.active) continue;
      this.deactivate(state, graph);
    }
  }

  private activate(state: SwitchState, graph: PathGraph): void {
    state.active = true;
    if (state.def.mode === 'toggle') state.toggleLocked = true;

    // 스위치 발광 강화
    (state.switchMesh.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.8;
    state.switchLight.intensity = 0.8;

    if (state.def.type === 'spawn') {
      this.spawnTarget(state, graph);
    } else {
      this.moveTarget(state, graph, true);
    }
  }

  private deactivate(state: SwitchState, graph: PathGraph): void {
    state.active = false;
    (state.switchMesh.material as THREE.MeshLambertMaterial).emissiveIntensity = 0.2;
    state.switchLight.intensity = 0.3;

    if (state.def.type === 'spawn') {
      this.despawnTarget(state, graph);
    } else {
      this.moveTarget(state, graph, false);
    }
  }

  private spawnTarget(state: SwitchState, graph: PathGraph): void {
    const mesh = state.targetMesh;
    if (!mesh) return;

    this.scene.add(mesh);
    graph.enableNode(state.def.targetNodeId);
    graph.refresh();

    // scale-in 연출
    mesh.scale.set(0, 0, 0);
    gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(2)' });

    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    this.particles.burst(wp, COLOR_SPAWN, 18, 1.2, 0.6);
  }

  private despawnTarget(state: SwitchState, graph: PathGraph): void {
    const mesh = state.targetMesh;
    if (!mesh) return;

    graph.disableNode(state.def.targetNodeId);
    graph.refresh();

    // scale-out 연출 후 제거
    gsap.to(mesh.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.3,
      ease: 'back.in',
      onComplete: () => { this.scene.remove(mesh); mesh.scale.set(1, 1, 1); },
    });
  }

  private moveTarget(state: SwitchState, graph: PathGraph, toActive: boolean): void {
    const mesh = state.targetMesh;
    if (!mesh || !state.def.moveTarget) return;

    // 이동 중 충돌 방지: 진행 중 tween 취소
    if (state.isMoving) gsap.killTweensOf(mesh.position);

    const dest = toActive
      ? new THREE.Vector3(...state.def.moveTarget)
      : state.origPosition.clone();

    state.isMoving = true;
    gsap.to(mesh.position, {
      x: dest.x, y: dest.y, z: dest.z,
      duration: 0.6,
      ease: 'power2.inOut',
      onComplete: () => {
        state.isMoving = false;
        graph.refresh();
      },
    });
  }

  dispose(): void {
    for (const state of this.states) {
      this.scene.remove(state.switchMesh);
      state.switchMesh.geometry.dispose();
      (state.switchMesh.material as THREE.Material).dispose();
      this.scene.remove(state.switchLight);

      // spawn 타입: 씬에 없을 수도 있는 targetMesh도 정리
      if (state.targetMesh) {
        this.scene.remove(state.targetMesh);
      }
    }
    this.states = [];
  }
}
