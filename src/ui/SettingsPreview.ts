import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GraphicsSettings, EXPOSURE_DEFAULT } from '../core/GraphicsSettings';
import { buildBlockMeshGroup, recolorBlockGroup } from '../world/Block';
import { StarBackground } from '../world/StarBackground';

// 프리뷰 전용 기본 블록 색상 (설정 오버라이드 없을 때 표시)
const BLOCK1_HEX = 0xA8D8EA;
const BLOCK2_HEX = 0xC8B5E8;

export class SettingsPreview {
  public readonly el: HTMLElement;

  private renderer:  THREE.WebGLRenderer;
  private scene:     THREE.Scene;
  private camera:    THREE.OrthographicCamera;

  private block1:    THREE.Group;
  private block2:    THREE.Group;
  private charBody:  THREE.Mesh;
  private charHead:  THREE.Mesh;

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

    // ── Preview objects ───────────────────────────────────────────────
    // 블록 1 (앞쪽, 캐릭터가 올라서는 블록) — [1, 0.5, 1] 실제 레벨과 동일 비율
    this.block1 = buildBlockMeshGroup(BLOCK1_HEX, [1, 0.5, 1]);
    this.block1.position.set(0.6, 0, 0.6);
    this.block1.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.scene.add(this.block1);

    // 블록 2 (뒤쪽)
    this.block2 = buildBlockMeshGroup(BLOCK2_HEX, [1, 0.5, 1]);
    this.block2.position.set(-0.6, 0, -0.6);
    this.block2.traverse(c => { if (c instanceof THREE.Mesh) { c.castShadow = true; c.receiveShadow = true; } });
    this.scene.add(this.block2);

    // 캐릭터 (블록 1 위)
    this.charBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.40, 0.28),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(GraphicsSettings.characterBodyColor) }),
    );
    this.charBody.position.set(0.6, 0.70, 0.6);
    this.charBody.castShadow = true;
    this.scene.add(this.charBody);

    this.charHead = new THREE.Mesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      new THREE.MeshLambertMaterial({ color: new THREE.Color(GraphicsSettings.characterHeadColor) }),
    );
    this.charHead.position.set(0.6, 1.01, 0.6);
    this.charHead.castShadow = true;
    this.scene.add(this.charHead);

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
      this.renderer.toneMapping        = THREE.NoToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.shadowMap.type      = THREE.PCFShadowMap;
      this.scene.environment = null;
    }
    this.renderer.shadowMap.needsUpdate = true;

    // 조명 — 모드 기본값 위에 오버라이드 적용
    const defs = GraphicsSettings.getLightDefaults();
    this.ambLight.intensity  = GraphicsSettings.lightAmbient ?? defs.ambient;
    this.dirLight.intensity  = GraphicsSettings.lightDir     ?? defs.dir;
    this.hemiLight.intensity = GraphicsSettings.lightHemi    ?? defs.hemi;
    this.ambLight.color.set(enhanced ? 0xfff5ee : 0xffffff);

    // 블록 색상 + variant — Group 전체를 recolorBlockGroup으로 갱신
    const override  = GraphicsSettings.blockColorOverride;
    const variant   = GraphicsSettings.blockVariant as import('../world/Block').BlockVariant;
    const b1 = override ? parseInt(override.replace('#', ''), 16) : BLOCK1_HEX;
    const b2 = override ? parseInt(override.replace('#', ''), 16) : BLOCK2_HEX;
    recolorBlockGroup(this.block1, b1, variant);
    recolorBlockGroup(this.block2, b2, variant);

    // 캐릭터 색상 & 재질 (품질 모드에 맞춤)
    const bodyColor = new THREE.Color(GraphicsSettings.characterBodyColor);
    const headColor = new THREE.Color(GraphicsSettings.characterHeadColor);
    this.replaceCharMat(this.charBody, bodyColor, enhanced);
    this.replaceCharMat(this.charHead, headColor, enhanced);
  }

  dispose(): void {
    cancelAnimationFrame(this.rafId);
    this.starBg.dispose();
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

  private replaceCharMat(mesh: THREE.Mesh, color: THREE.Color, enhanced: boolean): void {
    (mesh.material as THREE.Material).dispose();
    mesh.material = enhanced
      ? new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05 })
      : new THREE.MeshLambertMaterial({ color });
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
