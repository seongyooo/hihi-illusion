import * as THREE from 'three';
import gsap from 'gsap';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PathGraph } from '../world/PathGraph';
import type { BlockData } from '../world/Level';
import { Character } from '../character/Character';
import { CharacterController } from '../character/CharacterController';
import { InputManager } from '../core/InputManager';
import { CUSTOM_STAGE_NUMS } from '../levels/registry';
import { ProgressStore } from '../core/ProgressStore';
import { GraphicsSettings } from '../core/GraphicsSettings';

const PAGE_SIZE = 30;

const CHAPTER_COLORS = ['#7055bb', '#cc6640', '#30996e', '#bba020', '#4080bb'];

interface GateEntry {
  chapter:     number;
  x:           number;
  barrierMesh: THREE.Mesh | null;
}

export class WorldMapScene {
  private scene:  THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private orbit:  OrbitControls;
  private canvas: HTMLCanvasElement;

  private mapGroup    = new THREE.Group();
  private graph       = new PathGraph();
  private character:  Character | null = null;
  private controller: CharacterController | null = null;
  private input:      InputManager | null = null;

  private blockMeshes  = new Map<string, THREE.Mesh>();
  private gates        = new Map<number, GateEntry>();
  private walkableData: BlockData[] = [];
  private totalChapters = 1;

  private backBtn:  HTMLElement;
  private _visible  = false;
  private _gsapTweens: gsap.core.Tween[] = [];

  onChapterSelect: (chapter: number) => void = () => {};
  onBack:          () => void                = () => {};

  constructor(
    scene:     THREE.Scene,
    camera:    THREE.OrthographicCamera,
    orbit:     OrbitControls,
    canvas:    HTMLCanvasElement,
    container: HTMLElement,
  ) {
    this.scene  = scene;
    this.camera = camera;
    this.orbit  = orbit;
    this.canvas = canvas;

    this.backBtn = document.createElement('button');
    this.backBtn.textContent = '← Back';
    this.backBtn.className = 'stage-select__back';
    this.backBtn.style.display = 'none';
    this.backBtn.addEventListener('click', () => this.onBack());
    container.appendChild(this.backBtn);
  }

  show(): void {
    if (this._visible) return;
    this._visible = true;
    this._computeChapters();
    this._buildMap();
    this._buildCharacter();
    this._buildInput();
    this._setupCamera();
    this.backBtn.style.display = '';
  }

  hide(): void {
    if (!this._visible) return;
    this._visible = false;
    this.backBtn.style.display = 'none';
    this._teardown();
  }

  update(): void {
    if (!this._visible) return;
    this.controller?.update();
    // smooth camera follow
    const node = this.controller?.getCurrentNode();
    if (node) {
      const tx = this.orbit.target.x + (node.position.x - this.orbit.target.x) * 0.06;
      this.orbit.target.set(tx, 0.5, 0.5);
      this.orbit.update();
    }
  }

  /** Call after any stage is cleared — opens gate if chapter boundary crossed */
  notifyStageCleared(stageNum: number): void {
    if (!this._visible) return;
    if (stageNum % PAGE_SIZE !== 0) return; // not last stage of chapter
    const chapter = stageNum / PAGE_SIZE;
    this._openGate(chapter);
  }

  dispose(): void {
    this._teardown();
    this.backBtn.remove();
  }

  // ── private ──────────────────────────────────────────────────────────────

  private _computeChapters(): void {
    const maxStage = CUSTOM_STAGE_NUMS.length > 0 ? Math.max(...CUSTOM_STAGE_NUMS) : PAGE_SIZE;
    this.totalChapters = Math.ceil(maxStage / PAGE_SIZE);
  }

  private _buildMap(): void {
    this.walkableData = [];
    this.blockMeshes.clear();
    this.gates.clear();
    this._gsapTweens = [];
    this.mapGroup = new THREE.Group();
    this.scene.add(this.mapGroup);

    // Dark background plane
    const bgW = this.totalChapters * 4 + 3;
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(bgW, 4),
      new THREE.MeshBasicMaterial({ color: 0x0d0d1a }),
    );
    bg.rotation.x = -Math.PI / 2;
    bg.position.set(bgW / 2 - 0.5, -0.01, 0.5);
    this.mapGroup.add(bg);

    // Ambient light for world map
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    ambient.name = 'wm_ambient';
    this.mapGroup.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.6);
    dirLight.position.set(3, 8, 5);
    dirLight.name = 'wm_dir';
    this.mapGroup.add(dirLight);

    // Start block
    this._addBlock({ id: 'wm_start', position: [0.5, 0.25, 0.5], size: [1, 0.5, 1], color: '#667788', walkable: true });

    for (let ch = 1; ch <= this.totalChapters; ch++) {
      const bx = (ch - 1) * 4;
      const chColor = CHAPTER_COLORS[(ch - 1) % CHAPTER_COLORS.length];

      // Path block before portal
      this._addBlock({ id: `wm_path_${ch}a`, position: [bx + 1.5, 0.25, 0.5], size: [1, 0.5, 1], color: '#667788', walkable: true });

      // Chapter portal
      const portalMesh = this._addBlock({ id: `wm_ch_${ch}`, position: [bx + 2.5, 0.25, 0.5], size: [1, 0.5, 1], color: chColor, walkable: true });
      this._addPortalDeco(portalMesh, new THREE.Color(chColor));

      if (ch < this.totalChapters) {
        // Path block after portal
        this._addBlock({ id: `wm_path_${ch}b`, position: [bx + 3.5, 0.25, 0.5], size: [1, 0.5, 1], color: '#667788', walkable: true });

        const gateX = bx + 4.5;
        if (this._isGateUnlocked(ch)) {
          this._addBlock({ id: `wm_gate_${ch}`, position: [gateX, 0.25, 0.5], size: [1, 0.5, 1], color: '#8899aa', walkable: true });
          this.gates.set(ch, { chapter: ch, x: gateX, barrierMesh: null });
        } else {
          const barrier = this._makeBarrier(gateX);
          this.mapGroup.add(barrier);
          this.gates.set(ch, { chapter: ch, x: gateX, barrierMesh: barrier });
        }
      }
    }

    this.graph.build(this.walkableData, (id) => this.blockMeshes.get(id));
  }

  private _addBlock(bd: BlockData): THREE.Mesh {
    this.walkableData.push(bd);
    const [bx, by, bz] = bd.position;
    const [bw, bh, bdp] = bd.size;
    const geo  = new THREE.BoxGeometry(bw - 0.05, bh, bdp - 0.05);
    const mat  = new THREE.MeshLambertMaterial({ color: new THREE.Color(bd.color) });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(bx, by, bz);
    mesh.userData.blockId = bd.id;
    mesh.castShadow = true;
    this.blockMeshes.set(bd.id, mesh);
    this.mapGroup.add(mesh);
    return mesh;
  }

  private _makeBarrier(x: number): THREE.Mesh {
    const geo  = new THREE.BoxGeometry(0.85, 1.2, 0.85);
    const mat  = new THREE.MeshLambertMaterial({ color: 0x223344 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.5 + 0.6, 0.5); // block top + half height
    mesh.castShadow = true;
    return mesh;
  }

  private _addPortalDeco(parent: THREE.Mesh, color: THREE.Color): void {
    // Pulsing ring on top
    const ringGeo = new THREE.TorusGeometry(0.3, 0.05, 6, 18);
    const ringMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(1.8), transparent: true, opacity: 0.9 });
    const ring    = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.29;
    parent.add(ring);
    const t = gsap.to(ringMat, { opacity: 0.2, duration: 0.9, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    this._gsapTweens.push(t);

    // Floating small cube
    const cubeGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
    const cubeMat = new THREE.MeshBasicMaterial({ color: color.clone().multiplyScalar(2.5) });
    const cube    = new THREE.Mesh(cubeGeo, cubeMat);
    cube.position.y = 0.45;
    parent.add(cube);
    const t2 = gsap.to(cube.position, { y: 0.62, duration: 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut' });
    const t3 = gsap.to(cube.rotation, { y: Math.PI * 2, duration: 2.5, repeat: -1, ease: 'none' });
    this._gsapTweens.push(t2, t3);
  }

  private _buildCharacter(): void {
    const startNode = this.graph.getNode('wm_start');
    if (!startNode) return;

    this.character = new Character('default');
    this.character.setBodyColor(GraphicsSettings.characterBodyColor);
    this.character.setHeadColor(GraphicsSettings.characterHeadColor);
    this.scene.add(this.character.mesh);
    this.character.mesh.position.set(startNode.position.x, startNode.position.y + 0.32, startNode.position.z);

    this.controller = new CharacterController(
      this.character,
      (s, e) => this.graph.findPath(s, e),
      startNode,
      { onArrival: (nodeId) => this._onArrival(nodeId) },
    );
  }

  private _buildInput(): void {
    this.input = new InputManager(
      this.canvas,
      this.camera,
      [...this.blockMeshes.values()],
      {
        onBlockClick: (blockId) => {
          const node = this.graph.getNode(blockId);
          if (node && this.controller) this.controller.moveTo(node);
        },
        onSectionDrag: () => {},
        onSectionSnap: () => {},
      },
    );
    this.input.setOrbitControls(this.orbit);
  }

  private _setupCamera(): void {
    const az  = 225 * (Math.PI / 180);
    const pol = 52  * (Math.PI / 180);
    const d   = Math.max(10, 9 + this.totalChapters * 0.4);
    this.orbit.target.set(0.5, 0.5, 0.5);
    this.camera.position.set(
      0.5 + d * Math.sin(pol) * Math.sin(az),
      0.5 + d * Math.cos(pol),
      0.5 + d * Math.sin(pol) * Math.cos(az),
    );
    this.orbit.update();
  }

  private _onArrival(nodeId: string): void {
    const m = nodeId.match(/^wm_ch_(\d+)$/);
    if (!m) return;
    const ch = parseInt(m[1]);
    const firstStage = (ch - 1) * PAGE_SIZE + 1;
    if (ch === 1 ? ProgressStore.isTutorialDone() : ProgressStore.isUnlocked(firstStage)) {
      setTimeout(() => this.onChapterSelect(ch), 200);
    }
  }

  private _isGateUnlocked(chapter: number): boolean {
    return ProgressStore.isUnlocked(chapter * PAGE_SIZE + 1);
  }

  private _openGate(chapter: number): void {
    const gate = this.gates.get(chapter);
    if (!gate || !gate.barrierMesh) return;

    const barrier = gate.barrierMesh;
    gate.barrierMesh = null;

    gsap.to(barrier.scale,    { y: 0,    duration: 0.55, ease: 'power2.in' });
    gsap.to(barrier.position, { y: -0.5, duration: 0.55, ease: 'power2.in',
      onComplete: () => {
        barrier.removeFromParent();
        (barrier.material as THREE.Material).dispose();
        barrier.geometry.dispose();
      },
    });

    // Add walkable gate block after animation
    setTimeout(() => {
      const gateId = `wm_gate_${chapter}`;
      const bd: BlockData = { id: gateId, position: [gate.x, 0.25, 0.5], size: [1, 0.5, 1], color: '#8899aa', walkable: true };
      const mesh = this._addBlock(bd);
      mesh.scale.y = 0;
      gsap.to(mesh.scale, { y: 1, duration: 0.5, ease: 'back.out(1.5)' });

      this.graph.build(this.walkableData, (id) => this.blockMeshes.get(id));
      this.input?.addTarget(mesh);
    }, 650);
  }

  private _teardown(): void {
    for (const t of this._gsapTweens) t.kill();
    this._gsapTweens = [];

    this.input?.dispose();
    this.input = null;

    this.controller?.dispose();
    this.controller = null;

    if (this.character) {
      gsap.killTweensOf(this.character.mesh.position);
      gsap.killTweensOf(this.character.mesh.rotation);
      this.character.mesh.removeFromParent();
      this.character.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
      this.character = null;
    }

    this.blockMeshes.forEach(mesh => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    });
    this.blockMeshes.clear();

    this.gates.forEach(g => {
      if (g.barrierMesh) {
        g.barrierMesh.geometry.dispose();
        (g.barrierMesh.material as THREE.Material).dispose();
      }
    });
    this.gates.clear();

    this.mapGroup.removeFromParent();
  }
}
