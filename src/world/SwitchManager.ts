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
  active:          boolean;
  switchMesh:      THREE.Mesh;
  switchLight:     THREE.PointLight;
  switchOrigY:     number;                 // hold: 원래 Y (꺼짐 애니용)
  pulseRing:       THREE.Mesh | null;      // hold: 비활성 pulsing 링
  targetMesh:      THREE.Object3D | null;
  targetOrigParent: THREE.Object3D | null;
  origPosition:    THREE.Vector3;
  isMoving:        boolean;
  playerOnTarget:     boolean;
  pendingDespawn:     boolean;
  playerOnMoveTarget: boolean;
}

const COLOR_SPAWN = 0x44DDBB;
const COLOR_MOVE  = 0xFFAA44;

export interface CarryEntry {
  mesh:        THREE.Object3D;
  onStart?:    () => void;
  onComplete?: () => void;
}

export class SwitchManager {
  private states: SwitchState[] = [];
  private scene: THREE.Scene;
  private particles: ParticleSystem;
  private attachedMeshes: Map<string, THREE.Object3D[]> = new Map();
  private carryMeshes: Map<string, CarryEntry[]> = new Map();
  // spawn 블록 소멸 시 콜백 (플레이어 경로 차단용)
  private onDespawnCallback?: (nodeId: string) => void;
  // 조건부 사다리: switchNodeId → 엣지 쌍 목록
  private conditionalLadderGroups: Map<string, Array<[string, string]>> = new Map();
  // 조건부 사다리 메시: switchNodeId → 씬에 추가된 메시 목록 (ON시 visible, OFF시 hidden)
  private conditionalLadderMeshes: Map<string, THREE.Object3D[]> = new Map();

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
      const wp    = new THREE.Vector3();
      switchNode.mesh.getWorldPosition(wp);
      const origY = wp.y + switchNode.halfHeight + 0.05;

      let geo: THREE.BufferGeometry;
      let pulseRing: THREE.Mesh | null = null;

      if (def.mode === 'hold') {
        // 원형 버튼 — "발판, 계속 서 있어야 함"
        geo = new THREE.CylinderGeometry(0.25, 0.25, 0.1, 32);

        // 비활성 pulsing 링
        const ringGeo = new THREE.RingGeometry(0.32, 0.42, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.55,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        pulseRing = new THREE.Mesh(ringGeo, ringMat);
        pulseRing.rotation.x = -Math.PI / 2;
        pulseRing.position.set(wp.x, origY + 0.01, wp.z);
        this.scene.add(pulseRing);
        this.startPulse(pulseRing);
      } else {
        // 사각형 버튼 — "토글 스위치"
        geo = new THREE.BoxGeometry(0.5, 0.1, 0.5);
      }

      const mat  = new THREE.MeshLambertMaterial({ color, emissive: color, emissiveIntensity: 0.2 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(wp.x, origY, wp.z);
      this.scene.add(mesh);

      const light = new THREE.PointLight(color, 0.3, 2.5);
      light.position.set(wp.x, origY + 0.5, wp.z);
      this.scene.add(light);

      const targetMesh       = getMesh(def.targetNodeId) ?? null;
      const targetOrigParent = targetMesh?.parent ?? null;
      const origPosition     = targetMesh ? targetMesh.position.clone() : new THREE.Vector3();

      if (def.type === 'spawn' && targetMesh) {
        targetMesh.removeFromParent();
        graph.disableNode(def.targetNodeId);
      }

      this.states.push({
        def,
        active: false,
        switchMesh: mesh,
        switchLight: light,
        switchOrigY: origY,
        pulseRing,
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

  attachMeshes(targetNodeId: string, meshes: THREE.Object3D[]): void {
    this.attachedMeshes.set(targetNodeId, meshes);
    const state = this.states.find(
      s => s.def.targetNodeId === targetNodeId && s.def.type === 'spawn' && !s.active,
    );
    if (state) meshes.forEach(m => { m.visible = false; });
  }

  attachCarryMeshes(targetNodeId: string, entries: CarryEntry[]): void {
    this.carryMeshes.set(targetNodeId, entries);
  }

  /** spawn 블록 소멸 직전에 호출될 콜백을 등록한다 (nodeId를 인수로 전달). */
  setOnDespawn(cb: (nodeId: string) => void): void {
    this.onDespawnCallback = cb;
  }

  /** 특정 스위치와 연동된 조건부 사다리 엣지를 등록한다. 스위치 ON시 활성화, OFF시 비활성화. */
  registerConditionalLadders(switchNodeId: string, pairs: Array<[string, string]>): void {
    this.conditionalLadderGroups.set(switchNodeId, pairs);
  }

  /** 조건부 사다리 시각 메시를 등록한다. 기본값 hidden, 스위치 ON시 visible. */
  registerConditionalLadderMeshes(switchNodeId: string, meshes: THREE.Object3D[]): void {
    this.conditionalLadderMeshes.set(switchNodeId, meshes);
    meshes.forEach(m => { m.visible = false; });
  }

  onCharacterArrive(nodeId: string, graph: PathGraph): void {
    for (const state of this.states) {
      if (state.def.switchNodeId === nodeId) {
        if (state.def.mode === 'toggle') {
          // 토글: 도착할 때마다 on/off 반전
          if (state.active) this.deactivate(state, graph);
          else              this.activate(state, graph);
        } else {
          // hold: 올라서면 활성화
          if (!state.active) this.activate(state, graph);
        }
        continue;
      }

      if (state.def.mode === 'hold' && state.def.type === 'spawn') {
        if (state.def.targetNodeId === nodeId) {
          state.pendingDespawn = false;
          state.playerOnTarget = true;
          // 타겟 위에 안착 → 게이트 해제: 환상 경로로 다른 블록으로 출발 가능
          graph.clearSwitchGate(state.def.targetNodeId);
          graph.refresh();
        } else if (state.pendingDespawn) {
          state.pendingDespawn = false;
          this.despawnTarget(state, graph);
        }
      }

      if (state.def.type === 'move' && state.def.targetNodeId === nodeId) {
        state.playerOnMoveTarget = true;
      }
    }
  }

  onCharacterDepart(nodeId: string, graph: PathGraph): void {
    for (const state of this.states) {
      if (state.def.switchNodeId === nodeId) {
        if (state.def.mode === 'toggle') continue;   // 토글은 이탈로 비활성화 안 함
        if (!state.active) continue;
        this.deactivate(state, graph);
        continue;
      }
      if (state.def.targetNodeId === nodeId &&
          state.def.mode === 'hold' &&
          state.def.type === 'spawn' &&
          state.playerOnTarget) {
        state.playerOnTarget = false;
        if (!state.active) this.despawnTarget(state, graph);
      }
      if (state.def.type === 'move' && state.def.targetNodeId === nodeId) {
        state.playerOnMoveTarget = false;
      }
    }
  }

  isPlayerOnMovingBlock(): boolean {
    return this.states.some(s => s.def.type === 'move' && s.isMoving && s.playerOnMoveTarget);
  }

  private activate(state: SwitchState, graph: PathGraph): void {
    state.active        = true;
    state.pendingDespawn = false;   // 혹시 남아 있던 despawn 취소

    const mat = state.switchMesh.material as THREE.MeshLambertMaterial;

    if (state.def.mode === 'hold') {
      // 버튼 꺼짐 (sink)
      gsap.killTweensOf(state.switchMesh.position);
      gsap.to(state.switchMesh.position, {
        y: state.switchOrigY - 0.06,
        duration: 0.12,
        ease: 'power2.in',
      });
      // 링 숨김
      if (state.pulseRing) {
        gsap.killTweensOf(state.pulseRing.scale);
        gsap.killTweensOf(state.pulseRing.material);
        state.pulseRing.visible = false;
      }
      mat.emissiveIntensity = 0.9;
      state.switchLight.intensity = 1.0;
    } else {
      // 토글: 팝업 scale 펄스 후 밝은 고정 상태
      gsap.killTweensOf(state.switchMesh.scale);
      gsap.to(state.switchMesh.scale, {
        x: 1.25, y: 1.25, z: 1.25,
        duration: 0.1,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
        onComplete: () => { state.switchMesh.scale.set(1, 1, 1); },
      });
      mat.emissiveIntensity = 0.85;
      state.switchLight.intensity = 0.9;
    }

    if (state.def.type === 'spawn') {
      this.spawnTarget(state, graph);
    } else {
      this.moveTarget(state, graph, true);
    }

    const ladderPairs = this.conditionalLadderGroups.get(state.def.switchNodeId);
    if (ladderPairs) graph.enableLadderGroup(state.def.switchNodeId, ladderPairs);

    const ladderMeshes = this.conditionalLadderMeshes.get(state.def.switchNodeId) ?? [];
    ladderMeshes.forEach(m => { m.visible = true; });
  }

  private deactivate(state: SwitchState, graph: PathGraph): void {
    state.active = false;

    const mat = state.switchMesh.material as THREE.MeshLambertMaterial;
    mat.emissiveIntensity = 0.2;
    state.switchLight.intensity = 0.3;

    if (state.def.mode === 'hold') {
      // 버튼 팝업 (올라옴)
      gsap.killTweensOf(state.switchMesh.position);
      gsap.to(state.switchMesh.position, {
        y: state.switchOrigY,
        duration: 0.2,
        ease: 'back.out(2)',
      });
      // 링 재시작
      if (state.pulseRing) {
        state.pulseRing.visible = true;
        this.startPulse(state.pulseRing);
      }
    } else {
      // 토글: 꺼짐 scale 펄스 (작아졌다가 복귀)
      gsap.killTweensOf(state.switchMesh.scale);
      gsap.to(state.switchMesh.scale, {
        x: 0.8, y: 0.8, z: 0.8,
        duration: 0.1,
        ease: 'power2.in',
        yoyo: true,
        repeat: 1,
        onComplete: () => { state.switchMesh.scale.set(1, 1, 1); },
      });
    }

    if (state.def.type === 'spawn') {
      if (state.playerOnTarget) return;
      if (state.def.mode === 'toggle') {
        this.despawnTarget(state, graph);
      } else {
        state.pendingDespawn = true;
      }
    } else {
      this.moveTarget(state, graph, false);
    }

    const ladderPairs = this.conditionalLadderGroups.get(state.def.switchNodeId);
    if (ladderPairs) graph.disableLadderGroup(state.def.switchNodeId);

    const ladderMeshes = this.conditionalLadderMeshes.get(state.def.switchNodeId) ?? [];
    ladderMeshes.forEach(m => { m.visible = false; });
  }

  /** hold 버튼용 pulsing 링 애니메이션 시작 */
  private startPulse(ring: THREE.Mesh): void {
    ring.scale.set(1, 1, 1);
    (ring.material as THREE.MeshBasicMaterial).opacity = 0.55;
    gsap.to(ring.scale, {
      x: 1.45, y: 1.45, z: 1.45,
      duration: 0.9,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
    gsap.to(ring.material as THREE.MeshBasicMaterial, {
      opacity: 0.1,
      duration: 0.9,
      repeat: -1,
      yoyo: true,
      ease: 'sine.inOut',
    });
  }

  private spawnTarget(state: SwitchState, graph: PathGraph): void {
    const mesh = state.targetMesh;
    if (!mesh) return;

    (state.targetOrigParent ?? this.scene).add(mesh);
    if (state.def.mode === 'hold') {
      graph.setSwitchGate(state.def.targetNodeId, state.def.switchNodeId);
    }
    graph.enableNode(state.def.targetNodeId);
    graph.refresh();

    mesh.scale.set(0, 0, 0);
    gsap.to(mesh.scale, { x: 1, y: 1, z: 1, duration: 0.4, ease: 'back.out(2)' });

    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    this.particles.burst(wp, COLOR_SPAWN, 18, 1.2, 0.6);

    const attached = this.attachedMeshes.get(state.def.targetNodeId) ?? [];
    attached.forEach(m => { m.visible = true; });
  }

  private despawnTarget(state: SwitchState, graph: PathGraph): void {
    const mesh = state.targetMesh;
    if (!mesh) return;

    // 경로에 이 블록이 포함된 플레이어 즉시 정지
    this.onDespawnCallback?.(state.def.targetNodeId);

    graph.clearSwitchGate(state.def.targetNodeId);
    graph.disableNode(state.def.targetNodeId);
    graph.refresh();

    const attached = this.attachedMeshes.get(state.def.targetNodeId) ?? [];
    attached.forEach(m => { m.visible = false; });

    gsap.killTweensOf(mesh.scale);
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

    if (state.isMoving) gsap.killTweensOf(mesh.position);

    const dest = toActive
      ? new THREE.Vector3(...state.def.moveTarget)
      : state.origPosition.clone();

    const carries = this.carryMeshes.get(state.def.targetNodeId) ?? [];
    carries.forEach(c => {
      gsap.killTweensOf(c.mesh.position);
      c.onStart?.();
    });

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

        carries.forEach(c => {
          c.mesh.position.x += dx;
          c.mesh.position.y += dy;
          c.mesh.position.z += dz;
        });

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
        carries.forEach(c => c.onComplete?.());
      },
    });
  }

  dispose(): void {
    for (const state of this.states) {
      // 링 정리
      if (state.pulseRing) {
        gsap.killTweensOf(state.pulseRing.scale);
        gsap.killTweensOf(state.pulseRing.material);
        this.scene.remove(state.pulseRing);
        state.pulseRing.geometry.dispose();
        (state.pulseRing.material as THREE.Material).dispose();
      }

      this.scene.remove(state.switchMesh);
      gsap.killTweensOf(state.switchMesh.position);
      gsap.killTweensOf(state.switchMesh.scale);
      state.switchMesh.geometry.dispose();
      (state.switchMesh.material as THREE.Material).dispose();
      this.scene.remove(state.switchLight);

      if (state.def.type === 'move' && state.targetMesh) {
        gsap.killTweensOf(state.targetMesh.position);
      }

      if (state.targetMesh) {
        gsap.killTweensOf(state.targetMesh.scale);
        state.targetMesh.removeFromParent();
        state.targetMesh.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => (m as THREE.Material).dispose());
          }
        });
      }
    }
    for (const meshes of this.conditionalLadderMeshes.values()) {
      for (const m of meshes) {
        this.scene.remove(m);
        m.traverse(child => {
          if (child instanceof THREE.Mesh) {
            child.geometry.dispose();
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(mat => (mat as THREE.Material).dispose());
          }
        });
      }
    }

    this.states = [];
    this.attachedMeshes.clear();
    this.conditionalLadderGroups.clear();
    this.conditionalLadderMeshes.clear();
  }
}
