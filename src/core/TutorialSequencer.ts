/**
 * TutorialSequencer
 * 튜토리얼 레벨의 연출 시퀀스를 관리한다.
 *
 * [Phase 0]  s0·s1만 보임. 지시문 + 3D 화살표 → s1 클릭 유도.
 * [Phase 1]  s1 도착 → s2~s7(mid 포함) 블록이 아래에서 위로 순차 등장.
 *            s7이 올라오면 목표 링·글로우 활성화 + 카메라 안내 (~5초).
 * [Phase 2]  s3 도착 → 장애물 시퀀스:
 *              ① mid 블록(x=3) 솟아오름 → 경로 끊김 → "높이 차이로 지나갈 수 없어요"
 *              ② mid 블록 내려감 → 경로 재연결
 *              ③ mid 블록 다시 솟아오름 + 사다리 등록 → "사다리가 있으면 올라갈 수 있어요"
 * [Phase 3]  s6 도착 → 별 튜토리얼:
 *              ① star_b 솟아오름 (별과 함께)
 *              ② star_c1, star_c2 연결 블록 순차 등장
 *              ③ "별을 수집한 뒤 계속 이동하세요"
 * [Phase 4]  s7 도착 → 착시 튜토리얼:
 *              ① s8 블록 솟아오름 (목표 블록)
 *              ② "길이 끊어져 있습니다" / "시점을 돌려 길이 이어진 것처럼 보이게 해보세요"
 */

import * as THREE from 'three';
import gsap from 'gsap';

import type { PathGraph } from '../world/PathGraph';
import type { TutorialHint } from '../ui/TutorialHint';

// 순차 등장할 블록 순서 (s1 이후 방향, x=5→0)
const REVEAL_IDS = ['s2', 's3', 'mid', 's5', 's6', 's7'] as const;

// 별 튜토리얼 블록 (s6 도착 후 등장)
const STAR_IDS = ['star_c1', 'star_c2', 'star_b'] as const;
type StarId = (typeof STAR_IDS)[number];

const UNDERGROUND = -6;   // 등장 전 블록 center Y
const SURFACE_Y   =  0;   // 지표면 블록 center Y (size[1]=0.5 → top=0.25)

export interface TutorialSequencerOptions {
  scene:                THREE.Scene;
  graph:                PathGraph;
  hintUI:               TutorialHint;
  onInputLock:          (locked: boolean) => void;
  onAddInteractTarget:  (mesh: THREE.Object3D) => void;
  onPathRevealed:       () => void;   // 링·글로우 활성화
  onStarBlockHidden:    (nodeId: string) => void;   // 별 메시를 지하로 숨김
  onStarBlockRevealed:  (nodeId: string) => void;   // 블록 상승 후 별 메시 재배치
}

export class TutorialSequencer {
  private scene:               THREE.Scene;
  private graph:               PathGraph;
  private hint:                TutorialHint;
  private onInputLock:         (l: boolean) => void;
  private onAddInteractTarget: (mesh: THREE.Object3D) => void;
  private onPathRevealed:      () => void;
  private onStarBlockHidden:   (nodeId: string) => void;
  private onStarBlockRevealed: (nodeId: string) => void;

  private phase = 0;   // 0=initial, 1=path revealed, 2=obstacle done, 3=star tutorial done

  // 3D 화살표 (s1 위)
  private arrowMesh: THREE.Mesh | null = null;

  // 3D 화살표 (s7 위, phase 1 완료 후 목표 방향 표시)
  private s7ArrowMesh: THREE.Mesh | null = null;

  // 사다리 시각화
  private ladderGroup: THREE.Group | null = null;

  // 정리용 타이머
  private timeouts: ReturnType<typeof setTimeout>[] = [];

  constructor(opts: TutorialSequencerOptions) {
    this.scene               = opts.scene;
    this.graph               = opts.graph;
    this.hint                = opts.hintUI;
    this.onInputLock         = opts.onInputLock;
    this.onAddInteractTarget = opts.onAddInteractTarget;
    this.onPathRevealed      = opts.onPathRevealed;
    this.onStarBlockHidden   = opts.onStarBlockHidden;
    this.onStarBlockRevealed = opts.onStarBlockRevealed;
  }

  /**
   * 튜토리얼 시작.
   * s1 mesh를 넘겨 화살표 위치를 결정하고,
   * s2~s7 및 star 블록들을 지하로 내려 보이지 않게 한다.
   */
  start(s1Mesh: THREE.Object3D): void {
    // s2~s7 숨기기 + PathGraph 비활성화
    for (const id of REVEAL_IDS) {
      const node = this.graph.getNode(id);
      if (!node) continue;
      node.mesh.position.y = UNDERGROUND;
      node.mesh.visible    = false;
      this.graph.disableNode(id);
    }

    // 별 블록들도 숨기기 + PathGraph 비활성화
    for (const id of STAR_IDS) {
      const node = this.graph.getNode(id);
      if (!node) continue;
      node.mesh.position.y = UNDERGROUND;
      node.mesh.visible    = false;
      this.graph.disableNode(id);
      // star_b에 붙어있는 별 메시도 숨김
      this.onStarBlockHidden(id);
    }

    // 착시 목표 블록(s8) 숨기기 + PathGraph 비활성화
    const s8Node = this.graph.getNode('s8');
    if (s8Node) {
      s8Node.mesh.position.y = UNDERGROUND;
      s8Node.mesh.visible    = false;
      this.graph.disableNode('s8');
    }

    this.hint.showInstruction('블록을 탭하세요', '화살표 방향 블록을 탭해 이동합니다');
    this._createArrow(s1Mesh);
  }

  /** GameManager의 onArrival에서 호출 */
  onArrival(nodeId: string): void {
    if (nodeId === 's1' && this.phase === 0) { this.phase = 1; this._revealPath(); }
    if (nodeId === 's3' && this.phase === 1) { this.phase = 2; this._obstacleSequence(); }
    if (nodeId === 's6' && this.phase === 2) { this.phase = 3; this._starTutorial(); }
    if (nodeId === 's7' && this.phase === 3) { this.phase = 4; this._illusionTutorial(); }
  }

  // ── Phase 1: 경로 블록 순차 등장 ────────────────────────────────────────

  private _revealPath(): void {
    this._removeArrow();
    this.hint.hideInstruction();

    REVEAL_IDS.forEach((id, i) => {
      this._after(i * 200, () => {
        const node = this.graph.getNode(id);
        if (!node) return;
        node.mesh.visible = true;
        gsap.to(node.mesh.position, {
          y: SURFACE_Y,
          duration: 0.6,
          ease: 'back.out(1.4)',
          onComplete: () => {
            this.graph.refresh();
            this.graph.enableNode(id);
            this.onAddInteractTarget(node.mesh);
            if (id === 's7') this._finalizeReveal();
          },
        });
      });
    });
  }

  private _finalizeReveal(): void {
    // 카메라 조작 안내 (~5초)
    // 목표 링·글로우는 Phase 4에서 s8이 솟아오른 뒤 활성화
    this._after(400, () => {
      this.hint.showInstruction(
        '카메라를 드래그해 시점을 회전하세요',
        '마우스 휠로 줌 인 / 줌 아웃도 가능해요',
      );
      this._after(5000, () => {
        this.hint.hideInstruction();
        this._after(300, () => {
          this.hint.showHint('경로를 따라 이동하세요');
          this._createS7Arrow();
        });
      });
    });
  }

  // ── Phase 2: 장애물 시퀀스 ──────────────────────────────────────────────

  private _obstacleSequence(): void {
    this.onInputLock(true);
    this.hint.hideHint();

    const midNode = this.graph.getNode('mid');
    if (!midNode) { this.onInputLock(false); return; }
    const midMesh = midNode.mesh;

    this._after(300, () => {
      // ① mid 솟아오름 → graph.refresh()로 경로 끊김
      gsap.to(midMesh.position, {
        y: 0.5,
        duration: 0.65,
        ease: 'back.out(1.2)',
        onComplete: () => {
          this.graph.refresh();
          this.hint.showHint('높이 차이로 지나갈 수 없어요');

          this._after(2400, () => {
            this.hint.hideHint();

            // ② mid 내려감 → graph.refresh()로 경로 재연결
            gsap.to(midMesh.position, {
              y: SURFACE_Y,
              duration: 0.5,
              ease: 'power2.in',
              onComplete: () => {
                this.graph.refresh();

                this._after(450, () => {
                  // ③ mid 다시 솟아오름 + 사다리 등록
                  gsap.to(midMesh.position, {
                    y: 0.5,
                    duration: 0.65,
                    ease: 'back.out(1.5)',
                    onComplete: () => {
                      this.graph.refresh();
                      this.graph.setLadders([
                        ['s3', 'mid'],
                        ['mid', 's5'],
                      ]);

                      this.ladderGroup = this._buildLadderVisual();
                      this.scene.add(this.ladderGroup);

                      this.hint.showHint('사다리가 있으면 올라갈 수 있어요');
                      this.onInputLock(false);
                    },
                  });
                });
              },
            });
          });
        },
      });
    });
  }

  // ── Phase 3: 별 튜토리얼 ─────────────────────────────────────────────────

  private _starTutorial(): void {
    this.onInputLock(true);
    this.hint.hideHint();

    this._after(350, () => {
      // ① star_b 먼저 솟아오름 (별과 함께)
      const starBNode = this.graph.getNode('star_b');
      if (starBNode) {
        starBNode.mesh.visible = true;
        gsap.to(starBNode.mesh.position, {
          y: SURFACE_Y,
          duration: 0.7,
          ease: 'back.out(1.5)',
          onComplete: () => {
            this.graph.refresh();
            this.graph.enableNode('star_b');
            this.onAddInteractTarget(starBNode.mesh);
            // 별 메시를 블록이 올라온 위치로 재배치
            this.onStarBlockRevealed('star_b');
          },
        });
      }

      // ② 연결 블록 순차 등장 (star_c1 먼저, 그 다음 star_c2)
      const connIds: StarId[] = ['star_c1', 'star_c2'];
      connIds.forEach((id, i) => {
        this._after(280 + i * 220, () => {
          const node = this.graph.getNode(id);
          if (!node) return;
          node.mesh.visible = true;
          gsap.to(node.mesh.position, {
            y: SURFACE_Y,
            duration: 0.55,
            ease: 'back.out(1.2)',
            onComplete: () => {
              this.graph.refresh();
              this.graph.enableNode(id);
              this.onAddInteractTarget(node.mesh);
            },
          });
        });
      });

      // ③ 모두 올라온 후 힌트 교체 + 입력 잠금 해제
      this._after(1500, () => {
        this.hint.showHint('별을 수집한 뒤 계속 이동하세요');
        this.onInputLock(false);
      });
    });
  }

  // ── Phase 4: 착시 튜토리얼 ───────────────────────────────────────────────

  private _illusionTutorial(): void {
    this._removeS7Arrow();
    this.onInputLock(true);
    this.hint.hideHint();

    this._after(400, () => {
      // s8 블록 솟아오름 (목표 블록, center Y=0.5) → 완료 시 목표 링·글로우 활성화
      const s8Node = this.graph.getNode('s8');
      if (s8Node) {
        s8Node.mesh.visible = true;
        gsap.to(s8Node.mesh.position, {
          y: 0.5,
          duration: 0.8,
          ease: 'back.out(1.7)',
          onComplete: () => {
            this.graph.refresh();
            this.graph.enableNode('s8');
            this.onAddInteractTarget(s8Node.mesh);
            // 이제 s8이 올라왔으므로 목표 링·글로우 활성화
            this.onPathRevealed();
          },
        });
      }

      this._after(700, () => {
        this.hint.showInstruction(
          '길이 끊어져 있습니다',
          '시점을 돌려 길이 이어진 것처럼 보이게 해보세요',
        );
        this._after(6000, () => {
          this.hint.hideInstruction();
          this.onInputLock(false);
        });
      });
    });
  }

  // ── 사다리 시각화 ─────────────────────────────────────────────────────────

  /**
   * s3(x=4, topY=0.25) ↔ mid(x=3, topY=0.75) ↔ s5(x=2, topY=0.25)
   * 경로 방향=X, 수직 방향=Z → 레일을 z=±0.2에 배치.
   */
  private _buildLadderVisual(): THREE.Group {
    const group = new THREE.Group();
    const mat   = new THREE.MeshLambertMaterial({ color: 0x7A5C2E });

    const segments: Array<[number, number, number, number]> = [
      [4, 0.25, 3, 0.75],
      [3, 0.75, 2, 0.25],
    ];

    for (const [ax, ay, bx, by] of segments) {
      const midX   = (ax + bx) / 2;
      const midY   = (ay + by) / 2;
      const height = Math.abs(by - ay);
      const zRail  = 0.20;

      const railGeo = new THREE.BoxGeometry(0.04, height, 0.04);
      for (const side of [-1, 1] as const) {
        const r = new THREE.Mesh(railGeo, mat);
        r.position.set(midX, midY, side * zRail);
        group.add(r);
      }

      const count   = Math.max(2, Math.round(height / 0.16));
      const rungGeo = new THREE.BoxGeometry(0.04, 0.04, zRail * 2);
      for (let i = 1; i < count; i++) {
        const rung = new THREE.Mesh(rungGeo, mat);
        rung.position.set(midX, Math.min(ay, by) + (height / count) * i, 0);
        group.add(rung);
      }
    }

    return group;
  }

  // ── 착시 활성화 알림 ──────────────────────────────────────────────────────

  /** GameManager의 IllusionManager.onActivate에서 호출 */
  notifyIllusionActivated(nodeA: string, nodeB: string): void {
    if (this.phase !== 4) return;
    const isS7S8 = (nodeA === 's7' && nodeB === 's8') || (nodeA === 's8' && nodeB === 's7');
    if (!isS7S8) return;
    this.hint.showHint('길이 이어졌습니다. 이제 건너면 됩니다');
  }

  // ── 3D 화살표 ─────────────────────────────────────────────────────────────

  private _createArrow(targetMesh: THREE.Object3D): void {
    const wp = new THREE.Vector3();
    targetMesh.getWorldPosition(wp);

    const geo = new THREE.ConeGeometry(0.20, 0.50, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.35 });
    this.arrowMesh = new THREE.Mesh(geo, mat);
    this.arrowMesh.rotation.z = Math.PI;
    this.arrowMesh.position.set(wp.x, wp.y + 1.5, wp.z);
    this.scene.add(this.arrowMesh);

    gsap.to(this.arrowMesh.position, {
      y: wp.y + 1.0,
      duration: 0.65,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  private _removeArrow(): void {
    if (!this.arrowMesh) return;
    const a = this.arrowMesh;
    this.arrowMesh = null;
    gsap.killTweensOf(a.position);
    gsap.to(a.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        this.scene.remove(a);
        a.geometry.dispose();
        (a.material as THREE.Material).dispose();
      },
    });
  }

  private _createS7Arrow(): void {
    const node = this.graph.getNode('s7');
    if (!node) return;
    const wp = new THREE.Vector3();
    node.mesh.getWorldPosition(wp);

    const geo = new THREE.ConeGeometry(0.20, 0.50, 8);
    const mat = new THREE.MeshLambertMaterial({ color: 0xFFD700, emissive: 0xFFD700, emissiveIntensity: 0.35 });
    this.s7ArrowMesh = new THREE.Mesh(geo, mat);
    this.s7ArrowMesh.rotation.z = Math.PI;
    this.s7ArrowMesh.position.set(wp.x, wp.y + 1.5, wp.z);
    this.scene.add(this.s7ArrowMesh);

    gsap.to(this.s7ArrowMesh.position, {
      y: wp.y + 1.0,
      duration: 0.65,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  private _removeS7Arrow(): void {
    if (!this.s7ArrowMesh) return;
    const a = this.s7ArrowMesh;
    this.s7ArrowMesh = null;
    gsap.killTweensOf(a.position);
    gsap.to(a.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.25,
      ease: 'power2.in',
      onComplete: () => {
        this.scene.remove(a);
        a.geometry.dispose();
        (a.material as THREE.Material).dispose();
      },
    });
  }

  // ── 유틸 ──────────────────────────────────────────────────────────────────

  private _after(ms: number, fn: () => void): void {
    const id = setTimeout(() => {
      const idx = this.timeouts.indexOf(id);
      if (idx >= 0) this.timeouts.splice(idx, 1);
      fn();
    }, ms);
    this.timeouts.push(id);
  }

  dispose(): void {
    this.timeouts.forEach(clearTimeout);
    this.timeouts = [];

    this._removeArrow();
    this._removeS7Arrow();

    // 진행 중인 블록 트윈 모두 정지
    for (const id of REVEAL_IDS) {
      const node = this.graph.getNode(id);
      if (node) gsap.killTweensOf(node.mesh.position);
    }
    for (const id of STAR_IDS) {
      const node = this.graph.getNode(id);
      if (node) gsap.killTweensOf(node.mesh.position);
    }
    const midNode = this.graph.getNode('mid');
    if (midNode) gsap.killTweensOf(midNode.mesh.position);

    const s8Node = this.graph.getNode('s8');
    if (s8Node) gsap.killTweensOf(s8Node.mesh.position);

    if (this.ladderGroup) {
      this.scene.remove(this.ladderGroup);
      this.ladderGroup = null;
    }
  }
}
