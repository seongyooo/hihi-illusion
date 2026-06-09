import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GraphicsSettings } from '../core/GraphicsSettings';
import { buildBlockMeshGroup, recolorBlockGroup } from '../world/Block';
import type { BlockVariant } from '../world/Block';
import { StarBackground } from '../world/StarBackground';
import { Character } from '../character/Character';
import type { CharacterType } from '../character/Character';

// 프리뷰 전용 기본 블록 색상 (설정 오버라이드 없을 때 표시)
const BLOCK1_HEX = 0xA8D8EA;
const BLOCK2_HEX = 0xC8B5E8;

// 블록 1 top surface y: block center y=0 + halfHeight(0.5/2=0.25) = 0.25
const CHAR_BASE_Y = 0.25;

export class SettingsPreview {
  public readonly el: HTMLElement;

  private renderer:  THREE.WebGLRenderer;
  private scene:     THREE.Scene;
  private camera:    THREE.OrthographicCamera;

  private block1:    THREE.Group;
  private block2:    THREE.Group;
  private previewRadius = -1; // 마지막으로 구축한 radius — rebuild 여부 판단용

  /** 현재 프리뷰에 올라가 있는 캐릭터 */
  private charPreview: Character;
  /** 마지막으로 구축한 캐릭터 타입 / 품질 모드 — rebuild 여부 판단용 */
  private charPreviewType = '';
  private charPreviewEnh  = false;

  private ambLight:  THREE.AmbientLight;
  private dirLight:  THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;

  private starBg:     StarBackground;
  private pmrem:      THREE.PMREMGenerator;
  private envTexture: THREE.Texture | null = null;
  private rafId = 0;

  constructor(width = 220, height = 220) {
    this.el = document.createElement('div');
    this.el.className = 'settings-preview';

    // ── Renderer ──────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = true;
    this.el.appendChild(this.renderer.domElement);

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();

    // ── Scene & Camera (isometric) ────────────────────────────────────
    this.scene = new THREE.Scene();

    // 미니 별 배경 (반지름 8 — 프리뷰 씬 크기에 맞춤)
    this.starBg = new StarBackground(this.scene, { starCount: 400, radius: 8 });

    const f = 2.0;
    this.camera = new THREE.OrthographicCamera(-f, f, f, -f, -50, 50);
    this.camera.position.set(6, 6, 6);
    this.camera.lookAt(0, 0.3, 0);

    // ── Lights ────────────────────────────────────────────────────────
    this.ambLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(8, 16, 8);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(512, 512);
    this.dirLight.shadow.camera.near   = 0.1;
    this.dirLight.shadow.camera.far    = 50;
    this.dirLight.shadow.camera.left   = -5;
    this.dirLight.shadow.camera.right  =  5;
    this.dirLight.shadow.camera.top    =  5;
    this.dirLight.shadow.camera.bottom = -5;
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(0xA8D8EA, 0xFCBAD3, 0.4);
    this.scene.add(this.hemiLight);

    // ── 블록 ──────────────────────────────────────────────────────────
    this.block1 = buildBlockMeshGroup(BLOCK1_HEX, [1, 0.5, 1]);
    this.block1.position.set(0.6, 0, 0.6);
    this.block1.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.scene.add(this.block1);

    this.block2 = buildBlockMeshGroup(BLOCK2_HEX, [1, 0.5, 1]);
    this.block2.position.set(-0.6, 0, -0.6);
    this.block2.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.scene.add(this.block2);

    // ── 캐릭터 (블록 1 위) ────────────────────────────────────────────
    this.charPreview = this._buildChar();

    this.refresh();
    // 루프는 show() → resumeLoop() 시점에만 시작 (QA-16)
  }

  // ── Public API ─────────────────────────────────────────────────────

  /** 현재 GraphicsSettings를 읽어 씬 전체를 갱신한다. 설정값 변경 시 호출. */
  refresh(): void {
    // 배경색 + 별 배경
    this.scene.background = new THREE.Color(GraphicsSettings.getEffectiveBgColor());
    this.starBg.setVisible(GraphicsSettings.starBackground);

    // 렌더링 품질 & 환경맵
    const enhanced = GraphicsSettings.enhanced;
    if (enhanced) {
      this.renderer.toneMapping         = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = GraphicsSettings.getEffectiveExposure();
      this.renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
      if (!this.envTexture) {
        const env = new RoomEnvironment();
        this.envTexture = this.pmrem.fromScene(env).texture;
        env.dispose();
      }
      this.scene.environment = this.envTexture;
    } else {
      this.renderer.toneMapping         = THREE.NoToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.shadowMap.type      = THREE.PCFShadowMap;
      this.scene.environment = null;
    }
    this.renderer.shadowMap.needsUpdate = true;

    // 조명
    const defs = GraphicsSettings.getLightDefaults();
    this.ambLight.intensity  = GraphicsSettings.lightAmbient ?? defs.ambient;
    this.dirLight.intensity  = GraphicsSettings.lightDir     ?? defs.dir;
    this.hemiLight.intensity = GraphicsSettings.lightHemi    ?? defs.hemi;
    this.ambLight.color.set(enhanced ? 0xfff5ee : 0xffffff);

    // 블록 색상 + variant (radius 변경 시 geometry 재구축 포함)
    const override  = GraphicsSettings.blockColorOverride;
    const variant   = GraphicsSettings.blockVariant as import('../world/Block').BlockVariant;
    const b1hex = override ? parseInt(override.replace('#', ''), 16) : BLOCK1_HEX;
    const b2hex = override ? parseInt(override.replace('#', ''), 16) : BLOCK2_HEX;

    if (GraphicsSettings.blockRadiusRatio !== this.previewRadius) {
      this._rebuildPreviewBlocks(b1hex, b2hex, variant);
    } else {
      recolorBlockGroup(this.block1, b1hex, variant);
      recolorBlockGroup(this.block2, b2hex, variant);
    }

    // 캐릭터 — 타입 또는 품질 모드가 바뀌면 재구축
    const newType = GraphicsSettings.characterType;
    if (newType !== this.charPreviewType || enhanced !== this.charPreviewEnh) {
      this._disposeChar();
      this.charPreview = this._buildChar();
    }
    this.charPreview.setBodyColor(GraphicsSettings.characterBodyColor);
    this.charPreview.setHeadColor(GraphicsSettings.characterHeadColor);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.starBg.dispose();
    this._disposeChar();
    this.scene.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return;
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => (m as THREE.Material).dispose());
    });
    this.envTexture?.dispose();
    this.pmrem.dispose();
    this.renderer.dispose();
  }

  // ── Private ────────────────────────────────────────────────────────

  private _rebuildPreviewBlocks(b1hex: number, b2hex: number, variant: BlockVariant): void {
    // 기존 블록 제거 + dispose
    this.scene.remove(this.block1);
    this.scene.remove(this.block2);
    for (const g of [this.block1, this.block2]) {
      g.traverse(c => {
        if (!(c instanceof THREE.Mesh)) return;
        c.geometry.dispose();
        (c.material as THREE.Material).dispose();
      });
    }

    // 새 블록 생성
    this.block1 = buildBlockMeshGroup(b1hex, [1, 0.5, 1], variant);
    this.block1.position.set(0.6, 0, 0.6);
    this.block1.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });

    this.block2 = buildBlockMeshGroup(b2hex, [1, 0.5, 1], variant);
    this.block2.position.set(-0.6, 0, -0.6);
    this.block2.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });

    this.scene.add(this.block1, this.block2);
    this.previewRadius = GraphicsSettings.blockRadiusRatio;
  }

  private _buildChar(): Character {
    const type = GraphicsSettings.characterType as CharacterType;
    const char = new Character(type);
    char.mesh.position.set(0.6, CHAR_BASE_Y, 0.6);
    char.mesh.traverse(c => { if (c instanceof THREE.Mesh) c.castShadow = true; });
    this.scene.add(char.mesh);
    this.charPreviewType = type;
    this.charPreviewEnh  = GraphicsSettings.enhanced;
    return char;
  }

  private _disposeChar(): void {
    this.charPreview.stopWalk();
    this.scene.remove(this.charPreview.mesh);
    this.charPreview.mesh.traverse(c => {
      if (!(c instanceof THREE.Mesh)) return;
      c.geometry.dispose();
      const mats = Array.isArray(c.material) ? c.material : [c.material];
      mats.forEach(m => (m as THREE.Material).dispose());
    });
  }

  pauseLoop(): void {
    cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  resumeLoop(): void {
    if (this.rafId === 0) this.startLoop();
  }

  private startLoop(): void {
    const loop = () => {
      this.rafId = requestAnimationFrame(loop);
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }
}
