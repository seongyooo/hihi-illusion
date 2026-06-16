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
const MIN_XZ_DIST     = 0.5;  // 이 미만이면 수직 적층으로 판정 → 사다리 없이 이동 불가
const SAME_FLOOR_Y    = 0.15; // 이 미만이면 같은 층으로 판정

export class PathGraph {
  private nodes: Map<string, PathNode> = new Map();
  private disabledNodes: Set<string> = new Set();
  private ladderEdges:    Array<[string, string]> = [];
  private illusionEdges:  Array<[string, string]> = [];
  private illusionEdgeCounts: Map<string, number> = new Map();
  private teleporterEdges: Array<[string, string]> = [];
  // hold+spawn 스위치 게이트: targetNodeId → switchNodeId (해당 방향 엣지만 허용)
  private switchGatedNodes: Map<string, string> = new Map();
  // 조건부 사다리: switchNodeId → 엣지 쌍 목록 (활성화된 것만 저장)
  private conditionalLadderGroups: Map<string, Array<[string, string]>> = new Map();

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
    const key  = `${aId}|${bId}`;
    const prev = this.illusionEdgeCounts.get(key) ?? 0;
    const next = active ? prev + 1 : Math.max(0, prev - 1);
    this.illusionEdgeCounts.set(key, next);

    const inList = this.illusionEdges.some(([a, b]) => a === aId && b === bId);
    if (next > 0 && !inList) {
      this.illusionEdges.push([aId, bId]);
      this.buildEdges();
    } else if (next === 0 && inList) {
      const idx = this.illusionEdges.findIndex(([a, b]) => a === aId && b === bId);
      this.illusionEdges.splice(idx, 1);
      this.buildEdges();
    }
  }

  /** 사다리 선언 목록을 설정하고 엣지를 재계산한다 */
  setLadders(pairs: Array<[string, string]>): void {
    this.ladderEdges = pairs;
    this.buildEdges();
  }

  /** 스위치 활성화 시 등록되는 조건부 사다리 그룹 */
  enableLadderGroup(groupId: string, pairs: Array<[string, string]>): void {
    this.conditionalLadderGroups.set(groupId, pairs);
    this.buildEdges();
  }

  /** 스위치 비활성화 시 조건부 사다리 그룹 제거 */
  disableLadderGroup(groupId: string): void {
    if (!this.conditionalLadderGroups.has(groupId)) return;
    this.conditionalLadderGroups.delete(groupId);
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
    const list = Array.from(this.nodes.values()).filter(n => !this.disabledNodes.has(n.id));

    // 천장 막힘 계산: 같은 X/Z(MIN_XZ_DIST 미만)에 바로 위층 블록이 있으면 이동 불가.
    // b의 바닥면(b.position.y - 2*b.halfHeight)이 a의 윗면(a.position.y)에
    // 붙어 있을 때만 막힘 — 멀리 떨어진 위층 블록은 무시.
    const CEILING_GAP = 0.3; // 바닥면과 윗면 사이 허용 간격 (부동소수점 여유 포함)
    const ceilingBlocked = new Set<string>();
    for (const a of list) {
      for (const b of list) {
        if (a === b) continue;
        const xzDist = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
        if (xzDist >= MIN_XZ_DIST) continue;
        const bBottom = b.position.y - 2 * b.halfHeight; // b의 바닥면 Y
        const gap     = bBottom - a.position.y;           // b 바닥 - a 윗면
        if (gap >= -0.05 && gap < CEILING_GAP) {
          ceilingBlocked.add(a.id);
          break;
        }
      }
    }

    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        // 천장 막힘 노드는 수평 이동 불가
        if (ceilingBlocked.has(a.id) || ceilingBlocked.has(b.id)) continue;
        const xzDist = Math.hypot(a.position.x - b.position.x, a.position.z - b.position.z);
        const yDiff  = Math.abs(a.position.y - b.position.y);

        // 같은 층: XZ 인접이면 자유 이동 (수직 적층 블록은 제외)
        if (xzDist >= MIN_XZ_DIST && xzDist <= XZ_THRESHOLD && yDiff < SAME_FLOOR_Y) {
          // hold+spawn 게이트: 타겟 노드는 지정된 스위치 방향 엣지만 허용
          const aGate = this.switchGatedNodes.get(a.id);
          const bGate = this.switchGatedNodes.get(b.id);
          if (aGate !== undefined && aGate !== b.id) continue;
          if (bGate !== undefined && bGate !== a.id) continue;
          a.neighbors.push(b);
          b.neighbors.push(a);
        }
      }
    }

    // 사다리 엣지: 다른 층 이동 (명시적 선언 필요)
    for (const [aId, bId] of this.ladderEdges) {
      if (this.disabledNodes.has(aId) || this.disabledNodes.has(bId)) continue;
      if (ceilingBlocked.has(aId) || ceilingBlocked.has(bId)) continue;
      const aGate = this.switchGatedNodes.get(aId);
      const bGate = this.switchGatedNodes.get(bId);
      if (aGate !== undefined && aGate !== bId) continue;
      if (bGate !== undefined && bGate !== aId) continue;
      const a = this.nodes.get(aId);
      const b = this.nodes.get(bId);
      if (a && b) {
        a.neighbors.push(b);
        b.neighbors.push(a);
      }
    }

    // 조건부 사다리 엣지 (스위치 활성화 시에만 적용)
    for (const pairs of this.conditionalLadderGroups.values()) {
      for (const [aId, bId] of pairs) {
        if (this.disabledNodes.has(aId) || this.disabledNodes.has(bId)) continue;
        if (ceilingBlocked.has(aId) || ceilingBlocked.has(bId)) continue;
        const a = this.nodes.get(aId);
        const b = this.nodes.get(bId);
        if (a && b) {
          a.neighbors.push(b);
          b.neighbors.push(a);
        }
      }
    }

    // 착시 엣지 (카메라 방위각 트리거)
    for (const [aId, bId] of this.illusionEdges) {
      if (this.disabledNodes.has(aId) || this.disabledNodes.has(bId)) continue;
      if (ceilingBlocked.has(aId) || ceilingBlocked.has(bId)) continue;
      const aGate = this.switchGatedNodes.get(aId);
      const bGate = this.switchGatedNodes.get(bId);
      if (aGate !== undefined && aGate !== bId) continue;
      if (bGate !== undefined && bGate !== aId) continue;
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

  /** 튜토리얼 등 런타임에 동적으로 노드를 추가한다 */
  addWalkableNode(id: string, mesh: THREE.Object3D, halfHeight: number): void {
    const wp = new THREE.Vector3();
    mesh.getWorldPosition(wp);
    this.nodes.set(id, {
      id,
      position: new THREE.Vector3(wp.x, wp.y + halfHeight, wp.z),
      neighbors: [],
      mesh,
      halfHeight,
    });
    this.buildEdges();
  }

  /** 스위치/소환 게이트: 노드를 경로탐색에서 제외 (mesh는 유지) */
  disableNode(id: string): void {
    this.disabledNodes.add(id);
    this.buildEdges();
  }

  /** 스위치/소환 게이트: 노드를 경로탐색에 재포함 */
  enableNode(id: string): void {
    this.disabledNodes.delete(id);
    this.buildEdges();
  }

  isNodeDisabled(id: string): boolean {
    return this.disabledNodes.has(id);
  }

  /**
   * hold+spawn 전용: 타겟 노드를 스위치 노드 방향으로만 진입 가능하도록 제한.
   * enableNode() 호출 전에 설정해야 buildEdges()가 올바르게 반영된다.
   */
  setSwitchGate(targetNodeId: string, switchNodeId: string): void {
    this.switchGatedNodes.set(targetNodeId, switchNodeId);
  }

  /** 게이트 해제. disableNode() 전에 호출하면 rebuild가 한 번으로 줄어든다. */
  clearSwitchGate(targetNodeId: string): void {
    this.switchGatedNodes.delete(targetNodeId);
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
