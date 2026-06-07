import * as THREE from 'three';
import gsap from 'gsap';
import { Block } from './Block';

export interface SectionBlockInput {
  id: string;
  localPosition: [number, number, number];
  color: string;
  size: [number, number, number];
  walkable: boolean;
}

export interface SectionNodeEntry {
  id: string;
  mesh: THREE.Object3D;
  halfHeight: number;
}

const HALF_STEP = Math.PI / 2; // 90°

export class RotatingSection {
  public readonly id: string;
  public pivot: THREE.Group;
  private blockMeshes: Map<string, { mesh: THREE.Group; halfHeight: number }> = new Map();
  private walkableIds: Set<string> = new Set();
  private currentAngle = 0;
  public isAnimating = false;

  constructor(id: string, pivotPosition: [number, number, number], blockDatas: SectionBlockInput[]) {
    this.id = id;
    this.pivot = new THREE.Group();
    this.pivot.position.set(...pivotPosition);

    for (const bd of blockDatas) {
      const block = new Block({
        position: bd.localPosition,
        color: parseInt(bd.color.replace('#', ''), 16),
        size: bd.size,
      });
      block.mesh.userData.blockId = bd.id;
      block.mesh.userData.sectionId = id;
      block.mesh.traverse(child => {
        child.userData.blockId = bd.id;
        child.userData.sectionId = id;
      });
      this.pivot.add(block.mesh);
      this.blockMeshes.set(bd.id, { mesh: block.mesh, halfHeight: bd.size[1] / 2 });
      if (bd.walkable) this.walkableIds.add(bd.id);
    }
  }

  rotate(deltaRad: number): void {
    if (this.isAnimating) return;
    this.currentAngle = ((this.currentAngle + deltaRad) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    this.pivot.rotation.y = this.currentAngle;
  }

  snapToNearest(): Promise<void> {
    if (this.isAnimating) return Promise.resolve(); // Bug 5: guard duplicate calls
    const snapped = Math.round(this.currentAngle / HALF_STEP) * HALF_STEP;
    this.isAnimating = true;
    return new Promise(resolve => {
      gsap.to(this.pivot.rotation, {
        y: snapped,
        duration: 0.35,
        ease: 'back.out(1.4)',
        onComplete: () => {
          // Bug 6: normalize to [0, 2π) — handles negative modulo in JS
          this.currentAngle = ((snapped % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
          this.isAnimating = false;
          resolve();
        },
      });
    });
  }

  // All meshes — for drag/click raycasting
  getAllMeshes(): THREE.Object3D[] {
    return Array.from(this.blockMeshes.values()).map(v => v.mesh);
  }

  // Walkable node entries — for PathGraph
  getWalkableEntries(): SectionNodeEntry[] {
    return Array.from(this.blockMeshes.entries())
      .filter(([id]) => this.walkableIds.has(id))
      .map(([id, v]) => ({ id, mesh: v.mesh, halfHeight: v.halfHeight }));
  }
}
