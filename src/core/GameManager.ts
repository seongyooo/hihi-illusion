import * as THREE from 'three';
import gsap from 'gsap';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

import { Renderer }           from './Renderer';
import { CameraController }   from './CameraController';
import { InputManager }       from './InputManager';
import { Level, buildLadderMesh } from '../world/Level';
import type { LevelData, BlockData, ZoneDef } from '../world/Level';
import { PathGraph }          from '../world/PathGraph';
import { Character }          from '../character/Character';
import type { CharacterType } from '../character/Character';
import { CharacterController } from '../character/CharacterController';
import { IllusionManager }    from '../illusion/IllusionManager';
import { HUD }                from '../ui/HUD';
import { BlockLabels }        from '../ui/BlockLabels';
import { StageSelectUI }      from '../ui/StageSelectUI';
import { ChapterSelectUI }    from '../ui/ChapterSelectUI';
import { getWorldByStage }    from '../levels/worlds';
import { WorldMapScene }      from '../ui/WorldMapScene';
import { TitleScreen }        from '../ui/TitleScreen';
import { TutorialHint }       from '../ui/TutorialHint';
import { EditorLobby }        from '../ui/EditorLobby';
import { LevelEditor }        from '../editor/LevelEditor';
import { CustomLevelStore }   from '../editor/CustomLevelStore';
import { ParticleSystem }     from '../fx/ParticleSystem';
import { AudioManager }       from '../fx/AudioManager';
import { TeleportManager }    from '../mechanics/TeleportManager';
import { StarManager }        from '../mechanics/StarManager';
import { SwitchManager, type CarryEntry } from '../world/SwitchManager';
import { ElevatorManager }    from '../world/ElevatorManager';
import { PatrolManager }      from '../world/PatrolManager';
import { WorldRotateManager } from '../world/WorldRotateManager';
import { EnemyManager }      from '../world/EnemyManager';
import { LaserManager }      from '../world/LaserManager';
import { CannonManager }   from '../world/CannonManager';
import { IcicleManager }  from '../world/IcicleManager';
import { TutorialSequencer }  from './TutorialSequencer';
import { LEVELS, CUSTOM_STAGE_NUMS } from '../levels/registry';
import { GraphicsSettings, COLOR_DEFAULTS, isMobileDevice } from './GraphicsSettings';
import { SettingsScreen }     from '../ui/SettingsScreen';
import { StarBackground }     from '../world/StarBackground';
import { ProgressStore }      from './ProgressStore';
import { NarrationUI }        from '../ui/NarrationUI';

export class GameManager {
  // ── Engine singletons (shared across levels) ──────────────────────────
  private renderer:      Renderer;
  private hud:           HUD;
  private audio:         AudioManager;
  private particles:     ParticleSystem;
  private orbit:         OrbitControls;
  private cameraCtrl:    CameraController;
  private blockLabels:   BlockLabels;
  private stageSelect:    StageSelectUI;
  private chapterSelect:  ChapterSelectUI;
  private worldMapScene:  WorldMapScene | null = null;
  private _worldMapActive = false;
  private titleScreen:   TitleScreen;
  private tutorialHint:  TutorialHint;
  private editorLobby:    EditorLobby;
  private editor:         LevelEditor;
  private settingsScreen:   SettingsScreen;
  private starBackground:   StarBackground;
  private narrationUI:      NarrationUI;
  private readonly debug: boolean;

  // ── Per-level state (null when unloaded) ──────────────────────────────
  private level:       Level | null = null;
  private graph:       PathGraph | null = null;
  private character:   Character | null = null;
  private controller:  CharacterController | null = null;
  private input:       InputManager | null = null;
  private illusionMgr:      IllusionManager | null = null;
  private teleportMgr:      TeleportManager | null = null;
  private starMgr:          StarManager      | null = null;
  private switchMgr:        SwitchManager   | null = null;
  private elevatorMgr:      ElevatorManager    | null = null;
  private patrolMgr:        PatrolManager      | null = null;
  private enemyMgr:         EnemyManager       | null = null;
  private laserMgr:         LaserManager       | null = null;
  private laserSwitchMap:   Map<string, { laserIds: string[]; type: 'toggle' | 'hold' }> = new Map();
  private laserSwitchMarkers: THREE.Object3D[] = [];
  private cannonMgr: CannonManager | null = null;
  private icicleMgr: IcicleManager | null = null;
  private worldRotateMgr:   WorldRotateManager | null = null;
  private _teleportPadNodes: Array<[import('../world/PathGraph').PathNode, import('../world/PathGraph').PathNode]> = [];
  private tutorialSequencer: TutorialSequencer | null = null;
  private tutorialInputLocked = false;
  private goalGlow:         THREE.PointLight | null = null;
  private goalMarker:       THREE.Mesh | null = null;
  private midpointMarker:   THREE.Mesh | null = null;
  private goalBlockId              = '';
  private _goalFlipped             = false;
  private _goalFace: [number,number,number] | null = null;
  private midpointBlockId          = '';
  private _midpointFlipped         = false;
  private _midpointFace: [number,number,number] | null = null;
  private midpointReached          = false;
  private goalReached       = false;

  // ── Tutorial state ────────────────────────────────────────────────────
  private isTutorial      = false;
  private tutorialMoved   = false;

  // ── Stage tracking ────────────────────────────────────────────────────
  private currentStageNum = 0;  // 0 = tutorial, 1+ = actual stages

  // ── Current level reload info (for respawn-restart) ──────────────────
  private _currentLevelId:    string    | null = null;  // 빌트인 레벨 id
  private _currentCustomData: LevelData | null = null;  // 커스텀 레벨 data
  private _currentCustomExit: (() => void) | undefined = undefined;
  private _levelData:         LevelData | null = null;  // 현재 로드된 레벨 원본 data

  // ── Fly-in cancellation ───────────────────────────────────────────────
  private flyInCancelFn: (() => void) | null = null;

  // ── Pending timers / tweens (must be cancelled on unload) ────────────
  private midpointCinematicTween:   gsap.core.Tween | null = null;
  private midpointCinematicTimeout: ReturnType<typeof setTimeout> | null = null;
  private goalClearTimeout:         ReturnType<typeof setTimeout> | null = null;
  private goalClearInnerTimeout:    ReturnType<typeof setTimeout> | null = null;
  private starHintTimeout:          ReturnType<typeof setTimeout> | null = null;
  private goalMeshScaleTween:       gsap.core.Tween | null = null;

  // ── Zone camera system ────────────────────────────────────────────────
  private zoneDefs:         ZoneDef[] = [];
  private currentZoneId:    string | null = null;
  private zoneCameraTween:  gsap.core.Tween | null = null;


  constructor(container: HTMLElement) {
    this.debug      = new URLSearchParams(location.search).has('debug');
    this.renderer   = new Renderer(container);
    this.hud        = new HUD(container);
    this.audio      = new AudioManager();

    this.particles         = new ParticleSystem(this.renderer.scene);
    this.starBackground    = new StarBackground(this.renderer.scene, { starCount: isMobileDevice() ? 500 : 1400 });
    this.starBackground.setVisible(GraphicsSettings.starBackground);

    this.orbit = new OrbitControls(this.renderer.camera, this.renderer.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.dampingFactor = GraphicsSettings.dampingFactor;
    this.orbit.rotateSpeed   = GraphicsSettings.rotateSpeed;
    this.orbit.enablePan     = false;
    this.orbit.minDistance   = 6;
    this.orbit.maxDistance   = 25;
    this.orbit.minPolarAngle = Math.PI / 6;  // elevation 최대 60° 제한
    this.orbit.maxPolarAngle = Math.PI / 2 - 0.0873;  // elevation 최소 5° 제한 (수평 착시 방지)
    this.orbit.target.set(-1, 0, -1);

    this.cameraCtrl   = new CameraController(this.renderer.camera, this.orbit.target);
    this.blockLabels  = new BlockLabels(container, this.renderer.camera);
    this.narrationUI  = new NarrationUI(container);
    this.stageSelect   = new StageSelectUI(container);
    this.chapterSelect = new ChapterSelectUI(container);
    this.titleScreen   = new TitleScreen(container);
    this.tutorialHint = new TutorialHint(container);

    this.titleScreen.onPlay = () => {
      this.audio.playClick();
      this.titleScreen.hide();
      if (GraphicsSettings.worldMapMode) {
        this._showWorldMap();
      } else {
        this.chapterSelect.show();
      }
    };

    this.chapterSelect.onSelect = (chapter) => {
      this.audio.playClick();
      this.chapterSelect.hide();
      this.stageSelect.show(chapter);
    };
    this.chapterSelect.onBack = () => {
      this.audio.playClick();
      this.chapterSelect.hide();
      this.titleScreen.show();
    };

    this.editorLobby = new EditorLobby(container);
    this.editor      = new LevelEditor(container);

    // DEV 버튼 → 로비
    this.titleScreen.onDev = () => {
      this.audio.playClick();
      this.titleScreen.hide();
      this.editorLobby.show();
    };

    // SETTINGS 버튼 → 설정 화면
    this.settingsScreen = new SettingsScreen(container);

    this.titleScreen.onSettings = () => {
      this.audio.playClick();
      this.titleScreen.hide();
      this.settingsScreen.show();
    };

    this.settingsScreen.onClose = () => {
      this.audio.playClick();
      this.settingsScreen.hide();
      this.titleScreen.show();
    };

    this.settingsScreen.onQualityChange = (enhanced) => {
      GraphicsSettings.enhanced = enhanced;
      this.renderer.applyQuality(enhanced);
      // 모드 기본값 위에 저장된 조명 오버라이드 재적용
      this.renderer.applyLightingOverrides();
      this._swapSceneMaterials(enhanced);
      // 배경색: 커스텀 색 또는 새 모드 기본값 재적용
      this.renderer.applyBackgroundColor(GraphicsSettings.getEffectiveBgColor());
    };

    this.settingsScreen.onLightChange = (type, val) => {
      if (type === 'ambient') GraphicsSettings.lightAmbient = val;
      else if (type === 'dir') GraphicsSettings.lightDir    = val;
      else                     GraphicsSettings.lightHemi   = val;
      this.renderer.applyLightingOverrides();
    };

    this.settingsScreen.onBgColorChange = (hexStr) => {
      GraphicsSettings.backgroundColor = hexStr;
      this.renderer.applyBackgroundColor(hexStr ?? GraphicsSettings.getEffectiveBgColor());
    };

    this.settingsScreen.onBlockColorChange = (hexStr) => {
      GraphicsSettings.blockColorOverride = hexStr;
      const override = hexStr ? parseInt(hexStr.replace('#', ''), 16) : null;
      if (!this.isTutorial) this.level?.recolorAllBlocks(override);
    };

    this.settingsScreen.onBlockVariantChange = (variant) => {
      GraphicsSettings.blockVariant = variant;
      if (!this.isTutorial) this.level?.revariantAllBlocks(variant as import('../world/Block').BlockVariant);
    };

    this.settingsScreen.onBlockRadiusChange = (val) => {
      GraphicsSettings.blockRadiusRatio = val;
      this.level?.regeometryAllBlocks();
    };

    this.settingsScreen.onBlockXZChange = (val) => {
      GraphicsSettings.blockXZRatio = val;
      this.level?.regeometryAllBlocks();
    };

    this.settingsScreen.onBlockDividersChange = (val) => {
      GraphicsSettings.blockDividers = val;
      const override = GraphicsSettings.blockColorOverride
        ? parseInt(GraphicsSettings.blockColorOverride.replace('#', ''), 16)
        : null;
      this.level?.rebuildSeamMesh(override);
    };

    this.settingsScreen.onCharBodyColorChange = (hexStr) => {
      GraphicsSettings.characterBodyColor = hexStr;
      this.character?.setBodyColor(hexStr);
    };

    this.settingsScreen.onCharHeadColorChange = (hexStr) => {
      GraphicsSettings.characterHeadColor = hexStr;
      this.character?.setHeadColor(hexStr);
    };

    this.settingsScreen.onExposureChange = (val) => {
      GraphicsSettings.exposureOverride = val;
      this.renderer.applyLightingOverrides();
    };

    this.settingsScreen.onStarBgChange = (enabled) => {
      GraphicsSettings.starBackground = enabled;
      this.starBackground.setVisible(enabled);
      this.renderer.applyBackgroundColor(GraphicsSettings.getEffectiveBgColor());
    };

    this.settingsScreen.onRotateSpeedChange = (val) => {
      GraphicsSettings.rotateSpeed = val;
      this.orbit.rotateSpeed = val;
    };

    this.settingsScreen.onDampingFactorChange = (val) => {
      GraphicsSettings.dampingFactor = val;
      this.orbit.dampingFactor = val;
    };

    this.settingsScreen.onWorldMapModeChange = (_v) => {
      // setting saved automatically; takes effect on next Play press
    };

    this.settingsScreen.onCharacterTypeChange = (type) => {
      GraphicsSettings.characterType = type;
      if (!this.character || !this.controller) return;

      // 새 캐릭터 생성
      const next = new Character(type as CharacterType);
      if (this.isTutorial) {
        next.setBodyColor(COLOR_DEFAULTS.charBody);
        next.setHeadColor(COLOR_DEFAULTS.charHead);
      } else {
        next.setBodyColor(GraphicsSettings.characterBodyColor);
        next.setHeadColor(GraphicsSettings.characterHeadColor);
      }

      // 씬에서 구 캐릭터 제거 + 신 캐릭터 추가
      this.renderer.scene.remove(this.character.mesh);
      this.character.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          mats.forEach(m => (m as THREE.Material).dispose());
        }
      });

      this.renderer.scene.add(next.mesh);
      this.character = next;
      this.controller.replaceCharacter(next);
    };

    // 로비: 새 스테이지 만들기
    this.editorLobby.onNew = () => {
      this.editorLobby.hide();
      this.editor.newStage();
      this.editor.show();
    };

    // 로비: 커스텀 스테이지 수정
    this.editorLobby.onEdit = (stageNum) => {
      this.editorLobby.hide();
      this.editor.loadCustomStage(stageNum);
      this.editor.show();
    };

    // 로비: 내장 스테이지 수정 (개발자 모드)
    this.editorLobby.onEditBuiltin = async (stageNum) => {
      this.editorLobby.hide();
      await this.editor.loadBuiltinStage(stageNum);
      this.editor.show();
    };

    // 로비: 커스텀 스테이지 플레이
    this.editorLobby.onPlay = (stageNum) => {
      const saved = CustomLevelStore.getByStage(stageNum);
      if (!saved) return;
      this.editorLobby.hide();
      this.loadCustomLevel(saved.data, () => this.editorLobby.show());
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

    this.stageSelect.onSelect   = (stageNum) => { this.audio.playClick(); this.loadStage(stageNum); };
    this.stageSelect.onBack     = () => {
      this.audio.playClick();
      this.stageSelect.hide();
      if (GraphicsSettings.worldMapMode && this._worldMapActive === false) {
        this._showWorldMap();
      } else {
        this.chapterSelect.show();
      }
    };
    this.stageSelect.onTutorial = () => {
      this.audio.playClick();
      this.stageSelect.hide();
      this.currentStageNum = 0;
      this.loadLevel('level_01');
    };
    this.animate = this.animate.bind(this);
  }

  start(): void {
    requestAnimationFrame(this.animate);
    if (ProgressStore.isTutorialDone()) {
      // 튜토리얼 완료된 유저: 배경용 튜토리얼 레벨 로드 후 바로 타이틀 표시
      this.currentStageNum = 0;
      this.loadLevelForTitle('level_01');
    } else {
      this.currentStageNum = 0;
      this.loadLevel('level_01');
    }
  }

  // ── Stage select helper ───────────────────────────────────────────────

  private readonly builtinIds: Record<number, string> =
    Object.fromEntries(CUSTOM_STAGE_NUMS.map(n => [n, `custom_stage_${n}`]));

  private loadStage(stageNum: number): void {
    const custom = CustomLevelStore.getByStage(stageNum);
    if (custom) { this.currentStageNum = stageNum; this.loadCustomLevel(custom.data); return; }
    if (this.builtinIds[stageNum]) { this.currentStageNum = stageNum; this.loadLevel(this.builtinIds[stageNum]); return; }
    // QA-04: silent fail 방지 — stageNum 업데이트 없이 조기 종료
    console.warn(`[GameManager] loadStage: no level for stageNum=${stageNum}`);
  }

  // ── Effects ───────────────────────────────────────────────────────────

  private _showWorldMap(): void {
    this.unloadCurrent();
    if (!this.worldMapScene) {
      this.worldMapScene = new WorldMapScene(
        this.renderer.scene,
        this.renderer.camera as THREE.OrthographicCamera,
        this.orbit,
        this.renderer.renderer.domElement,
        document.getElementById('app') ?? document.body,
      );
      this.worldMapScene.onChapterSelect = (ch) => {
        this._worldMapActive = false;
        this.worldMapScene?.hide();
        this.stageSelect.show(ch);
      };
      this.worldMapScene.onBack = () => {
        this._worldMapActive = false;
        this.worldMapScene?.hide();
        this.titleScreen.show();
      };
    }
    this._worldMapActive = true;
    this.worldMapScene.show();
  }

  private _triggerIllusionEffect(): void {
    // 모바일 햅틱
    try { navigator.vibrate?.(40); } catch { /* 지원 안 하는 환경 무시 */ }
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
    this._levelData = data;
    // Level
    this.level = new Level(this.renderer.scene);
    // 튜토리얼은 variant 오버라이드 미적용 (JSON 원본 유지), 나머지는 settings 값 사용
    this.level.load(data, this.isTutorial ? undefined : GraphicsSettings.blockVariant);
    this.hud.setLevelName(data.name);

    // 배경색 적용:
    // - Level.load()가 scene.background를 교체하므로 반드시 그 이후에 호출
    // - 튜토리얼은 색상 설정 영향을 받지 않음 → 레벨 JSON 색상 그대로 사용
    if (GraphicsSettings.starBackground) {
      // 별 배경 모드: 레벨/커스텀 배경색 무시하고 항상 우주 다크 컬러 유지
      this.renderer.applyBackgroundColor(GraphicsSettings.getEffectiveBgColor());
    } else if (this.isTutorial) {
      this.renderer.applyBackgroundColor(data.backgroundColor || GraphicsSettings.getEffectiveBgColor());
    } else {
      const customBg = GraphicsSettings.backgroundColor;
      this.renderer.applyBackgroundColor(customBg || data.backgroundColor || GraphicsSettings.getEffectiveBgColor());

      // 블록 색상 오버라이드 (튜토리얼 제외 — 각 블록의 JSON 색상 그라데이션 유지)
      const blockOverride = GraphicsSettings.blockColorOverride;
      if (blockOverride) {
        this.level.recolorAllBlocks(parseInt(blockOverride.replace('#', ''), 16));
      }
    }

    // PathGraph
    this.graph = new PathGraph();
    this.graph.build(data.blocks, (bid) => this.level!.blocks.get(bid)?.mesh);
    for (const section of this.level.sections) {
      this.graph.addSectionNodes(section.getWalkableEntries());
    }
    this.graph.setLadders((data.ladders ?? []).map(l => [l.nodeA, l.nodeB] as [string, string]));

    if (this.debug) this.blockLabels.build(this.graph.getAllNodes());

    // IllusionManager — 블록 위치로부터 모든 가능한 착시 연결을 자동 계산
    this.illusionMgr = new IllusionManager(
      this.renderer.camera,
      this.orbit.target,
      this._buildAutoIllusionConns(data),
      {
        onActivate:   (nodeA, nodeB) => {
          this.audio.playIllusionActivate();
          this._triggerIllusionEffect();
          this.tutorialSequencer?.notifyIllusionActivated(nodeA, nodeB);
        },
        onDeactivate: () => {},
      }
    );

    // Goal / midpoint setup
    this.goalBlockId        = data.goal.blockId;
    this._goalFlipped       = data.goal.flipped ?? false;
    this._goalFace          = data.goal.face ?? null;
    this.midpointBlockId    = data.midpoint?.blockId ?? '';
    this._midpointFlipped   = data.midpoint?.flipped ?? false;
    this._midpointFace      = data.midpoint?.face ?? null;
    this.midpointReached    = false;
    this.goalGlow        = new THREE.PointLight(0xFFD700, 1.5, 3.5);
    const goalMesh       = this.level.blocks.get(this.goalBlockId)?.mesh;
    if (goalMesh) {
      const wp = new THREE.Vector3();
      goalMesh.getWorldPosition(wp);
      const glowDir = this._getMarkerDir(this._goalFace, this._goalFlipped);
      const glowPos = wp.clone().addScaledVector(glowDir, 1.5);
      this.goalGlow.position.set(glowPos.x, glowPos.y, glowPos.z);
    }
    this.level.getGroup().add(this.goalGlow);

    if (this.midpointBlockId) {
      this.goalGlow.intensity = 0;
      const midMesh = this.level.blocks.get(this.midpointBlockId)?.mesh;
      if (midMesh) this.setupMidpointMarker(midMesh, this._midpointFlipped);
    } else if (this.isTutorial) {
      // 튜토리얼: 경로 블록이 올라온 뒤 _revealTutorialGoal()에서 활성화
      this.goalGlow.intensity = 0;
    } else if (goalMesh) {
      this.setupGoalMarker(goalMesh);
      gsap.to(this.goalGlow, { intensity: 0.4, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    }

    // Teleporters
    const teleporterPairs = (data.teleporters ?? []).map(
      t => [t.nodeA, t.nodeB] as [string, string]
    );
    this.graph.setTeleporters(teleporterPairs);

    this.teleportMgr = new TeleportManager(this.level.getGroup(), this.particles);
    this._teleportPadNodes = teleporterPairs
      .map(([a, b]) => [this.graph!.getNode(a), this.graph!.getNode(b)] as const)
      .filter((pair): pair is [NonNullable<typeof pair[0]>, NonNullable<typeof pair[1]>] =>
        pair[0] != null && pair[1] != null
      );
    if (this._teleportPadNodes.length > 0) this.teleportMgr.setupPads(this._teleportPadNodes);

    // StarManager
    this.starMgr = new StarManager(this.renderer.scene, this.particles);
    if ((data.stars ?? []).length > 0) {
      this.starMgr.setup(data.stars!, (id) => this.graph!.getNode(id));
    }
    const totalStars = this.starMgr?.getTotal() ?? 0;
    if (totalStars > 0) this.hud.showStarCounter(0, totalStars);

    // SwitchManager
    this.switchMgr = new SwitchManager(this.renderer.scene, this.particles);
    if ((data.switches ?? []).length > 0) {
      this.switchMgr.setup(
        data.switches!,
        this.graph,
        (id) => this.level!.blocks.get(id)?.mesh,
      );
    }
    this.switchMgr.setOnDespawn((nodeId) => {
      this.controller?.stopIfPathContains(nodeId);
    });
    for (const cl of data.conditionalLadders ?? []) {
      this.switchMgr.registerConditionalLadders(
        cl.switchNodeId,
        cl.pairs.map(p => [p.nodeA, p.nodeB] as [string, string]),
      );

      // 사다리 시각 메시: 스위치 ON 상태의 블록 위치(moveTarget)를 기준으로 생성
      const ladderMeshes: THREE.Object3D[] = [];
      for (const pair of cl.pairs) {
        const bdA = this.getFinalBlockData(data, pair.nodeA);
        const bdB = this.getFinalBlockData(data, pair.nodeB);
        if (bdA && bdB) {
          const mesh = buildLadderMesh(bdA, bdB);
          this.renderer.scene.add(mesh);
          ladderMeshes.push(mesh);
        }
      }
      if (ladderMeshes.length > 0) {
        this.switchMgr.registerConditionalLadderMeshes(cl.switchNodeId, ladderMeshes);
      }
    }

    // ElevatorManager
    this.elevatorMgr = new ElevatorManager(this.renderer.scene);
    if ((data.elevators ?? []).length > 0) {
      this.elevatorMgr.setup(data.elevators!, this.graph);
    }

    // PatrolManager
    this.patrolMgr = new PatrolManager(this.renderer.scene);
    if ((data.patrols ?? []).length > 0) {
      this.patrolMgr.setup(data.patrols!, this.graph);
    }

    // EnemyManager
    this.enemyMgr = new EnemyManager(this.renderer.scene);
    if (data.enemies && data.enemies.length > 0) {
      this.enemyMgr.setup(data.enemies, this.graph);
    }
    this.enemyMgr.setOnPlayerKilled(() => { this._respawn(); });

    // LaserManager
    const getEmitterPos = (blockId: string): THREE.Vector3 | null => {
      const node = this.graph?.getNode(blockId);
      if (node) return node.position.clone();
      // walkable 아닌 블록: mesh worldPos + halfHeight (윗면 Y)
      const blk = this.level?.blocks.get(blockId);
      if (!blk) return null;
      const bd = data.blocks.find(b => b.id === blockId);
      const wp = new THREE.Vector3();
      blk.mesh.getWorldPosition(wp);
      wp.y += (bd?.size[1] ?? 1) / 2; // 중심 → 윗면
      return wp;
    };
    this.laserMgr = new LaserManager(this.level.getGroup(), getEmitterPos);
    if (data.lasers && data.lasers.length > 0) {
      this.laserMgr.setup(data.lasers);
    }
    // laserSwitch 맵 구성 + 시각 마커
    this.laserSwitchMap.clear();
    for (const m of this.laserSwitchMarkers) m.removeFromParent();
    this.laserSwitchMarkers = [];
    for (const ls of data.laserSwitches ?? []) {
      this.laserSwitchMap.set(ls.switchNodeId, { laserIds: ls.laserIds, type: ls.type });
      // 스위치 노드 위에 발광 링 마커 추가
      const swNode = this.graph?.getNode(ls.switchNodeId);
      if (swNode) {
        const markerColor = ls.type === 'toggle' ? 0xFF6600 : 0xFF9900;
        const ringGeo = new THREE.TorusGeometry(0.38, 0.045, 6, 20);
        const ringMat = new THREE.MeshBasicMaterial({ color: markerColor, transparent: true, opacity: 0.9 });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(swNode.position.x, swNode.position.y + 0.05, swNode.position.z);
        this.level.getGroup().add(ring);
        this.laserSwitchMarkers.push(ring);
        gsap.to(ringMat, { opacity: 0.3, duration: 0.7, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      }
    }

    // CannonManager
    this.cannonMgr = new CannonManager(this.level.getGroup(), (nodeId) => {
      const node = this.graph?.getNode(nodeId);
      return node ? node.position.clone() : null;
    });
    if (data.cannons && data.cannons.length > 0) {
      this.cannonMgr.setup(data.cannons);
    }

    // IcicleManager
    this.icicleMgr = new IcicleManager(this.level.getGroup(), (nodeId) => {
      const node = this.graph?.getNode(nodeId);
      return node ? node.position.clone() : null;
    });
    if (data.icicles && data.icicles.length > 0) {
      this.icicleMgr.setup(data.icicles);
    }

    // WorldRotateManager — 맵 전체 회전 블록
    this.worldRotateMgr = new WorldRotateManager();
    if ((data.mapRotateBlocks ?? []).length > 0) {
      const bounds = new THREE.Box3().setFromObject(this.level.getGroup());
      const defs = data.mapRotateBlocks!.map(d => ({
        ...d,
        angle: d.angle * (Math.PI / 180), // degrees → radians
      }));
      this.worldRotateMgr.setup(
        defs,
        this.graph,
        this.level.getGroup(),
        this.level.getFlipPivot(),
        bounds,
        {
          beforeRotate: () => {
            this.controller?.stop();
            this.enemyMgr?.pause();
          },
          onRotateUpdate: () => {
            if (this.graph) this.illusionMgr?.update(this.graph);
          },
          onRotateComplete: (up: THREE.Vector3) => {
            // PathGraph는 WorldRotateManager 내부에서 refresh(up) 완료
            // 캐릭터 중력 방향 업데이트
            this.controller?.setGravityUp(up);
            // 착시 연결 재계산
            if (this.illusionMgr && this.graph && this._levelData) {
              const newConns = this._buildIllusionConnsWorldSpace(this._levelData);
              this.illusionMgr.setConnections(newConns, this.graph);
            }
            // goalGlow / goalMarker / midpointMarker / 텔레포터 링 위치 갱신
            this._refreshWorldElements();
            this.enemyMgr?.resume();

          },
        },
      );
    }

    // Character — 타입은 항상 settings 값 사용, 튜토리얼은 색상만 기본값 유지
    this.character = new Character(GraphicsSettings.characterType as CharacterType);
    if (this.isTutorial) {
      this.character.setBodyColor(COLOR_DEFAULTS.charBody);
      this.character.setHeadColor(COLOR_DEFAULTS.charHead);
    }
    const startNode   = this.graph.getNode(data.character.startNodeId);
    if (!startNode) throw new Error(`Start node "${data.character.startNodeId}" not found`);

    // Zone setup — 구역 목록 저장, 시작 위치 기반 초기 구역 결정
    this.zoneDefs      = data.zones ?? [];
    this.currentZoneId = null;
    const startNode2   = this.graph.getNode(data.character.startNodeId);
    if (startNode2) {
      const startZone = this._findZoneAt(startNode2.position.x, startNode2.position.z);
      if (startZone) this.currentZoneId = startZone.id;
    }

    this.controller = new CharacterController(
      this.character,
      (start, end) => this.graph!.findPath(start, end),
      startNode,
      {
        shouldBlock: () => this.switchMgr?.isPlayerOnMovingBlock() ?? false,
        onDepart: (nodeId) => {
          this.audio.playStep();
          this.switchMgr?.onCharacterDepart(nodeId, this.graph!);
          // hold 레이저 스위치 — 벗어나면 레이저 재활성
          const lsDepart = this.laserSwitchMap.get(nodeId);
          if (lsDepart?.type === 'hold') {
            for (const lid of lsDepart.laserIds) this.laserMgr?.setActive(lid, true);
          }
        },
        onArrival: (nodeId) => {
          // 가시 블록 — 즉시 리스폰 (blinking 타입은 가시가 표시 중일 때만)
          if (this.level!.getSpikeNodeIds().has(nodeId) && this.level!.isBlinkingSpikeActive(nodeId)) {
            this._respawn();
            return;
          }

          // 레이저 스위치 처리
          const lsSwitch = this.laserSwitchMap.get(nodeId);
          if (lsSwitch) {
            if (lsSwitch.type === 'toggle') {
              for (const lid of lsSwitch.laserIds) this.laserMgr?.toggleLaser(lid);
            } else {
              // hold: 서 있는 동안 레이저 꺼짐
              for (const lid of lsSwitch.laserIds) this.laserMgr?.setActive(lid, false);
            }
          }

          // 레이저 충돌 판정
          const arrivedNodeForLaser = this.graph?.getNode(nodeId);
          if (arrivedNodeForLaser && this.laserMgr?.isNodeInLaser(arrivedNodeForLaser)) {
            this._respawn();
            return;
          }

          // 대포 포탄 충돌 판정
          const arrivedNodeForCannon = this.graph?.getNode(nodeId);
          if (arrivedNodeForCannon && this.cannonMgr?.isPlayerHit(arrivedNodeForCannon)) {
            this._respawn();
            return;
          }

          // 고드름 충돌 판정
          const arrivedNodeForIcicle = this.graph?.getNode(nodeId);
          if (arrivedNodeForIcicle && this.icicleMgr?.isPlayerHit(arrivedNodeForIcicle)) {
            this._respawn();
            return;
          }

          // 구역 전환 체크 — 새 구역 진입 시 카메라 타깃 이동
          const arrivedNode = this.graph?.getNode(nodeId);
          if (arrivedNode) {
            const arrivedZone = this._findZoneAt(arrivedNode.position.x, arrivedNode.position.z);
            if (arrivedZone && arrivedZone.id !== this.currentZoneId) {
              this.currentZoneId = arrivedZone.id;
              this._onZoneEnter(arrivedZone);
            }
          }

          // 튜토리얼 시퀀스 트리거
          this.tutorialSequencer?.onArrival(nodeId);

          // 맵 전체 회전 블록
          this.worldRotateMgr?.onArrival(nodeId);

          // 스위치 / 엘리베이터 트리거
          this.switchMgr?.onCharacterArrive(nodeId, this.graph!);
          this.elevatorMgr?.onCharacterArrive(nodeId, this.graph!);

          // 유효 flip 상태: 맵 Y축 180° 회전 여부
          const effectiveFlipped = this.worldRotateMgr?.isMapFlipped() ?? false;

          // 별 수집
          const _collected = this.starMgr?.tryCollect(nodeId, effectiveFlipped);
          if (_collected) {
            const totalCollected = this.starMgr?.getCollected() ?? 0;
            const totalAll       = this.starMgr?.getTotal() ?? 0;
            this.hud.updateStarCounter(totalCollected, totalAll);
            this.audio.playStarCollect();
          }

          // 순간이동 패드 도착 → 즉시 발동 (경로탐색과 무관)
          const teleportDest = this.graph!.getTeleportDest(nodeId);
          if (teleportDest) {
            const destNode = this.graph!.getNode(teleportDest);
            if (destNode) {
              this.teleportMgr?.playEffect(this.graph!.getNode(nodeId)!, destNode);
              this.audio.playTeleport();
              this.controller!.teleportTo(destNode);
              // 텔레포트 후 남은 경로를 제거 — 목적지 너머를 클릭했을 때 자동 이동 방지
              this.controller!.stop();
              // QA-07: 텔레포트 목적지 노드의 별 수집 판정
              const _tpCollected = this.starMgr?.tryCollect(teleportDest, effectiveFlipped);
              if (_tpCollected) {
                const totalCollected = this.starMgr?.getCollected() ?? 0;
                const totalAll       = this.starMgr?.getTotal() ?? 0;
                this.hud.updateStarCounter(totalCollected, totalAll);
                this.audio.playStarCollect();
              }
              // QA-03: 도착지에 대한 goal/midpoint 판정도 수행
              if (this.midpointBlockId && !this.midpointReached && teleportDest === this.midpointBlockId && (this._midpointFace !== null || effectiveFlipped === this._midpointFlipped)) {
                this.onMidpointReached();
              }
              if (teleportDest === this.goalBlockId && (!this.midpointBlockId || this.midpointReached) && (this._goalFace !== null || effectiveFlipped === this._goalFlipped)) {
                this._tryGoalReached();
              }
              return;
            }
          }

          if (this.midpointBlockId && !this.midpointReached && nodeId === this.midpointBlockId && (this._midpointFace !== null || effectiveFlipped === this._midpointFlipped)) {
            this.onMidpointReached();
          }
          if (nodeId === this.goalBlockId && (!this.midpointBlockId || this.midpointReached) && (this._goalFace !== null || effectiveFlipped === this._goalFlipped)) {
            this._tryGoalReached();
          }
          if (this.isTutorial && !this.tutorialMoved) {
            this.tutorialMoved = true;
            this.tutorialHint.showStep(2);
          }
        },
      }
    );
    this.renderer.scene.add(this.character.mesh);

    // blinking 가시 활성화 콜백 — 플레이어가 서 있는 블록에 가시가 올라오면 즉시 리스폰
    this.level.setSpikeActivationCallback((nodeId) => {
      if (this.controller?.getCurrentNode().id === nodeId) {
        this._respawn();
      }
    });

    // dev 모드: blinking 속도 조절 패널
    if (this.debug) this._setupBlinkDevPanel();

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
          if (this.tutorialInputLocked) return;
          if (this.switchMgr?.isPlayerOnMovingBlock()) return;
          const node = this.graph!.getNode(blockId);
          if (node) {
            this.audio.ensureBgm();
            this.controller!.moveTo(node);
          }
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
              // QA-08: 섹션 회전 후 별 메시 위치 갱신
              this.starMgr?.refreshPositions((id) => this.graph!.getNode(id));
              this.cameraCtrl.pulse(0.3);
            });
          }
        },
      }
    );
    this.input.setOrbitControls(this.orbit);

    // 스폰 타입 스위치 타겟에 연동된 시각 요소(별, 텔레포트 링, 목표 링 등) 숨김 연결
    this._linkSwitchAttachments(data);
  }

  private _linkSwitchAttachments(data: LevelData): void {
    if (!this.switchMgr) return;
    for (const sw of data.switches ?? []) {
      if (sw.type === 'spawn') {
        const meshes: THREE.Object3D[] = [];

        // 별
        const starMesh = this.starMgr?.getStarMesh(sw.targetNodeId);
        if (starMesh) meshes.push(starMesh);

        // 텔레포트 패드 링
        const padRings = this.teleportMgr?.getRingsForNode(sw.targetNodeId);
        if (padRings) meshes.push(...padRings);

        // 목표 마커 / 목표 조명
        if (sw.targetNodeId === this.goalBlockId) {
          if (this.goalMarker) meshes.push(this.goalMarker);
          if (this.goalGlow)   meshes.push(this.goalGlow);
        }

        // 중간 포인트 마커
        if (sw.targetNodeId === this.midpointBlockId) {
          if (this.midpointMarker) meshes.push(this.midpointMarker);
        }

        // 사다리 (타겟 블록과 연결된 사다리 전체)
        const ladderGroups = this.level!.getLaddersForBlock(sw.targetNodeId);
        meshes.push(...ladderGroups);

        if (meshes.length > 0) this.switchMgr.attachMeshes(sw.targetNodeId, meshes);

      } else if (sw.type === 'move') {
        const carries: CarryEntry[] = [];

        // 별: 이동 시 float 애니 중단 → 델타 적용 → 완료 후 재시작
        const starMesh = this.starMgr?.getStarMesh(sw.targetNodeId);
        if (starMesh) {
          const nodeId = sw.targetNodeId;
          carries.push({
            mesh: starMesh,
            onComplete: () => {
              const node = this.graph?.getNode(nodeId);
              if (node) this.starMgr?.repositionStar(nodeId, node);
            },
          });
        }

        // 텔레포트 패드 링
        const padRings = this.teleportMgr?.getRingsForNode(sw.targetNodeId);
        if (padRings) padRings.forEach(m => carries.push({ mesh: m }));

        if (carries.length > 0) this.switchMgr.attachCarryMeshes(sw.targetNodeId, carries);
      }
    }
  }

  /** 튜토리얼 완료 유저용: 레벨을 배경으로만 로드하고 타이틀 화면을 즉시 표시 */
  private async loadLevelForTitle(id: string): Promise<void> {
    this.unloadCurrent();

    const meta = LEVELS.find(l => l.id === id);
    if (!meta) throw new Error(`Level not found: ${id}`);
    const mod  = await meta.file();
    const data = mod.default as unknown as LevelData;

    this.isTutorial    = false; // 튜토리얼 시퀀서 비활성화
    this.goalReached   = false;
    this.tutorialMoved = false;

    this._initLevelObjects(data);

    // 타이틀 화면을 플라이인 완료 시 표시
    this._startCameraFlyInThenTitle(data);
  }

  private _startCameraFlyInThenTitle(data: LevelData): void {
    let cx: number;
    let cz: number;
    if (data.zones && data.zones.length > 0) {
      const z0 = data.zones[0];
      cx = z0.gridX + z0.width  / 2;
      cz = z0.gridZ + z0.depth  / 2;
    } else {
      cx = data.blocks.reduce((s, b) => s + b.position[0], 0) / Math.max(data.blocks.length, 1);
      cz = data.blocks.reduce((s, b) => s + b.position[2], 0) / Math.max(data.blocks.length, 1);
    }

    let finalPos: [number, number, number];
    let targetY = 0;

    if (data.initialCamera) {
      const { azimuth, polar, distance, targetY: ty } = data.initialCamera;
      targetY = ty;
      const az = azimuth * Math.PI / 180;
      const po = polar   * Math.PI / 180;
      finalPos = [
        cx + distance * Math.sin(po) * Math.sin(az),
        targetY + distance * Math.cos(po),
        cz + distance * Math.sin(po) * Math.cos(az),
      ];
    } else {
      finalPos = [cx + 12, 8, cz + 6];
    }

    // 애니메이션 없이 즉시 최종 위치로 이동 후 타이틀 표시
    this.orbit.target.set(cx, targetY, cz);
    this.renderer.camera.position.set(...finalPos);
    this.renderer.camera.lookAt(cx, targetY, cz);
    this.orbit.update();
    this.orbit.enabled = true;
    this.titleScreen.show();
  }

  private async loadLevel(id: string): Promise<void> {
    this.unloadCurrent();

    const meta = LEVELS.find(l => l.id === id);
    if (!meta) throw new Error(`Level not found: ${id}`);
    const mod  = await meta.file();
    const data = mod.default as unknown as LevelData;

    this._currentLevelId    = id;
    this._currentCustomData = null;
    this.isTutorial    = this.currentStageNum === 0;
    this.goalReached   = false;
    this.tutorialMoved = false;

    this._initLevelObjects(data);

    // Tutorial hints / sequencer
    if (this.isTutorial) {
      this.tutorialInputLocked = false;
      this.tutorialSequencer = new TutorialSequencer({
        scene:               this.renderer.scene,
        graph:               this.graph!,
        hintUI:              this.tutorialHint,
        onInputLock:         (locked) => {
          this.tutorialInputLocked = locked;
          if (locked) this.controller?.stop();
        },
        onAddInteractTarget: (mesh) => { this.input?.addTarget(mesh); },
        onPathRevealed:      () => { this._revealTutorialGoal(); },
        onStarBlockHidden:   (nodeId) => { this.starMgr?.hideStarMesh(nodeId); },
        onStarBlockRevealed: (nodeId) => {
          const node = this.graph?.getNode(nodeId);
          if (node) this.starMgr?.repositionStar(nodeId, node);
        },
      });

      // s1 블록 mesh를 넘겨 화살표 위치 결정
      const s1Mesh = this.level!.blocks.get('s1')?.mesh;
      if (s1Mesh) this.tutorialSequencer.start(s1Mesh);

      this.hud.enableSkip(() => { this.titleScreen.show(); });
    } else {
      this.hud.enableSkip(() => { this.chapterSelect.show(); });
    }

    // Intro camera fly-in
    this._startCameraFlyIn(data);
    this._showStageNarration();
  }

  private async loadCustomLevel(data: LevelData, onExit?: () => void): Promise<void> {
    this.unloadCurrent();
    this.stageSelect.hide();
    this.isTutorial    = false;
    this.goalReached   = false;
    this.tutorialMoved = false;

    this._currentCustomData = data;
    this._currentCustomExit = onExit;
    this._currentLevelId    = null;

    this._initLevelObjects(data);
    this.hud.enableSkip(() => {
      if (onExit) { onExit(); return; }
      const worldId = getWorldByStage(this.currentStageNum)?.id ?? 1;
      this.stageSelect.show(worldId);
    });
    this._startCameraFlyIn(data);
    this._showStageNarration();
  }

  private _showStageNarration(): void {
    if (this.currentStageNum <= 0) return;
    const world = getWorldByStage(this.currentStageNum);
    if (!world) return;
    const idx = this.currentStageNum - world.startStage;
    const text = world.stageNarrations[idx];
    if (text) this.narrationUI.show(text);
  }

  /** initialCamera 설정 또는 기본값으로 인트로 카메라 플라이-인 실행 */
  private _startCameraFlyIn(data: LevelData): void {
    // zone이 있으면 첫 번째 zone의 중심을 기준으로, 없으면 블록 평균
    let cx: number;
    let cz: number;
    if (data.zones && data.zones.length > 0) {
      const z0 = data.zones[0];
      cx = z0.gridX + z0.width  / 2;
      cz = z0.gridZ + z0.depth  / 2;
    } else {
      cx = data.blocks.reduce((s, b) => s + b.position[0], 0) / Math.max(data.blocks.length, 1);
      cz = data.blocks.reduce((s, b) => s + b.position[2], 0) / Math.max(data.blocks.length, 1);
    }

    let finalPos: [number, number, number];
    let targetY = 0;

    if (data.initialCamera) {
      const { azimuth, polar, distance, targetY: ty } = data.initialCamera;
      targetY = ty;
      const az = azimuth * Math.PI / 180;
      const po = polar   * Math.PI / 180;
      finalPos = [
        cx + distance * Math.sin(po) * Math.sin(az),
        targetY + distance * Math.cos(po),
        cz + distance * Math.sin(po) * Math.cos(az),
      ];
    } else {
      finalPos = [cx + 12, 8, cz + 6];
    }

    const lookAt: [number, number, number] = [cx, targetY, cz];
    // 시작 위치는 최종 위치에서 더 멀리
    const startPos: [number, number, number] = [
      cx + (finalPos[0] - cx) * 1.8,
      targetY + (finalPos[1] - targetY) * 1.8,
      cz + (finalPos[2] - cz) * 1.8,
    ];

    this.orbit.target.set(cx, targetY, cz);
    this.renderer.camera.position.set(...startPos);
    this.orbit.update();

    // pointerdown 시 fly-in을 즉시 finalPos로 스냅하고 orbit 활성화
    const canvas = this.renderer.renderer.domElement;
    const commitFinal = () => {
      this.flyInCancelFn = null;
      this.cameraCtrl.cancel();
      this.renderer.camera.position.set(...finalPos);
      this.orbit.target.set(cx, targetY, cz);
      this.renderer.camera.lookAt(this.orbit.target);
      this.orbit.update();
      this.orbit.enabled = true;
    };
    this.flyInCancelFn = () => {
      canvas.removeEventListener('pointerdown', commitFinal);
      commitFinal();
    };
    canvas.addEventListener('pointerdown', commitFinal, { once: true });

    this.orbit.enabled = false;
    this.cameraCtrl.transitionTo({ position: finalPos, lookAt }, 1.8)
      .then(() => {
        canvas.removeEventListener('pointerdown', commitFinal);
        this.flyInCancelFn = null;
        this.orbit.enabled = true;
      });
  }

  private unloadCurrent(): void {
    if (!this.level) return;

    this._worldMapActive = false;
    if (this.worldMapScene) {
      this.worldMapScene.hide();
    }

    // 나레이션 취소
    this.narrationUI.cancel();

    // fly-in 취소 및 이벤트 리스너 정리
    this.flyInCancelFn?.();
    this.flyInCancelFn = null;

    // QA-01: proxy tween(p1/p2)과 setTimeout 취소
    if (this.midpointCinematicTween) {
      this.midpointCinematicTween.kill();
      this.midpointCinematicTween = null;
    }
    if (this.midpointCinematicTimeout !== null) {
      clearTimeout(this.midpointCinematicTimeout);
      this.midpointCinematicTimeout = null;
    }
    // QA-02: goalClearTimeout 취소
    if (this.goalClearTimeout !== null) {
      clearTimeout(this.goalClearTimeout);
      this.goalClearTimeout = null;
    }
    // BUG-01: 튜토리얼 클리어 inner setTimeout 취소
    if (this.goalClearInnerTimeout !== null) {
      clearTimeout(this.goalClearInnerTimeout);
      this.goalClearInnerTimeout = null;
    }
    // BUG-03: 별 부족 힌트 setTimeout 취소
    if (this.starHintTimeout !== null) {
      clearTimeout(this.starHintTimeout);
      this.starHintTimeout = null;
    }
    // BUG-15-01: 골 블록 팽창 트윈 취소
    if (this.goalMeshScaleTween) {
      this.goalMeshScaleTween.kill();
      this.goalMeshScaleTween = null;
    }

    // NEW-04: cam/orbit 직접 tween이 있을 경우도 대비해 유지
    gsap.killTweensOf(this.renderer.camera.position);
    gsap.killTweensOf(this.orbit.target);
    this.orbit.enabled = true;

    // Zone 상태 초기화
    if (this.zoneCameraTween) { this.zoneCameraTween.kill(); this.zoneCameraTween = null; }
    this.zoneDefs      = [];
    this.currentZoneId = null;

    if (this.goalGlow) {
      gsap.killTweensOf(this.goalGlow);
      this.goalGlow.removeFromParent();
      this.goalGlow = null;
    }

    if (this.goalMarker) {
      gsap.killTweensOf(this.goalMarker.position);
      gsap.killTweensOf(this.goalMarker.scale);
      this.goalMarker.removeFromParent();
      this.goalMarker.geometry.dispose();
      (this.goalMarker.material as THREE.Material).dispose();
      this.goalMarker = null;
    }

    if (this.midpointMarker) {
      gsap.killTweensOf(this.midpointMarker.position);
      gsap.killTweensOf(this.midpointMarker.scale);
      this.midpointMarker.removeFromParent();
      this.midpointMarker.geometry.dispose();
      (this.midpointMarker.material as THREE.Material).dispose();
      this.midpointMarker = null;
    }
    this.midpointBlockId          = '';
    this._midpointFlipped         = false;
    this._midpointFace            = null;
    this.goalBlockId              = '';
    this._goalFlipped             = false;
    this._goalFace                = null;
    this.midpointReached          = false;
    this.orbit.rotateSpeed = GraphicsSettings.rotateSpeed;

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

    // StarManager를 먼저 dispose — 별이 블록 메시의 자식이므로
    // level.dispose()의 traverse보다 먼저 제거해야 double-dispose 방지
    this.starMgr?.dispose();
    this.starMgr = null;

    this.level.dispose();
    this.level = null;

    this.graph            = null;
    this.controller?.dispose();
    this.controller       = null;
    this.illusionMgr      = null;
    this._levelData       = null;
    this._teleportPadNodes = [];
    this.teleportMgr?.dispose();
    this.teleportMgr = null;
    this.switchMgr?.dispose();
    this.switchMgr   = null;
    this.elevatorMgr?.dispose();
    this.elevatorMgr = null;
    this.patrolMgr?.dispose();
    this.patrolMgr = null;
    this.enemyMgr?.dispose();
    this.enemyMgr = null;
    this.laserMgr?.dispose();
    this.laserMgr = null;
    this.laserSwitchMap.clear();
    for (const m of this.laserSwitchMarkers) {
      gsap.killTweensOf((m as THREE.Mesh).material);
      m.removeFromParent();
      (m as THREE.Mesh).geometry?.dispose();
      ((m as THREE.Mesh).material as THREE.Material)?.dispose();
    }
    this.laserSwitchMarkers = [];
    this.cannonMgr?.dispose();
    this.cannonMgr = null;
    this.icicleMgr?.dispose();
    this.icicleMgr = null;
    this.worldRotateMgr?.dispose();
    this.worldRotateMgr = null;
    this.tutorialSequencer?.dispose();
    this.tutorialSequencer    = null;
    this.tutorialInputLocked  = false;

    this.blockLabels.dispose();
    this.hud.reset();
    this.tutorialHint.hide();
    this.titleScreen.hide();
    this.chapterSelect.hide();
    this.editorLobby.hide();
    this.stageSelect.hide();

    // Reset orbit constraints
    this.orbit.minAzimuthAngle = -Infinity;
    this.orbit.maxAzimuthAngle =  Infinity;
    this.orbit.minPolarAngle   = Math.PI / 6;  // elevation 최대 60° 제한 유지
    this.orbit.maxPolarAngle   = Math.PI / 2 - 0.0873;  // elevation 최소 5° 제한 (수평 착시 방지)
    this.orbit.target.set(-1, 0, -1);
  }

  /**
   * 모든 walkable 블록 쌍의 면(face) 중심점을 기준으로 착시 연결 설정을 자동 생성한다.
   *
   * 블록 A와 B가 대각선 방향으로 떨어져 있을 때, X축 방향 face 쌍과 Z축 방향 face 쌍
   * 각각에 대해 카메라 정렬 각도를 계산한다. 각 face 쌍마다 A→B 시점과 B→A 시점
   * 두 가지 방향을 등록하며, 카메라 elevation 범위(0°~60°) 안에 드는 것만 포함한다.
   *
   * switch-move 블록의 경우 원래 위치와 이동 후 위치(moveTarget) 두 가지 모두에 대해
   * 각도를 계산하여 등록한다.
   */
  /**
   * mapRotateBlocks 회전 완료 후 goal/midpoint 마커, 텔레포터 링 위치를
   * 새 월드 좌표 기준으로 갱신한다.
   * 회전으로 인해 levelGroup 로컬 좌표계가 바뀌므로 worldToLocal() 로 변환.
   */
  private _refreshWorldElements(): void {
    if (!this.level) return;
    const group = this.level.getGroup();
    const wp    = new THREE.Vector3();

    const toLocal = (wx: number, wy: number, wz: number) =>
      group.worldToLocal(new THREE.Vector3(wx, wy, wz));

    // goalGlow 재배치
    const goalMesh = this.level.blocks.get(this.goalBlockId)?.mesh;
    if (goalMesh && this.goalGlow) {
      goalMesh.getWorldPosition(wp);
      const dir = this._getMarkerDir(this._goalFace, this._goalFlipped);
      const gwp = wp.clone().addScaledVector(dir, 1.5);
      this.goalGlow.position.copy(toLocal(gwp.x, gwp.y, gwp.z));
    }

    // goalMarker 재배치 (GSAP 재시작)
    if (goalMesh && this.goalMarker) {
      goalMesh.getWorldPosition(wp);
      const dir      = this._getMarkerDir(this._goalFace, this._goalFlipped);
      const startWp  = wp.clone().addScaledVector(dir, 0.55);
      const floatWp  = wp.clone().addScaledVector(dir, 0.85);
      const localStart = toLocal(startWp.x, startWp.y, startWp.z);
      const localFloat = toLocal(floatWp.x, floatWp.y, floatWp.z);
      gsap.killTweensOf(this.goalMarker.position);
      this.goalMarker.position.copy(localStart);
      this.goalMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
      gsap.to(this.goalMarker.position, {
        x: localFloat.x, y: localFloat.y, z: localFloat.z,
        duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut',
      });
    }

    // midpointMarker 재배치
    if (this.midpointBlockId && this.midpointMarker) {
      const midMesh = this.level.blocks.get(this.midpointBlockId)?.mesh;
      if (midMesh) {
        midMesh.getWorldPosition(wp);
        const dir      = this._getMarkerDir(this._midpointFace, this._midpointFlipped);
        const startWp  = wp.clone().addScaledVector(dir, 0.55);
        const floatWp  = wp.clone().addScaledVector(dir, 0.85);
        const localStart = toLocal(startWp.x, startWp.y, startWp.z);
        const localFloat = toLocal(floatWp.x, floatWp.y, floatWp.z);
        gsap.killTweensOf(this.midpointMarker.position);
        this.midpointMarker.position.copy(localStart);
        this.midpointMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        gsap.to(this.midpointMarker.position, {
          x: localFloat.x, y: localFloat.y, z: localFloat.z,
          duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut',
        });
      }
    }

    // 텔레포터 링 재배치
    if (this._teleportPadNodes.length > 0) {
      const allNodes = this._teleportPadNodes.flatMap(([a, b]) => [a, b]);
      this.teleportMgr?.repositionRings(allNodes);
    }
  }

  /**
   * mapRotateBlocks 회전 후 착시 연결 재계산.
   * flipPivot.matrixWorld 를 각 블록의 위치/크기에 적용한 뒤
   * 기존 _buildAutoIllusionConns를 호출한다.
   */
  private _buildIllusionConnsWorldSpace(data: LevelData) {
    if (!this.level) return this._buildAutoIllusionConns(data);

    const pivot = this.level.getFlipPivot();
    pivot.updateMatrixWorld(true);
    const mat = pivot.matrixWorld;
    const e   = mat.elements; // column-major

    // 절댓값 회전 성분: |R[row][col]| = |e[col*4 + row]|
    const absR = (row: number, col: number) => Math.abs(e[col * 4 + row]);
    // Y축이 뒤집혔는지 (X축 180° 회전 → R[1][1] < 0)
    const yFlipped = e[5] < 0;

    const transformed = data.blocks.map(b => {
      const [bx, by, bz] = b.position;
      const hw = b.size[0] / 2, hh = b.size[1] / 2, hd = b.size[2] / 2;

      // 블록 중심 월드 좌표
      const cx = e[0]*bx + e[4]*by + e[8]*bz  + e[12];
      const cy = e[1]*bx + e[5]*by + e[9]*bz  + e[13];
      const cz = e[2]*bx + e[6]*by + e[10]*bz + e[14];

      // 월드 AABB 반높이 (항상 양수)
      const nHW = absR(0,0)*hw + absR(0,1)*hh + absR(0,2)*hd;
      const nHH = absR(1,0)*hw + absR(1,1)*hh + absR(1,2)*hd;
      const nHD = absR(2,0)*hw + absR(2,1)*hh + absR(2,2)*hd;

      // Y축 반전 시 "걷는 면"은 월드 AABB 아랫면 (cy - nHH)
      // _buildAutoIllusionConns 에서 topY = position[1] + size[1]/2 이므로
      // position[1] = topFaceY - nHH
      const topFaceY = yFlipped ? cy - nHH : cy + nHH;
      const adjCY    = topFaceY - nHH;

      return {
        ...b,
        position: [cx, adjCY, cz] as [number, number, number],
        size:     [nHW * 2, nHH * 2, nHD * 2] as [number, number, number],
      };
    });

    return this._buildAutoIllusionConns({ ...data, blocks: transformed });
  }

  private _buildAutoIllusionConns(data: LevelData) {
    const blocks = data.blocks;
    const walkable = blocks.filter(b => b.walkable);
    const conns: Array<{
      nodeAId: string; nodeBId: string;
      activateAzimuth: number; azimuthTolerance: number;
      activateElevation: number; elevationTolerance: number;
    }> = [];

    // 착시 허용 오차 (°)
    const AZ_TOL      = 1;
    const EL_TOL      = 1;

    const EL_MIN = -5;  // 카메라 elevation 하한 (여유 포함)
    const EL_MAX = 65;  // 카메라 elevation 상한 (여유 포함)

    const flipAz = (az: number) => az >= 0 ? az - 180 : az + 180;

    const tryRegister = (nodeAId: string, nodeBId: string,
                         fdx: number, fdy: number, fdz: number,
                         azTol: number, elTol: number) => {
      const hd = Math.hypot(fdx, fdz);
      if (hd < 0.01) return;
      const az = Math.atan2(fdx, fdz) * (180 / Math.PI);
      const el = Math.atan2(fdy, hd) * (180 / Math.PI);
      if (el >= EL_MIN && el <= EL_MAX) {
        conns.push({ nodeAId, nodeBId, activateAzimuth: az, azimuthTolerance: azTol, activateElevation: el, elevationTolerance: elTol });
      }
      // B→A 반대 시점
      const elBA = -el;
      if (elBA >= EL_MIN && elBA <= EL_MAX) {
        conns.push({ nodeAId, nodeBId, activateAzimuth: flipAz(az), azimuthTolerance: azTol, activateElevation: elBA, elevationTolerance: elTol });
      }
    };

    for (let i = 0; i < walkable.length; i++) {
      for (let j = i + 1; j < walkable.length; j++) {
        const a = walkable[i];
        const b = walkable[j];

        const A_topY = a.position[1] + a.size[1] / 2;
        const B_topY = b.position[1] + b.size[1] / 2;
        const dx = b.position[0] - a.position[0];
        const dz = b.position[2] - a.position[2];

        // 이미 인접한 블록은 착시 불필요
        const xzDist = Math.hypot(dx, dz);
        const yDiff  = Math.abs(B_topY - A_topY);
        if (xzDist <= 1.1 && yDiff < 0.15) continue;

        const isDiag = Math.abs(dx) > 0.01 && Math.abs(dz) > 0.01;

        // X축 방향 face 쌍: A의 ±x 면 → B의 ∓x 면
        if (Math.abs(dx) > 0.01) {
          const signX = dx > 0 ? 1 : -1;
          const FA = { x: a.position[0] + signX * a.size[0] / 2, y: A_topY, z: a.position[2] };
          const FB = { x: b.position[0] - signX * b.size[0] / 2, y: B_topY, z: b.position[2] };
          tryRegister(a.id, b.id, FB.x - FA.x, FB.y - FA.y, FB.z - FA.z, AZ_TOL, EL_TOL);
        }

        // Z축 방향 face 쌍: A의 ±z 면 → B의 ∓z 면
        if (Math.abs(dz) > 0.01) {
          const signZ = dz > 0 ? 1 : -1;
          const FA = { x: a.position[0], y: A_topY, z: a.position[2] + signZ * a.size[2] / 2 };
          const FB = { x: b.position[0], y: B_topY, z: b.position[2] - signZ * b.size[2] / 2 };
          tryRegister(a.id, b.id, FB.x - FA.x, FB.y - FA.y, FB.z - FA.z, AZ_TOL, EL_TOL);
        }

        // 대각선 배치 추가: center-to-center 벡터로 보완
        if (isDiag) {
          tryRegister(a.id, b.id, dx, B_topY - A_topY, dz, AZ_TOL, EL_TOL);
        }
      }
    }

    // switch-move 블록의 moveTarget 위치에서도 착시 각도 계산
    // movable 블록들을 moveTarget 위치로 대체한 블록 목록으로 한 번 더 계산한다.
    const moveTargets = new Map<string, [number, number, number]>();
    for (const sw of data.switches ?? []) {
      if (sw.type === 'move' && sw.moveTarget) {
        moveTargets.set(sw.targetNodeId, sw.moveTarget);
      }
    }
    if (moveTargets.size > 0) {
      const movedWalkable = walkable.map(b => {
        const mt = moveTargets.get(b.id);
        return mt ? { ...b, position: mt } : b;
      });
      // 원래 위치와 동일한 블록 쌍은 이미 등록됐으므로
      // moveTarget이 적용된 블록이 최소 하나 포함된 쌍만 계산
      for (let i = 0; i < movedWalkable.length; i++) {
        for (let j = i + 1; j < movedWalkable.length; j++) {
          const a = movedWalkable[i];
          const b = movedWalkable[j];
          const aWasMoved = moveTargets.has(a.id);
          const bWasMoved = moveTargets.has(b.id);
          if (!aWasMoved && !bWasMoved) continue; // 둘 다 원래 위치면 이미 등록됨

          const A_topY = a.position[1] + a.size[1] / 2;
          const B_topY = b.position[1] + b.size[1] / 2;
          const dx = b.position[0] - a.position[0];
          const dz = b.position[2] - a.position[2];

          const xzDist = Math.hypot(dx, dz);
          const yDiff  = Math.abs(B_topY - A_topY);
          if (xzDist <= 1.1 && yDiff < 0.15) continue;

          const isDiagM = Math.abs(dx) > 0.01 && Math.abs(dz) > 0.01;

          if (Math.abs(dx) > 0.01) {
            const signX = dx > 0 ? 1 : -1;
            const FA = { x: a.position[0] + signX * a.size[0] / 2, y: A_topY, z: a.position[2] };
            const FB = { x: b.position[0] - signX * b.size[0] / 2, y: B_topY, z: b.position[2] };
            tryRegister(a.id, b.id, FB.x - FA.x, FB.y - FA.y, FB.z - FA.z, AZ_TOL, EL_TOL);
          }
          if (Math.abs(dz) > 0.01) {
            const signZ = dz > 0 ? 1 : -1;
            const FA = { x: a.position[0], y: A_topY, z: a.position[2] + signZ * a.size[2] / 2 };
            const FB = { x: b.position[0], y: B_topY, z: b.position[2] - signZ * b.size[2] / 2 };
            tryRegister(a.id, b.id, FB.x - FA.x, FB.y - FA.y, FB.z - FA.z, AZ_TOL, EL_TOL);
          }
          if (isDiagM) {
            tryRegister(a.id, b.id, dx, B_topY - A_topY, dz, AZ_TOL, EL_TOL);
          }
        }
      }
    }

    return conns;
  }

  /** 튜토리얼: 경로 블록이 모두 올라온 뒤 goal glow/marker를 활성화 */
  private _revealTutorialGoal(): void {
    const goalMesh = this.level?.blocks.get(this.goalBlockId)?.mesh;
    if (!goalMesh || !this.goalGlow) return;

    // 메시가 올라온 뒤 호출되므로 glow 위치를 현재 메시 위치로 갱신
    const wp = new THREE.Vector3();
    goalMesh.getWorldPosition(wp);
    const glowDir = this._getMarkerDir(this._goalFace, this._goalFlipped);
    const glowPos = wp.clone().addScaledVector(glowDir, 1.5);
    const glowLocal = this.level!.getGroup().worldToLocal(glowPos);
    this.goalGlow.position.copy(glowLocal);

    gsap.to(this.goalGlow, { intensity: 0.4, duration: 1.4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
    this.setupGoalMarker(goalMesh);
  }

  /** 현재 flipPivot 회전 기준 중력 방향 (+Y를 현재 회전으로 변환) */
  private _currentGravUp(): THREE.Vector3 {
    const flipPivot = this.level?.getFlipPivot();
    if (!flipPivot) return new THREE.Vector3(0, 1, 0);
    flipPivot.updateMatrixWorld(true);
    const q = new THREE.Quaternion().setFromEuler(flipPivot.rotation);
    return new THREE.Vector3(0, 1, 0).applyQuaternion(q);
  }

  /**
   * 마커(goal/midpoint ring) 배치 방향 벡터를 반환한다.
   * face 지정 시 로컬 face normal을 현재 맵 회전으로 변환.
   * face 미지정 시 중력 방향 또는 반전 방향.
   */
  private _getMarkerDir(face: [number,number,number] | null, flipped: boolean): THREE.Vector3 {
    if (face) {
      const flipPivot = this.level?.getFlipPivot();
      const q = new THREE.Quaternion();
      if (flipPivot) {
        flipPivot.updateMatrixWorld(true);
        q.setFromEuler(flipPivot.rotation);
      }
      return new THREE.Vector3(...face).normalize().applyQuaternion(q);
    }
    const gravUp = this._currentGravUp();
    const effectiveFlipped = this.worldRotateMgr?.isMapFlipped() ?? false;
    const below = flipped !== effectiveFlipped;
    return below ? gravUp.negate() : gravUp;
  }

  /** 조건부 사다리 메시 렌더링용: 블록의 최종 위치(moveTarget 있으면 반영) 반환 */
  private getFinalBlockData(data: LevelData, nodeId: string): BlockData | null {
    const block = data.blocks.find(b => b.id === nodeId);
    if (!block) return null;
    const sw = data.switches?.find(s => s.targetNodeId === nodeId && s.type === 'move' && s.moveTarget);
    if (sw?.moveTarget) {
      return { ...block, position: sw.moveTarget };
    }
    return block;
  }

  private setupGoalMarker(goalMesh: THREE.Object3D): void {
    const wp = new THREE.Vector3();
    goalMesh.getWorldPosition(wp);

    const dir = this._getMarkerDir(this._goalFace, this._goalFlipped);

    const geo = new THREE.TorusGeometry(0.28, 0.055, 8, 24);
    const mat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
    this.goalMarker = new THREE.Mesh(geo, mat);
    this.goalMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

    const startPos = wp.clone().addScaledVector(dir, 0.55);
    const floatPos = wp.clone().addScaledVector(dir, 0.85);
    this.goalMarker.position.copy(startPos);
    this.level!.getGroup().add(this.goalMarker);

    gsap.to(this.goalMarker.position, {
      x: floatPos.x, y: floatPos.y, z: floatPos.z,
      duration: 1.1, yoyo: true, repeat: -1, ease: 'sine.inOut',
    });
  }

  private setupMidpointMarker(midMesh: THREE.Object3D, flipped = false): void {
    const wp = new THREE.Vector3();
    midMesh.getWorldPosition(wp);

    const dir = this._getMarkerDir(this._midpointFace, flipped);

    const geo = new THREE.TorusGeometry(0.28, 0.055, 8, 24);
    const mat = new THREE.MeshLambertMaterial({ color: 0x44DDBB });
    this.midpointMarker = new THREE.Mesh(geo, mat);
    this.midpointMarker.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

    const startPos = wp.clone().addScaledVector(dir, 0.55);
    const floatPos = wp.clone().addScaledVector(dir, 0.85);
    this.midpointMarker.position.copy(startPos);
    this.level!.getGroup().add(this.midpointMarker);

    gsap.to(this.midpointMarker.position, {
      x: floatPos.x, y: floatPos.y, z: floatPos.z,
      duration: 1.3, yoyo: true, repeat: -1, ease: 'sine.inOut',
    });
  }

  /** dev 모드: blinking 가시 속도 조절 패널 생성 */
  private _blinkDevPanel: HTMLElement | null = null;
  private _setupBlinkDevPanel(): void {
    this._blinkDevPanel?.remove();
    const panel = document.createElement('div');
    panel.style.cssText = [
      'position:fixed', 'bottom:60px', 'left:12px', 'z-index:9999',
      'background:rgba(0,0,0,0.75)', 'color:#fff', 'padding:8px 12px',
      'border-radius:6px', 'font:12px/1.6 monospace', 'pointer-events:all',
    ].join(';');

    const makeRow = (label: string, min: number, max: number, step: number, initial: number, onChange: (v: number) => void) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.gap = '6px';
      row.style.marginBottom = '2px';
      const lbl = document.createElement('span');
      lbl.textContent = label;
      lbl.style.minWidth = '90px';
      const slider = document.createElement('input');
      slider.type = 'range';
      slider.min  = String(min);
      slider.max  = String(max);
      slider.step = String(step);
      slider.value = String(initial);
      slider.style.width = '100px';
      const num = document.createElement('span');
      num.textContent = `${initial.toFixed(1)}s`;
      num.style.minWidth = '32px';
      slider.addEventListener('input', () => {
        const v = parseFloat(slider.value);
        num.textContent = `${v.toFixed(1)}s`;
        onChange(v);
      });
      row.appendChild(lbl);
      row.appendChild(slider);
      row.appendChild(num);
      return row;
    };

    const title = document.createElement('div');
    title.textContent = '🗡 Blink Speed (dev)';
    title.style.marginBottom = '4px';
    title.style.fontWeight = 'bold';
    panel.appendChild(title);

    const updateSpeed = () => {
      if (this.level) {
        this.level.setBlinkSpeed(onVal, offVal);
      }
    };
    let onVal  = this.level?.blinkOnDuration  ?? 1.5;
    let offVal = this.level?.blinkOffDuration ?? 1.0;

    panel.appendChild(makeRow('On (active)', 0.5, 5.0, 0.1, onVal,  (v) => { onVal  = v; updateSpeed(); }));
    panel.appendChild(makeRow('Off (hidden)', 0.5, 5.0, 0.1, offVal, (v) => { offVal = v; updateSpeed(); }));

    document.body.appendChild(panel);
    this._blinkDevPanel = panel;
  }

  /** 가시 블록 착지 시 레벨 전체 재시작 (별 등 모든 상태 초기화) */
  private _respawn(): void {
    if (!this.character) return;
    if (this.goalReached) return;
    // 파티클 + 사운드 피드백
    this.particles.burst(this.character.mesh.position.clone(), 0xFF3322, 18, 1.5, 0.8);
    this.audio.playTeleport();
    // 레벨 전체 재로드
    this._reloadCurrentLevel();
  }

  private _reloadCurrentLevel(): void {
    if (this._currentCustomData) {
      this.loadCustomLevel(this._currentCustomData, this._currentCustomExit);
    } else if (this._currentLevelId) {
      this.loadLevel(this._currentLevelId);
    }
  }

  /** 월드 좌표 (x, z)가 속한 구역 반환. 없으면 null */
  private _findZoneAt(worldX: number, worldZ: number): ZoneDef | null {
    for (const zone of this.zoneDefs) {
      if (worldX >= zone.gridX && worldX < zone.gridX + zone.width &&
          worldZ >= zone.gridZ && worldZ < zone.gridZ + zone.depth) {
        return zone;
      }
    }
    return null;
  }

  /** 구역 진입 시 orbit.target을 해당 구역의 중심으로 부드럽게 이동 */
  private _onZoneEnter(zone: ZoneDef): void {
    const tx = zone.gridX + zone.width / 2;
    const ty = 0;
    const tz = zone.gridZ + zone.depth / 2;
    if (this.zoneCameraTween) this.zoneCameraTween.kill();
    this.zoneCameraTween = gsap.to(this.orbit.target, {
      x: tx, y: ty, z: tz,
      duration: 0.8,
      ease: 'power2.inOut',
      onUpdate: () => { this.orbit.update(); },
      onComplete: () => { this.zoneCameraTween = null; },
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
          marker.removeFromParent();
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

    // QA-01: p1/p2 tween 참조와 setTimeout ID 저장 → unloadCurrent()에서 취소
    // ── Phase 1: 골 블록 방향으로 패닝 ──────────────────────────────────
    const p1 = { t: 0 };
    this.midpointCinematicTween = gsap.to(p1, {
      t: 1,
      duration: 1.1,
      ease: 'power2.inOut',
      onUpdate: () => {
        cam.position.lerpVectors(origCamPos, panCamPos, p1.t);
        orbit.target.lerpVectors(origTarget, panTarget, p1.t);
        orbit.update();
      },
      onComplete: () => {
        this.midpointCinematicTween = null;
        // ── Phase 2: 골 링 scale-in ────────────────────────────────────
        this.setupGoalMarker(goalMesh);

        if (this.goalMarker) {
          const ring = this.goalMarker;
          // BUG-16-02: dir 벡터 기반으로 floatPos 계산 — 맵 회전 후에도 올바른 방향으로 떠다님
          const dir      = this._getMarkerDir(this._goalFace, this._goalFlipped);
          const floatPos = ring.position.clone().addScaledVector(dir, 0.3);

          // 이미 시작된 float 트윈을 멈추고 scale-in 후 재시작
          gsap.killTweensOf(ring.position);
          ring.scale.set(0, 0, 0);

          gsap.to(ring.scale, {
            x: 1, y: 1, z: 1,
            duration: 0.55,
            ease: 'back.out(2.5)',
            onComplete: () => {
              gsap.to(ring.position, {
                x: floatPos.x, y: floatPos.y, z: floatPos.z,
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
        this.midpointCinematicTimeout = setTimeout(() => {
          this.midpointCinematicTimeout = null;
          const p2 = { t: 0 };
          this.midpointCinematicTween = gsap.to(p2, {
            t: 1,
            duration: 1.1,
            ease: 'power2.inOut',
            onUpdate: () => {
              cam.position.lerpVectors(panCamPos, origCamPos, p2.t);
              orbit.target.lerpVectors(panTarget, origTarget, p2.t);
              orbit.update();
            },
            onComplete: () => {
              this.midpointCinematicTween = null;
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

  /**
   * QA-09: 별을 모두 수집했으면 골 클리어, 아니면 힌트 표시.
   * 텔레포트/일반 두 경로 모두 이 메서드를 통해 처리한다.
   */
  private _tryGoalReached(): void {
    if (this.starMgr && !this.starMgr.allCollected()) {
      this.tutorialHint.showHint('★ 별을 모두 모아야 해요');
      // BUG-03: timeout 추적 → unloadCurrent()에서 취소
      if (this.starHintTimeout !== null) clearTimeout(this.starHintTimeout);
      this.starHintTimeout = setTimeout(() => {
        this.starHintTimeout = null;
        this.tutorialHint.hideHint();
      }, 2000);
      return;
    }
    this.onGoalReached();
  }

  private onGoalReached(): void {
    if (this.goalReached) return;
    this.goalReached = true;

    this.audio.playGoalReached();

    const goalMesh = (
      this.level?.blocks.get(this.goalBlockId)?.mesh ??
      this.graph?.getNode(this.goalBlockId)?.mesh
    ) ?? null;

    if (goalMesh) {
      const wp = new THREE.Vector3();
      goalMesh.getWorldPosition(wp);
      this.particles.burst(wp, 0xFFD700, 40, 2.5, 1.2);

      // blockDividers=false 시 geometry mesh가 hidden 상태 → 애니메이션 동안만 노출
      if (!GraphicsSettings.blockDividers) {
        goalMesh.traverse(child => {
          if ((child as THREE.Mesh).isMesh && child.userData.isBlock) child.visible = true;
        });
      }

      this.goalMeshScaleTween = gsap.to(goalMesh.scale, {
        x: 1.5, y: 1.5, z: 1.5,
        duration: 0.25,
        ease: 'power2.out',
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          this.goalMeshScaleTween = null;
          goalMesh.scale.set(1, 1, 1);
          if (!GraphicsSettings.blockDividers) {
            goalMesh.traverse(child => {
              if ((child as THREE.Mesh).isMesh && child.userData.isBlock) child.visible = false;
            });
          }
        },
      });
    }

    // QA-02: setTimeout ID 저장 → unloadCurrent()에서 취소
    this.goalClearTimeout = setTimeout(() => {
      this.goalClearTimeout = null;
      if (this.isTutorial) {
        // 튜토리얼 클리어: 완료 기록 후 타이틀 화면으로 이동
        ProgressStore.setTutorialDone();
        ProgressStore.unlockStage(1);
        this.hud.showClear();
        // BUG-01: inner timeout 추적 → unloadCurrent()에서 취소
        this.goalClearInnerTimeout = setTimeout(() => {
          this.goalClearInnerTimeout = null;
          this.titleScreen.show();
        }, 1400);
      } else {
        // 일반 스테이지 클리어: 다음 스테이지 언락 + Next Stage / Stage Select 버튼 표시
        ProgressStore.unlockStage(this.currentStageNum + 1);
        // 월드맵 모드: 챕터 경계 클리어 시 게이트 열기
        this.worldMapScene?.notifyStageCleared(this.currentStageNum);
        const nextNum = this.getNextStageNum();
        const onNext  = nextNum !== null && ProgressStore.isUnlocked(nextNum)
          ? () => { this.audio.playClick(); this.loadStage(nextNum); }
          : undefined;
        const onSelect = () => { this.audio.playClick(); this.chapterSelect.show(); };
        this.hud.showClear(onNext, onSelect);
      }
    }, 800);
  }

  // ── Graphics quality ──────────────────────────────────────────────────

  /**
   * Traverse every Mesh in the scene and swap materials between Lambert (standard)
   * and Standard/PBR (enhanced). Called when the user toggles quality at runtime.
   * Per-face color arrays are preserved; roughness/metalness are added or stripped.
   */
  private _swapSceneMaterials(enhanced: boolean): void {
    this.renderer.scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;

      const swap = (m: THREE.Material): THREE.Material => {
        if (enhanced && m instanceof THREE.MeshLambertMaterial) {
          const next = new THREE.MeshStandardMaterial({
            color:             m.color.clone(),
            transparent:       m.transparent,
            opacity:           m.opacity,
            emissive:          m.emissive.clone(),
            emissiveIntensity: m.emissiveIntensity,
            roughness:         0.72,
            metalness:         0.04,
          });
          m.dispose();
          return next;
        }
        if (!enhanced && m instanceof THREE.MeshStandardMaterial) {
          const next = new THREE.MeshLambertMaterial({
            color:             m.color.clone(),
            transparent:       m.transparent,
            opacity:           m.opacity,
            emissive:          m.emissive.clone(),
            emissiveIntensity: m.emissiveIntensity,
          });
          m.dispose();
          return next;
        }
        return m;
      };

      if (Array.isArray(obj.material)) {
        obj.material = obj.material.map(swap);
      } else {
        obj.material = swap(obj.material);
      }
    });
  }

  // ── Render loop ───────────────────────────────────────────────────────

  private animate(): void {
    requestAnimationFrame(this.animate);

    if (this._worldMapActive && this.worldMapScene) {
      this.orbit.update();
      this.worldMapScene.update();
      this.renderer.render();
      return;
    }

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

    if (this.graph) this.elevatorMgr?.update(this.graph);
    if (this.graph) this.patrolMgr?.update(this.graph);
    this.level?.update();
    this.controller?.update();
    if (this.enemyMgr) {
      const playerNode = this.controller?.getCurrentNode() ?? null;
      this.enemyMgr.update(playerNode);
    }
    // 레이저 빔 위치 갱신 + 이동 중 충돌 체크
    if (this.laserMgr) {
      this.laserMgr.update();
      const playerNode = this.controller?.getCurrentNode();
      if (playerNode && this.laserMgr.isNodeInLaser(playerNode)) {
        this._respawn();
      }
    }
    // 대포 포탄 업데이트 + 충돌 체크
    if (this.cannonMgr) {
      this.cannonMgr.update();
      const playerNode = this.controller?.getCurrentNode();
      if (playerNode && this.cannonMgr.isPlayerHit(playerNode)) {
        this._respawn();
      }
    }
    // 고드름 충돌 체크
    if (this.icicleMgr) {
      const playerNode = this.controller?.getCurrentNode();
      if (playerNode && this.icicleMgr.isPlayerHit(playerNode)) {
        this._respawn();
      }
    }
    this.renderer.render();
  }
}
