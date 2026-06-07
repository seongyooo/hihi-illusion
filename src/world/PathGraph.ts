import * as THREE from 'three';
import type { BlockData } from './Level';
import type { SectionNodeEntry } from './RotatingSection';

export interface PathNode {
  id: string;
  position: THREE.Vector3;
  neighbors: PathNode[];
  mesh: THREE.Object3D;
  halfHeight: number;
}

const XZ_THRESHOLD    = 1.1;
const SAME_FLOOR_Y    = 0.15; // 이 미만이면 같은 층으로 판정

export class PathGraph {
  private nodes: Map<string, PathNode> = new Map();
  private ladderEdges:    Array<[string, string]> = [];
  private illusionEdges:  Array<[string, string]> = [];
  private teleporterEdges: Array<[string, string]> = [];

  build(blocks: BlockData[], getMesh: (id: string) => THREE.Object3D | undefined): void {
    this.nodes.clear();
    for (const block of blocks) {
      if (!block.walkable) continue;
      const mesh = getMesh(block.id);
      if (!mesh) continue;
      const wp = new THREE.Vector3();
      mesh.getWorldPosition(wp);
      const halfH = block.size[1] / 2;
      this.nodes.set(block.id, {
        id: block.id,
        position: new THREE.Vector3(wp.x, wp.y + halfH, wp.z),
        neighbors: [],
        mesh,
        halfHeight: halfH,
      });
    }
    this.buildEdges();
  }

  addSectionNodes(entries: SectionNodeEntry[]): void {
    const wp = new THREE.Vector3();
    for (const { id, mesh, halfHeight } of entries) {
      mesh.getWorldPosition(wp);
      this.nodes.set(id, {
        id,
        position: new THREE.Vector3(wp.x, wp.y + halfHeight, wp.z),
        neighbors: [],
        mesh,
        halfHeight,
      });
    }
    this.buildEdges();
  }

  // Call after any section rotation to update dynamic positions
  refresh(): void {
    const wp = new THREE.Vector3();
    for (const node of this.nodes.values()) {
      node.mesh.getWorldPosition(wp);
      node.position.set(wp.x, wp.y + node.halfHeight, wp.z);
    }
    this.buildEdges();
  }

  setIllusionEdge(aId: string, bId: string, active: boolean): void {
    const idx = this.illusionEdges.findIndex(([a, b]) => a === aId && b === bId);
    if (active && idx === -1) {
      this.illusionEdges.push([aId, bId]);
      this.buildEdges();
    } else if (!active && idx !== -1) {
      this.illusionEdges.splice(idx, 1);
      this.buildEdges();
    }
  }

  /** 사다리 선언 목록을 설정하고 엣지를 재계산한다 */
  setLadders(pairs: Array<[string, string]>): void {
    this.ladderEdges = pairs;
    this.buildEdges();
  }

  /** 순간이동 패드 쌍을 설정하고 엣지를 재계산한다 */
  setTeleporters(pairs: Array<[string, string]>): void {
    this.teleporterEdges = pairs;
    this.buildEdges();
  }

  isTeleporterEdge(fromId: string, toId: string): boolean {
    return this.teleporterEdges.some(
      ([a, b]) => (a === fromId && b === toId) || (b === fromId && a === toId),
    );
  }

  getTeleportDest(nodeId: string): string | null {
    for (const [a, b] of this.teleporterEdges) {
      if (a === nodeId) return b;
      if (b === nodeId) return a;
    }
    return null;
  }

  private buildEdges(): void {
    for (const node of this.nodes.values()) node.neighbors = [];
    const list = Array.from(this.nodes.values());

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        const xzDist = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
        const yDiff  = Math.abs(a.position.y - b.position.y);

        // 같은 층: XZ 인접이면 자유 이동
        if (xzDist <= XZ_THRESHOLD && yDiff < SAME_FLOOR_Y) {
          a.neighbors.push(b);
          b.neighbors.push(a);
        }
      }
    }

    // 사다리 엣지: 다른 층 이동 (명시적 선언 필요)
    for (const [aId, bId] of this.ladderEdges) {
      const a = this.nodes.get(aId);
      const b = this.nodes.get(bId);
      if (a && b) {
        a.neighbors.push(b);
        b.neighbors.push(a);
      }
    }

    // 착시 엣지 (카메라 방위각 트리거)
    for (const [aId, bId] of this.illusionEdges) {
      const a = this.nodes.get(aId);
      const b = this.nodes.get(bId);
      if (a && b) {
        a.neighbors.push(b);
        b.neighbors.push(a);
      }
    }

    // 순간이동 엣지는 경로탐색에 포함하지 않음.
    // 패드에 직접 도착해야만 발동 (onArrival 트리거).
  }

  getNode(id: string): PathNode | undefined {
    return this.nodes.get(id);
  }

  getAllNodes(): PathNode[] {
    return Array.from(this.nodes.values());
  }

  findPath(start: PathNode, end: PathNode): PathNode[] {
    if (start === end) return [start];
    const visited = new Set<PathNode>([start]);
    const queue: PathNode[][] = [[start]];
    while (queue.length > 0) {
      const path = queue.shift()!;
      const node = path[path.length - 1];
      for (const neighbor of node.neighbors) {
        if (visited.has(neighbor)) continue;
        const next = [...path, neighbor];
        if (neighbor === end) return next;
        visited.add(neighbor);
        queue.push(next);
      }
    }
    return [];
  }
}
