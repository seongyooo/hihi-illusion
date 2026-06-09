import * as THREE from 'three';
import { Block } from './Block';
import { RotatingSection } from './RotatingSection';
import type { SectionBlockInput } from './RotatingSection';

// ---------- 사다리 메시 생성 ----------
function buildLadderMesh(a: BlockData, b: BlockData): THREE.Group {
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
}

export interface RotatingSectionData {
  id: string;
  pivot: [number, number, number];
  blocks: SectionBlockInput[];
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
  elevators?: Array<{
    nodeId:   string;
    bottomY:  number;
    topY:     number;
    duration: number;
    mode:     'auto' | 'trigger';
  }>;
  stars?: Array<{ nodeId: string }>;
  character: { startNodeId: string };
  midpoint?: { blockId: string };
  goal: { blockId: string };
}

export class Level {
  public blocks: Map<string, Block> = new Map();
  public sections: RotatingSection[] = [];
  private group: THREE.Group = new THREE.Group();
  private walkableMeshes: THREE.Object3D[] = [];
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  load(data: LevelData, variantOverride?: string): void {
    this.blocks.clear();
    this.sections = [];
    this.walkableMeshes = [];
    this.scene.remove(this.group);
    this.group = new THREE.Group();

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
    }

    // 사다리 메시
    for (const ladder of data.ladders ?? []) {
      const bdA = data.blocks.find(b => b.id === ladder.nodeA);
      const bdB = data.blocks.find(b => b.id === ladder.nodeB);
      if (bdA && bdB) this.group.add(buildLadderMesh(bdA, bdB));
    }

    // Rotating sections
    for (const sd of data.rotatingSections ?? []) {
      const section = new RotatingSection(sd.id, sd.pivot, sd.blocks);
      this.group.add(section.pivot);
      this.sections.push(section);
    }

    this.scene.add(this.group);
  }

  getGroup(): THREE.Group               { return this.group; }
  getWalkableMeshes(): THREE.Object3D[] { return this.walkableMeshes; }

  /** Apply a global hex color to all blocks, or restore each block's original JSON color. */
  recolorAllBlocks(hexOverride: number | null): void {
    this.blocks.forEach(block => block.recolor(hexOverride));
  }

  /** Apply a global material variant to all blocks. */
  revariantAllBlocks(variant: import('./Block').BlockVariant): void {
    this.blocks.forEach(block => block.revariant(variant));
  }

  dispose(): void {
    this.group.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
        else (child.material as THREE.Material).dispose();
      }
    });
    this.scene.remove(this.group);
    this.blocks.clear();
    this.sections     = [];
    this.walkableMeshes = [];
  }
}
