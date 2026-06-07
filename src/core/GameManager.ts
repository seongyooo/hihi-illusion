import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { Renderer }           from './Renderer';
import { CameraController }   from './CameraController';
import { InputManager }       from './InputManager';
import { Level }              from '../world/Level';
import type { LevelData }     from '../world/Level';
import { PathGraph }          from '../world/PathGraph';
import { Character }          from '../character/Character';
import { CharacterController } from '../character/CharacterController';
import { IllusionManager }    from '../illusion/IllusionManager';
import { HUD }                from '../ui/HUD';
import { BlockLabels }        from '../ui/BlockLabels';
import { StageSelectUI }      from '../ui/StageSelectUI';
import { TitleScreen }        from '../ui/TitleScreen';
import { TutorialHint }       from '../ui/TutorialHint';
import { EditorLobby }        from '../ui/EditorLobby';
import { LevelEditor }        from '../editor/LevelEditor';
import { CustomLevelStore }   from '../editor/CustomLevelStore';
import { ParticleSystem }     from '../fx/ParticleSystem';
import { AudioManager }       from '../fx/AudioManager';
import { TeleportManager }    from '../mechanics/TeleportManager';
import { LEVELS }             from '../levels/registry';

export class GameManager {
  // ── Engine singletons (shared across levels) ──────────────────────────
  private renderer:      Renderer;
  private hud:           HUD;
  private audio:         AudioManager;
  private particles:     ParticleSystem;
  private orbit:         OrbitControls;
  private cameraCtrl:    CameraController;
  private blockLabels:   BlockLabels;
  private stageSelect:   StageSelectUI;
  private titleScreen:   TitleScreen;
  private tutorialHint:  TutorialHint;
  private editorLobby:   EditorLobby;
  private editor:        LevelEditor;
  private readonly debug: boolean;

  // ── Per-level state (null when unloaded) ──────────────────────────────
  private level:       Level | null = null;
  private graph:       PathGraph | null = null;
  private character:   Character | null = null;
  private controller:  CharacterController | null = null;
  private input:       InputManager | null = null;
  private illusionMgr:      IllusionManager | null = null;
  private teleportMgr:      TeleportManager | null = null;
  private goalGlow:         THREE.PointLight | null = null;
  private goalMarker:       THREE.Mesh | null = null;
  private midpointMarker:   THREE.Mesh | null = null;
  private goalBlockId       = '';
  private midpointBlockId   = '';
  private midpointReached   = false;
  private goalReached       = false;

  // ── Tutorial state ────────────────────────────────────────────────────
  private isTutorial      = false;
  private tutorialMoved   = false;

  // ── Stage tracking ────────────────────────────────────────────────────
  private currentStageNum = 0;  // 0 = tutorial, 1+ = actual stages

  constructor(container: HTMLElement) {
    this.debug      = new URLSearchParams(location.search).has('debug');
    this.renderer   = new Renderer(container);
    this.hud        = new HUD(container);
    this.audio      = new AudioManager();
    this.particles  = new ParticleSystem(this.renderer.scene);

    this.orbit = new OrbitControls(this.renderer.camera, this.renderer.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = 0.08;
    this.orbit.enablePan     = false;
    this.orbit.minDistance   = 6;
    this.orbit.maxDistance   = 25;
    this.orbit.target.set(-1, 0, -1);

    this.cameraCtrl   = new CameraController(this.renderer.camera, this.orbit.target);
    this.blockLabels  = new BlockLabels(container, this.renderer.camera);
    this.stageSelect  = new StageSelectUI(container);
    this.titleScreen  = new TitleScreen(container);
    this.tutorialHint = new TutorialHint(container);

    this.titleScreen.onPlay = () => {
      this.titleScreen.hide();
      this.stageSelect.show();
    };

    this.editorLobby = new EditorLobby(container);
    this.editor      = new LevelEditor(container);

    // DEV 버튼 → 로비
    this.titleScreen.onDev = () => {
      this.titleScreen.hide();
      this.editorLobby.show();
    };

    // 로비: 새 스테이지 만들기
    this.editorLobby.onNew = () => {
      this.editorLobby.hide();
      this.editor.newStage();
      this.editor.show();
    };

    // 로비: 기존 커스텀 스테이지 수정
    this.editorLobby.onEdit = (stageNum) => {
      this.editorLobby.hide();
      this.editor.loadCustomStage(stageNum);
      this.editor.show();
    };

    // 로비: 내장 스테이지 수정
    this.editorLobby.onEditBuiltin = async (stageNum) => {
      this.editorLobby.hide();
      await this.editor.loadBuiltinStage(stageNum);
      this.editor.show();
    };

    // 로비 닫기 → 타이틀
    this.editorLobby.onClose = () => {
      this.editorLobby.hide();
      this.titleScreen.show();
    };

    // 에디터 닫기 → 로비
    this.editor.onClose = () => {
      this.editor.hide();
      this.editorLobby.show();
    };

    this.stageSelect.onSelect = (stageNum) => { this.loadStage(stageNum); };
    this.stageSelect.onBack   = () => { this.stageSelect.hide(); this.titleScreen.show(); };
    this.animate = this.animate.bind(this);
  }

  start(): void {
    requestAnimationFrame(this.animate);
    this.currentStageNum = 0;
    this.loadLevel('level_01');
  }

  // ── Stage select helper ───────────────────────────────────────────────

  private readonly builtinIds: Record<number, string> = {
    1: 'custom_stage_1',
    2: 'custom_stage_2',
    3: 'custom_stage_3',
    4: 'custom_stage_4',
    5: 'custom_stage_5',
    6: 'custom_stage_6',
    7: 'custom_stage_7',
    8: 'custom_stage_8',
  };

  private loadStage(stageNum: number): void {
    this.currentStageNum = stageNum;
    const custom = CustomLevelStore.getByStage(stageNum);
    if (custom) { this.loadCustomLevel(custom.data); return; }
    if (this.builtinIds[stageNum]) { this.loadLevel(this.builtinIds[stageNum]); return; }
  }

  private getNextStageNum(): number | null {
    const next = this.currentStageNum + 1;
    const custom = CustomLevelStore.getByStage(next);
    if (custom) return next;
    if (this.builtinIds[next]) return next;
    return null;
  }

  // ── Level lifecycle ───────────────────────────────────────────────────

  // NEW-05: 공통 레벨 오브젝트 초기화 (NEW-03: 커스텀 레벨 섹션 지원 포함)
  private _initLevelObjects(data: LevelData): void {
    // Level
    this.level = new Level(this.renderer.scene);
    this.level.load(data);
    this.hud.setLevelName(data.name);

    // PathGraph
    this.graph = new PathGraph();
    this.graph.build(data.blocks, (bid) => this.level!.blocks.get(bid)?.mesh);
    for (const section of this.level.sections) {
      this.graph.addSectionNodes(section.getWalkableEntries());
    }
    this.graph.setLadders((data.ladders ?? []).map(l => [l.nodeA, l.nodeB] as [string, string]));

    if (this.debug) this.blockLabels.build(this.graph.getAllNodes());

    // IllusionManager
    this.illusionMgr = new IllusionManager(
      this.renderer.camera,
      this.orbit.target,
      (data.illusionConnections ?? []).map(c => ({
        nodeAId:            c.nodeA,
        nodeBId:            c.nodeB,
        activateAzimuth:    c.activateAzimuth,
        azimuthTolerance:   c.azimuthTolerance,
        activateElevation:  c.activateElevation,
        elevationTolerance: c.elevationTolerance,
      })),
      {
        onActivate:   () => { this.cameraCtrl.pulse(0.3); this.audio.playIllusionActivate(); },
        onDeactivate: () => {},
      }
    );

    // Goal / midpoint setup
    this.goalBlockId     = data.goal.blockId;
    this.midpointBlockId = data.midpoint?.blockId ?? '';
    this.midpointReached = false;
    this.goalGlow        = new THREE.PointLight(0xFFD700, 1.5, 3.5);
    const goalMesh       = this.level.blocks.get(this.goalBlockId)?.mesh;
    if (goalMesh) {
      const wp = new THREE.Vector3();
      goalMesh.getWorldPosition(wp);
      this.goalGlow.position.set(wp.x, wp.y + 1.5, wp.z);
    }
    this.renderer.scene.add(this.goalGlow);

    if (this.midpointBlockId) {
      this.goalGlow.intensity = 0;
      const midMesh = this.level.blocks.get(this.midpointBlockId)?.mesh;
      if (midMesh) this.setupMidpointMarker(midMesh);
    } else {
      if (goalMesh) this.setupGoalMarker(goalMesh);
      gsap.to(this.goalGlow, { intensity: 0.4, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }

    // Teleporters
    const teleporterPairs = (data.teleporters ?? []).map(
      t => [t.nodeA, t.nodeB] as [string, string]
    );
    this.graph.setTeleporters(teleporterPairs);

    this.teleportMgr = new TeleportManager(this.renderer.scene, this.particles);
    const padNodePairs = teleporterPairs
      .map(([a, b]) => [this.graph!.getNode(a), this.graph!.getNode(b)] as const)
      .filter((pair): pair is [NonNullable<typeof pair[0]>, NonNullable<typeof pair[1]>] =>
        pair[0] != null && pair[1] != null
      );
    if (padNodePairs.length > 0) this.teleportMgr.setupPads(padNodePairs);

    // Character
    this.character  = new Character();
    const startNode = this.graph.getNode(data.character.startNodeId);
    if (!startNode) throw new Error(`Start node "${data.character.startNodeId}" not found`);

    this.controller = new CharacterController(
      this.character,
      (start, end) => this.graph!.findPath(start, end),
      startNode,
      {
        onArrival: (nodeId) => {
          // 순간이동 패드 도착 → 즉시 발동 (경로탐색과 무관)
          const teleportDest = this.graph!.getTeleportDest(nodeId);
          if (teleportDest) {
            const destNode = this.graph!.getNode(teleportDest);
            if (destNode) {
              this.teleportMgr?.playEffect(this.graph!.getNode(nodeId)!, destNode);
              this.audio.playTeleport();
              this.controller!.teleportTo(destNode);
              return; // midpoint/goal 판정은 도착지에서 하지 않음
            }
          }

          if (this.midpointBlockId && !this.midpointReached && nodeId === this.midpointBlockId) {
            this.onMidpointReached();
          }
          if (nodeId === this.goalBlockId && (!this.midpointBlockId || this.midpointReached)) {
            this.onGoalReached();
          }
          if (this.isTutorial && !this.tutorialMoved) {
            this.tutorialMoved = true;
            this.tutorialHint.showStep(2);
          }
        },
      }
    );
    this.renderer.scene.add(this.character.mesh);

    // InputManager (섹션 드래그/스냅 포함)
    const interactTargets = [
      ...this.level.getWalkableMeshes(),
      ...this.level.sections.flatMap(s => s.getAllMeshes()),
    ];
    this.input = new InputManager(
      this.renderer.renderer.domElement,
      this.renderer.camera,
      interactTargets,
      {
        onBlockClick: (blockId) => {
          const node = this.graph!.getNode(blockId);
          if (node) { this.controller!.moveTo(node); this.audio.playStep(); }
        },
        onSectionDrag: (sectionId, deltaRad) => {
          const section = this.level!.sections.find(s => s.id === sectionId);
          section?.rotate(deltaRad);
        },
        onSectionSnap: (sectionId) => {
          const section = this.level!.sections.find(s => s.id === sectionId);
          if (section) {
            section.snapToNearest().then(() => {
              this.graph!.refresh();
              this.cameraCtrl.pulse(0.3);
            });
          }
        },
      }
    );
    this.input.setOrbitControls(this.orbit);
  }

  private async loadLevel(id: string): Promise<void> {
    this.unloadCurrent();

    const meta = LEVELS.find(l => l.id === id);
    if (!meta) throw new Error(`Level not found: ${id}`);
    const mod  = await meta.file();
    const data = mod.default as unknown as LevelData;

    this.isTutorial    = this.currentStageNum === 0;
    this.goalReached   = false;
    this.tutorialMoved = false;

    this._initLevelObjects(data);

    // Tutorial hints
    if (this.isTutorial) {
      this.tutorialHint.showStep(1);
      const onCameraChange = () => {
        if (this.tutorialMoved) {
          this.tutorialHint.hide();
          this.orbit.removeEventListener('change', onCameraChange);
        }
      };
      this.orbit.addEventListener('change', onCameraChange);
      this.hud.enableSkip(() => { this.titleScreen.show(); });
    } else {
      this.hud.enableSkip(() => { this.stageSelect.show(); });
    }

    // Intro camera fly-in
    this.renderer.camera.position.set(22, 16, 12);
    this.orbit.update();
    this.orbit.enabled = false;
    this.cameraCtrl.transitionTo({ position: [12, 8, 6], lookAt: [-1, 0, -1] }, 1.8)
      .then(() => { this.orbit.enabled = true; });
  }

  private async loadCustomLevel(data: LevelData): Promise<void> {
    this.unloadCurrent();
    this.stageSelect.hide();
    this.isTutorial    = false;
    this.goalReached   = false;
    this.tutorialMoved = false;

    this._initLevelObjects(data);

    // 레벨 블록들의 XZ 무게중심 계산
    const cx = data.blocks.reduce((s, b) => s + b.position[0], 0) / Math.max(data.blocks.length, 1);
    const cz = data.blocks.reduce((s, b) => s + b.position[2], 0) / Math.max(data.blocks.length, 1);

    this.orbit.target.set(cx, 0, cz);
    this.renderer.camera.position.set(cx + 22, 16, cz + 12);
    this.orbit.update();
    this.orbit.enabled = false;
    this.cameraCtrl.transitionTo(
      { position: [cx + 12, 8, cz + 6], lookAt: [cx, 0, cz] },
      1.8,
    ).then(() => { this.orbit.enabled = true; });
  }

  private unloadCurrent(): void {
    if (!this.level) return;

    // NEW-04: 미드포인트 시네마틱 중 전환 시 cam/orbit tween 강제 종료
    gsap.killTweensOf(this.renderer.camera.position);
    gsap.killTweensOf(this.orbit.target);
    this.orbit.enabled = true;

    if (this.goalGlow) {
      gsap.killTweensOf(this.goalGlow);
      this.renderer.scene.remove(this.goalGlow);
      this.goalGlow = null;
    }

    if (this.goalMarker) {
      gsap.killTweensOf(this.goalMarker.position);
      this.renderer.scene.remove(this.goalMarker);
      this.goalMarker.geometry.dispose();
      (this.goalMarker.material as THREE.Material).dispose();
      this.goalMarker = null;
    }

    if (this.midpointMarker) {
      gsap.killTweensOf(this.midpointMarker.position);
      gsap.killTweensOf(this.midpointMarker.scale);
      this.renderer.scene.remove(this.midpointMarker);
      this.midpointMarker.geometry.dispose();
      (this.midpointMarker.material as THREE.Material).dispose();
      this.midpointMarker = null;
    }
    this.midpointBlockId = '';
    this.midpointReached = false;

    this.particles.dispose();
    this.particles.reset();

    if (this.character) {
      this.renderer.scene.remove(this.character.mesh);
      this.character.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.character = null;
    }

    this.input?.dispose();
    this.input = null;

    this.level.dispose();
    this.level = null;

    this.graph       = null;
    this.controller  = null;
    this.illusionMgr = null;
    this.teleportMgr?.dispose();
    this.teleportMgr = null;

    this.blockLabels.dispose();
    this.hud.reset();
    this.tutorialHint.hide();
    this.titleScreen.hide();
    this.editorLobby.hide();
    this.stageSelect.hide();

    // Reset orbit constraints
    this.orbit.minAzimuthAngle = -Infinity;
    this.orbit.maxAzimuthAngle =  Infinity;
    this.orbit.minPolarAngle   = 0;
    this.orbit.maxPolarAngle   = Math.PI;
    this.orbit.target.set(-1, 0, -1);
  }

  private setupGoalMarker(goalMesh: THREE.Group): void {
    const wp = new THREE.Vector3();
    goalMesh.getWorldPosition(wp);

    const geo = new THREE.TorusGeometry(0.28, 0.055, 8, 24);
    const mat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    this.goalMarker = new THREE.Mesh(geo, mat);
    this.goalMarker.rotation.x = Math.PI / 2;
    this.goalMarker.position.set(wp.x, wp.y + 0.55, wp.z);
    this.renderer.scene.add(this.goalMarker);

    gsap.to(this.goalMarker.position, {
      y: wp.y + 0.85,
      duration: 1.1,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  private setupMidpointMarker(midMesh: THREE.Group): void {
    const wp = new THREE.Vector3();
    midMesh.getWorldPosition(wp);

    const geo = new THREE.TorusGeometry(0.28, 0.055, 8, 24);
    const mat = new THREE.MeshLambertMaterial({ color: 0x44DDBB });
    this.midpointMarker = new THREE.Mesh(geo, mat);
    this.midpointMarker.rotation.x = Math.PI / 2;
    this.midpointMarker.position.set(wp.x, wp.y + 0.55, wp.z);
    this.renderer.scene.add(this.midpointMarker);

    gsap.to(this.midpointMarker.position, {
      y: wp.y + 0.85,
      duration: 1.1,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  private onMidpointReached(): void {
    this.midpointReached = true;

    // 중간 포인트 링 scale-out 후 제거
    if (this.midpointMarker) {
      const marker = this.midpointMarker;
      this.midpointMarker = null;
      gsap.killTweensOf(marker.position);
      gsap.to(marker.scale, {
        x: 0, y: 0, z: 0,
        duration: 0.35,
        ease: 'back.in',
        onComplete: () => {
          this.renderer.scene.remove(marker);
          marker.geometry.dispose();
          (marker.material as THREE.Material).dispose();
        },
      });
    }

    const goalMesh = this.level?.blocks.get(this.goalBlockId)?.mesh;

    // 골 블록 위치가 없으면 바로 활성화
    if (!goalMesh) {
      if (this.goalGlow) {
        gsap.to(this.goalGlow, { intensity: 0.4, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
      }
      return;
    }

    const goalWp = new THREE.Vector3();
    goalMesh.getWorldPosition(goalWp);

    const cam   = this.renderer.camera;
    const orbit = this.orbit;

    // 현재 카메라 상태 저장
    const origTarget = orbit.target.clone();
    const origCamPos = cam.position.clone();
    const delta      = origCamPos.clone().sub(origTarget);   // 카메라 오프셋 유지

    const panTarget = new THREE.Vector3(goalWp.x, origTarget.y, goalWp.z);
    const panCamPos = panTarget.clone().add(delta);

    // OrbitControls 비활성화 (시네마틱 동안 유저 조작 차단)
    orbit.enabled = false;

    // ── Phase 1: 골 블록 방향으로 패닝 ──────────────────────────────────
    const p1 = { t: 0 };
    gsap.to(p1, {
      t: 1,
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: () => {
        cam.position.lerpVectors(origCamPos, panCamPos, p1.t);
        orbit.target.lerpVectors(origTarget, panTarget, p1.t);
        orbit.update();
      },
      onComplete: () => {
        // ── Phase 2: 골 링 scale-in ────────────────────────────────────
        this.setupGoalMarker(goalMesh);

        if (this.goalMarker) {
          const ring   = this.goalMarker;
          const floatY = ring.position.y;  // setupGoalMarker 이 설정한 시작 Y

          // 이미 시작된 float 트윈을 멈추고 scale-in 후 재시작
          gsap.killTweensOf(ring.position);
          ring.scale.set(0, 0, 0);

          gsap.to(ring.scale, {
            x: 1, y: 1, z: 1,
            duration: 0.55,
            ease: 'back.out(2.5)',
            onComplete: () => {
              gsap.to(ring.position, {
                y: floatY + 0.3,
                duration: 1.1,
                yoyo: true,
                repeat: -1,
                ease: 'sine.inOut',
              });
            },
          });
        }

        if (this.goalGlow) {
          gsap.to(this.goalGlow, { intensity: 0.4, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
        }

        // ── Phase 3: 잠시 머문 뒤 원래 위치로 복귀 ──────────────────────
        setTimeout(() => {
          const p2 = { t: 0 };
          gsap.to(p2, {
            t: 1,
            duration: 1.1,
            ease: 'power2.inOut',
            onUpdate: () => {
              cam.position.lerpVectors(panCamPos, origCamPos, p2.t);
              orbit.target.lerpVectors(panTarget, origTarget, p2.t);
              orbit.update();
            },
            onComplete: () => {
              cam.position.copy(origCamPos);
              orbit.target.copy(origTarget);
              orbit.update();
              orbit.enabled = true;
            },
          });
        }, 900);
      },
    });
  }

  private onGoalReached(): void {
    if (this.goalReached) return;
    this.goalReached = true;

    this.audio.playGoalReached();

    const goalMesh = this.level?.blocks.get(this.goalBlockId)?.mesh ?? null;
    if (goalMesh) {
      const wp = new THREE.Vector3();
      goalMesh.getWorldPosition(wp);
      this.particles.burst(wp, 0xFFD700, 40, 2.5, 1.2);

      gsap.to(goalMesh.scale, {
        x: 1.4, y: 1.8, z: 1.4,
        duration: 0.25,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
        onComplete: () => { goalMesh.scale.set(1, 1, 1); },
      });
    }

    setTimeout(() => {
      if (this.isTutorial) {
        // 튜토리얼 클리어: 버튼 없이 잠시 후 타이틀 화면으로 이동
        this.hud.showClear();
        setTimeout(() => { this.titleScreen.show(); }, 1400);
      } else {
        // 일반 스테이지 클리어: Next Stage / Stage Select 버튼 표시
        const nextNum = this.getNextStageNum();
        const onNext  = nextNum !== null
          ? () => { this.loadStage(nextNum); }
          : undefined;
        const onSelect = () => { this.stageSelect.show(); };
        this.hud.showClear(onNext, onSelect);
      }
    }, 800);
  }

  // ── Render loop ───────────────────────────────────────────────────────

  private animate(): void {
    requestAnimationFrame(this.animate);
    this.orbit.update();

    if (this.orbit.enabled && this.illusionMgr && this.graph) {
      this.illusionMgr.update(this.graph);
    }

    if (this.debug && this.illusionMgr) {
      this.hud.setDebug(
        this.illusionMgr.currentAzimuth,
        this.illusionMgr.currentElevation,
        this.illusionMgr.anyActive,
      );
      this.blockLabels.update();
    }

    this.controller?.update();
    this.renderer.render();
  }
}
