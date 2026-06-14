import * as THREE from 'three';
import gsap from 'gsap';
import { Block } from './Block';
import { RotatingSection } from './RotatingSection';
import type { SectionBlockInput } from './RotatingSection';

// ---------- 가시 메시 생성 ----------
export const SPIKE_H      = 0.22;
export const SPIKE_TRAVEL = SPIKE_H + 0.12; // 가시가 블록 안으로 숨는 거리

export function buildSpikesMesh(bd: BlockData): THREE.Group {
  const group = new THREE.Group();
  const mat   = new THREE.MeshLambertMaterial({ color: 0xCC2020 }); // always/blinking 모두 빨간색
  const [bx, by, bz] = bd.position;
  const [, bh] = bd.size;
  const topY   = by + bh / 2;
  const spikeR = 0.065;
  const off    = 0.28; // X자 패턴 오프셋
  // X자 형태: 중앙 1개 + 대각선 4개
  const positions: [number, number, number][] = [
    [bx,       topY + SPIKE_H / 2, bz],
    [bx - off, topY + SPIKE_H / 2, bz - off],
    [bx + off, topY + SPIKE_H / 2, bz - off],
    [bx - off, topY + SPIKE_H / 2, bz + off],
    [bx + off, topY + SPIKE_H / 2, bz + off],
  ];
  for (const [x, y, z] of positions) {
    const geo  = new THREE.ConeGeometry(spikeR, SPIKE_H, 5);
    const mesh = new THREE.Mesh(geo, mat.clone());
    mesh.position.set(x, y, z);
    group.add(mesh);
  }
  // blinking 가시는 초기에 숨겨진 위치에서 시작
  if (bd.spikeType === 'blinking') {
    group.visible = false;
    group.position.y = -SPIKE_TRAVEL;
  }
  return group;
}

// ---------- 사다리 메시 생성 ----------
export function buildLadderMesh(a: BlockData, b: BlockData): THREE.Group {
  const ay = a.position[1] + a.size[1] / 2;
  const by = b.position[1] + b.size[1] / 2;
  const bottomY = Math.min(ay, by);
  const topY    = Math.max(ay, by);
  const height  = topY - bottomY;
  const centerY = (bottomY + topY) / 2;

  // XZ 중간점 (인접 면 위치)
  const mx = (a.position[0] + b.position[0]) / 2;
  const mz = (a.position[2] + b.position[2]) / 2;

  // A→B XZ 방향의 수직 벡터 (레일 오프셋 방향)
  const dx  = b.position[0] - a.position[0];
  const dz  = b.position[2] - a.position[2];
  const len = Math.sqrt(dx * dx + dz * dz) || 1;
  const px  = -dz / len;
  const pz  =  dx / len;

  const group      = new THREE.Group();
  const mat        = new THREE.MeshLambertMaterial({ color: 0x7A5C2E });
  const railOffset = 0.22;

  // 세로 레일 2개
  const railGeo = new THREE.BoxGeometry(0.04, height, 0.04);
  for (const side of [-1, 1] as const) {
    const rail = new THREE.Mesh(railGeo, mat);
    rail.position.set(
      mx + px * railOffset * side,
      centerY,
      mz + pz * railOffset * side,
    );
    group.add(rail);
  }

  // 가로 발판 (rung)
  const rungCount = Math.max(2, Math.round(height / 0.18));
  const rungGeo   = new THREE.BoxGeometry(railOffset * 2, 0.04, 0.04);
  const rungAngle = Math.atan2(pz, px);
  for (let i = 1; i < rungCount; i++) {
    const rung = new THREE.Mesh(rungGeo, mat);
    rung.position.set(mx, bottomY + (height / rungCount) * i, mz);
    rung.rotation.y = rungAngle;
    group.add(rung);
  }

  return group;
}

export interface BlockData {
  id: string;
  position: [number, number, number];
  color: string;
  size: [number, number, number];
  walkable: boolean;
  variant?: string;
  isSpike?: boolean;
  spikeType?: 'always' | 'blinking';
}

export interface RotatingSectionData {
  id: string;
  pivot: [number, number, number];
  blocks: SectionBlockInput[];
}

export interface ZoneDef {
  id: string;
  gridX: number;   // 구역 좌상단 X (그리드 좌표)
  gridZ: number;   // 구역 좌상단 Z (그리드 좌표)
  width: number;   // X 방향 칸 수
  depth: number;   // Z 방향 칸 수
}

export interface LevelData {
  id: string;
  name: string;
  backgroundColor: string;
  blocks: BlockData[];
  rotatingSections?: RotatingSectionData[];
  ladders?: Array<{ nodeA: string; nodeB: string }>;
  illusionConnections?: Array<{
    nodeA:              string;
    nodeB:              string;
    activateAzimuth:    number;
    azimuthTolerance:   number;
    activateElevation:  number;
    elevationTolerance: number;
  }>;
  teleporters?: Array<{ nodeA: string; nodeB: string }>;
  switches?: Array<{
    switchNodeId: string;
    targetNodeId: string;
    mode: 'hold' | 'toggle';
    type: 'spawn' | 'move';
    moveTarget?: [number, number, number];
  }>;
  conditionalLadders?: Array<{
    switchNodeId: string;
    pairs: Array<{ nodeA: string; nodeB: string }>;
  }>;
  elevators?: Array<{
    nodeId:   string;
    bottomY:  number;
    topY:     number;
    duration: number;
    mode:     'auto' | 'trigger';
  }>;
  patrols?: Array<{
    nodeId:   string;
    axis:     'x' | '-x' | 'y' | '-y' | 'z' | '-z';
    distance: number;
    duration: number;
  }>;
  stars?: Array<{ nodeId: string; flipped?: boolean }>;
  gravityFlipBlocks?: Array<{ nodeId: string }>;
  mapRotateBlocks?: Array<{
    nodeId:  string;
    axis:    'x' | 'y';
    angle:   number;   // degrees (예: 180, 90)
    pivotY?: number;   // X축 회전 전용 피벗 Y (미지정 시 맵 중심)
  }>;
  zones?: ZoneDef[];
  character: { startNodeId: string };
  midpoint?: { blockId: string };
  goal: { blockId: string; flipped?: boolean };
  initialCamera?: {
    azimuth:  number;   // Y축 회전 각도 (degrees, 0 = +Z 방향)
    polar:    number;   // 수직 각도 (degrees, 0 = 정수리, 90 = 수평)
    distance: number;   // 타깃으로부터의 거리
    targetY:  number;   // 오비트 타깃 Y
  };
}

export class Level {
  public blocks: Map<string, Block> = new Map();
  public sections: RotatingSection[] = [];
  private group:     THREE.Group = new THREE.Group();
  private flipPivot: THREE.Group = new THREE.Group(); // mapRotateBlocks 회전 피벗
  private walkableMeshes: THREE.Object3D[] = [];
  private ladderMeshes: Map<string, THREE.Group[]> = new Map();
  private spikeNodeIds: Set<string> = new Set();
  private gravityFlipNodeIds: Set<string> = new Set();
  private mapRotateNodeIds: Set<string> = new Set();
  private portalGroups: THREE.Group[] = [];
  private blinkingNodeIds: Set<string> = new Set();
  private blinkingSpikeGroups: Map<string, THREE.Group> = new Map();
  private blinkIsActive  = false; // 현재 사이클에서 가시가 위험 상태인가
  private scene: THREE.Scene;

  // blinking 속도 설정 (dev에서 조절 가능)
  blinkOnDuration  = 1.5; // 가시 올라와 있는 시간(초)
  blinkOffDuration = 1.0; // 가시 내려가 있는 시간(초)

  // 애니메이션 길이 (고정값)
  private static readonly EMERGE_DURATION  = 0.25; // 올라오는 모션 시간
  private static readonly RETRACT_DURATION = 0.2;  // 내려가는 모션 시간

  // 가시가 활성화될 때 호출되는 콜백 (각 nodeId 전달)
  private onSpikeActivated: ((nodeId: string) => void) | null = null;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  load(data: LevelData, variantOverride?: string): void {
    this.blocks.clear();
    this.sections = [];
    this.walkableMeshes = [];
    this.ladderMeshes.clear();
    this.spikeNodeIds.clear();
    this.gravityFlipNodeIds.clear();
    this.mapRotateNodeIds.clear();
    this.portalGroups = [];
    this.blinkingNodeIds.clear();
    this.blinkingSpikeGroups.clear();
    this.blinkIsActive = false;
    this.group     = new THREE.Group();
    this.flipPivot = new THREE.Group();

    // Apply level background color
    this.scene.background = new THREE.Color(data.backgroundColor);

    // Static blocks
    for (const bd of data.blocks) {
      // per-block JSON variant takes priority; then variantOverride (from settings, non-tutorial only)
      const resolvedVariant = (bd.variant ?? variantOverride ?? 'default') as import('./Block').BlockVariant;
      const block = new Block({
        position: bd.position,
        color:    parseInt(bd.color.replace('#', ''), 16),
        size:     bd.size,
        variant:  resolvedVariant,
      });
      const blockTopY = bd.position[1] + bd.size[1] / 2;
      block.mesh.userData.blockId   = bd.id;
      block.mesh.userData.blockTopY = blockTopY;
      block.mesh.traverse(child => {
        child.userData.blockId   = bd.id;
        child.userData.blockTopY = blockTopY;
      });

      this.blocks.set(bd.id, block);
      this.group.add(block.mesh);
      if (bd.walkable) this.walkableMeshes.push(block.mesh);
      if (bd.isSpike) {
        this.spikeNodeIds.add(bd.id);
        const spikeGroup = buildSpikesMesh(bd);
        this.group.add(spikeGroup);
        if (bd.spikeType === 'blinking') {
          this.blinkingNodeIds.add(bd.id);
          this.blinkingSpikeGroups.set(bd.id, spikeGroup);
        }
      }
    }

    // 사다리 메시
    for (const ladder of data.ladders ?? []) {
      const bdA = data.blocks.find(b => b.id === ladder.nodeA);
      const bdB = data.blocks.find(b => b.id === ladder.nodeB);
      if (bdA && bdB) {
        const ladderGroup = buildLadderMesh(bdA, bdB);
        this.group.add(ladderGroup);
        // nodeA, nodeB 각각에 등록 (스위치 타겟이 어느 쪽이든 숨길 수 있도록)
        for (const nodeId of [ladder.nodeA, ladder.nodeB]) {
          const list = this.ladderMeshes.get(nodeId) ?? [];
          list.push(ladderGroup);
          this.ladderMeshes.set(nodeId, list);
        }
      }
    }

    // Rotating sections
    for (const sd of data.rotatingSections ?? []) {
      const section = new RotatingSection(sd.id, sd.pivot, sd.blocks);
      this.group.add(section.pivot);
      this.sections.push(section);
    }

    // 중력 반전 블록 — 블록은 그대로 표시하고 위·아래 사각형 링 펄스 이펙트 추가
    for (const gf of data.gravityFlipBlocks ?? []) {
      const bd = data.blocks.find(b => b.id === gf.nodeId);
      if (!bd) continue;
      this.gravityFlipNodeIds.add(gf.nodeId);
      const effectGroup = this._buildRingEffect(bd, 0x00DDBB);
      this.group.add(effectGroup);
      this.portalGroups.push(effectGroup);
    }

    // 맵 회전 블록 — 주황 링 이펙트
    for (const mr of data.mapRotateBlocks ?? []) {
      const bd = data.blocks.find(b => b.id === mr.nodeId);
      if (!bd) continue;
      this.mapRotateNodeIds.add(mr.nodeId);
      const effectGroup = this._buildRingEffect(bd, 0xFF8800);
      this.group.add(effectGroup);
      this.portalGroups.push(effectGroup);
    }

    // flipPivot → group 계층으로 씬에 추가
    // (WorldRotateManager.setup()이 위치 오프셋을 나중에 설정)
    this.flipPivot.add(this.group);
    this.scene.add(this.flipPivot);
  }

  getGroup(): THREE.Group               { return this.group; }
  getFlipPivot(): THREE.Group           { return this.flipPivot; }
  getWalkableMeshes(): THREE.Object3D[] { return this.walkableMeshes; }
  getLaddersForBlock(blockId: string): THREE.Group[] { return this.ladderMeshes.get(blockId) ?? []; }
  getGravityFlipNodeIds(): Set<string>  { return this.gravityFlipNodeIds; }
  getMapRotateNodeIds(): Set<string>    { return this.mapRotateNodeIds; }
  getSpikeNodeIds(): Set<string>        { return this.spikeNodeIds; }

  /** blinking 가시가 현재 위험한 상태(올라오는 중/올라와 있음/내려가는 중)인지 반환. always 타입이면 항상 true. */
  isBlinkingSpikeActive(nodeId: string): boolean {
    if (!this.blinkingNodeIds.has(nodeId)) return true;
    return this.blinkIsActive;
  }

  /** 가시가 활성화(올라오기 시작)될 때 호출될 콜백을 등록한다. */
  setSpikeActivationCallback(cb: (nodeId: string) => void): void {
    this.onSpikeActivated = cb;
  }

  /** blinking 속도 설정 (dev 패널에서 호출) */
  setBlinkSpeed(onDuration: number, offDuration: number): void {
    this.blinkOnDuration  = onDuration;
    this.blinkOffDuration = offDuration;
  }

  /** 매 프레임 호출 — blinking 가시 슬라이드 애니메이션 */
  update(): void {
    if (this.blinkingSpikeGroups.size === 0) return;

    const E = Level.EMERGE_DURATION;
    const R = Level.RETRACT_DURATION;
    const period = this.blinkOnDuration + this.blinkOffDuration;
    const phase  = (performance.now() / 1000) % period;

    // smoothstep (3t²-2t³) — 부드러운 가속/감속
    const smoothstep = (t: number) => t * t * (3 - 2 * t);

    let progress: number;  // 0 = 완전히 내려감, 1 = 완전히 올라옴
    let isActive: boolean; // 플레이어에게 위험한 상태

    if (phase < E) {
      // 올라오는 모션
      progress = smoothstep(phase / E);
      isActive = true;
    } else if (phase < this.blinkOnDuration - R) {
      // 완전히 올라온 상태
      progress = 1;
      isActive = true;
    } else if (phase < this.blinkOnDuration) {
      // 내려가는 모션
      progress = smoothstep(1 - (phase - (this.blinkOnDuration - R)) / R);
      isActive = true;
    } else {
      // 완전히 내려간 상태
      progress = 0;
      isActive = false;
    }

    const prevActive = this.blinkIsActive;
    this.blinkIsActive = isActive;

    this.blinkingSpikeGroups.forEach((group, nodeId) => {
      group.visible    = isActive;
      group.position.y = -SPIKE_TRAVEL * (1 - progress);
      // 활성화 전환 시 콜백 (내려감→올라옴 시작)
      if (isActive && !prevActive) {
        this.onSpikeActivated?.(nodeId);
      }
    });
  }

  /** Apply a global hex color to all blocks, or restore each block's original JSON color. */
  recolorAllBlocks(hexOverride: number | null): void {
    this.blocks.forEach(block => block.recolor(hexOverride));
  }

  /** Apply a global material variant to all blocks. */
  revariantAllBlocks(variant: import('./Block').BlockVariant): void {
    this.blocks.forEach(block => block.revariant(variant));
  }

  /** Rebuild geometry for all blocks (called when block radius changes). */
  regeometryAllBlocks(): void {
    this.blocks.forEach(block => block.rebuildGeometry());
  }

  /**
   * 블록 이펙트 — 위·아래로 사각형 링들이 Y축 방향으로 퍼져나가며 펄스
   * LineBasicMaterial은 WebGL 제한으로 굵기 설정 불가 → BoxGeometry 4개로 테두리 구성
   */
  private _buildRingEffect(bd: BlockData, color: number): THREE.Group {
    const [bx, by, bz] = bd.position;
    const [bw, bh, bdz] = bd.size;

    const group    = new THREE.Group();
    const COLOR    = color;
    const RINGS    = 5;
    const SPACING  = 0.13;
    const DURATION = 1.8;
    const STAGGER  = DURATION / RINGS;
    const THICK    = 0.06;   // 막대 XZ 굵기
    const BAR_H    = 0.015;  // 막대 Y 두께

    for (const side of [-1, 1] as const) {
      for (let i = 0; i < RINGS; i++) {
        const y = by + side * (bh / 2 + 0.008 + i * SPACING);

        const mat = new THREE.MeshBasicMaterial({
          color:       COLOR,
          transparent: true,
          opacity:     0,
          depthWrite:  false,
        });

        // 사각형 테두리 = 4개의 막대
        const ring = new THREE.Group();
        ring.position.set(bx, y, bz);

        const barDefs: [number, number, number, number, number, number][] = [
          [bw + THICK, BAR_H, THICK,  0,          0,  bdz / 2],  // 앞
          [bw + THICK, BAR_H, THICK,  0,          0, -bdz / 2],  // 뒤
          [THICK,      BAR_H, bdz,    bw / 2,     0,  0      ],  // 우
          [THICK,      BAR_H, bdz,   -bw / 2,     0,  0      ],  // 좌
        ];
        for (const [w, h, d, px, py, pz] of barDefs) {
          const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
          mesh.position.set(px, py, pz);
          ring.add(mesh);
        }

        group.add(ring);

        const delay = i * STAGGER;
        gsap.fromTo(ring.scale,
          { x: 1, z: 1 },
          { x: 0.8, z: 0.8, duration: DURATION, delay, repeat: -1, ease: 'power2.out' },
        );
        gsap.fromTo(mat,
          { opacity: 0.9 },
          { opacity: 0,     duration: DURATION, delay, repeat: -1, ease: 'power2.out' },
        );
      }
    }

    return group;
  }

  dispose(): void {
    // 포탈 링 GSAP 트윈 먼저 정리 (scale: Group, opacity: MeshBasicMaterial)
    for (const pg of this.portalGroups) {
      pg.traverse(child => {
        gsap.killTweensOf(child.scale);
        if (child instanceof THREE.Mesh) gsap.killTweensOf(child.material);
      });
    }

    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => (m as THREE.Material).dispose());
        else (child.material as THREE.Material).dispose();
      }
    });
    // flipPivot 회전 초기화 후 씬에서 제거 (WorldRotateManager.dispose도 호출하지만 보험)
    this.flipPivot.rotation.set(0, 0, 0);
    this.flipPivot.position.set(0, 0, 0);
    this.group.position.set(0, 0, 0);
    this.scene.remove(this.flipPivot);
    this.blocks.clear();
    this.sections         = [];
    this.walkableMeshes   = [];
    this.ladderMeshes.clear();
    this.spikeNodeIds.clear();
    this.gravityFlipNodeIds.clear();
    this.mapRotateNodeIds.clear();
    this.portalGroups     = [];
    this.blinkingNodeIds.clear();
    this.blinkingSpikeGroups.clear();
    this.onSpikeActivated = null;
  }
}
