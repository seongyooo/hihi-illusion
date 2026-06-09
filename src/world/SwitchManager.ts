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
  def:             SwitchDef;
  active:          boolean;                // 현재 활성 여부
  toggleLocked:    boolean;                // toggle 모드: 이미 발동됨
  switchMesh:      THREE.Mesh;             // 스위치 비주얼
  switchLight:     THREE.PointLight;
  targetMesh:      THREE.Object3D | null;  // 타깃 블록 mesh
  targetOrigParent: THREE.Object3D | null; // 타깃 블록의 원래 부모 (level.group 등)
  origPosition:    THREE.Vector3;          // type=move: 원래 위치
  isMoving:        boolean;                // type=move: tween 진행 중
}

// 스위치 색상
const COLOR_SPAWN = 0x44DDBB;
const COLOR_MOVE  = 0xFFAA44;

export class SwitchManager {
  private states: SwitchState[] = [];
  private scene: THREE.Scene;
  private particles: ParticleSystem;
  // targetNodeId → 함께 숨겨야 할 메시 목록 (별, 텔레포트 링, 목표 링 등)
  private attachedMeshes: Map<string, THREE.Object3D[]> = new Map();

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
      const targetOrigParent = targetMesh?.parent ?? null;
      const origPosition = targetMesh
        ? targetMesh.position.clone()
        : new THREE.Vector3();

      // type='spawn': 초기 상태에서 타깃 블록 숨김
      // scene.remove()는 직접 자식이 아니면 무효 → removeFromParent() 사용
      if (def.type === 'spawn' && targetMesh) {
        targetMesh.removeFromParent();
        graph.disableNode(def.targetNodeId);
      }

      this.states.push({
        def,
        active: false,
        toggleLocked: false,
        switchMesh: mesh,
        switchLight: light,
        targetMesh,
        targetOrigParent,
        origPosition,
        isMoving: false,
      });
    }
  }

  /**
   * 스폰 타겟 블록에 연동된 메시(별, 텔레포트 링, 목표 마커 등)를 등록.
   * setup() 이후에 호출해야 한다. 현재 비활성 상태이면 즉시 숨긴다.
   */
  attachMeshes(targetNodeId: string, meshes: THREE.Object3D[]): void {
    this.attachedMeshes.set(targetNodeId, meshes);
    // 현재 비활성 상태(스폰 전)면 즉시 숨김
    const state = this.states.find(
      s => s.def.targetNodeId === targetNodeId && s.def.type === 'spawn' && !s.active,
    );
    if (state) meshes.forEach(m => { m.visible = false; });
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

    // 원래 부모(level.group)로 복원, 없으면 scene에 직접 추가
    (state.targetOrigParent ?? this.scene).add(mesh);
    graph.enableNode(state.def.targetNodeId);
    graph.refresh();

    // scale-in 연출
    mesh.scale.set(0, 0, 0);
    gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(2)' });

    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    this.particles.burst(wp, COLOR_SPAWN, 18, 1.2, 0.6);

    // 연동된 메시(별, 링 등) 표시
    const attached = this.attachedMeshes.get(state.def.targetNodeId) ?? [];
    attached.forEach(m => { m.visible = true; });
  }

  private despawnTarget(state: SwitchState, graph: PathGraph): void {
    const mesh = state.targetMesh;
    if (!mesh) return;

    graph.disableNode(state.def.targetNodeId);
    graph.refresh();

    // 연동된 메시(별, 링 등) 즉시 숨김
    const attached = this.attachedMeshes.get(state.def.targetNodeId) ?? [];
    attached.forEach(m => { m.visible = false; });

    // BUG-04: spawn scale-in 애니메이션이 진행 중일 수 있으므로 먼저 취소
    gsap.killTweensOf(mesh.scale);

    // scale-out 연출 후 제거
    gsap.to(mesh.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.3,
      ease: 'back.in',
      onComplete: () => { mesh.removeFromParent(); mesh.scale.set(1, 1, 1); },
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
        state.targetMesh.removeFromParent();
      }
    }
    this.states = [];
    this.attachedMeshes.clear();
  }
}
