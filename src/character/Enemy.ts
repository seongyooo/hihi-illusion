import * as THREE from 'three';
import gsap from 'gsap';
import type { PathGraph, PathNode } from '../world/PathGraph';
import type { EnemyDef } from '../world/Level';

export class Enemy {
  public readonly id: string;
  public mesh: THREE.Group;

  private currentNode: PathNode;
  private def: EnemyDef;
  private graph: PathGraph;

  private isMoving = false;
  private waitTimer: ReturnType<typeof setTimeout> | null = null;

  // patrol 전용
  private patrolNodes: PathNode[] = [];
  private patrolIndex = 0;

  private _paused = false;

  private readonly _wp = new THREE.Vector3();

  constructor(def: EnemyDef, startNode: PathNode, graph: PathGraph, scene: THREE.Scene) {
    this.id          = def.id;
    this.def         = def;
    this.currentNode = startNode;
    this.graph       = graph;
    this.mesh        = this._buildMesh(def.color ?? '#CC2020');

    startNode.mesh.getWorldPosition(this._wp);
    this.mesh.position.set(this._wp.x, this._wp.y + startNode.halfHeight, this._wp.z);
    scene.add(this.mesh);
  }

  setupPatrolNodes(nodeIds: string[]): void {
    this.patrolNodes = [];
    for (const id of nodeIds) {
      const node = this.graph.getNode(id);
      if (node) this.patrolNodes.push(node);
    }
    const startIdx = this.patrolNodes.findIndex(n => n.id === this.currentNode.id);
    if (startIdx !== -1) this.patrolIndex = startIdx;
  }

  getCurrentNode(): PathNode { return this.currentNode; }

  pause():  void { this._paused = true; }
  resume(): void { this._paused = false; }

  /** 매 프레임: 정지 중일 때 블록 이동에 추종 */
  update(): void {
    if (this.isMoving) return;
    this.currentNode.mesh.getWorldPosition(this._wp);
    this.mesh.position.set(this._wp.x, this._wp.y + this.currentNode.halfHeight, this._wp.z);
  }

  /** EnemyManager 스로틀 틱에서 호출 */
  tick(playerNode: PathNode | null): void {
    if (this.isMoving || this._paused) return;
    if (this.def.behavior === 'patrol') this._tickPatrol();
    else if (this.def.behavior === 'chase') this._tickChase(playerNode);
  }

  dispose(): void {
    if (this.waitTimer !== null) { clearTimeout(this.waitTimer); this.waitTimer = null; }
    gsap.killTweensOf(this.mesh.position);
    gsap.killTweensOf(this.mesh.rotation);
    this.mesh.removeFromParent();
    this.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    });
  }

  private _tickPatrol(): void {
    if (this.patrolNodes.length < 2) return;
    const nextIndex = (this.patrolIndex + 1) % this.patrolNodes.length;
    const target = this.patrolNodes[nextIndex];
    // 연속된 patrol 노드가 이웃인지 확인 (disconnected면 스킵)
    if (!this.currentNode.neighbors.includes(target)) {
      // BFS로 경로 탐색
      const path = this.graph.findPath(this.currentNode, target);
      if (path.length < 2) { this.patrolIndex = nextIndex; return; }
      this._moveToNode(path[1], () => {});
      return;
    }
    this._moveToNode(target, () => { this.patrolIndex = nextIndex; });
  }

  private _tickChase(playerNode: PathNode | null): void {
    if (!playerNode) return;
    const range = this.def.chaseRange ?? 5;
    const path = this.graph.findPath(this.currentNode, playerNode);
    if (path.length === 0 || path.length - 1 > range) return;
    if (path.length < 2) return;
    this._moveToNode(path[1], () => {});
  }

  private _moveToNode(target: PathNode, onDone: () => void): void {
    if (this.isMoving) return;
    this.isMoving = true;

    const prev = this.currentNode;
    const dx = target.position.x - prev.position.x;
    const dz = target.position.z - prev.position.z;

    const targetY = target.position.y;

    const tl = gsap.timeline({
      onComplete: () => {
        this.currentNode = target;
        target.mesh.getWorldPosition(this._wp);
        this.mesh.position.set(this._wp.x, this._wp.y + target.halfHeight, this._wp.z);
        onDone();
        const interval = (this.def.moveInterval ?? 0.8) * 1000;
        this.waitTimer = setTimeout(() => {
          this.waitTimer = null;
          this.isMoving = false;
        }, interval);
      },
    });

    if (dx !== 0 || dz !== 0) {
      tl.to(this.mesh.rotation, { y: Math.atan2(dx, dz), duration: 0.08 }, 0);
    }
    tl.to(this.mesh.position, {
      x: target.position.x,
      y: targetY + 0.15,
      z: target.position.z,
      duration: 0.15,
      ease: 'power1.out',
    }, 0.08);
    tl.to(this.mesh.position, {
      y: targetY,
      duration: 0.1,
      ease: 'power1.in',
    });
  }

  private _buildMesh(colorStr: string): THREE.Group {
    const group = new THREE.Group();
    const color = new THREE.Color(colorStr);
    const mat   = () => new THREE.MeshLambertMaterial({ color });

    // 몸통
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.32, 0.28), mat());
    body.position.y = 0.16;
    body.castShadow  = true;
    group.add(body);

    // 머리
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.20, 0.22), mat());
    head.position.y = 0.42;
    head.castShadow  = true;
    group.add(head);

    // 발광 눈 (흰색)
    const eyeGeo = new THREE.BoxGeometry(0.06, 0.04, 0.02);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      emissive: new THREE.Color(0xFFFFFF),
      emissiveIntensity: 1.2,
    });
    for (const xSign of [-1, 1] as const) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat);
      eye.position.set(xSign * 0.06, 0.425, 0.115);
      group.add(eye);
    }

    return group;
  }
}
