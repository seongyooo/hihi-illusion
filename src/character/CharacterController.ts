import * as THREE from 'three';
import gsap from 'gsap';
import type { PathNode } from '../world/PathGraph';
import type { Character } from './Character';

export interface CharacterControllerOptions {
  onArrival?:   (nodeId: string) => void;
  onDepart?:    (nodeId: string) => void;
  shouldBlock?: () => boolean;
}

export class CharacterController {
  private character: Character;
  private findPath: (start: PathNode, end: PathNode) => PathNode[];
  private currentNode: PathNode;
  private isMoving = false;
  private pendingTarget: PathNode | null = null;
  private _currentTarget: PathNode | null = null;
  private onArrival?:   (nodeId: string) => void;
  private onDepart?:    (nodeId: string) => void;
  private shouldBlock?: () => boolean;
  private readonly _wp = new THREE.Vector3();

  // 남은 경로 (한 스텝씩 소비)
  private _movePath: PathNode[] = [];

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
    this.onDepart    = options.onDepart;
    this.shouldBlock = options.shouldBlock;
    const { x, y, z } = startNode.position;
    character.setPosition(x, y, z);
  }

  moveTo(target: PathNode): void {
    if (target === this.currentNode) return;
    if (this.isMoving) {
      if (target === this._currentTarget) return; // 이미 이 목적지로 이동 중 — 무시
      // 다른 목적지: 현재 한 스텝(≤0.25s)만 마친 뒤 자연스럽게 리다이렉트
      // stop()으로 스냅하지 않고 pendingTarget만 교체
      this._currentTarget = target;
      this._movePath      = [];       // 남은 경로 비우기 (현재 진행 중인 스텝은 완료됨)
      this.pendingTarget  = target;
      return;
    }
    this._currentTarget = target;
    this._startMove(target);
  }

  /** 즉시 노드로 이동 (순간이동 발동 시 외부에서 호출) */
  teleportTo(node: PathNode): void {
    node.mesh.getWorldPosition(this._wp);
    this.character.setPosition(this._wp.x, this._wp.y + node.halfHeight, this._wp.z);
    this.currentNode = node;
  }

  /**
   * 남은 이동 경로 또는 대기 중인 목적지에 주어진 노드가 포함되어 있으면 즉시 멈춘다.
   * spawn 블록 소멸 시 플레이어 차단에 사용.
   */
  stopIfPathContains(nodeId: string): void {
    const inPath    = this._movePath.some(n => n.id === nodeId);
    const inPending = this.pendingTarget?.id === nodeId;
    if (inPath || inPending) this.stop();
  }

  /**
   * 현재 이동을 즉시 중단하고 마지막으로 밟은 노드에 정착한다.
   * 튜토리얼 장애물 연출처럼 외부에서 캐릭터를 멈춰야 할 때 사용.
   */
  stop(): void {
    this._movePath      = [];
    this.pendingTarget  = null;
    this._currentTarget = null;
    gsap.killTweensOf(this.character.mesh.position);
    gsap.killTweensOf(this.character.mesh.rotation);
    this.character.stopWalk();
    this.isMoving = false;
    // 현재 노드 위치로 스냅
    this.currentNode.mesh.getWorldPosition(this._wp);
    this.character.setPosition(
      this._wp.x,
      this._wp.y + this.currentNode.halfHeight,
      this._wp.z,
    );
  }

  /**
   * 현재 캐릭터를 새 캐릭터로 교체한다.
   * 설정 화면에서 타입 변경 시 사용.
   */
  replaceCharacter(char: import('./Character').Character): void {
    gsap.killTweensOf(this.character.mesh.position);
    gsap.killTweensOf(this.character.mesh.rotation);
    this.character.stopWalk();
    this.character    = char;
    this.isMoving     = false;
    this.pendingTarget = null;
    this._movePath    = [];
    // 현재 노드 위치로 즉시 스냅
    this.currentNode.mesh.getWorldPosition(this._wp);
    char.setPosition(
      this._wp.x,
      this._wp.y + this.currentNode.halfHeight,
      this._wp.z,
    );
  }

  private _startMove(target: PathNode): void {
    const path = this.findPath(this.currentNode, target);
    if (path.length === 0) return;

    this.isMoving  = true;
    this.character.startWalk();
    this._movePath = path.slice(1); // start 제외, 방문할 노드 목록
    this._advance();
  }

  /**
   * 남은 경로에서 한 스텝 애니메이션.
   * 도착할 때마다 onArrival 발생 → 외부(튜토리얼 등)에서 stop() 호출 가능.
   */
  private _advance(): void {
    if (!this.isMoving) return; // stop()에 의해 중단됨

    // 이동 중인 블록 위에 있으면 경로를 즉시 취소
    if (this.shouldBlock?.()) {
      this.stop();
      return;
    }

    if (this._movePath.length === 0) {
      // 최종 목적지 도달
      this.isMoving       = false;
      this._currentTarget = null;
      this.character.stopWalk();
      this.onArrival?.(this.currentNode.id);
      if (this.pendingTarget && this.pendingTarget !== this.currentNode) {
        const next = this.pendingTarget;
        this.pendingTarget = null;
        this._startMove(next);
      } else {
        this.pendingTarget = null;
      }
      return;
    }

    const node = this._movePath.shift()!;
    const prev = this.currentNode;

    // 이동 블록(패트롤 등) 위치 변화로 인접성이 사라진 경우 이동 취소
    if (!prev.neighbors.includes(node)) {
      this.stop();
      return;
    }
    const dx   = node.position.x - prev.position.x;
    const dz   = node.position.z - prev.position.z;

    this.onDepart?.(prev.id);

    const tl = gsap.timeline({
      onComplete: () => {
        this.currentNode = node;
        // 이동 블록(패트롤 등): 0.25s 애니메이션 동안 블록이 이동했을 수 있으므로
        // 트위닝이 끝난 직후 실제 현재 위치로 스냅해 update()의 한 프레임 지연 없앰
        node.mesh.getWorldPosition(this._wp);
        this.character.setPosition(
          this._wp.x,
          this._wp.y + node.halfHeight,
          this._wp.z,
        );
        // 중간 노드에만 발동. 마지막 노드는 _advance()의 '경로 소진' 분기에서 처리.
        // (QA-06: 이중 발동 방지 — 마지막 노드에서 tl.onComplete + 경로소진 양쪽 호출되던 문제)
        if (this._movePath.length > 0) {
          this.onArrival?.(node.id);
        }
        this._advance();           // stop() 이후면 isMoving=false라 즉시 반환
      },
    });

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

  // 매 프레임: 이동 중이 아닐 때 캐릭터를 노드 월드 좌표에 고정
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
