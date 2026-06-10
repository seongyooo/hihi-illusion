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
  playerOnTarget:     boolean;            // hold+spawn: 플레이어가 타깃 블록 위에 있음
  pendingDespawn:     boolean;            // hold+spawn: 다음 arrive까지 despawn 지연 중
  playerOnMoveTarget: boolean;            // move: 플레이어가 이동 중인 타깃 블록 위에 있음
}

// 스위치 색상
const COLOR_SPAWN = 0x44DDBB;
const COLOR_MOVE  = 0xFFAA44;

export interface CarryEntry {
  mesh:        THREE.Object3D;
  onStart?:    () => void;   // 이동 시작 시 호출 (예: float 애니 중단)
  onComplete?: () => void;   // 이동 완료 시 호출 (예: float 애니 재시작)
}

export class SwitchManager {
  private states: SwitchState[] = [];
  private scene: THREE.Scene;
  private particles: ParticleSystem;
  // targetNodeId → 함께 숨겨야 할 메시 목록 (별, 텔레포트 링, 목표 링 등) — spawn 전용
  private attachedMeshes: Map<string, THREE.Object3D[]> = new Map();
  // targetNodeId → 이동 시 함께 이동할 메시 목록 — move 전용
  private carryMeshes: Map<string, CarryEntry[]> = new Map();

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
        playerOnTarget: false,
        pendingDespawn: false,
        playerOnMoveTarget: false,
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

  /** move 타겟 블록에 연동된 메시를 등록. 이동 시 함께 움직이며 onStart/onComplete 콜백 지원. */
  attachCarryMeshes(targetNodeId: string, entries: CarryEntry[]): void {
    this.carryMeshes.set(targetNodeId, entries);
  }

  /** CharacterController의 onArrival / onDepart 에서 호출 */
  onCharacterArrive(nodeId: string, graph: PathGraph): void {
    for (const state of this.states) {
      // 스위치 노드 도착 → 활성화
      if (state.def.switchNodeId === nodeId) {
        if (!state.toggleLocked) this.activate(state, graph);
        continue;
      }

      if (state.def.mode === 'hold' && state.def.type === 'spawn') {
        if (state.def.targetNodeId === nodeId) {
          // 타깃 도착: pendingDespawn이든 active 상태든 플레이어가 올라선 것으로 처리
          state.pendingDespawn = false;
          state.playerOnTarget = true;
        } else if (state.pendingDespawn) {
          // 타깃이 아닌 다른 노드에 도달 → 이제 despawn 확정
          state.pendingDespawn = false;
          this.despawnTarget(state, graph);
        }
      }

      // move: 타깃 도착 추적
      if (state.def.type === 'move' && state.def.targetNodeId === nodeId) {
        state.playerOnMoveTarget = true;
      }
    }
  }

  onCharacterDepart(nodeId: string, graph: PathGraph): void {
    for (const state of this.states) {
      // 스위치 노드 이탈 → 비활성화 (hold 모드)
      if (state.def.switchNodeId === nodeId) {
        if (state.def.mode === 'toggle') continue;
        if (!state.active) continue;
        this.deactivate(state, graph);
        continue;
      }
      // hold+spawn: 타깃 노드 이탈 → 플레이어가 빠져나간 시점에 despawn
      if (state.def.targetNodeId === nodeId &&
          state.def.mode === 'hold' &&
          state.def.type === 'spawn' &&
          state.playerOnTarget) {
        state.playerOnTarget = false;
        if (!state.active) this.despawnTarget(state, graph);
      }
      // move: 타깃 이탈 추적
      if (state.def.type === 'move' && state.def.targetNodeId === nodeId) {
        state.playerOnMoveTarget = false;
      }
    }
  }

  /** move 타입 스위치가 이동 중이고 플레이어가 해당 블록 위에 있으면 true */
  isPlayerOnMovingBlock(): boolean {
    return this.states.some(s => s.def.type === 'move' && s.isMoving && s.playerOnMoveTarget);
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
      if (state.playerOnTarget) return;  // 타깃 위에 있으면 이탈 시까지 지연
      // 타깃으로 이동 중일 수 있으므로 다음 arrive까지 지연
      state.pendingDespawn = true;
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

    // carry meshes (별 등) — onStart로 자체 애니 중단
    const carries = this.carryMeshes.get(state.def.targetNodeId) ?? [];
    carries.forEach(c => {
      gsap.killTweensOf(c.mesh.position);
      c.onStart?.();
    });

    // 매 onUpdate마다 델타를 계산해 인접 메시에 적용
    const prevPos = mesh.position.clone();

    state.isMoving = true;
    gsap.to(mesh.position, {
      x: dest.x, y: dest.y, z: dest.z,
      duration: 0.6,
      ease: 'power2.inOut',
      onUpdate: () => {
        const dx = mesh.position.x - prevPos.x;
        const dy = mesh.position.y - prevPos.y;
        const dz = mesh.position.z - prevPos.z;
        prevPos.copy(mesh.position);

        // carry meshes에 동일 델타 적용
        carries.forEach(c => {
          c.mesh.position.x += dx;
          c.mesh.position.y += dy;
          c.mesh.position.z += dz;
        });

        // 타깃 블록 상단에 올려진 PathNode 메시들에 동일 델타 적용
        const wp = new THREE.Vector3();
        mesh.getWorldPosition(wp);
        const EPS = 0.35;
        for (const node of graph.getAllNodes()) {
          if (node.id === state.def.targetNodeId) continue;
          const np = node.position;
          if (Math.abs(np.x - wp.x) < EPS && Math.abs(np.z - wp.z) < EPS && np.y >= wp.y) {
            node.mesh.position.x += dx;
            node.mesh.position.y += dy;
            node.mesh.position.z += dz;
          }
        }

        graph.refresh();
      },
      onComplete: () => {
        state.isMoving = false;
        graph.refresh();
        // carry meshes onComplete: float 애니 재시작 등
        carries.forEach(c => c.onComplete?.());
      },
    });
  }

  dispose(): void {
    for (const state of this.states) {
      this.scene.remove(state.switchMesh);
      state.switchMesh.geometry.dispose();
      (state.switchMesh.material as THREE.Material).dispose();
      this.scene.remove(state.switchLight);

      // move 타입: position tween 취소 (언로드 후 graph.refresh() 호출 방지)
      if (state.def.type === 'move' && state.targetMesh) {
        gsap.killTweensOf(state.targetMesh.position);
      }

      // spawn 타입: 씬에 없을 수도 있는 targetMesh도 정리
      if (state.targetMesh) {
        gsap.killTweensOf(state.targetMesh.scale); // QA-SP2
        state.targetMesh.removeFromParent();
        state.targetMesh.traverse(child => {       // QA-SP1
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => (m as THREE.Material).dispose());
          }
        });
      }
    }
    this.states = [];
    this.attachedMeshes.clear();
  }
}
