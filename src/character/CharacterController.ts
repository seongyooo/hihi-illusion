import * as THREE from 'three';
import gsap from 'gsap';
import type { PathNode } from '../world/PathGraph';
import type { Character } from './Character';

export interface CharacterControllerOptions {
  onArrival?: (nodeId: string) => void;
}

export class CharacterController {
  private character: Character;
  private findPath: (start: PathNode, end: PathNode) => PathNode[];
  private currentNode: PathNode;
  private isMoving = false;
  private pendingTarget: PathNode | null = null;
  private onArrival?: (nodeId: string) => void;
  private readonly _wp = new THREE.Vector3();

  constructor(
    character: Character,
    findPath: (start: PathNode, end: PathNode) => PathNode[],
    startNode: PathNode,
    options: CharacterControllerOptions = {}
  ) {
    this.character   = character;
    this.findPath    = findPath;
    this.currentNode = startNode;
    this.onArrival   = options.onArrival;
    const { x, y, z } = startNode.position;
    character.setPosition(x, y, z);
  }

  moveTo(target: PathNode): void {
    if (this.isMoving) {
      this.pendingTarget = target;
      return;
    }
    if (target === this.currentNode) return;
    this._startMove(target);
  }

  /** 즉시 노드로 이동 (순간이동 발동 시 외부에서 호출) */
  teleportTo(node: PathNode): void {
    node.mesh.getWorldPosition(this._wp);
    this.character.setPosition(this._wp.x, this._wp.y + node.halfHeight, this._wp.z);
    this.currentNode = node;
  }

  private _startMove(target: PathNode): void {
    const path = this.findPath(this.currentNode, target);
    if (path.length === 0) return;

    this.isMoving = true;
    const tl = gsap.timeline({
      onComplete: () => {
        this.currentNode = target;
        this.isMoving = false;
        this.onArrival?.(target.id);

        if (this.pendingTarget && this.pendingTarget !== this.currentNode) {
          const next = this.pendingTarget;
          this.pendingTarget = null;
          this._startMove(next);
        } else {
          this.pendingTarget = null;
        }
      },
    });

    for (let i = 1; i < path.length; i++) {
      const node = path[i];
      const prev = path[i - 1];
      const dx = node.position.x - prev.position.x;
      const dz = node.position.z - prev.position.z;
      if (dx !== 0 || dz !== 0) {
        tl.to(this.character.mesh.rotation, {
          y: Math.atan2(dx, dz),
          duration: 0.1,
        });
      }

      tl.to(this.character.mesh.position, {
        x: node.position.x,
        y: node.position.y + 0.08,
        z: node.position.z,
        duration: 0.15,
        ease: 'power1.out',
      }).to(this.character.mesh.position, {
        y: node.position.y,
        duration: 0.1,
        ease: 'power1.in',
      });
    }
  }

  // Call every frame — keeps character glued to its node's world position.
  update(): void {
    if (this.isMoving) return;
    this.currentNode.mesh.getWorldPosition(this._wp);
    this.character.setPosition(
      this._wp.x,
      this._wp.y + this.currentNode.halfHeight,
      this._wp.z,
    );
  }

  getCurrentNode(): PathNode {
    return this.currentNode;
  }
}
