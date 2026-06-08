import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LevelData } from '../world/Level';
import { Block } from '../world/Block';
import { CustomLevelStore } from './CustomLevelStore';

const FACE_BRIGHTNESS = [0.82, 0.65, 1.0, 0.45, 0.70, 0.55];

// ── Types ─────────────────────────────────────────────────────────────────────

interface EditorBlock {
  id: string;
  floor: number;
  gridX: number;
  gridZ: number;
  color: string;
  walkable: boolean;
  mesh: THREE.Group;  // Block.mesh (THREE.Group with per-face materials)
}

interface IllusionConn {
  nodeA: string;
  nodeB: string;
  azimuth: number;
  azimuthTol: number;
  elevation: number;
  elevationTol: number;
}

interface SwitchConn {
  switchNodeId: string;
  targetNodeId: string;
  mode: 'hold' | 'toggle';
  type: 'spawn' | 'move';
}

type Tool = 'place' | 'erase' | 'select';

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_SIZE = 14;
const DEFAULT_COLOR = '#A8C5DA';

// ── Helpers ───────────────────────────────────────────────────────────────────

function blockWorldPos(gridX: number, floor: number, gridZ: number): THREE.Vector3 {
  return new THREE.Vector3(gridX + 0.5, floor * 0.5 + 0.25, gridZ + 0.5);
}

function floorY(floor: number): number {
  return floor * 0.5;
}

// ── LevelEditor ───────────────────────────────────────────────────────────────

export class LevelEditor {
  // DOM
  private el: HTMLElement;
  private viewportEl: HTMLElement;
  private panelEl: HTMLElement;

  // Three.js
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private frustumSize = 20;
  private orbit: OrbitControls;
  private gridHelper: THREE.GridHelper;
  private floorPlane: THREE.Mesh;
  private ghostMesh: THREE.Mesh;
  private startMarker:    THREE.Mesh;
  private midpointMarker: THREE.Mesh;
  private goalMarker:     THREE.Mesh;

  // RAF
  private rafId: number | null = null;
  private resizeObserver: ResizeObserver;
  private angleOverlay!: HTMLElement;
  private labelsContainer!: HTMLElement;
  private labelEls: Map<string, HTMLElement> = new Map();

  // Raycasting
  private raycaster = new THREE.Raycaster();
  private mouse = new THREE.Vector2();
  private hoveredBlock: EditorBlock | null = null;

  // Editor state
  private blocks: EditorBlock[] = [];
  private blockCounter = 0;
  private currentFloor = 0;
  private currentTool: Tool = 'place';
  private selectedBlock: EditorBlock | null = null;
  private illusionConns: IllusionConn[] = [];
  private ladderConns: Array<{ nodeA: string; nodeB: string }> = [];
  private teleporterConns: Array<{ nodeA: string; nodeB: string }> = [];
  private starNodeIds:     string[] = [];
  private switchConns:    SwitchConn[] = [];
  private startNodeId:    string | null = null;
  private midpointBlockId: string | null = null;
  private goalBlockId:    string | null = null;
  private stageName = 'Custom Level';
  private stageNum = 4;
  private bgColor = '#E8EEF5';
  private currentColor = DEFAULT_COLOR;

  // Mouse drag detection
  private mouseDownPos = new THREE.Vector2();
  private isDragging = false;

  // Callbacks
  onClose: () => void = () => {};

  // Panel elements (for updating)
  private selectedSection!: HTMLElement;
  private illusionListEl!: HTMLElement;
  private ladderListEl!: HTMLElement;
  private teleporterListEl!: HTMLElement;
  private starListEl!:       HTMLElement;
  private switchListEl!:     HTMLElement;
  private illusionFormEl!:   HTMLElement;
  private ladderFormEl!:     HTMLElement;
  private teleporterFormEl!: HTMLElement;
  private starFormEl!:       HTMLElement;
  private switchFormEl!:     HTMLElement;
  private colorInput!: HTMLInputElement;
  private walkableInput!: HTMLInputElement;
  private selIdEl!: HTMLElement;
  private selFloorEl!: HTMLElement;
  private floorLabel!: HTMLElement;
  private toolBtns: Partial<Record<Tool, HTMLButtonElement>> = {};

  constructor(container: HTMLElement) {
    // ── Build DOM ────────────────────────────────────────────────────────────
    this.el = document.createElement('div');
    this.el.className = 'editor-overlay';
    container.appendChild(this.el);

    this.viewportEl = document.createElement('div');
    this.viewportEl.className = 'editor-viewport';
    this.el.appendChild(this.viewportEl);

    this.panelEl = document.createElement('div');
    this.panelEl.className = 'editor-panel';
    this.el.appendChild(this.panelEl);

    this.buildPanel();

    // ── Three.js setup ───────────────────────────────────────────────────────
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.viewportEl.appendChild(this.renderer.domElement);

    this.angleOverlay = document.createElement('div');
    this.angleOverlay.className = 'editor-angle-overlay';
    this.viewportEl.appendChild(this.angleOverlay);

    this.labelsContainer = document.createElement('div');
    this.labelsContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;';
    this.viewportEl.appendChild(this.labelsContainer);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xF5F0E8);

    // Orthographic camera — 게임과 동일한 방식
    const aspect = this.viewportEl.clientWidth / (this.viewportEl.clientHeight || 1);
    const f = this.frustumSize;
    this.camera = new THREE.OrthographicCamera(
      -f * aspect / 2, f * aspect / 2, f / 2, -f / 2, -100, 100,
    );
    this.camera.position.set(7 + 15, 15, 7 + 15);
    this.camera.lookAt(7, 0, 7);

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;
    this.orbit.enablePan = false;
    this.orbit.minZoom = 0.15;
    this.orbit.maxZoom = 8;
    this.orbit.target.set(7, 0, 7);

    // 게임과 동일한 조명
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(8, 16, 8);
    this.scene.add(dir);
    this.scene.add(new THREE.HemisphereLight(0xA8D8EA, 0xFCBAD3, 0.4));

    // Grid
    this.gridHelper = new THREE.GridHelper(14, 14, 0x4444aa, 0x333366);
    this.gridHelper.position.set(7, floorY(0), 7);
    this.scene.add(this.gridHelper);

    // Floor plane for raycasting
    const planeGeo = new THREE.PlaneGeometry(14, 14);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    this.floorPlane = new THREE.Mesh(planeGeo, planeMat);
    this.floorPlane.rotation.x = -Math.PI / 2;
    this.floorPlane.position.set(7, floorY(0), 7);
    this.scene.add(this.floorPlane);

    // Ghost mesh
    const ghostGeo = new THREE.BoxGeometry(1, 0.5, 1);
    const ghostMat = new THREE.MeshLambertMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.4,
    });
    this.ghostMesh = new THREE.Mesh(ghostGeo, ghostMat);
    this.ghostMesh.visible = false;
    this.scene.add(this.ghostMesh);

    // Markers
    const sphereGeo = new THREE.SphereGeometry(0.18, 8, 8);
    this.startMarker = new THREE.Mesh(sphereGeo, new THREE.MeshLambertMaterial({ color: 0x44cc66 }));
    this.startMarker.visible = false;
    this.scene.add(this.startMarker);

    this.midpointMarker = new THREE.Mesh(sphereGeo, new THREE.MeshLambertMaterial({ color: 0x44DDBB }));
    this.midpointMarker.visible = false;
    this.scene.add(this.midpointMarker);

    this.goalMarker = new THREE.Mesh(sphereGeo, new THREE.MeshLambertMaterial({ color: 0xFFD700 }));
    this.goalMarker.visible = false;
    this.scene.add(this.goalMarker);

    // ── Events ───────────────────────────────────────────────────────────────
    this.renderer.domElement.addEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.addEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.addEventListener('mouseup', this.onMouseUp);

    // ResizeObserver
    this.resizeObserver = new ResizeObserver(() => this.onResize());
    this.resizeObserver.observe(this.viewportEl);

    // Initial size
    this.onResize();
  }

  // ── Panel construction ────────────────────────────────────────────────────

  private rebuildPanel(): void { this.buildPanel(); }

  private buildPanel(): void {
    const p = this.panelEl;
    p.innerHTML = '';

    // Close
    const closeBar = document.createElement('div');
    closeBar.className = 'editor-close';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.onClose());
    closeBar.appendChild(closeBtn);
    p.appendChild(closeBar);

    // Floor
    p.appendChild(this.buildSection('FLOOR', (sec) => {
      const row = document.createElement('div');
      row.className = 'editor-row';
      this.floorLabel = document.createElement('span');
      this.floorLabel.textContent = `Floor: ${this.currentFloor}`;
      this.floorLabel.style.minWidth = '60px';
      const minusBtn = document.createElement('button');
      minusBtn.className = 'editor-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => this.changeFloor(-1));
      const plusBtn = document.createElement('button');
      plusBtn.className = 'editor-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => this.changeFloor(1));
      row.appendChild(this.floorLabel);
      row.appendChild(minusBtn);
      row.appendChild(plusBtn);
      sec.appendChild(row);
    }));

    // Tool
    p.appendChild(this.buildSection('TOOL', (sec) => {
      const row = document.createElement('div');
      row.className = 'editor-row';
      for (const tool of ['place', 'erase', 'select'] as Tool[]) {
        const btn = document.createElement('button');
        btn.className = 'editor-btn' + (tool === this.currentTool ? ' active' : '');
        btn.textContent = tool.charAt(0).toUpperCase() + tool.slice(1);
        btn.addEventListener('click', () => this.setTool(tool));
        this.toolBtns[tool] = btn;
        row.appendChild(btn);
      }
      sec.appendChild(row);

      // Color row
      const colorRow = document.createElement('div');
      colorRow.className = 'editor-row';
      const colorLabel = document.createElement('label');
      colorLabel.textContent = 'Color:';
      this.colorInput = document.createElement('input');
      this.colorInput.type = 'color';
      this.colorInput.value = this.currentColor;
      this.colorInput.style.width = '48px';
      this.colorInput.style.height = '26px';
      this.colorInput.style.border = 'none';
      this.colorInput.style.background = 'none';
      this.colorInput.style.cursor = 'pointer';
      this.colorInput.addEventListener('input', () => {
        this.currentColor = this.colorInput.value;
        if (this.selectedBlock) {
          this.applyBlockColor(this.selectedBlock, this.colorInput.value);
        }
      });
      colorRow.appendChild(colorLabel);
      colorRow.appendChild(this.colorInput);
      sec.appendChild(colorRow);
    }));

    // Selected block
    this.selectedSection = this.buildSection('SELECTED BLOCK', (sec) => {
      const idRow = document.createElement('div');
      idRow.className = 'editor-row';
      const idLabel = document.createElement('label');
      idLabel.textContent = 'ID:';
      this.selIdEl = document.createElement('span');
      this.selIdEl.textContent = '—';
      idRow.appendChild(idLabel);
      idRow.appendChild(this.selIdEl);
      sec.appendChild(idRow);

      const floorRow = document.createElement('div');
      floorRow.className = 'editor-row';
      const floorLabel = document.createElement('label');
      floorLabel.textContent = 'Floor:';
      this.selFloorEl = document.createElement('span');
      this.selFloorEl.textContent = '—';
      floorRow.appendChild(floorLabel);
      floorRow.appendChild(this.selFloorEl);
      sec.appendChild(floorRow);

      const walkRow = document.createElement('div');
      walkRow.className = 'editor-row';
      const walkLabel = document.createElement('label');
      walkLabel.textContent = 'Walkable:';
      this.walkableInput = document.createElement('input');
      this.walkableInput.type = 'checkbox';
      this.walkableInput.checked = true;
      this.walkableInput.addEventListener('change', () => {
        if (this.selectedBlock) this.selectedBlock.walkable = this.walkableInput.checked;
      });
      walkRow.appendChild(walkLabel);
      walkRow.appendChild(this.walkableInput);
      sec.appendChild(walkRow);

      const startBtn = document.createElement('button');
      startBtn.className = 'editor-btn';
      startBtn.textContent = 'Set as Start';
      startBtn.style.marginBottom = '4px';
      startBtn.addEventListener('click', () => {
        if (this.selectedBlock) {
          this.startNodeId = this.selectedBlock.id;
          this.updateMarkers();
        }
      });
      sec.appendChild(startBtn);

      const midBtn = document.createElement('button');
      midBtn.className = 'editor-btn';
      midBtn.textContent = 'Set as Midpoint';
      midBtn.style.marginBottom = '4px';
      midBtn.style.color = '#44DDBB';
      midBtn.addEventListener('click', () => {
        if (this.selectedBlock) {
          this.midpointBlockId = this.selectedBlock.id;
          this.updateMarkers();
        }
      });
      sec.appendChild(midBtn);

      const clearMidBtn = document.createElement('button');
      clearMidBtn.className = 'editor-btn';
      clearMidBtn.textContent = 'Clear Midpoint';
      clearMidBtn.style.marginBottom = '4px';
      clearMidBtn.style.fontSize = '10px';
      clearMidBtn.addEventListener('click', () => {
        this.midpointBlockId = null;
        this.updateMarkers();
      });
      sec.appendChild(clearMidBtn);

      const goalBtn = document.createElement('button');
      goalBtn.className = 'editor-btn';
      goalBtn.textContent = 'Set as Goal';
      goalBtn.addEventListener('click', () => {
        if (this.selectedBlock) {
          this.goalBlockId = this.selectedBlock.id;
          this.updateMarkers();
        }
      });
      sec.appendChild(goalBtn);
    });
    p.appendChild(this.selectedSection);

    // Illusion connections
    p.appendChild(this.buildSection('ILLUSION CONNECTIONS', (sec) => {
      this.illusionListEl = document.createElement('div');
      sec.appendChild(this.illusionListEl);
      this.rebuildIllusionList();

      const addBtn = document.createElement('button');
      addBtn.className = 'editor-btn';
      addBtn.textContent = '+ Add Illusion Connection';
      addBtn.style.width = '100%';
      addBtn.style.marginTop = '6px';
      sec.appendChild(addBtn);

      this.illusionFormEl = document.createElement('div');
      this.illusionFormEl.className = 'editor-add-form';
      this.illusionFormEl.innerHTML = `
        <div class="editor-row">
          <label>NodeA:</label><input class="editor-input" id="ill-nodeA" style="width:80px">
          <label>NodeB:</label><input class="editor-input" id="ill-nodeB" style="width:80px">
        </div>
        <div class="editor-row" style="align-items:center; gap:6px;">
          <label>Azimuth:</label><input class="editor-input" id="ill-az" type="number" value="0" style="width:60px">
          <label style="margin-left:4px;">±</label><input class="editor-input" id="ill-az-tol" type="number" value="2" min="0.5" max="30" step="0.5" style="width:45px" title="Azimuth tolerance (°)">
        </div>
        <div class="editor-row" style="align-items:center; gap:6px;">
          <label>Elevation:</label><input class="editor-input" id="ill-el" type="number" value="30" style="width:60px">
          <label style="margin-left:4px;">±</label><input class="editor-input" id="ill-el-tol" type="number" value="2" min="0.5" max="30" step="0.5" style="width:45px" title="Elevation tolerance (°)">
        </div>
        <div class="editor-row" style="margin-top:2px;">
          <button class="editor-btn" id="ill-capture" style="width:100%; font-size:10px;">↺ Use Current Camera Angle</button>
        </div>
      `;

      // 현재 카메라 각도를 읽어 입력 필드에 채우는 헬퍼
      const fillCurrentAngle = () => {
        const cam = this.camera.position;
        const tgt = this.orbit.target;
        const dx = cam.x - tgt.x;
        const dy = cam.y - tgt.y;
        const dz = cam.z - tgt.z;
        const horizDist = Math.sqrt(dx * dx + dz * dz);
        const az  = Math.atan2(dx, dz) * (180 / Math.PI);
        const el  = Math.atan2(dy, horizDist) * (180 / Math.PI);
        (this.illusionFormEl.querySelector('#ill-az') as HTMLInputElement).value = az.toFixed(1);
        (this.illusionFormEl.querySelector('#ill-el') as HTMLInputElement).value = el.toFixed(1);
      };

      // 캡처 버튼
      this.illusionFormEl.querySelector('#ill-capture')!
        .addEventListener('click', fillCurrentAngle);

      const illAddBtn = document.createElement('button');
      illAddBtn.className = 'editor-btn primary';
      illAddBtn.textContent = 'Add';
      illAddBtn.style.marginTop = '6px';
      illAddBtn.addEventListener('click', () => {
        const nodeA     = (this.illusionFormEl.querySelector('#ill-nodeA') as HTMLInputElement).value.trim();
        const nodeB     = (this.illusionFormEl.querySelector('#ill-nodeB') as HTMLInputElement).value.trim();
        const azimuth   = parseFloat((this.illusionFormEl.querySelector('#ill-az') as HTMLInputElement).value);
        const azimuthTol = Math.max(0.5, parseFloat((this.illusionFormEl.querySelector('#ill-az-tol') as HTMLInputElement).value) || 2);
        const elevation = parseFloat((this.illusionFormEl.querySelector('#ill-el') as HTMLInputElement).value);
        const elevationTol = Math.max(0.5, parseFloat((this.illusionFormEl.querySelector('#ill-el-tol') as HTMLInputElement).value) || 2);
        if (nodeA && nodeB) {
          this.illusionConns.push({ nodeA, nodeB, azimuth, azimuthTol, elevation, elevationTol });
          this.rebuildIllusionList();
          this.illusionFormEl.classList.remove('open');
        }
      });
      this.illusionFormEl.appendChild(illAddBtn);
      sec.appendChild(this.illusionFormEl);

      addBtn.addEventListener('click', () => {
        const isOpening = !this.illusionFormEl.classList.contains('open');
        this.illusionFormEl.classList.toggle('open');
        // 폼이 열릴 때 현재 각도를 자동으로 채움
        if (isOpening) fillCurrentAngle();
      });
    }));

    // Ladders
    p.appendChild(this.buildSection('LADDERS', (sec) => {
      this.ladderListEl = document.createElement('div');
      sec.appendChild(this.ladderListEl);
      this.rebuildLadderList();

      const addBtn = document.createElement('button');
      addBtn.className = 'editor-btn';
      addBtn.textContent = '+ Add Ladder';
      addBtn.style.width = '100%';
      addBtn.style.marginTop = '6px';
      sec.appendChild(addBtn);

      this.ladderFormEl = document.createElement('div');
      this.ladderFormEl.className = 'editor-add-form';
      this.ladderFormEl.innerHTML = `
        <div class="editor-row">
          <label>NodeA:</label><input class="editor-input" id="lad-nodeA" style="width:90px">
          <label>NodeB:</label><input class="editor-input" id="lad-nodeB" style="width:90px">
        </div>
      `;
      const ladAddBtn = document.createElement('button');
      ladAddBtn.className = 'editor-btn primary';
      ladAddBtn.textContent = 'Add';
      ladAddBtn.style.marginTop = '6px';
      ladAddBtn.addEventListener('click', () => {
        const nodeA = (this.ladderFormEl.querySelector('#lad-nodeA') as HTMLInputElement).value.trim();
        const nodeB = (this.ladderFormEl.querySelector('#lad-nodeB') as HTMLInputElement).value.trim();
        if (nodeA && nodeB) {
          this.ladderConns.push({ nodeA, nodeB });
          this.rebuildLadderList();
          this.ladderFormEl.classList.remove('open');
        }
      });
      this.ladderFormEl.appendChild(ladAddBtn);
      sec.appendChild(this.ladderFormEl);

      addBtn.addEventListener('click', () => {
        this.ladderFormEl.classList.toggle('open');
      });
    }));

    // Teleporters
    p.appendChild(this.buildSection('TELEPORTERS', (sec) => {
      this.teleporterListEl = document.createElement('div');
      sec.appendChild(this.teleporterListEl);
      this.rebuildTeleporterList();

      const addBtn = document.createElement('button');
      addBtn.className = 'editor-btn';
      addBtn.textContent = '+ Add Teleporter';
      addBtn.style.width = '100%';
      addBtn.style.marginTop = '6px';
      sec.appendChild(addBtn);

      this.teleporterFormEl = document.createElement('div');
      this.teleporterFormEl.className = 'editor-add-form';
      this.teleporterFormEl.innerHTML = `
        <div class="editor-row">
          <label>PadA:</label><input class="editor-input" id="tp-nodeA" style="width:90px">
          <label>PadB:</label><input class="editor-input" id="tp-nodeB" style="width:90px">
        </div>
      `;
      const tpAddBtn = document.createElement('button');
      tpAddBtn.className = 'editor-btn primary';
      tpAddBtn.textContent = 'Add';
      tpAddBtn.style.marginTop = '6px';
      tpAddBtn.addEventListener('click', () => {
        const nodeA = (this.teleporterFormEl.querySelector('#tp-nodeA') as HTMLInputElement).value.trim();
        const nodeB = (this.teleporterFormEl.querySelector('#tp-nodeB') as HTMLInputElement).value.trim();
        if (nodeA && nodeB) {
          this.teleporterConns.push({ nodeA, nodeB });
          this.rebuildTeleporterList();
          this.teleporterFormEl.classList.remove('open');
        }
      });
      this.teleporterFormEl.appendChild(tpAddBtn);
      sec.appendChild(this.teleporterFormEl);

      addBtn.addEventListener('click', () => {
        this.teleporterFormEl.classList.toggle('open');
      });
    }));

    // Stars
    p.appendChild(this.buildSection('STARS', (sec) => {
      this.starListEl = document.createElement('div');
      sec.appendChild(this.starListEl);
      this.rebuildStarList();

      const addBtn = document.createElement('button');
      addBtn.className = 'editor-btn';
      addBtn.textContent = '+ Add Star';
      addBtn.style.width = '100%';
      addBtn.style.marginTop = '6px';
      sec.appendChild(addBtn);

      this.starFormEl = document.createElement('div');
      this.starFormEl.className = 'editor-add-form';
      this.starFormEl.innerHTML = `
        <div class="editor-row">
          <label>Node ID:</label><input class="editor-input" id="star-nodeId" style="width:100px" placeholder="e.g. b001">
        </div>
      `;
      const starAddBtn = document.createElement('button');
      starAddBtn.className = 'editor-btn primary';
      starAddBtn.textContent = 'Add';
      starAddBtn.style.marginTop = '6px';
      starAddBtn.addEventListener('click', () => {
        const nodeId = (this.starFormEl.querySelector('#star-nodeId') as HTMLInputElement).value.trim();
        if (nodeId && !this.starNodeIds.includes(nodeId)) {
          this.starNodeIds.push(nodeId);
          this.rebuildStarList();
          (this.starFormEl.querySelector('#star-nodeId') as HTMLInputElement).value = '';
        }
      });
      // 선택된 블록을 바로 추가하는 버튼
      const starAddSelectedBtn = document.createElement('button');
      starAddSelectedBtn.className = 'editor-btn';
      starAddSelectedBtn.textContent = 'Add Selected Block';
      starAddSelectedBtn.style.marginTop = '4px';
      starAddSelectedBtn.style.width = '100%';
      starAddSelectedBtn.addEventListener('click', () => {
        if (!this.selectedBlock) return;
        const id = this.selectedBlock.id;
        if (!this.starNodeIds.includes(id)) {
          this.starNodeIds.push(id);
          this.rebuildStarList();
        }
      });
      this.starFormEl.appendChild(starAddBtn);
      this.starFormEl.appendChild(starAddSelectedBtn);
      sec.appendChild(this.starFormEl);

      addBtn.addEventListener('click', () => {
        this.starFormEl.classList.toggle('open');
      });
    }));

    // Switches
    p.appendChild(this.buildSection('SWITCHES', (sec) => {
      this.switchListEl = document.createElement('div');
      sec.appendChild(this.switchListEl);
      this.rebuildSwitchList();

      const addBtn = document.createElement('button');
      addBtn.className = 'editor-btn';
      addBtn.textContent = '+ Add Switch';
      addBtn.style.width = '100%';
      addBtn.style.marginTop = '6px';
      sec.appendChild(addBtn);

      this.switchFormEl = document.createElement('div');
      this.switchFormEl.className = 'editor-add-form';
      this.switchFormEl.innerHTML = `
        <div class="editor-row">
          <label>Switch:</label><input class="editor-input" id="sw-switch" style="width:80px" placeholder="e.g. b004">
          <label>Target:</label><input class="editor-input" id="sw-target" style="width:80px" placeholder="e.g. b005">
        </div>
        <div class="editor-row" style="gap:8px;">
          <label>Mode:</label>
          <select class="editor-input" id="sw-mode" style="width:80px">
            <option value="toggle">toggle</option>
            <option value="hold">hold</option>
          </select>
          <label>Type:</label>
          <select class="editor-input" id="sw-type" style="width:70px">
            <option value="spawn">spawn</option>
            <option value="move">move</option>
          </select>
        </div>
      `;

      const swAddBtn = document.createElement('button');
      swAddBtn.className = 'editor-btn primary';
      swAddBtn.textContent = 'Add';
      swAddBtn.style.marginTop = '6px';
      swAddBtn.addEventListener('click', () => {
        const switchNodeId = (this.switchFormEl.querySelector('#sw-switch') as HTMLInputElement).value.trim();
        const targetNodeId = (this.switchFormEl.querySelector('#sw-target') as HTMLInputElement).value.trim();
        const mode = (this.switchFormEl.querySelector('#sw-mode') as HTMLSelectElement).value as 'hold' | 'toggle';
        const type = (this.switchFormEl.querySelector('#sw-type') as HTMLSelectElement).value as 'spawn' | 'move';
        if (switchNodeId && targetNodeId) {
          this.switchConns.push({ switchNodeId, targetNodeId, mode, type });
          this.rebuildSwitchList();
          (this.switchFormEl.querySelector('#sw-switch') as HTMLInputElement).value = '';
          (this.switchFormEl.querySelector('#sw-target') as HTMLInputElement).value = '';
          this.switchFormEl.classList.remove('open');
        }
      });

      // 선택한 블록을 Switch로, 다른 블록을 Target으로 빠르게 추가하는 헬퍼 버튼
      const swAddSelectedBtn = document.createElement('button');
      swAddSelectedBtn.className = 'editor-btn';
      swAddSelectedBtn.textContent = 'Use Selected as Switch Node';
      swAddSelectedBtn.style.marginTop = '4px';
      swAddSelectedBtn.style.width = '100%';
      swAddSelectedBtn.addEventListener('click', () => {
        if (!this.selectedBlock) return;
        (this.switchFormEl.querySelector('#sw-switch') as HTMLInputElement).value = this.selectedBlock.id;
      });

      this.switchFormEl.appendChild(swAddBtn);
      this.switchFormEl.appendChild(swAddSelectedBtn);
      sec.appendChild(this.switchFormEl);

      addBtn.addEventListener('click', () => {
        this.switchFormEl.classList.toggle('open');
      });
    }));

    // Export
    p.appendChild(this.buildSection('EXPORT', (sec) => {
      const nameRow = document.createElement('div');
      nameRow.className = 'editor-row';
      const nameLabel = document.createElement('label');
      nameLabel.textContent = 'Name:';
      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'editor-input';
      nameInput.value = this.stageName;
      nameInput.addEventListener('input', () => { this.stageName = nameInput.value; });
      nameRow.appendChild(nameLabel);
      nameRow.appendChild(nameInput);
      sec.appendChild(nameRow);

      const numRow = document.createElement('div');
      numRow.className = 'editor-row';
      const numLabel = document.createElement('label');
      numLabel.textContent = 'Stage #:';
      const numInput = document.createElement('input');
      numInput.type = 'number';
      numInput.className = 'editor-input';
      numInput.min = '4';
      numInput.max = '30';
      numInput.value = String(this.stageNum);
      numInput.addEventListener('input', () => { this.stageNum = parseInt(numInput.value) || 4; });
      numRow.appendChild(numLabel);
      numRow.appendChild(numInput);
      sec.appendChild(numRow);

      const bgRow = document.createElement('div');
      bgRow.className = 'editor-row';
      const bgLabel = document.createElement('label');
      bgLabel.textContent = 'BG Color:';
      const bgInput = document.createElement('input');
      bgInput.type = 'color';
      bgInput.value = this.bgColor;
      bgInput.style.width = '48px';
      bgInput.style.height = '26px';
      bgInput.style.border = 'none';
      bgInput.style.background = 'none';
      bgInput.style.cursor = 'pointer';
      bgInput.addEventListener('input', () => { this.bgColor = bgInput.value; });
      bgRow.appendChild(bgLabel);
      bgRow.appendChild(bgInput);
      sec.appendChild(bgRow);

      const saveBtn = document.createElement('button');
      saveBtn.className = 'editor-btn primary';
      saveBtn.textContent = 'Save to localStorage';
      saveBtn.style.width = '100%';
      saveBtn.style.marginBottom = '6px';
      saveBtn.addEventListener('click', () => {
        CustomLevelStore.save({ stageNum: this.stageNum, data: this.toLevel() });
        saveBtn.textContent = 'Saved!';
        setTimeout(() => { saveBtn.textContent = 'Save to localStorage'; }, 1500);
      });
      sec.appendChild(saveBtn);

      const dlBtn = document.createElement('button');
      dlBtn.className = 'editor-btn';
      dlBtn.textContent = 'Download JSON';
      dlBtn.style.width = '100%';
      dlBtn.style.marginBottom = '6px';
      dlBtn.addEventListener('click', () => {
        const json = JSON.stringify(this.toLevel(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `level_custom_${this.stageNum}.json`;
        a.click();
        URL.revokeObjectURL(url);
      });
      sec.appendChild(dlBtn);

      const uploadLabel = document.createElement('label');
      uploadLabel.className = 'editor-btn';
      uploadLabel.textContent = 'Upload JSON';
      uploadLabel.style.width = '100%';
      uploadLabel.style.display = 'block';
      uploadLabel.style.textAlign = 'center';
      uploadLabel.style.cursor = 'pointer';
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json,application/json';
      fileInput.style.display = 'none';
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const data = JSON.parse(e.target!.result as string) as LevelData;
            this.loadFromLevelData(data);
            CustomLevelStore.save({ stageNum: this.stageNum, data });
          } catch {
            alert('Invalid JSON file');
          }
          fileInput.value = '';
        };
        reader.readAsText(file);
      });
      uploadLabel.appendChild(fileInput);
      sec.appendChild(uploadLabel);
    }));
  }

  private buildSection(title: string, fill: (sec: HTMLElement) => void): HTMLElement {
    const sec = document.createElement('div');
    sec.className = 'editor-section';
    const h3 = document.createElement('h3');
    h3.textContent = title;
    sec.appendChild(h3);
    fill(sec);
    return sec;
  }

  // ── Panel update helpers ──────────────────────────────────────────────────

  private rebuildIllusionList(): void {
    this.illusionListEl.innerHTML = '';
    this.illusionConns.forEach((conn, i) => {
      const item = document.createElement('div');
      item.className = 'editor-conn-item';
      item.innerHTML = `<span>${conn.nodeA} ↔ ${conn.nodeB} (az:${conn.azimuth} el:${conn.elevation})</span>`;
      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.illusionConns.splice(i, 1);
        this.rebuildIllusionList();
      });
      item.appendChild(del);
      this.illusionListEl.appendChild(item);
    });
  }

  private rebuildLadderList(): void {
    this.ladderListEl.innerHTML = '';
    this.ladderConns.forEach((conn, i) => {
      const item = document.createElement('div');
      item.className = 'editor-conn-item';
      item.innerHTML = `<span>${conn.nodeA} ↔ ${conn.nodeB}</span>`;
      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.ladderConns.splice(i, 1);
        this.rebuildLadderList();
      });
      item.appendChild(del);
      this.ladderListEl.appendChild(item);
    });
  }

  private rebuildTeleporterList(): void {
    this.teleporterListEl.innerHTML = '';
    this.teleporterConns.forEach((conn, i) => {
      const item = document.createElement('div');
      item.className = 'editor-conn-item';
      item.innerHTML = `<span style="color:#44DDEE">⬡</span> <span>${conn.nodeA} ↔ ${conn.nodeB}</span>`;
      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.teleporterConns.splice(i, 1);
        this.rebuildTeleporterList();
      });
      item.appendChild(del);
      this.teleporterListEl.appendChild(item);
    });
  }

  private rebuildStarList(): void {
    this.starListEl.innerHTML = '';
    this.starNodeIds.forEach((nodeId, i) => {
      const item = document.createElement('div');
      item.className = 'editor-conn-item';
      item.innerHTML = `<span style="color:#FFD700">★</span> <span>${nodeId}</span>`;
      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.starNodeIds.splice(i, 1);
        this.rebuildStarList();
      });
      item.appendChild(del);
      this.starListEl.appendChild(item);
    });
  }

  private rebuildSwitchList(): void {
    this.switchListEl.innerHTML = '';
    this.switchConns.forEach((sw, i) => {
      const item = document.createElement('div');
      item.className = 'editor-conn-item';
      const typeColor = sw.type === 'spawn' ? '#44DDBB' : '#FFAA44';
      item.innerHTML = `<span style="color:${typeColor}">⬡</span> <span>${sw.switchNodeId} → ${sw.targetNodeId} <small>[${sw.mode}/${sw.type}]</small></span>`;
      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.switchConns.splice(i, 1);
        this.rebuildSwitchList();
      });
      item.appendChild(del);
      this.switchListEl.appendChild(item);
    });
  }

  private updateSelectedPanel(): void {
    const b = this.selectedBlock;
    if (b) {
      this.selIdEl.textContent = b.id;
      this.selFloorEl.textContent = String(b.floor);
      this.colorInput.value = b.color;
      this.walkableInput.checked = b.walkable;
    } else {
      this.selIdEl.textContent = '—';
      this.selFloorEl.textContent = '—';
    }
  }

  // ── Floor / tool ──────────────────────────────────────────────────────────

  private changeFloor(delta: number): void {
    this.currentFloor = Math.max(0, this.currentFloor + delta);
    this.floorLabel.textContent = `Floor: ${this.currentFloor}`;
    const y = floorY(this.currentFloor);
    this.gridHelper.position.y = y;
    this.floorPlane.position.y = y;
  }

  private setTool(tool: Tool): void {
    this.currentTool = tool;
    for (const [t, btn] of Object.entries(this.toolBtns) as [Tool, HTMLButtonElement][]) {
      btn.classList.toggle('active', t === tool);
    }
    this.ghostMesh.visible = false;
    // Clear hover highlight on tool switch
    if (this.hoveredBlock) {
      this.clearHoverHighlight();
    }
    if (tool !== 'select') {
      this.deselectBlock();
    }
  }

  // ── Block management ──────────────────────────────────────────────────────

  private nextBlockId(): string {
    this.blockCounter++;
    return `b${String(this.blockCounter).padStart(3, '0')}`;
  }

  private getBlockAt(gridX: number, floor: number, gridZ: number): EditorBlock | undefined {
    return this.blocks.find(b => b.gridX === gridX && b.floor === floor && b.gridZ === gridZ);
  }

  private placeBlock(gridX: number, gridZ: number): void {
    if (this.getBlockAt(gridX, this.currentFloor, gridZ)) return;
    if (gridX < 0 || gridX >= GRID_SIZE || gridZ < 0 || gridZ >= GRID_SIZE) return;

    const id = this.nextBlockId();
    const pos = blockWorldPos(gridX, this.currentFloor, gridZ);
    const colorHex = parseInt(this.currentColor.replace('#', ''), 16);
    const blockInst = new Block({ position: [pos.x, pos.y, pos.z], color: colorHex, size: [1, 0.5, 1] });
    blockInst.mesh.userData.editorBlockId = id;
    blockInst.mesh.traverse(child => { child.userData.editorBlockId = id; });
    this.scene.add(blockInst.mesh);

    const block: EditorBlock = {
      id,
      floor: this.currentFloor,
      gridX,
      gridZ,
      color: this.currentColor,
      walkable: true,
      mesh: blockInst.mesh,
    };
    this.blocks.push(block);
    this.addLabel(id);

    // Auto-set start/goal for first/any block
    if (!this.startNodeId && this.blocks.length === 1) this.startNodeId = id;
    this.goalBlockId = id; // last placed is always goal candidate
    this.updateMarkers();
  }

  private eraseBlock(block: EditorBlock): void {
    this.scene.remove(block.mesh);
    block.mesh.traverse(child => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) child.material.forEach(m => (m as THREE.Material).dispose());
        else (child.material as THREE.Material).dispose();
      }
    });
    this.blocks = this.blocks.filter(b => b !== block);
    this.removeLabel(block.id);

    if (this.startNodeId    === block.id) this.startNodeId    = this.blocks[0]?.id ?? null;
    if (this.midpointBlockId === block.id) this.midpointBlockId = null;
    if (this.goalBlockId    === block.id) this.goalBlockId    = this.blocks[this.blocks.length - 1]?.id ?? null;
    this.starNodeIds  = this.starNodeIds.filter(id => id !== block.id);
    this.switchConns  = this.switchConns.filter(
      sw => sw.switchNodeId !== block.id && sw.targetNodeId !== block.id,
    );
    if (this.selectedBlock === block) this.selectedBlock = null;
    this.updateMarkers();
    this.updateSelectedPanel();
    this.hoveredBlock = null;
  }

  private setBlockEmissive(block: EditorBlock, hex: number): void {
    block.mesh.traverse(child => {
      if (child instanceof THREE.Mesh && Array.isArray(child.material)) {
        (child.material as THREE.MeshLambertMaterial[]).forEach(m => m.emissive.setHex(hex));
      }
    });
  }

  private applyBlockColor(block: EditorBlock, color: string): void {
    block.color = color;
    const base = new THREE.Color(parseInt(color.replace('#', ''), 16));
    block.mesh.traverse(child => {
      if (child instanceof THREE.Mesh && Array.isArray(child.material)) {
        (child.material as THREE.MeshLambertMaterial[]).forEach((mat, i) => {
          mat.color.copy(base.clone().multiplyScalar(FACE_BRIGHTNESS[i] ?? 1));
        });
      }
    });
  }

  private selectBlock(block: EditorBlock): void {
    if (this.selectedBlock && this.selectedBlock !== block) {
      this.setBlockEmissive(this.selectedBlock, 0x000000);
    }
    this.selectedBlock = block;
    this.setBlockEmissive(block, 0x222244);
    this.updateSelectedPanel();
  }

  private deselectBlock(): void {
    if (this.selectedBlock) {
      this.setBlockEmissive(this.selectedBlock, 0x000000);
      this.selectedBlock = null;
    }
    this.updateSelectedPanel();
  }

  // ── Markers ───────────────────────────────────────────────────────────────

  private updateMarkers(): void {
    const startBlock = this.blocks.find(b => b.id === this.startNodeId);
    if (startBlock) {
      const p = blockWorldPos(startBlock.gridX, startBlock.floor, startBlock.gridZ);
      this.startMarker.position.set(p.x, p.y + 0.45, p.z);
      this.startMarker.visible = true;
    } else {
      this.startMarker.visible = false;
    }

    const midBlock = this.blocks.find(b => b.id === this.midpointBlockId);
    if (midBlock) {
      const p = blockWorldPos(midBlock.gridX, midBlock.floor, midBlock.gridZ);
      this.midpointMarker.position.set(p.x, p.y + 0.45, p.z);
      this.midpointMarker.visible = true;
    } else {
      this.midpointMarker.visible = false;
    }

    const goalBlock = this.blocks.find(b => b.id === this.goalBlockId);
    if (goalBlock) {
      const p = blockWorldPos(goalBlock.gridX, goalBlock.floor, goalBlock.gridZ);
      this.goalMarker.position.set(p.x, p.y + 0.45, p.z);
      this.goalMarker.visible = true;
    } else {
      this.goalMarker.visible = false;
    }
  }

  // ── Mouse handling ────────────────────────────────────────────────────────

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    if (this.currentTool === 'place') {
      this.updateGhost();
    } else if (this.currentTool === 'erase') {
      this.updateEraseHover();
    }
  };

  private onMouseDown = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    this.mouseDownPos.set(e.clientX, e.clientY);
    this.isDragging = false;

    // Disable orbit while placing/erasing so mouse clicks don't pan
    if (this.currentTool === 'place' || this.currentTool === 'erase') {
      this.orbit.enabled = false;
    }
  };

  private onMouseUp = (e: MouseEvent): void => {
    if (e.button !== 0) return;
    const dx = e.clientX - this.mouseDownPos.x;
    const dy = e.clientY - this.mouseDownPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    this.isDragging = dist > 5;
    this.orbit.enabled = true;

    if (!this.isDragging) {
      this.handleClick();
    }
  };

  private handleClick(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);

    if (this.currentTool === 'place') {
      const hits = this.raycaster.intersectObject(this.floorPlane);
      if (hits.length > 0) {
        const pt = hits[0].point;
        const gridX = Math.floor(pt.x);
        const gridZ = Math.floor(pt.z);
        this.placeBlock(gridX, gridZ);
      }
    } else if (this.currentTool === 'erase') {
      const hits = this.raycaster.intersectObjects(this.blocks.map(b => b.mesh), true);
      if (hits.length > 0) {
        const id = hits[0].object.userData.editorBlockId as string;
        const block = this.blocks.find(b => b.id === id);
        if (block) this.eraseBlock(block);
      }
    } else if (this.currentTool === 'select') {
      const hits = this.raycaster.intersectObjects(this.blocks.map(b => b.mesh), true);
      if (hits.length > 0) {
        const id = hits[0].object.userData.editorBlockId as string;
        const block = this.blocks.find(b => b.id === id);
        if (block) this.selectBlock(block);
      } else {
        this.deselectBlock();
      }
    }
  }

  private updateGhost(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObject(this.floorPlane);
    if (hits.length > 0) {
      const pt = hits[0].point;
      const gridX = Math.floor(pt.x);
      const gridZ = Math.floor(pt.z);
      if (gridX >= 0 && gridX < GRID_SIZE && gridZ >= 0 && gridZ < GRID_SIZE) {
        const pos = blockWorldPos(gridX, this.currentFloor, gridZ);
        this.ghostMesh.position.copy(pos);
        const occupied = !!this.getBlockAt(gridX, this.currentFloor, gridZ);
        this.ghostMesh.visible = !occupied;
      } else {
        this.ghostMesh.visible = false;
      }
    } else {
      this.ghostMesh.visible = false;
    }
  }

  private clearHoverHighlight(): void {
    if (this.hoveredBlock) {
      this.setBlockEmissive(this.hoveredBlock, 0x000000);
      this.hoveredBlock = null;
    }
  }

  private updateEraseHover(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.blocks.map(b => b.mesh), true);

    if (hits.length > 0) {
      const id = hits[0].object.userData.editorBlockId as string;
      const block = this.blocks.find(b => b.id === id);
      if (block && block !== this.hoveredBlock) {
        this.clearHoverHighlight();
        this.hoveredBlock = block;
        this.setBlockEmissive(block, 0x551111);
      }
    } else {
      this.clearHoverHighlight();
    }
  }

  // ── Resize ────────────────────────────────────────────────────────────────

  private onResize(): void {
    const w = this.viewportEl.clientWidth;
    const h = this.viewportEl.clientHeight;
    if (w === 0 || h === 0) return;
    const aspect = w / h;
    const f = this.frustumSize;
    this.camera.left   = -f * aspect / 2;
    this.camera.right  =  f * aspect / 2;
    this.camera.top    =  f / 2;
    this.camera.bottom = -f / 2;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  // ── RAF loop ──────────────────────────────────────────────────────────────

  private loop = (): void => {
    this.rafId = requestAnimationFrame(this.loop);
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
    this.updateAngleOverlay();
    this.updateLabels();
  };

  private updateAngleOverlay(): void {
    const cam = this.camera.position;
    const tgt = this.orbit.target;
    const dx = cam.x - tgt.x;
    const dy = cam.y - tgt.y;
    const dz = cam.z - tgt.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    const azimuth   = Math.atan2(dx, dz) * (180 / Math.PI);
    const elevation = Math.atan2(dy, horizDist) * (180 / Math.PI);
    this.angleOverlay.textContent =
      `azimuth: ${azimuth.toFixed(1)}°  |  elevation: ${elevation.toFixed(1)}°`;
  }

  // ── Block ID labels ───────────────────────────────────────────────────────

  private addLabel(id: string): void {
    const el = document.createElement('div');
    el.className = 'editor-block-label';
    el.textContent = id;
    this.labelsContainer.appendChild(el);
    this.labelEls.set(id, el);
  }

  private removeLabel(id: string): void {
    const el = this.labelEls.get(id);
    if (el) { el.remove(); this.labelEls.delete(id); }
  }

  private clearAllLabels(): void {
    this.labelsContainer.innerHTML = '';
    this.labelEls.clear();
  }

  private updateLabels(): void {
    const w = this.viewportEl.clientWidth;
    const h = this.viewportEl.clientHeight;
    const v = new THREE.Vector3();

    for (const block of this.blocks) {
      const el = this.labelEls.get(block.id);
      if (!el) continue;
      v.copy(block.mesh.position);
      v.y += 0.4;
      v.project(this.camera);

      // NDC → pixel
      const x = (v.x * 0.5 + 0.5) * w;
      const y = (-v.y * 0.5 + 0.5) * h;

      // Hide if behind camera
      if (v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = 'block';
      el.style.left = `${x}px`;
      el.style.top  = `${y}px`;
    }
  }

  // ── toLevel ───────────────────────────────────────────────────────────────

  private toLevel(): LevelData {
    return {
      id: `custom_stage_${this.stageNum}`,
      name: this.stageName,
      backgroundColor: this.bgColor,
      blocks: this.blocks.map(b => ({
        id: b.id,
        position: [b.gridX + 0.5, b.floor * 0.5 + 0.25, b.gridZ + 0.5] as [number, number, number],
        color: b.color,
        size: [1, 0.5, 1] as [number, number, number],
        walkable: b.walkable,
      })),
      ladders: this.ladderConns,
      teleporters: this.teleporterConns.length > 0 ? this.teleporterConns : undefined,
      stars: this.starNodeIds.length > 0 ? this.starNodeIds.map(id => ({ nodeId: id })) : undefined,
      switches: this.switchConns.length > 0 ? this.switchConns.map(sw => ({
        switchNodeId: sw.switchNodeId,
        targetNodeId: sw.targetNodeId,
        mode: sw.mode,
        type: sw.type,
      })) : undefined,
      illusionConnections: this.illusionConns.map(c => ({
        nodeA: c.nodeA,
        nodeB: c.nodeB,
        activateAzimuth: c.azimuth,
        azimuthTolerance: c.azimuthTol,
        activateElevation: c.elevation,
        elevationTolerance: c.elevationTol,
      })),
      character: { startNodeId: this.startNodeId ?? this.blocks[0]?.id ?? '' },
      midpoint:  this.midpointBlockId ? { blockId: this.midpointBlockId } : undefined,
      goal: { blockId: this.goalBlockId ?? this.blocks[this.blocks.length - 1]?.id ?? '' },
    };
  }

  // ── loadFromLevelData ─────────────────────────────────────────────────────

  private loadFromLevelData(data: LevelData): void {
    // Clear existing blocks
    for (const b of this.blocks) {
      this.scene.remove(b.mesh);
      b.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => (m as THREE.Material).dispose());
          else (child.material as THREE.Material).dispose();
        }
      });
    }
    this.blocks = [];
    this.blockCounter = 0;
    this.clearAllLabels();
    this.illusionConns   = [];
    this.ladderConns     = [];
    this.teleporterConns = [];
    this.starNodeIds     = [];
    this.switchConns     = [];
    this.selectedBlock   = null;
    this.hoveredBlock    = null;
    this.midpointBlockId = null;

    // Parse stage name and meta
    this.stageName       = data.name;
    this.bgColor         = data.backgroundColor;
    this.startNodeId     = data.character.startNodeId;
    this.midpointBlockId = data.midpoint?.blockId ?? null;
    this.goalBlockId     = data.goal.blockId;

    // Extract stageNum from id if possible
    const match = data.id.match(/(\d+)$/);
    if (match) this.stageNum = parseInt(match[1]);

    // Parse blocks
    let maxCounter = 0;
    for (const bd of data.blocks) {
      const floor = Math.round((bd.position[1] - 0.25) / 0.5);
      const gridX = Math.round(bd.position[0] - 0.5);
      const gridZ = Math.round(bd.position[2] - 0.5);

      const colorHex = parseInt(bd.color.replace('#', ''), 16);
      const blockInst = new Block({ position: [bd.position[0], bd.position[1], bd.position[2]], color: colorHex, size: [1, 0.5, 1] });
      blockInst.mesh.userData.editorBlockId = bd.id;
      blockInst.mesh.traverse(child => { child.userData.editorBlockId = bd.id; });
      this.scene.add(blockInst.mesh);

      const block: EditorBlock = {
        id: bd.id,
        floor,
        gridX,
        gridZ,
        color: bd.color,
        walkable: bd.walkable,
        mesh: blockInst.mesh,
      };
      this.blocks.push(block);

      // Track counter for new IDs
      const numMatch = bd.id.match(/(\d+)$/);
      if (numMatch) maxCounter = Math.max(maxCounter, parseInt(numMatch[1]));
    }
    this.blockCounter = maxCounter;

    // Parse connections
    this.illusionConns = (data.illusionConnections ?? []).map(c => ({
      nodeA: c.nodeA,
      nodeB: c.nodeB,
      azimuth: c.activateAzimuth,
      azimuthTol: c.azimuthTolerance,
      elevation: c.activateElevation,
      elevationTol: c.elevationTolerance,
    }));
    this.ladderConns     = data.ladders ?? [];
    this.teleporterConns = data.teleporters ?? [];
    this.starNodeIds     = (data.stars ?? []).map(s => s.nodeId);
    this.switchConns     = (data.switches ?? []).map(sw => ({
      switchNodeId: sw.switchNodeId,
      targetNodeId: sw.targetNodeId,
      mode: sw.mode,
      type: sw.type,
    }));

    // Rebuild panel lists
    this.rebuildIllusionList();
    this.rebuildLadderList();
    this.rebuildTeleporterList();
    this.rebuildStarList();
    this.rebuildSwitchList();
    this.updateSelectedPanel();
    this.updateMarkers();
    for (const b of this.blocks) this.addLabel(b.id);
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** 빈 상태로 초기화해서 새 스테이지 작업을 시작한다 */
  newStage(): void {
    this.loadFromLevelData({
      id: '',
      name: 'Custom Level',
      backgroundColor: '#E8EEF5',
      blocks: [],
      character: { startNodeId: '' },
      goal: { blockId: '' },
    });
    // 빈 슬롯 중 가장 작은 번호 자동 선택
    const used = CustomLevelStore.getAll().map(l => l.stageNum);
    let next = 4;
    while (used.includes(next) && next <= 30) next++;
    this.stageNum = next <= 30 ? next : 4;
    this.stageName = 'Custom Level';
    this.bgColor   = '#E8EEF5';
    this.rebuildPanel(); // Export 섹션의 입력값도 갱신
  }

  /** localStorage에서 해당 스테이지를 불러와 에디터에 로드한다 */
  loadCustomStage(stageNum: number): void {
    const saved = CustomLevelStore.getByStage(stageNum);
    if (!saved) return;
    this.loadFromLevelData(saved.data);
    this.stageNum = stageNum;
    this.rebuildPanel();
  }

  /** 내장 스테이지(JSON 파일)를 에디터에 로드한다 */
  async loadBuiltinStage(stageNum: number): Promise<void> {
    const fileMap: Record<number, () => Promise<{ default: unknown }>> = {
      1:  () => import('../levels/level_custom_1.json'),
      2:  () => import('../levels/level_custom_2.json'),
      3:  () => import('../levels/level_custom_3.json'),
      4:  () => import('../levels/level_custom_4.json'),
      5:  () => import('../levels/level_custom_5.json'),
      6:  () => import('../levels/level_custom_6.json'),
      7:  () => import('../levels/level_custom_7.json'),
      8:  () => import('../levels/level_custom_8.json'),
      9:  () => import('../levels/level_custom_9.json'),
      10: () => import('../levels/level_custom_10.json'),
      11: () => import('../levels/level_custom_11.json'),
      12: () => import('../levels/level_custom_12.json'),
    };
    const loader = fileMap[stageNum];
    if (!loader) return;
    const mod  = await loader();
    const data = mod.default as unknown as LevelData;
    this.loadFromLevelData(data);
    this.stageNum = stageNum;
    this.rebuildPanel();
  }

  show(): void {
    this.el.classList.add('visible');
    this.onResize();
    if (this.rafId === null) this.loop();
  }

  hide(): void {
    this.el.classList.remove('visible');
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  dispose(): void {
    this.hide();
    this.resizeObserver.disconnect();
    this.renderer.domElement.removeEventListener('mousemove', this.onMouseMove);
    this.renderer.domElement.removeEventListener('mousedown', this.onMouseDown);
    this.renderer.domElement.removeEventListener('mouseup', this.onMouseUp);

    for (const b of this.blocks) {
      b.mesh.traverse(child => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          if (Array.isArray(child.material)) child.material.forEach(m => (m as THREE.Material).dispose());
          else (child.material as THREE.Material).dispose();
        }
      });
    }

    this.ghostMesh.geometry.dispose();
    (this.ghostMesh.material as THREE.Material).dispose();
    this.startMarker.geometry.dispose();
    (this.startMarker.material as THREE.Material).dispose();
    this.midpointMarker.geometry.dispose();
    (this.midpointMarker.material as THREE.Material).dispose();
    this.goalMarker.geometry.dispose();
    (this.goalMarker.material as THREE.Material).dispose();
    this.floorPlane.geometry.dispose();
    (this.floorPlane.material as THREE.Material).dispose();
    this.gridHelper.dispose();

    this.orbit.dispose();
    this.renderer.dispose();
    this.el.remove();
  }
}
