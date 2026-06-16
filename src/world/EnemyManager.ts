import * as THREE from 'three';
import { Enemy } from '../character/Enemy';
import type { EnemyDef } from './Level';
import type { PathGraph, PathNode } from './PathGraph';

export class EnemyManager {
  private enemies: Enemy[] = [];
  private scene: THREE.Scene;
  private onPlayerKilled: (() => void) | null = null;

  private lastTickTime = 0;
  private readonly TICK_INTERVAL = 250; // ms

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  setup(defs: EnemyDef[], graph: PathGraph): void {
    for (const def of defs) {
      const startNode = graph.getNode(def.startNodeId);
      if (!startNode) {
        console.warn(`[EnemyManager] startNodeId "${def.startNodeId}" not found`);
        continue;
      }
      const enemy = new Enemy(def, startNode, graph, this.scene);
      if (def.behavior === 'patrol' && def.patrolPath) {
        enemy.setupPatrolNodes(def.patrolPath);
      }
      this.enemies.push(enemy);
    }
  }

  setOnPlayerKilled(cb: () => void): void {
    this.onPlayerKilled = cb;
  }

  update(playerNode: PathNode | null): void {
    if (this.enemies.length === 0) return;

    const now = performance.now();
    const doTick = now - this.lastTickTime >= this.TICK_INTERVAL;
    if (doTick) this.lastTickTime = now;

    for (const enemy of this.enemies) {
      enemy.update();
      if (doTick) {
        enemy.tick(playerNode);
        if (playerNode && enemy.getCurrentNode() === playerNode) {
          this.onPlayerKilled?.();
          return;
        }
      }
    }
  }

  pause():  void { for (const e of this.enemies) e.pause(); }
  resume(): void { for (const e of this.enemies) e.resume(); }

  dispose(): void {
    for (const enemy of this.enemies) enemy.dispose();
    this.enemies = [];
    this.onPlayerKilled = null;
  }
}
