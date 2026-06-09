import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { GraphicsSettings } from './GraphicsSettings';

export class Renderer {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;

  private frustumSize = 10;

  private ambientLight!: THREE.AmbientLight;
  private dirLight!: THREE.DirectionalLight;
  private hemiLight!: THREE.HemisphereLight;
  private pmremGenerator!: THREE.PMREMGenerator;

  private _onWindowResize!: () => void;
  private _onViewportResize!: () => void;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xF5F0E8);
    this.scene.fog = new THREE.FogExp2(0xF5F0E8, 0.032);

    const aspect = container.clientWidth / container.clientHeight;
    const f = this.frustumSize;
    this.camera = new THREE.OrthographicCamera(
      -f * aspect / 2,
       f * aspect / 2,
       f / 2,
      -f / 2,
      -100,
       100
    );
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    container.appendChild(this.renderer.domElement);

    this.pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.pmremGenerator.compileEquirectangularShader();

    this.setupLights();

    // 조명/쉐이더 품질 적용 (배경색은 건드리지 않음)
    this.applyQuality(GraphicsSettings.enhanced);
    // 저장된 조명 오버라이드 적용 (모드 기본값을 덮어씀)
    this.applyLightingOverrides();
    // 배경색은 applyQuality와 분리하여 독립적으로 관리
    this.applyBackgroundColor(GraphicsSettings.getEffectiveBgColor());

    this._onWindowResize   = () => this.onResize(container);
    this._onViewportResize = () => this.onResize(container);
    window.addEventListener('resize', this._onWindowResize);
    window.visualViewport?.addEventListener('resize', this._onViewportResize);
  }

  private setupLights(): void {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(this.ambientLight);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    this.dirLight.position.set(8, 16, 8);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.camera.near = 0.1;
    this.dirLight.shadow.camera.far  = 100;
    this.dirLight.shadow.camera.left   = -15;
    this.dirLight.shadow.camera.right  =  15;
    this.dirLight.shadow.camera.top    =  15;
    this.dirLight.shadow.camera.bottom = -15;
    this.scene.add(this.dirLight);

    this.hemiLight = new THREE.HemisphereLight(0xA8D8EA, 0xFCBAD3, 0.4);
    this.scene.add(this.hemiLight);
  }

  /**
   * 조명 품질 / 그림자 / 톤매핑 / 환경맵을 전환한다.
   * 배경색은 건드리지 않는다 — applyBackgroundColor()가 단독으로 담당.
   */
  public applyQuality(enhanced: boolean): void {
    // QA-13: 이전 환경맵 텍스처 해제 후 교체
    if (this.scene.environment) {
      (this.scene.environment as THREE.Texture).dispose();
      this.scene.environment = null;
    }

    if (enhanced) {
      this.renderer.toneMapping    = THREE.ACESFilmicToneMapping;
      this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const env = new RoomEnvironment();
      const envTexture = this.pmremGenerator.fromScene(env).texture;
      env.dispose();
      this.scene.environment = envTexture;

      this.ambientLight.color.set(0xfff5ee);
      this.ambientLight.intensity = 0.32;
      this.dirLight.intensity = 1.45;
      this.dirLight.shadow.mapSize.set(2048, 2048);
      this.hemiLight.intensity = 0.45;

      // 안개 밀도만 조정 (색상은 applyBackgroundColor에서 처리)
      (this.scene.fog as THREE.FogExp2).density = 0.028;
    } else {
      this.renderer.toneMapping        = THREE.NoToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.shadowMap.type      = THREE.PCFShadowMap;

      this.scene.environment = null;

      this.ambientLight.color.set(0xffffff);
      this.ambientLight.intensity = 0.6;
      this.dirLight.intensity = 1.2;
      this.dirLight.shadow.mapSize.set(1024, 1024);
      this.hemiLight.intensity = 0.4;

      (this.scene.fog as THREE.FogExp2).density = 0.032;
    }

    this.renderer.shadowMap.needsUpdate = true;
  }

  /**
   * 배경색과 포그 색을 항상 함께 변경한다.
   * Level.load()가 scene.background를 새 객체로 교체하므로,
   * 여기서도 교체 방식으로 처리해 참조 불일치를 방지한다.
   */
  /**
   * 저장된 조명 강도 오버라이드를 적용한다.
   * applyQuality() 이후에 호출해야 모드 기본값 위에 덮어쓴다.
   */
  public applyLightingOverrides(): void {
    const a = GraphicsSettings.lightAmbient;
    const d = GraphicsSettings.lightDir;
    const h = GraphicsSettings.lightHemi;
    if (a !== null) this.ambientLight.intensity = a;
    if (d !== null) this.dirLight.intensity = d;
    if (h !== null) this.hemiLight.intensity = h;
    // Exposure: Enhanced 모드에서만 유효, Standard는 NoToneMapping이라 렌더러가 무시
    this.renderer.toneMappingExposure = GraphicsSettings.getEffectiveExposure();
  }

  public applyBackgroundColor(hexStr: string): void {
    const color = new THREE.Color(hexStr);
    this.scene.background = color.clone();            // 항상 교체
    (this.scene.fog as THREE.FogExp2).color.copy(color);
  }

  private onResize(container: HTMLElement): void {
    const aspect = container.clientWidth / container.clientHeight;
    const f = this.frustumSize;
    this.camera.left   = -f * aspect / 2;
    this.camera.right  =  f * aspect / 2;
    this.camera.top    =  f / 2;
    this.camera.bottom = -f / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  public render = (): void => {
    this.renderer.render(this.scene, this.camera);
  };

  public dispose(): void {
    window.removeEventListener('resize', this._onWindowResize);
    window.visualViewport?.removeEventListener('resize', this._onViewportResize);
  }
}
