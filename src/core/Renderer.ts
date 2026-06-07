import * as THREE from 'three';

export class Renderer {
  public renderer: THREE.WebGLRenderer;
  public scene: THREE.Scene;
  public camera: THREE.OrthographicCamera;

  private frustumSize = 10;

  constructor(container: HTMLElement) {
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xF5F0E8);

    // Orthographic camera (isometric view)
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

    // Subtle fog — blends distant geometry into background
    this.scene.fog = new THREE.FogExp2(0xF5F0E8, 0.032);

    // Isometric angle: 45° azimuth, arctan(1/sqrt(2)) ≈ 35.264° elevation
    this.camera.position.set(10, 10, 10);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    container.appendChild(this.renderer.domElement);

    // Lighting
    this.setupLights();

    // Resize handler
    window.addEventListener('resize', () => this.onResize(container));
  }

  private setupLights(): void {
    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(8, 16, 8);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.set(1024, 1024);
    dirLight.shadow.camera.near = 0.1;
    dirLight.shadow.camera.far = 100;
    dirLight.shadow.camera.left = -15;
    dirLight.shadow.camera.right = 15;
    dirLight.shadow.camera.top = 15;
    dirLight.shadow.camera.bottom = -15;
    this.scene.add(dirLight);

    const hemi = new THREE.HemisphereLight(0xA8D8EA, 0xFCBAD3, 0.4);
    this.scene.add(hemi);
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
}
