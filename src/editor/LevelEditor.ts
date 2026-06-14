import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { LevelData } from '../world/Level';
import type { PatrolDef } from '../world/PatrolManager';
import { Block, recolorBlockGroup } from '../world/Block';
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
  isSpike: boolean;
  spikeType: 'always' | 'blinking';
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

interface SwitchTarget {
  nodeId:     string;
  moveTarget?: [number, number, number];  // move 타입 전용
}

interface ZoneEntry {
  id:    string;
  gridX: number;
  gridZ: number;
  width: number;
  depth: number;
}

interface SwitchConn {
  switchNodeId: string;
  targets:      SwitchTarget[];   // 타깃별 moveTarget 개별 지원
  mode: 'hold' | 'toggle';
  type: 'spawn' | 'move';
}

type Tool = 'place' | 'erase' | 'select';

// ── Constants ─────────────────────────────────────────────────────────────────

const GRID_SIZE = 100;
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
  private panelToggleBtn!: HTMLButtonElement;
  private panelVisible = true;

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
  private conditionalLadderConns: Array<{ switchNodeId: string; nodeA: string; nodeB: string }> = [];
  private teleporterConns: Array<{ nodeA: string; nodeB: string }> = [];
  private starEntries: Array<{ nodeId: string; flipped: boolean }> = [];
  private gravityFlipNodeIds:  string[] = [];
  private switchConns:      SwitchConn[] = [];
  private swPendingTargets: SwitchTarget[] = [];   // 폼에서 임시로 쌓아두는 타깃 목록
  private patrolConns:        PatrolDef[] = [];
  private patrolArrows:       THREE.ArrowHelper[] = [];
  private patrolListEl!:      HTMLElement;
  private zones: ZoneEntry[] = [];
  private zoneCounter = 0;
  private zoneOverlays: Map<string, THREE.Mesh> = new Map();
  private static readonly ZONE_COLORS = [
    0xFF6B6B, // 빨강
    0x6BAEFF, // 파랑
    0x6BFF8A, // 초록
    0xFFCC6B, // 노랑
    0xCC6BFF, // 보라
    0x6BFFF0, // 청록
    0xFF9E6B, // 주황
    0xFF6BCC, // 핑크
  ];
  private pickCallback: ((block: EditorBlock) => void) | null = null;
  private startNodeId:    string | null = null;
  private midpointBlockId: string | null = null;
  private goalBlockId:    string | null = null;
  private goalFlipped                  = false;
  private stageName = 'Custom Level';
  private stageNum = 4;
  private bgColor = '#E8EEF5';
  private currentColor = DEFAULT_COLOR;
  private initCam: { azimuth: number; polar: number; distance: number; targetY: number } | null = null;

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
  private condLadderListEl!: HTMLElement;
  private condLadderFormEl!: HTMLElement;
  private zoneListEl!:       HTMLElement;
  private zoneFormEl!:       HTMLElement;
  private illusionFormEl!:   HTMLElement;
  private ladderFormEl!:     HTMLElement;
  private teleporterFormEl!: HTMLElement;
  private starFormEl!:       HTMLElement;
  private switchFormEl!:     HTMLElement;
  // Camera panel sliders (load 시 값 동기화용)
  private camAzSlider!:   HTMLInputElement;
  private camPoSlider!:   HTMLInputElement;
  private camDistSlider!: HTMLInputElement;
  private camTySlider!:   HTMLInputElement;
  private camAzNum!:      HTMLInputElement;
  private camPoNum!:      HTMLInputElement;
  private camDistNum!:    HTMLInputElement;
  private camTyNum!:      HTMLInputElement;
  private camPreviewEl!:  HTMLElement;
  private colorInput!: HTMLInputElement;
  private walkableInput!: HTMLInputElement;
  private spikeInput!: HTMLInputElement;
  private spikeTypeSelect!: HTMLSelectElement;
  private spikeModeBtn!: HTMLButtonElement;
  private spikeModeType: 'always' | 'blinking' = 'always';
  private spikeMode = false;
  private selIdEl!: HTMLElement;
  private selFloorEl!: HTMLElement;
  private floorLabel!: HTMLElement;
  private toolBtns: Partial<Record<Tool, HTMLButtonElement>> = {};
  private axisLabelEls: HTMLElement[] = [];
  private axisArrows:   THREE.ArrowHelper[] = [];

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

    // Panel toggle button (always visible in viewport)
    this.panelToggleBtn = document.createElement('button');
    this.panelToggleBtn.className = 'editor-panel-toggle';
    this.panelToggleBtn.innerHTML = '&#9776;';
    this.panelToggleBtn.title = '패널 열기/닫기';
    this.panelToggleBtn.addEventListener('click', () => this.togglePanel());
    this.viewportEl.appendChild(this.panelToggleBtn);

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
    this.orbit.enablePan = true;
    this.orbit.mouseButtons = {
      LEFT:   THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT:  THREE.MOUSE.PAN,
    };
    this.orbit.minZoom = 0.15;
    this.orbit.maxZoom = 8;
    this.orbit.target.set(7, 0, 7);

    // 우클릭 컨텍스트 메뉴 방지
    this.renderer.domElement.addEventListener('contextmenu', e => e.preventDefault());

    // 게임과 동일한 조명
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dir = new THREE.DirectionalLight(0xffffff, 1.2);
    dir.position.set(8, 16, 8);
    this.scene.add(dir);
    this.scene.add(new THREE.HemisphereLight(0xA8D8EA, 0xFCBAD3, 0.4));

    // Grid — 100×100, 중심 (50, 0, 50)
    const half = GRID_SIZE / 2;
    this.gridHelper = new THREE.GridHelper(GRID_SIZE, GRID_SIZE, 0x4444aa, 0x333366);
    this.gridHelper.position.set(half, floorY(0), half);
    this.scene.add(this.gridHelper);

    // Floor plane for raycasting — 그리드와 동일 영역
    const planeGeo = new THREE.PlaneGeometry(GRID_SIZE, GRID_SIZE);
    const planeMat = new THREE.MeshBasicMaterial({ visible: false, side: THREE.DoubleSide });
    this.floorPlane = new THREE.Mesh(planeGeo, planeMat);
    this.floorPlane.rotation.x = -Math.PI / 2;
    this.floorPlane.position.set(half, floorY(0), half);
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

    // ── 3D 축 레이블 (그리드 끝 모서리) ────────────────────────────────────
    this._buildAxisArrows();

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

  // ── Panel toggle ──────────────────────────────────────────────────────────

  private togglePanel(): void {
    this.panelVisible = !this.panelVisible;
    this.panelEl.classList.toggle('editor-panel--hidden', !this.panelVisible);
    this.panelToggleBtn.innerHTML = this.panelVisible ? '&#10005;' : '&#9776;';
    // 패널 숨김 시 뷰포트 리사이즈 트리거
    setTimeout(() => this.onResize(), 300);
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

      // Color presets row
      const presetRow = document.createElement('div');
      presetRow.className = 'editor-row';
      const presetLabel = document.createElement('label');
      presetLabel.textContent = 'Preset:';
      presetRow.appendChild(presetLabel);

      const presets: { color: string; title: string }[] = [
        { color: '#A8C5DA', title: 'Block (168,197,218)' },
        { color: '#A6E2D6', title: 'Spawn target (166,226,214)' },
        { color: '#F7DA93', title: 'Move target (247,218,147)' },
      ];

      const swatchWrap = document.createElement('div');
      swatchWrap.style.cssText = 'display:flex;gap:4px;align-items:center;';
      for (const preset of presets) {
        const swatch = document.createElement('button');
        swatch.title = preset.title;
        swatch.style.cssText = [
          `width:22px`, `height:22px`, `border-radius:4px`,
          `border:2px solid #555`, `cursor:pointer`,
          `background:${preset.color}`, `padding:0`, `flex-shrink:0`,
        ].join(';');
        swatch.addEventListener('click', () => {
          this.currentColor = preset.color;
          this.colorInput.value = preset.color;
          if (this.selectedBlock) {
            this.applyBlockColor(this.selectedBlock, preset.color);
          }
        });
        swatchWrap.appendChild(swatch);
      }
      presetRow.appendChild(swatchWrap);
      sec.appendChild(presetRow);

      // Spike mode toggle
      const spikeModeRow = document.createElement('div');
      spikeModeRow.className = 'editor-row';
      this.spikeModeBtn = document.createElement('button');
      this.spikeModeBtn.className = 'editor-btn';
      this.spikeModeBtn.textContent = '🗡 Spike Mode: OFF';
      this.spikeModeBtn.style.cssText = 'width:100%;text-align:left;';
      this.spikeModeBtn.addEventListener('click', () => {
        this.spikeMode = !this.spikeMode;
        this.spikeModeBtn.textContent = `🗡 Spike Mode: ${this.spikeMode ? 'ON' : 'OFF'}`;
        this.spikeModeBtn.classList.toggle('active', this.spikeMode);
      });
      spikeModeRow.appendChild(this.spikeModeBtn);

      // Spike mode type selector
      const spikeModeTypeRow = document.createElement('div');
      spikeModeTypeRow.className = 'editor-row';
      const spikeModeTypeLabel = document.createElement('label');
      spikeModeTypeLabel.textContent = 'Spike Type:';
      const spikeModeTypeSelect = document.createElement('select');
      spikeModeTypeSelect.className = 'editor-input';
      spikeModeTypeSelect.style.flex = '1';
      [['always', '항상 (Always)'], ['blinking', '깜빡임 (Blinking)']].forEach(([val, text]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        spikeModeTypeSelect.appendChild(opt);
      });
      spikeModeTypeSelect.addEventListener('change', () => {
        this.spikeModeType = spikeModeTypeSelect.value as 'always' | 'blinking';
      });
      spikeModeTypeRow.appendChild(spikeModeTypeLabel);
      spikeModeTypeRow.appendChild(spikeModeTypeSelect);

      sec.appendChild(spikeModeRow);
      sec.appendChild(spikeModeTypeRow);
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

      const spikeRow = document.createElement('div');
      spikeRow.className = 'editor-row';
      const spikeLabel = document.createElement('label');
      spikeLabel.textContent = 'Spike:';
      this.spikeInput = document.createElement('input');
      this.spikeInput.type = 'checkbox';
      this.spikeInput.checked = false;
      this.spikeInput.addEventListener('change', () => {
        if (this.selectedBlock) {
          this.selectedBlock.isSpike = this.spikeInput.checked;
          this._setSpikeIndicator(this.selectedBlock, this.spikeInput.checked);
        }
      });
      spikeRow.appendChild(spikeLabel);
      spikeRow.appendChild(this.spikeInput);
      sec.appendChild(spikeRow);

      const spikeTypeRow = document.createElement('div');
      spikeTypeRow.className = 'editor-row';
      const spikeTypeLabel = document.createElement('label');
      spikeTypeLabel.textContent = 'Spike Type:';
      this.spikeTypeSelect = document.createElement('select');
      this.spikeTypeSelect.className = 'editor-input';
      this.spikeTypeSelect.style.flex = '1';
      [['always', '항상 (Always)'], ['blinking', '깜빡임 (Blinking)']].forEach(([val, text]) => {
        const opt = document.createElement('option');
        opt.value = val;
        opt.textContent = text;
        this.spikeTypeSelect.appendChild(opt);
      });
      this.spikeTypeSelect.addEventListener('change', () => {
        if (this.selectedBlock) {
          this.selectedBlock.spikeType = this.spikeTypeSelect.value as 'always' | 'blinking';
          if (this.selectedBlock.isSpike) {
            this._setSpikeIndicator(this.selectedBlock, true);
          }
        }
      });
      spikeTypeRow.appendChild(spikeTypeLabel);
      spikeTypeRow.appendChild(this.spikeTypeSelect);
      sec.appendChild(spikeTypeRow);

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
        if (!this.selectedBlock) return;
        this.midpointBlockId = this.selectedBlock.id;
        this.updateMarkers();
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
        if (!this.selectedBlock) return;
        this.goalBlockId  = this.selectedBlock.id;
        this.goalFlipped  = false;
        this.updateMarkers();
      });
      sec.appendChild(goalBtn);

      const flippedGoalBtn = document.createElement('button');
      flippedGoalBtn.className = 'editor-btn';
      flippedGoalBtn.textContent = 'Set as Flipped Goal';
      flippedGoalBtn.style.background = '#224466';
      flippedGoalBtn.addEventListener('click', () => {
        if (!this.selectedBlock) return;
        this.goalBlockId  = this.selectedBlock.id;
        this.goalFlipped  = true;
        this.updateMarkers();
      });
      sec.appendChild(flippedGoalBtn);

      const flipBtn = document.createElement('button');
      flipBtn.className = 'editor-btn';
      flipBtn.textContent = 'Toggle Gravity Flip Block';
      flipBtn.style.marginTop = '4px';
      flipBtn.style.background = '#005544';
      flipBtn.addEventListener('click', () => {
        if (!this.selectedBlock) return;
        const id = this.selectedBlock.id;
        const idx = this.gravityFlipNodeIds.indexOf(id);
        if (idx === -1) {
          this.gravityFlipNodeIds.push(id);
          recolorBlockGroup(this.selectedBlock.mesh, 0x00CCAA, 'default');
        } else {
          this.gravityFlipNodeIds.splice(idx, 1);
          // 원래 블록 색으로 복원
          recolorBlockGroup(this.selectedBlock.mesh, parseInt(this.selectedBlock.color.replace('#', ''), 16), 'default');
        }
        this.updateMarkers();
      });
      sec.appendChild(flipBtn);
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
          <label>NodeA:</label><input class="editor-input" id="ill-nodeA" style="width:66px">
          <button class="editor-btn" id="ill-pick-a" title="블록 클릭으로 선택">↗</button>
          <label>NodeB:</label><input class="editor-input" id="ill-nodeB" style="width:66px">
          <button class="editor-btn" id="ill-pick-b" title="블록 클릭으로 선택">↗</button>
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

      // Pick 버튼
      (this.illusionFormEl.querySelector('#ill-pick-a') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.illusionFormEl.querySelector('#ill-nodeA') as HTMLInputElement).value = b.id;
        }));
      (this.illusionFormEl.querySelector('#ill-pick-b') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.illusionFormEl.querySelector('#ill-nodeB') as HTMLInputElement).value = b.id;
        }));

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
          <label>NodeA:</label><input class="editor-input" id="lad-nodeA" style="width:66px">
          <button class="editor-btn" id="lad-pick-a" title="블록 클릭으로 선택">↗</button>
          <label>NodeB:</label><input class="editor-input" id="lad-nodeB" style="width:66px">
          <button class="editor-btn" id="lad-pick-b" title="블록 클릭으로 선택">↗</button>
        </div>
      `;
      (this.ladderFormEl.querySelector('#lad-pick-a') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.ladderFormEl.querySelector('#lad-nodeA') as HTMLInputElement).value = b.id;
        }));
      (this.ladderFormEl.querySelector('#lad-pick-b') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.ladderFormEl.querySelector('#lad-nodeB') as HTMLInputElement).value = b.id;
        }));
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

    // Conditional Ladders (switch-gated)
    p.appendChild(this.buildSection('COND. LADDERS', (sec) => {
      this.condLadderListEl = document.createElement('div');
      sec.appendChild(this.condLadderListEl);
      this.rebuildCondLadderList();

      const addBtn = document.createElement('button');
      addBtn.className = 'editor-btn';
      addBtn.textContent = '+ Add Cond. Ladder';
      addBtn.style.width = '100%';
      addBtn.style.marginTop = '6px';
      sec.appendChild(addBtn);

      this.condLadderFormEl = document.createElement('div');
      this.condLadderFormEl.className = 'editor-add-form';
      this.condLadderFormEl.innerHTML = `
        <div class="editor-row">
          <label>Switch:</label><input class="editor-input" id="cl-switch" style="width:60px">
          <button class="editor-btn" id="cl-pick-sw" title="블록 클릭으로 선택">↗</button>
        </div>
        <div class="editor-row">
          <label>A:</label><input class="editor-input" id="cl-nodeA" style="width:66px">
          <button class="editor-btn" id="cl-pick-a" title="블록 클릭으로 선택">↗</button>
          <label>B:</label><input class="editor-input" id="cl-nodeB" style="width:66px">
          <button class="editor-btn" id="cl-pick-b" title="블록 클릭으로 선택">↗</button>
        </div>
      `;
      (this.condLadderFormEl.querySelector('#cl-pick-sw') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.condLadderFormEl.querySelector('#cl-switch') as HTMLInputElement).value = b.id;
        }));
      (this.condLadderFormEl.querySelector('#cl-pick-a') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.condLadderFormEl.querySelector('#cl-nodeA') as HTMLInputElement).value = b.id;
        }));
      (this.condLadderFormEl.querySelector('#cl-pick-b') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.condLadderFormEl.querySelector('#cl-nodeB') as HTMLInputElement).value = b.id;
        }));

      const clAddBtn = document.createElement('button');
      clAddBtn.className = 'editor-btn primary';
      clAddBtn.textContent = 'Add';
      clAddBtn.style.marginTop = '6px';
      clAddBtn.addEventListener('click', () => {
        const switchNodeId = (this.condLadderFormEl.querySelector('#cl-switch') as HTMLInputElement).value.trim();
        const nodeA        = (this.condLadderFormEl.querySelector('#cl-nodeA') as HTMLInputElement).value.trim();
        const nodeB        = (this.condLadderFormEl.querySelector('#cl-nodeB') as HTMLInputElement).value.trim();
        if (switchNodeId && nodeA && nodeB) {
          this.conditionalLadderConns.push({ switchNodeId, nodeA, nodeB });
          this.rebuildCondLadderList();
          this.condLadderFormEl.classList.remove('open');
        }
      });
      this.condLadderFormEl.appendChild(clAddBtn);
      sec.appendChild(this.condLadderFormEl);

      addBtn.addEventListener('click', () => {
        this.condLadderFormEl.classList.toggle('open');
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
          <label>PadA:</label><input class="editor-input" id="tp-nodeA" style="width:66px">
          <button class="editor-btn" id="tp-pick-a" title="블록 클릭으로 선택">↗</button>
          <label>PadB:</label><input class="editor-input" id="tp-nodeB" style="width:66px">
          <button class="editor-btn" id="tp-pick-b" title="블록 클릭으로 선택">↗</button>
        </div>
      `;
      (this.teleporterFormEl.querySelector('#tp-pick-a') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.teleporterFormEl.querySelector('#tp-nodeA') as HTMLInputElement).value = b.id;
        }));
      (this.teleporterFormEl.querySelector('#tp-pick-b') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.teleporterFormEl.querySelector('#tp-nodeB') as HTMLInputElement).value = b.id;
        }));
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
          <label>Node ID:</label><input class="editor-input" id="star-nodeId" style="width:80px" placeholder="e.g. b001">
          <button class="editor-btn" id="star-pick" title="블록 클릭으로 선택">↗</button>
        </div>
        <div class="editor-row" style="align-items:center;gap:6px;">
          <label style="min-width:60px">Flipped:</label>
          <input type="checkbox" id="star-flipped" style="width:16px;height:16px">
          <span style="font-size:10px;color:#aaa">(블록 아랫면)</span>
        </div>
      `;
      (this.starFormEl.querySelector('#star-pick') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.starFormEl.querySelector('#star-nodeId') as HTMLInputElement).value = b.id;
        }));
      const starAddBtn = document.createElement('button');
      starAddBtn.className = 'editor-btn primary';
      starAddBtn.textContent = 'Add';
      starAddBtn.style.marginTop = '6px';
      starAddBtn.addEventListener('click', () => {
        const nodeId  = (this.starFormEl.querySelector('#star-nodeId') as HTMLInputElement).value.trim();
        const flipped = (this.starFormEl.querySelector('#star-flipped') as HTMLInputElement).checked;
        if (nodeId && !this.starEntries.some(e => e.nodeId === nodeId && e.flipped === flipped)) {
          this.starEntries.push({ nodeId, flipped });
          this.rebuildStarList();
          (this.starFormEl.querySelector('#star-nodeId') as HTMLInputElement).value = '';
        }
      });
      // 선택된 블록을 바로 추가하는 버튼 (일반 / 반전)
      const starAddSelectedBtn = document.createElement('button');
      starAddSelectedBtn.className = 'editor-btn';
      starAddSelectedBtn.textContent = '★ Add Selected (Normal)';
      starAddSelectedBtn.style.marginTop = '4px';
      starAddSelectedBtn.style.width = '100%';
      starAddSelectedBtn.addEventListener('click', () => {
        if (!this.selectedBlock) return;
        const id = this.selectedBlock.id;
        if (!this.starEntries.some(e => e.nodeId === id && !e.flipped)) {
          this.starEntries.push({ nodeId: id, flipped: false });
          this.rebuildStarList();
        }
      });
      const starAddFlippedBtn = document.createElement('button');
      starAddFlippedBtn.className = 'editor-btn';
      starAddFlippedBtn.textContent = '★↓ Add Selected (Flipped)';
      starAddFlippedBtn.style.marginTop = '2px';
      starAddFlippedBtn.style.width = '100%';
      starAddFlippedBtn.style.background = '#224466';
      starAddFlippedBtn.addEventListener('click', () => {
        if (!this.selectedBlock) return;
        const id = this.selectedBlock.id;
        if (!this.starEntries.some(e => e.nodeId === id && e.flipped)) {
          this.starEntries.push({ nodeId: id, flipped: true });
          this.rebuildStarList();
        }
      });
      this.starFormEl.appendChild(starAddBtn);
      this.starFormEl.appendChild(starAddSelectedBtn);
      this.starFormEl.appendChild(starAddFlippedBtn);
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
          <label>Switch:</label><input class="editor-input" id="sw-switch" style="width:72px" placeholder="e.g. b004">
          <button class="editor-btn" id="sw-pick-switch" title="클릭해서 블록 선택">↗</button>
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
        <div style="margin-top:4px;">
          <label style="font-size:11px;color:#aaa;">Targets:</label>
          <div id="sw-target-list" style="min-height:20px;margin:2px 0 4px;"></div>
          <div class="editor-row" style="gap:4px;">
            <input class="editor-input" id="sw-target-input" style="width:72px" placeholder="e.g. b005">
            <button class="editor-btn" id="sw-pick-target" title="클릭해서 블록 선택">↗</button>
          </div>
          <div class="editor-row" id="sw-target-move-row" style="display:none; gap:4px; margin-top:3px;">
            <label style="min-width:52px;font-size:11px;">MoveTo:</label>
            <input class="editor-input" id="sw-mx" type="number" step="0.5" value="0" style="width:48px" placeholder="X">
            <input class="editor-input" id="sw-my" type="number" step="0.5" value="0" style="width:48px" placeholder="Y">
            <input class="editor-input" id="sw-mz" type="number" step="0.5" value="0" style="width:48px" placeholder="Z">
            <button class="editor-btn" id="sw-pick-move" title="블록 클릭으로 좌표 입력">↗</button>
          </div>
          <button class="editor-btn" id="sw-add-target" style="margin-top:3px;">+ Target</button>
        </div>
      `;

      // type 변경 시 moveTarget 입력 행 표시/숨김
      const swTypeSelect     = this.switchFormEl.querySelector('#sw-type') as HTMLSelectElement;
      const swTargetMoveRow  = this.switchFormEl.querySelector('#sw-target-move-row') as HTMLElement;
      swTypeSelect.addEventListener('change', () => {
        swTargetMoveRow.style.display = swTypeSelect.value === 'move' ? '' : 'none';
      });

      // 타깃 목록 참조
      const swTargetListEl = this.switchFormEl.querySelector('#sw-target-list') as HTMLElement;

      // Pick: 스위치 노드
      (this.switchFormEl.querySelector('#sw-pick-switch') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.switchFormEl.querySelector('#sw-switch') as HTMLInputElement).value = b.id;
        }));
      // Pick: 타깃 노드 ID 입력
      (this.switchFormEl.querySelector('#sw-pick-target') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          (this.switchFormEl.querySelector('#sw-target-input') as HTMLInputElement).value = b.id;
        }));
      // Pick: moveTarget 좌표 → 해당 타깃의 XYZ 입력
      (this.switchFormEl.querySelector('#sw-pick-move') as HTMLButtonElement)
        .addEventListener('click', () => this.startPick(b => {
          const wp = blockWorldPos(b.gridX, b.floor, b.gridZ);
          (this.switchFormEl.querySelector('#sw-mx') as HTMLInputElement).value = String(wp.x);
          (this.switchFormEl.querySelector('#sw-my') as HTMLInputElement).value = String(wp.y);
          (this.switchFormEl.querySelector('#sw-mz') as HTMLInputElement).value = String(wp.z);
        }));

      // + Target: 타깃 nodeId + per-target moveTarget을 함께 추가
      (this.switchFormEl.querySelector('#sw-add-target') as HTMLButtonElement)
        .addEventListener('click', () => {
          const id = (this.switchFormEl.querySelector('#sw-target-input') as HTMLInputElement).value.trim();
          if (!id || this.swPendingTargets.some(t => t.nodeId === id)) return;
          const target: SwitchTarget = { nodeId: id };
          if (swTypeSelect.value === 'move') {
            const mx = parseFloat((this.switchFormEl.querySelector('#sw-mx') as HTMLInputElement).value) || 0;
            const my = parseFloat((this.switchFormEl.querySelector('#sw-my') as HTMLInputElement).value) || 0;
            const mz = parseFloat((this.switchFormEl.querySelector('#sw-mz') as HTMLInputElement).value) || 0;
            target.moveTarget = [mx, my, mz];
          }
          this.swPendingTargets.push(target);
          this.renderSwTargetList(swTargetListEl);
          // 입력 초기화
          (this.switchFormEl.querySelector('#sw-target-input') as HTMLInputElement).value = '';
          (this.switchFormEl.querySelector('#sw-mx') as HTMLInputElement).value = '0';
          (this.switchFormEl.querySelector('#sw-my') as HTMLInputElement).value = '0';
          (this.switchFormEl.querySelector('#sw-mz') as HTMLInputElement).value = '0';
        });

      const swAddBtn = document.createElement('button');
      swAddBtn.className = 'editor-btn primary';
      swAddBtn.textContent = 'Add Switch';
      swAddBtn.style.marginTop = '6px';
      swAddBtn.addEventListener('click', () => {
        const switchNodeId = (this.switchFormEl.querySelector('#sw-switch') as HTMLInputElement).value.trim();
        const mode = (this.switchFormEl.querySelector('#sw-mode') as HTMLSelectElement).value as 'hold' | 'toggle';
        const type = (this.switchFormEl.querySelector('#sw-type') as HTMLSelectElement).value as 'spawn' | 'move';
        if (switchNodeId && this.swPendingTargets.length > 0) {
          this.switchConns.push({ switchNodeId, targets: [...this.swPendingTargets], mode, type });
          this.swPendingTargets = [];
          this.renderSwTargetList(swTargetListEl);
          this.rebuildSwitchList();
          (this.switchFormEl.querySelector('#sw-switch') as HTMLInputElement).value = '';
          this.switchFormEl.classList.remove('open');
        }
      });

      // 선택한 블록을 Switch로 빠르게 채우는 헬퍼 버튼
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
        if (!this.switchFormEl.classList.contains('open')) {
          this.swPendingTargets = [];
          this.renderSwTargetList(swTargetListEl);
        }
        this.switchFormEl.classList.toggle('open');
        if (!this.switchFormEl.classList.contains('open')) this.cancelPick();
      });
    }));

    // Patrol Blocks
    p.appendChild(this.buildSection('PATROL BLOCKS', (sec) => {
      this.patrolListEl = document.createElement('div');
      sec.appendChild(this.patrolListEl);
      this.rebuildPatrolList();

      const addBtn = document.createElement('button');
      addBtn.className = 'editor-btn';
      addBtn.textContent = '+ Add Patrol';
      addBtn.style.cssText = 'width:100%;margin-top:6px;';
      sec.appendChild(addBtn);

      const form = document.createElement('div');
      form.className = 'editor-add-form';

      // ── 폼 상태 ──────────────────────────────────────────────────────────
      let ptSrcId  = '';
      let ptDist   = 0;

      // ── Source ───────────────────────────────────────────────────────────
      const srcRow = document.createElement('div');
      srcRow.className = 'editor-row';
      const srcLabel = document.createElement('label');
      srcLabel.textContent = 'Source:';
      const srcDisplay = document.createElement('input');
      srcDisplay.className = 'editor-input';
      srcDisplay.readOnly = true;
      srcDisplay.placeholder = '↗ 클릭';
      srcDisplay.style.flex = '1';
      const srcPickBtn = document.createElement('button');
      srcPickBtn.className = 'editor-btn';
      srcPickBtn.textContent = '↗';
      srcPickBtn.title = '소스 블록 선택';
      srcPickBtn.addEventListener('click', () => this.startPick(b => {
        ptSrcId = b.id;
        srcDisplay.value = b.id;
        // 목적지 초기화
        ptDist = 0;
        destDisplay.value = '';
        updatePreviewArrow();
      }));
      srcRow.appendChild(srcLabel);
      srcRow.appendChild(srcDisplay);
      srcRow.appendChild(srcPickBtn);
      form.appendChild(srcRow);

      // ── Axis ─────────────────────────────────────────────────────────────
      const axisRow = document.createElement('div');
      axisRow.className = 'editor-row';
      const axisLabel = document.createElement('label');
      axisLabel.textContent = 'Axis:';
      const axisSelect = document.createElement('select');
      axisSelect.className = 'editor-input';
      axisSelect.style.flex = '1';
      [
        ['x',  '+X (빨강 →)'],
        ['-x', '−X (빨강 ←)'],
        ['z',  '+Z (파랑 →)'],
        ['-z', '−Z (파랑 ←)'],
        ['y',  '+Y (초록 ↑)'],
        ['-y', '−Y (초록 ↓)'],
      ].forEach(([v, t]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = t;
        axisSelect.appendChild(o);
      });
      axisSelect.addEventListener('change', () => {
        // 축 바뀌면 목적지 초기화
        ptDist = 0;
        destDisplay.value = '';
        updatePreviewArrow();
      });
      axisRow.appendChild(axisLabel);
      axisRow.appendChild(axisSelect);
      form.appendChild(axisRow);

      // ── Destination (pick) ────────────────────────────────────────────────
      const destRow = document.createElement('div');
      destRow.className = 'editor-row';
      const destLabel = document.createElement('label');
      destLabel.textContent = 'Dest:';
      const destDisplay = document.createElement('input');
      destDisplay.className = 'editor-input';
      destDisplay.readOnly = true;
      destDisplay.placeholder = '↗ 목적지 선택';
      destDisplay.style.flex = '1';
      const destPickBtn = document.createElement('button');
      destPickBtn.className = 'editor-btn';
      destPickBtn.textContent = '↗';
      destPickBtn.title = '목적지 블록 선택';
      destPickBtn.addEventListener('click', () => {
        if (!ptSrcId) { alert('Source 블록을 먼저 선택하세요.'); return; }
        this.startPick(b => {
          if (b.id === ptSrcId) return;
          const srcBlock  = this.blocks.find(bl => bl.id === ptSrcId);
          if (!srcBlock) return;
          const axis     = axisSelect.value as PatrolDef['axis'];
          const baseAxis = axis.replace('-', '') as 'x' | 'y' | 'z';
          const dist =
            baseAxis === 'x' ? Math.abs(b.gridX - srcBlock.gridX) :
            baseAxis === 'z' ? Math.abs(b.gridZ - srcBlock.gridZ) :
            Math.abs(b.floor - srcBlock.floor) * 0.5;
          if (dist < 0.01) {
            destDisplay.value = `${b.id} — 같은 위치!`;
            return;
          }
          ptDist = Math.round(dist * 100) / 100;
          destDisplay.value = `${b.id}  (${ptDist} units)`;
          updatePreviewArrow();
        });
      });
      destRow.appendChild(destLabel);
      destRow.appendChild(destDisplay);
      destRow.appendChild(destPickBtn);
      form.appendChild(destRow);

      // ── Duration ─────────────────────────────────────────────────────────
      const durRow = document.createElement('div');
      durRow.className = 'editor-row';
      const durLabel = document.createElement('label');
      durLabel.textContent = 'Duration:';
      const durInput = document.createElement('input');
      durInput.className = 'editor-input';
      durInput.type = 'number'; durInput.step = '0.1'; durInput.min = '0.1';
      durInput.value = '1.5'; durInput.style.width = '60px';
      const durUnit = document.createElement('span');
      durUnit.style.cssText = 'font-size:11px;color:#888';
      durUnit.textContent = 'sec/way';
      durRow.appendChild(durLabel);
      durRow.appendChild(durInput);
      durRow.appendChild(durUnit);
      form.appendChild(durRow);

      // ── 미리보기 화살표 (씬에 임시 추가) ─────────────────────────────────
      let previewArrow: THREE.ArrowHelper | null = null;
      const updatePreviewArrow = () => {
        if (previewArrow) { this.scene.remove(previewArrow); previewArrow = null; }
        if (!ptSrcId || ptDist <= 0) return;
        const src = this.blocks.find(b => b.id === ptSrcId);
        if (!src) return;
        const axis     = axisSelect.value as PatrolDef['axis'];
        const sign     = axis.startsWith('-') ? -1 : 1;
        const baseAxis = axis.replace('-', '') as 'x' | 'y' | 'z';
        const origin = src.mesh.position.clone();
        origin.y += 0.35;
        const dir = new THREE.Vector3(
          baseAxis === 'x' ? sign : 0,
          baseAxis === 'y' ? sign : 0,
          baseAxis === 'z' ? sign : 0,
        );
        previewArrow = new THREE.ArrowHelper(dir, origin, ptDist, 0xFFAA00, 0.25, 0.15);
        this.scene.add(previewArrow);
      };

      // ── Add 버튼 ─────────────────────────────────────────────────────────
      const confirmBtn = document.createElement('button');
      confirmBtn.className = 'editor-btn primary';
      confirmBtn.textContent = 'Add';
      confirmBtn.style.cssText = 'margin-top:6px;width:100%;';
      confirmBtn.addEventListener('click', () => {
        if (!ptSrcId || ptDist <= 0) { alert('Source와 Dest 블록을 모두 선택하세요.'); return; }
        if (this.patrolConns.some(p => p.nodeId === ptSrcId)) {
          alert(`${ptSrcId}는 이미 패트롤 블록입니다.`); return;
        }
        const axis     = axisSelect.value as PatrolDef['axis'];
        const duration = parseFloat(durInput.value) || 1.5;
        this.patrolConns.push({ nodeId: ptSrcId, axis, distance: ptDist, duration });
        this._rebuildPatrolArrows();
        this.rebuildPatrolList();
        // 폼 초기화
        ptSrcId = ''; ptDist = 0;
        srcDisplay.value = ''; destDisplay.value = '';
        if (previewArrow) { this.scene.remove(previewArrow); previewArrow = null; }
        form.classList.remove('open');
      });
      form.appendChild(confirmBtn);
      sec.appendChild(form);

      addBtn.addEventListener('click', () => {
        form.classList.toggle('open');
        if (!form.classList.contains('open')) {
          if (previewArrow) { this.scene.remove(previewArrow); previewArrow = null; }
          this.cancelPick();
        }
      });
    }));

    // Zones
    p.appendChild(this.buildSection('ZONES', (sec) => {
      this.zoneListEl = document.createElement('div');
      sec.appendChild(this.zoneListEl);
      this.rebuildZoneList();

      const addBtn = document.createElement('button');
      addBtn.className = 'editor-btn';
      addBtn.textContent = '+ Add Zone';
      addBtn.style.cssText = 'width:100%;margin-top:6px;';
      sec.appendChild(addBtn);

      this.zoneFormEl = document.createElement('div');
      this.zoneFormEl.className = 'editor-add-form';

      // ID
      const idRow = document.createElement('div');
      idRow.className = 'editor-row';
      idRow.innerHTML = `<label style="min-width:36px;font-size:11px">ID:</label><input class="editor-input" id="zone-id" style="flex:1" placeholder="자동">`;
      this.zoneFormEl.appendChild(idRow);

      // 위치 (gridX, gridZ)
      const posRow = document.createElement('div');
      posRow.className = 'editor-row';
      posRow.style.gap = '4px';
      posRow.innerHTML = `
        <label style="min-width:36px;font-size:11px">위치:</label>
        <label style="font-size:10px">X</label><input class="editor-input" id="zone-gx" type="number" step="1" value="0" style="width:44px">
        <label style="font-size:10px">Z</label><input class="editor-input" id="zone-gz" type="number" step="1" value="0" style="width:44px">
      `;
      const pickOriginBtn = document.createElement('button');
      pickOriginBtn.className = 'editor-btn';
      pickOriginBtn.textContent = '↗';
      pickOriginBtn.title = '현재 카메라 위치를 구역 좌상단으로';
      pickOriginBtn.addEventListener('click', () => {
        const t = this.orbit.target;
        (this.zoneFormEl.querySelector('#zone-gx') as HTMLInputElement).value = String(Math.round(t.x - 5));
        (this.zoneFormEl.querySelector('#zone-gz') as HTMLInputElement).value = String(Math.round(t.z - 5));
      });
      posRow.appendChild(pickOriginBtn);
      this.zoneFormEl.appendChild(posRow);

      // 크기 (width × depth), 기본 10×10
      const sizeRow = document.createElement('div');
      sizeRow.className = 'editor-row';
      sizeRow.style.gap = '4px';
      sizeRow.innerHTML = `
        <label style="min-width:36px;font-size:11px">크기:</label>
        <label style="font-size:10px">W</label><input class="editor-input" id="zone-w" type="number" step="1" min="1" value="10" style="width:44px">
        <label style="font-size:10px">D</label><input class="editor-input" id="zone-d" type="number" step="1" min="1" value="10" style="width:44px">
        <span style="font-size:10px;color:#888">블록</span>
      `;
      this.zoneFormEl.appendChild(sizeRow);

      const zoneAddBtn = document.createElement('button');
      zoneAddBtn.className = 'editor-btn primary';
      zoneAddBtn.textContent = 'Add Zone';
      zoneAddBtn.style.cssText = 'margin-top:6px;width:100%;';
      zoneAddBtn.addEventListener('click', () => {
        const idInput = this.zoneFormEl.querySelector('#zone-id') as HTMLInputElement;
        const zoneId  = idInput.value.trim() || `zone_${++this.zoneCounter}`;
        const gx = parseInt((this.zoneFormEl.querySelector('#zone-gx') as HTMLInputElement).value) || 0;
        const gz = parseInt((this.zoneFormEl.querySelector('#zone-gz') as HTMLInputElement).value) || 0;
        const w  = Math.max(1, parseInt((this.zoneFormEl.querySelector('#zone-w') as HTMLInputElement).value) || 10);
        const d  = Math.max(1, parseInt((this.zoneFormEl.querySelector('#zone-d') as HTMLInputElement).value) || 10);
        this.zones.push({ id: zoneId, gridX: gx, gridZ: gz, width: w, depth: d });
        idInput.value = '';
        this.rebuildZoneList();
        this.zoneFormEl.classList.remove('open');
      });
      this.zoneFormEl.appendChild(zoneAddBtn);
      sec.appendChild(this.zoneFormEl);

      addBtn.addEventListener('click', () => this.zoneFormEl.classList.toggle('open'));
    }));

    // Camera
    p.appendChild(this.buildSection('CAMERA', (sec) => {
      // 슬라이더 헬퍼
      const makeRow = (label: string, id: string, min: number, max: number, step: number, def: number) => {
        const row = document.createElement('div');
        row.className = 'editor-row';
        row.style.gap = '6px';
        const lbl = document.createElement('label');
        lbl.style.minWidth = '80px';
        lbl.style.fontSize = '11px';
        lbl.textContent = label;
        const slider = document.createElement('input');
        slider.type = 'range'; slider.id = id;
        slider.min = String(min); slider.max = String(max); slider.step = String(step);
        slider.value = String(def);
        slider.style.flex = '1';
        const num = document.createElement('input');
        num.type = 'number'; num.className = 'editor-input';
        num.min = String(min); num.max = String(max); num.step = String(step);
        num.value = String(def); num.style.width = '52px';
        slider.addEventListener('input', () => { num.value = slider.value; updatePreview(); });
        num.addEventListener('input', () => { slider.value = num.value; updatePreview(); });
        row.appendChild(lbl); row.appendChild(slider); row.appendChild(num);
        sec.appendChild(row);
        return { slider, num };
      };

      const azRow  = makeRow('Azimuth (°)',   'cam-az',   -180, 180,  1,  45);
      const poRow  = makeRow('Elevation (°)', 'cam-po',    10,   80,  1,  33);
      const distRow= makeRow('Distance',      'cam-dist',   4,   30, 0.5, 14);
      const tyRow  = makeRow('Target Y',      'cam-ty',    -5,   10, 0.5,  0);

      // 필드 참조 저장 (loadFromLevelData에서 동기화)
      this.camAzSlider = azRow.slider;   this.camAzNum = azRow.num;
      this.camPoSlider = poRow.slider;   this.camPoNum = poRow.num;
      this.camDistSlider = distRow.slider; this.camDistNum = distRow.num;
      this.camTySlider = tyRow.slider;   this.camTyNum = tyRow.num;

      this.camPreviewEl = document.createElement('div');
      this.camPreviewEl.style.cssText = 'font-size:10px;color:#888;margin-top:2px;word-break:break-all;';
      sec.appendChild(this.camPreviewEl);

      const updatePreview = () => {
        const az = parseFloat(azRow.slider.value);
        const po = parseFloat(poRow.slider.value);
        const d  = parseFloat(distRow.slider.value);
        const ty = parseFloat(tyRow.slider.value);
        const azR = az * Math.PI / 180;
        const poR = po * Math.PI / 180;
        const dx = +(d * Math.sin(poR) * Math.sin(azR)).toFixed(2);
        const dy = +(ty + d * Math.cos(poR)).toFixed(2);
        const dz = +(d * Math.sin(poR) * Math.cos(azR)).toFixed(2);
        this.camPreviewEl.textContent = `pos offset: (${dx}, ${dy}, ${dz})`;
        this.initCam = { azimuth: az, polar: po, distance: d, targetY: ty };
      };
      updatePreview();

      // Capture: 에디터 현재 카메라 각도 → 슬라이더에 반영
      const captureBtn = document.createElement('button');
      captureBtn.className = 'editor-btn';
      captureBtn.textContent = '📷 Capture Editor View';
      captureBtn.style.cssText = 'width:100%;margin-top:6px;';
      captureBtn.addEventListener('click', () => {
        const off = this.camera.position.clone().sub(this.orbit.target);
        const dist = off.length();
        const az   = Math.atan2(off.x, off.z) * 180 / Math.PI;
        const po   = Math.acos(Math.max(-1, Math.min(1, off.y / dist))) * 180 / Math.PI;
        const ty   = this.orbit.target.y;
        azRow.slider.value  = azRow.num.value  = String(Math.round(az));
        poRow.slider.value  = poRow.num.value  = String(Math.min(80, Math.max(10, Math.round(po))));
        distRow.slider.value= distRow.num.value= String(Math.max(4, +dist.toFixed(1)));
        tyRow.slider.value  = tyRow.num.value  = String(+ty.toFixed(2));
        updatePreview();
      });
      sec.appendChild(captureBtn);

      // Reset: 기본값으로 초기화
      const resetBtn = document.createElement('button');
      resetBtn.className = 'editor-btn';
      resetBtn.textContent = 'Reset to Default';
      resetBtn.style.cssText = 'width:100%;margin-top:4px;';
      resetBtn.addEventListener('click', () => {
        azRow.slider.value  = azRow.num.value  = '45';
        poRow.slider.value  = poRow.num.value  = '33';
        distRow.slider.value= distRow.num.value= '14';
        tyRow.slider.value  = tyRow.num.value  = '0';
        this.initCam = null;
        updatePreview();
      });
      sec.appendChild(resetBtn);
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

      const edit = document.createElement('button');
      edit.textContent = '✎';
      edit.title = '편집';
      edit.addEventListener('click', () => {
        this.illusionConns.splice(i, 1);
        this.illusionFormEl.classList.add('open');
        (this.illusionFormEl.querySelector('#ill-nodeA') as HTMLInputElement).value = conn.nodeA;
        (this.illusionFormEl.querySelector('#ill-nodeB') as HTMLInputElement).value = conn.nodeB;
        (this.illusionFormEl.querySelector('#ill-az') as HTMLInputElement).value = String(conn.azimuth);
        (this.illusionFormEl.querySelector('#ill-az-tol') as HTMLInputElement).value = String(conn.azimuthTol);
        (this.illusionFormEl.querySelector('#ill-el') as HTMLInputElement).value = String(conn.elevation);
        (this.illusionFormEl.querySelector('#ill-el-tol') as HTMLInputElement).value = String(conn.elevationTol);
        this.rebuildIllusionList();
      });

      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.illusionConns.splice(i, 1);
        this.rebuildIllusionList();
      });
      item.appendChild(edit);
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

      const edit = document.createElement('button');
      edit.textContent = '✎';
      edit.title = '편집';
      edit.addEventListener('click', () => {
        this.ladderConns.splice(i, 1);
        this.ladderFormEl.classList.add('open');
        (this.ladderFormEl.querySelector('#lad-nodeA') as HTMLInputElement).value = conn.nodeA;
        (this.ladderFormEl.querySelector('#lad-nodeB') as HTMLInputElement).value = conn.nodeB;
        this.rebuildLadderList();
      });

      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.ladderConns.splice(i, 1);
        this.rebuildLadderList();
      });
      item.appendChild(edit);
      item.appendChild(del);
      this.ladderListEl.appendChild(item);
    });
  }

  private rebuildCondLadderList(): void {
    this.condLadderListEl.innerHTML = '';
    this.conditionalLadderConns.forEach((conn, i) => {
      const item = document.createElement('div');
      item.className = 'editor-conn-item';
      item.innerHTML = `<span style="color:#FFAA44">⚡</span> <span style="font-size:10px">[${conn.switchNodeId}] ${conn.nodeA} ↔ ${conn.nodeB}</span>`;

      const edit = document.createElement('button');
      edit.textContent = '✎';
      edit.title = '편집';
      edit.addEventListener('click', () => {
        this.conditionalLadderConns.splice(i, 1);
        this.condLadderFormEl.classList.add('open');
        (this.condLadderFormEl.querySelector('#cl-switch') as HTMLInputElement).value = conn.switchNodeId;
        (this.condLadderFormEl.querySelector('#cl-nodeA') as HTMLInputElement).value = conn.nodeA;
        (this.condLadderFormEl.querySelector('#cl-nodeB') as HTMLInputElement).value = conn.nodeB;
        this.rebuildCondLadderList();
      });

      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.conditionalLadderConns.splice(i, 1);
        this.rebuildCondLadderList();
      });
      item.appendChild(edit);
      item.appendChild(del);
      this.condLadderListEl.appendChild(item);
    });
  }

  private rebuildTeleporterList(): void {
    this.teleporterListEl.innerHTML = '';
    this.teleporterConns.forEach((conn, i) => {
      const item = document.createElement('div');
      item.className = 'editor-conn-item';
      item.innerHTML = `<span style="color:#44DDEE">⬡</span> <span>${conn.nodeA} ↔ ${conn.nodeB}</span>`;

      const edit = document.createElement('button');
      edit.textContent = '✎';
      edit.title = '편집';
      edit.addEventListener('click', () => {
        this.teleporterConns.splice(i, 1);
        this.teleporterFormEl.classList.add('open');
        (this.teleporterFormEl.querySelector('#tp-nodeA') as HTMLInputElement).value = conn.nodeA;
        (this.teleporterFormEl.querySelector('#tp-nodeB') as HTMLInputElement).value = conn.nodeB;
        this.rebuildTeleporterList();
      });

      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.teleporterConns.splice(i, 1);
        this.rebuildTeleporterList();
      });
      item.appendChild(edit);
      item.appendChild(del);
      this.teleporterListEl.appendChild(item);
    });
  }

  private rebuildStarList(): void {
    this.starListEl.innerHTML = '';
    if (this.starEntries.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:#888;margin:4px 0;';
      empty.textContent = '(별 없음)';
      this.starListEl.appendChild(empty);
    }
    this.starEntries.forEach((entry, i) => {
      const item = document.createElement('div');
      item.className = 'editor-conn-item';
      const icon  = entry.flipped ? `<span style="color:#44CCFF">★↓</span>` : `<span style="color:#FFD700">★</span>`;
      const label = entry.flipped ? `${entry.nodeId} (F)` : entry.nodeId;
      item.innerHTML = `${icon} <span>${label}</span>`;

      const edit = document.createElement('button');
      edit.textContent = '✎';
      edit.title = '편집';
      edit.addEventListener('click', () => {
        this.starEntries.splice(i, 1);
        this.starFormEl.classList.add('open');
        (this.starFormEl.querySelector('#star-nodeId') as HTMLInputElement).value = entry.nodeId;
        (this.starFormEl.querySelector('#star-flipped') as HTMLInputElement).checked = entry.flipped;
        this.rebuildStarList();
      });

      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.starEntries.splice(i, 1);
        this.rebuildStarList();
      });
      item.appendChild(edit);
      item.appendChild(del);
      this.starListEl.appendChild(item);
    });
  }

  private rebuildSwitchList(): void {
    this.switchListEl.innerHTML = '';
    this.switchConns.forEach((sw, i) => {
      const item = document.createElement('div');
      item.className = 'editor-conn-item';
      item.style.flexDirection = 'column';
      item.style.alignItems = 'flex-start';
      const typeColor = sw.type === 'spawn' ? '#44DDBB' : '#FFAA44';
      const targetsStr = sw.targets.map(t => {
        if (sw.type === 'move' && t.moveTarget) {
          return `${t.nodeId}<small style="color:#888">(→${t.moveTarget.map(v => v.toFixed(1)).join(',')})</small>`;
        }
        return t.nodeId;
      }).join(', ');
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;align-items:center;gap:4px;width:100%;';
      header.innerHTML = `<span style="color:${typeColor}">⬡</span> <span style="flex:1;">${sw.switchNodeId} → [${targetsStr}] <small>[${sw.mode}/${sw.type}]</small></span>`;

      const edit = document.createElement('button');
      edit.textContent = '✎';
      edit.title = '편집';
      edit.addEventListener('click', () => {
        this.switchConns.splice(i, 1);
        this.swPendingTargets = sw.targets.map(t => ({ ...t }));
        const swTargetListEl = this.switchFormEl.querySelector('#sw-target-list') as HTMLElement;
        this.renderSwTargetList(swTargetListEl);
        this.switchFormEl.classList.add('open');
        (this.switchFormEl.querySelector('#sw-switch') as HTMLInputElement).value = sw.switchNodeId;
        (this.switchFormEl.querySelector('#sw-mode') as HTMLSelectElement).value = sw.mode;
        (this.switchFormEl.querySelector('#sw-type') as HTMLSelectElement).value = sw.type;
        const swTargetMoveRow = this.switchFormEl.querySelector('#sw-target-move-row') as HTMLElement;
        swTargetMoveRow.style.display = sw.type === 'move' ? '' : 'none';
        this.rebuildSwitchList();
      });

      const del = document.createElement('button');
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.switchConns.splice(i, 1);
        this.rebuildSwitchList();
      });
      header.appendChild(edit);
      header.appendChild(del);
      item.appendChild(header);
      this.switchListEl.appendChild(item);
    });
  }

  /** 에디터 블록 메시에 가시 표시 콘을 추가하거나 제거한다 */
  private _setSpikeIndicator(block: EditorBlock, on: boolean): void {
    const existing = block.mesh.children.find(c => c.userData.isSpikeIndicator);
    if (existing) {
      block.mesh.remove(existing);
      existing.traverse(c => {
        if (c instanceof THREE.Mesh) { c.geometry.dispose(); (c.material as THREE.Material).dispose(); }
      });
    }
    if (!on) return;
    const color = 0xFF2200; // 항상 빨간색 (always/blinking 동일)
    const mat = new THREE.MeshBasicMaterial({ color });
    const geo = new THREE.ConeGeometry(0.18, 0.28, 4);
    const cone = new THREE.Mesh(geo, mat);
    cone.position.y = 0.25 + 0.14; // 블록 상단(+0.25) + 콘 반높이
    cone.userData.isSpikeIndicator = true;
    block.mesh.add(cone);
  }

  private updateZoneOverlays(): void {
    // 기존 오버레이 전부 제거
    for (const mesh of this.zoneOverlays.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.zoneOverlays.clear();

    // 구역별로 그리드 바닥을 덮는 직사각형 평면 1장씩 생성
    this.zones.forEach((zone, zi) => {
      const color = LevelEditor.ZONE_COLORS[zi % LevelEditor.ZONE_COLORS.length];
      const geo = new THREE.PlaneGeometry(zone.width, zone.depth);
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const overlay = new THREE.Mesh(geo, mat);
      overlay.rotation.x = -Math.PI / 2;
      // 구역 중심 = (gridX + width/2, 0.005, gridZ + depth/2)
      overlay.position.set(
        zone.gridX + zone.width / 2,
        0.005,
        zone.gridZ + zone.depth / 2,
      );
      overlay.renderOrder = 1;
      this.scene.add(overlay);
      // key를 zone.id로 저장 (1구역 = 1오버레이)
      this.zoneOverlays.set(zone.id, overlay);
    });
  }

  private rebuildPatrolList(): void {
    if (!this.patrolListEl) return;
    this.patrolListEl.innerHTML = '';
    if (this.patrolConns.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:#888;margin:4px 0;';
      empty.textContent = '패트롤 없음';
      this.patrolListEl.appendChild(empty);
      return;
    }
    this.patrolConns.forEach((p, i) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;font-size:11px;';
      const info = document.createElement('span');
      info.style.flex = '1';
      info.textContent = `${p.nodeId}  ${p.axis.toUpperCase().replace('-', '−')}  ${p.distance}u  ${p.duration}s`;
      const del = document.createElement('button');
      del.className = 'editor-btn';
      del.textContent = '✕';
      del.style.cssText = 'padding:1px 6px;font-size:11px;';
      del.addEventListener('click', () => {
        this.patrolConns.splice(i, 1);
        this._rebuildPatrolArrows();
        this.rebuildPatrolList();
      });
      row.appendChild(info);
      row.appendChild(del);
      this.patrolListEl.appendChild(row);
    });
  }

  /** 에디터 씬에 패트롤 방향 화살표를 다시 그린다 */
  private _rebuildPatrolArrows(): void {
    for (const arr of this.patrolArrows) this.scene.remove(arr);
    this.patrolArrows = [];

    for (const p of this.patrolConns) {
      const block = this.blocks.find(b => b.id === p.nodeId);
      if (!block) continue;
      const sign     = p.axis.startsWith('-') ? -1 : 1;
      const baseAxis = p.axis.replace('-', '') as 'x' | 'y' | 'z';
      const origin = block.mesh.position.clone();
      origin.y += 0.35;
      const dir = new THREE.Vector3(
        baseAxis === 'x' ? sign : 0,
        baseAxis === 'y' ? sign : 0,
        baseAxis === 'z' ? sign : 0,
      );
      const arr = new THREE.ArrowHelper(dir, origin, p.distance, 0x44AAFF, 0.2, 0.12);
      this.scene.add(arr);
      this.patrolArrows.push(arr);
    }
  }

  private rebuildZoneList(): void {
    this.zoneListEl.innerHTML = '';
    if (this.zones.length === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:11px;color:#888;margin:4px 0;';
      empty.textContent = '구역 없음';
      this.zoneListEl.appendChild(empty);
      this.updateZoneOverlays();
      return;
    }
    this.zones.forEach((zone, zi) => {
      const zoneColor    = LevelEditor.ZONE_COLORS[zi % LevelEditor.ZONE_COLORS.length];
      const zoneColorCss = '#' + zoneColor.toString(16).padStart(6, '0');

      const wrap = document.createElement('div');
      wrap.style.cssText = `border:1px solid #ddd;border-left:4px solid ${zoneColorCss};border-radius:4px;padding:6px;margin-bottom:6px;`;

      // 헤더: 색상 뱃지 + ID + 삭제
      const header = document.createElement('div');
      header.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;';
      const title = document.createElement('strong');
      title.style.cssText = 'font-size:12px;display:flex;align-items:center;gap:5px;';
      const badge = document.createElement('span');
      badge.style.cssText = `display:inline-block;width:12px;height:12px;border-radius:2px;background:${zoneColorCss};flex-shrink:0;`;
      title.appendChild(badge);
      title.appendChild(document.createTextNode(zone.id));
      const delBtn = document.createElement('button');
      delBtn.className = 'editor-btn';
      delBtn.textContent = '✕';
      delBtn.style.cssText = 'padding:1px 6px;font-size:11px;';
      delBtn.addEventListener('click', () => { this.zones.splice(zi, 1); this.rebuildZoneList(); });
      header.appendChild(title);
      header.appendChild(delBtn);
      wrap.appendChild(header);

      // 위치/크기 편집
      const boundsRow = document.createElement('div');
      boundsRow.style.cssText = 'display:flex;gap:4px;align-items:center;font-size:11px;margin-bottom:4px;flex-wrap:wrap;';
      boundsRow.innerHTML = `
        <label style="color:#666;min-width:28px">위치:</label>
        <label>X</label><input class="editor-input" type="number" step="1" value="${zone.gridX}" style="width:40px" data-zi="${zi}" data-field="gridX">
        <label>Z</label><input class="editor-input" type="number" step="1" value="${zone.gridZ}" style="width:40px" data-zi="${zi}" data-field="gridZ">
        <label style="margin-left:4px">W</label><input class="editor-input" type="number" step="1" min="1" value="${zone.width}" style="width:40px" data-zi="${zi}" data-field="width">
        <label>D</label><input class="editor-input" type="number" step="1" min="1" value="${zone.depth}" style="width:40px" data-zi="${zi}" data-field="depth">
      `;
      boundsRow.querySelectorAll('input[data-field]').forEach(el => {
        el.addEventListener('input', (e) => {
          const inp   = e.target as HTMLInputElement;
          const idx   = parseInt(inp.dataset.zi!);
          const field = inp.dataset.field as keyof ZoneEntry;
          (this.zones[idx] as never as Record<string, number>)[field] = parseInt(inp.value) || 0;
          this.updateZoneOverlays();
        });
      });
      wrap.appendChild(boundsRow);

      const autoLabel = document.createElement('div');
      autoLabel.style.cssText = 'font-size:10px;color:#888;margin-bottom:2px;';
      const cx = (zone.gridX + zone.width  / 2).toFixed(1);
      const cz = (zone.gridZ + zone.depth  / 2).toFixed(1);
      autoLabel.textContent = `Cam target: (${cx}, 0, ${cz}) — 자동`;
      wrap.appendChild(autoLabel);

      this.zoneListEl.appendChild(wrap);
    });

    this.updateZoneOverlays();
  }

  /** initCam → 카메라 슬라이더 동기화 (loadFromLevelData 호출 후) */
  private rebuildCameraPanel(): void {
    if (!this.camAzSlider) return; // 패널 미초기화 시 스킵
    const c = this.initCam ?? { azimuth: 45, polar: 33, distance: 14, targetY: 0 };
    this.camAzSlider.value   = this.camAzNum.value   = String(c.azimuth);
    this.camPoSlider.value   = this.camPoNum.value   = String(c.polar);
    this.camDistSlider.value = this.camDistNum.value = String(c.distance);
    this.camTySlider.value   = this.camTyNum.value   = String(c.targetY);
    this.initCam = this.initCam ? { ...c } : null;
    // preview 텍스트 직접 갱신 (슬라이더 input 이벤트가 발화하지 않으므로)
    if (this.camPreviewEl) {
      const azR = c.azimuth * Math.PI / 180;
      const poR = c.polar   * Math.PI / 180;
      const dx = +(c.distance * Math.sin(poR) * Math.sin(azR)).toFixed(2);
      const dy = +(c.targetY + c.distance * Math.cos(poR)).toFixed(2);
      const dz = +(c.distance * Math.sin(poR) * Math.cos(azR)).toFixed(2);
      this.camPreviewEl.textContent = `pos offset: (${dx}, ${dy}, ${dz})`;
    }
  }

  /** swPendingTargets를 기반으로 #sw-target-list 내용을 렌더링 */
  private renderSwTargetList(el: HTMLElement): void {
    el.innerHTML = '';
    this.swPendingTargets.forEach((t, ti) => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:4px;margin:1px 0;font-size:12px;';
      const mtLabel = t.moveTarget
        ? `<small style="color:#888"> → (${t.moveTarget.map(v => v.toFixed(1)).join(',')})</small>`
        : '';
      row.innerHTML = `<span style="flex:1;color:#ddd;">${t.nodeId}${mtLabel}</span>`;
      const del = document.createElement('button');
      del.className = 'editor-btn';
      del.textContent = '×';
      del.addEventListener('click', () => {
        this.swPendingTargets.splice(ti, 1);
        this.renderSwTargetList(el);
      });
      row.appendChild(del);
      el.appendChild(row);
    });
  }

  private updateSelectedPanel(): void {
    const b = this.selectedBlock;
    if (b) {
      this.selIdEl.textContent = b.id;
      this.selFloorEl.textContent = String(b.floor);
      this.colorInput.value = b.color;
      this.walkableInput.checked = b.walkable;
      this.spikeInput.checked    = b.isSpike;
      this.spikeTypeSelect.value = b.spikeType;
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
      isSpike: this.spikeMode,
      spikeType: this.spikeModeType,
      mesh: blockInst.mesh,
    };
    if (this.spikeMode) this._setSpikeIndicator(block, true);
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
    if (this.goalBlockId    === block.id) { this.goalBlockId = this.blocks[this.blocks.length - 1]?.id ?? null; this.goalFlipped = false; }
    this.starEntries        = this.starEntries.filter(e => e.nodeId !== block.id);
    this.gravityFlipNodeIds = this.gravityFlipNodeIds.filter(id => id !== block.id);
    this.switchConns = this.switchConns
      .map(sw => ({ ...sw, targets: sw.targets.filter(t => t.nodeId !== block.id) }))
      .filter(sw => sw.switchNodeId !== block.id && sw.targets.length > 0);
    // 구역은 격자 범위 기반이므로 별도 제거 불필요
    if (this.selectedBlock === block) this.selectedBlock = null;
    this.updateMarkers();
    this.updateSelectedPanel();
    this.hoveredBlock = null;
  }

  private setBlockEmissive(block: EditorBlock, hex: number): void {
    block.mesh.traverse(child => {
      if (!(child instanceof THREE.Mesh)) return;
      const mats = Array.isArray(child.material) ? child.material : [child.material];
      (mats as THREE.MeshLambertMaterial[]).forEach(m => {
        if (m.emissive) m.emissive.setHex(hex);
      });
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

  private startPick(cb: (block: EditorBlock) => void): void {
    this.pickCallback = cb;
    this.viewportEl.style.cursor = 'crosshair';
    this.viewportEl.style.outline = '2px solid #44DDBB';
  }

  private cancelPick(): void {
    this.pickCallback = null;
    this.viewportEl.style.cursor = '';
    this.viewportEl.style.outline = '';
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
    // 중력 프리뷰 상태에서는 mesh.position (실제 이동된 위치)을 사용
    const markerPos = (b: EditorBlock) => ({
      x: b.mesh.position.x,
      y: b.mesh.position.y + 0.25, // center + halfHeight(0.25)
      z: b.mesh.position.z,
    });

    // Start
    const startBlock = this.blocks.find(b => b.id === this.startNodeId);
    if (startBlock) {
      const p = markerPos(startBlock);
      this.startMarker.position.set(p.x, p.y + 0.2, p.z);
      this.startMarker.visible = true;
    } else {
      this.startMarker.visible = false;
    }

    // Midpoint
    const midBlock = this.blocks.find(b => b.id === this.midpointBlockId);
    if (midBlock) {
      const p = markerPos(midBlock);
      this.midpointMarker.position.set(p.x, p.y + 0.2, p.z);
      this.midpointMarker.visible = true;
    } else {
      this.midpointMarker.visible = false;
    }

    // Goal — gold (normal) or blue (flipped)
    const goalBlock = this.blocks.find(b => b.id === this.goalBlockId);
    if (goalBlock) {
      const p       = markerPos(goalBlock);
      const offsetY = this.goalFlipped ? -0.2 : 0.2;
      this.goalMarker.position.set(p.x, p.y + offsetY, p.z);
      (this.goalMarker.material as THREE.MeshLambertMaterial).color.setHex(this.goalFlipped ? 0x44CCFF : 0xFFD700);
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
    } else if (this.currentTool === 'select') {
      this.updateSelectHover();
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

    // Pick 모드: 뷰포트 블록 클릭으로 폼 필드를 채운다
    if (this.pickCallback !== null) {
      const hits = this.raycaster.intersectObjects(this.blocks.map(b => b.mesh), true);
      if (hits.length > 0) {
        const id = hits[0].object.userData.editorBlockId as string;
        const block = this.blocks.find(b => b.id === id);
        if (block) this.pickCallback(block);
      }
      this.pickCallback = null;
      this.viewportEl.style.cursor = '';
      this.viewportEl.style.outline = '';
      return;
    }

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
      // 선택된 블록이면 선택 색으로 복원, 아니면 끔
      const restore = this.hoveredBlock === this.selectedBlock ? 0x222244 : 0x000000;
      this.setBlockEmissive(this.hoveredBlock, restore);
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

  private updateSelectHover(): void {
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const hits = this.raycaster.intersectObjects(this.blocks.map(b => b.mesh), true);

    if (hits.length > 0) {
      const id = hits[0].object.userData.editorBlockId as string;
      const block = this.blocks.find(b => b.id === id);
      if (block && block !== this.hoveredBlock) {
        this.clearHoverHighlight();
        this.hoveredBlock = block;
        // 이미 선택된 블록이면 더 밝게, 아니면 옅은 청록으로 표시
        this.setBlockEmissive(block, block === this.selectedBlock ? 0x4444AA : 0x224444);
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
    this._updateAxisLabels();
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

  /** 그리드 끝 모서리에 3D 축 화살표와 HTML 레이블을 생성한다 */
  private _buildAxisArrows(): void {
    // 그리드 범위를 살짝 벗어난 위치 (0,0 모서리 기준)
    const origin = new THREE.Vector3(-1, 0.05, -1);
    const len = 3;

    const axes: Array<{ dir: THREE.Vector3; color: number; label: string; cssColor: string }> = [
      { dir: new THREE.Vector3(1, 0, 0), color: 0xFF4444, label: 'X', cssColor: '#FF6666' },
      { dir: new THREE.Vector3(0, 0, 1), color: 0x4466FF, label: 'Z', cssColor: '#6699FF' },
      { dir: new THREE.Vector3(0, 1, 0), color: 0x33CC55, label: 'Y', cssColor: '#55EE77' },
    ];

    for (const { dir, color, label, cssColor } of axes) {
      const arrow = new THREE.ArrowHelper(dir, origin, len, color, 0.4, 0.25);
      this.scene.add(arrow);
      this.axisArrows.push(arrow);

      // HTML 레이블 — updateLabels() 루프 바깥에서 관리
      const el = document.createElement('div');
      el.style.cssText = `position:absolute;pointer-events:none;font:bold 13px monospace;color:${cssColor};
        text-shadow:0 0 4px #000,0 0 2px #000;transform:translate(-50%,-50%);`;
      el.textContent = label;
      el.dataset['axisDir'] = `${dir.x},${dir.y},${dir.z}`;
      this.labelsContainer.appendChild(el);
      this.axisLabelEls.push(el);
    }
  }

  /** 매 프레임: 3D 축 레이블 HTML 위치를 카메라 투영으로 갱신 */
  private _updateAxisLabels(): void {
    const w = this.viewportEl.clientWidth;
    const h = this.viewportEl.clientHeight;
    const origin = new THREE.Vector3(-1, 0.05, -1);
    const len = 3;

    this.axisLabelEls.forEach((el) => {
      const raw = el.dataset['axisDir']!.split(',').map(Number);
      const tip = origin.clone().addScaledVector(new THREE.Vector3(raw[0], raw[1], raw[2]), len + 0.6);
      tip.project(this.camera);
      if (tip.z > 1) { el.style.display = 'none'; return; }
      el.style.display = 'block';
      el.style.left = `${(tip.x * 0.5 + 0.5) * w}px`;
      el.style.top  = `${(-tip.y * 0.5 + 0.5) * h}px`;
    });
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
        ...(b.isSpike ? { isSpike: true, spikeType: b.spikeType } : {}),
      })),
      ladders: this.ladderConns,
      conditionalLadders: (() => {
        const map = new Map<string, Array<{ nodeA: string; nodeB: string }>>();
        for (const cl of this.conditionalLadderConns) {
          const arr = map.get(cl.switchNodeId) ?? [];
          arr.push({ nodeA: cl.nodeA, nodeB: cl.nodeB });
          map.set(cl.switchNodeId, arr);
        }
        return map.size > 0
          ? Array.from(map.entries()).map(([switchNodeId, pairs]) => ({ switchNodeId, pairs }))
          : undefined;
      })(),
      teleporters: this.teleporterConns.length > 0 ? this.teleporterConns : undefined,
      stars: this.starEntries.length > 0 ? this.starEntries.map(e => ({ nodeId: e.nodeId, ...(e.flipped ? { flipped: true } : {}) })) : undefined,
      gravityFlipBlocks: this.gravityFlipNodeIds.length > 0 ? this.gravityFlipNodeIds.map(id => ({ nodeId: id })) : undefined,
      // 각 SwitchConn을 targetNodeId 하나씩의 SwitchDef로 펼쳐 내보냄
      switches: this.switchConns.length > 0 ? this.switchConns.flatMap(sw =>
        sw.targets.map(t => ({
          switchNodeId: sw.switchNodeId,
          targetNodeId: t.nodeId,
          mode: sw.mode,
          type: sw.type,
          ...(sw.type === 'move' && t.moveTarget ? { moveTarget: t.moveTarget } : {}),
        }))
      ) : undefined,
      patrols: this.patrolConns.length > 0 ? this.patrolConns.map(p => ({ ...p })) : undefined,
      illusionConnections: this.illusionConns.map(c => ({
        nodeA: c.nodeA,
        nodeB: c.nodeB,
        activateAzimuth: c.azimuth,
        azimuthTolerance: c.azimuthTol,
        activateElevation: c.elevation,
        elevationTolerance: c.elevationTol,
      })),
      zones: this.zones.length > 0
        ? this.zones.map(z => ({ id: z.id, gridX: z.gridX, gridZ: z.gridZ, width: z.width, depth: z.depth }))
        : undefined,
      character: { startNodeId: this.startNodeId ?? this.blocks[0]?.id ?? '' },
      midpoint:  this.midpointBlockId ? { blockId: this.midpointBlockId } : undefined,
      goal: { blockId: this.goalBlockId ?? this.blocks[this.blocks.length - 1]?.id ?? '', ...(this.goalFlipped ? { flipped: true } : {}) },
      ...(this.initCam ? { initialCamera: this.initCam } : {}),
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
    this.ladderConns             = [];
    this.conditionalLadderConns  = [];
    this.teleporterConns = [];
    this.starEntries            = [];
    this.gravityFlipNodeIds     = [];
    this.goalFlipped            = false;
    this.switchConns     = [];
    this.patrolConns     = [];
    for (const arr of this.patrolArrows) this.scene.remove(arr);
    this.patrolArrows    = [];
    this.zones           = [];
    this.zoneCounter     = 0;
    // 오버레이 초기화
    for (const mesh of this.zoneOverlays.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    }
    this.zoneOverlays.clear();
    this.selectedBlock   = null;
    this.hoveredBlock    = null;
    this.midpointBlockId = null;

    // Parse stage name and meta
    this.stageName       = data.name;
    this.bgColor         = data.backgroundColor;
    this.startNodeId     = data.character.startNodeId;
    this.midpointBlockId = data.midpoint?.blockId ?? null;
    this.goalBlockId     = data.goal.blockId;
    this.goalFlipped     = data.goal.flipped ?? false;

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
        isSpike: !!bd.isSpike,
        spikeType: bd.spikeType ?? 'always',
        mesh: blockInst.mesh,
      };
      if (bd.isSpike) this._setSpikeIndicator(block, true);
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
    this.ladderConns            = data.ladders ?? [];
    this.conditionalLadderConns = (data.conditionalLadders ?? []).flatMap(cl =>
      cl.pairs.map(p => ({ switchNodeId: cl.switchNodeId, nodeA: p.nodeA, nodeB: p.nodeB }))
    );
    this.teleporterConns = data.teleporters ?? [];
    this.starEntries          = (data.stars ?? []).map(s => ({ nodeId: s.nodeId, flipped: s.flipped ?? false }));
    this.goalFlipped          = data.goal.flipped ?? false;
    this.gravityFlipNodeIds   = (data.gravityFlipBlocks ?? []).map(g => g.nodeId);
    // 같은 (switchNodeId + mode + type) 조합을 그룹핑해 targets 배열로 합침
    // 각 타깃은 자신의 moveTarget을 개별 보유
    {
      const map = new Map<string, SwitchConn>();
      for (const sw of data.switches ?? []) {
        const key = `${sw.switchNodeId}|${sw.mode}|${sw.type}`;
        if (map.has(key)) {
          map.get(key)!.targets.push({ nodeId: sw.targetNodeId, moveTarget: sw.moveTarget });
        } else {
          map.set(key, { switchNodeId: sw.switchNodeId, targets: [{ nodeId: sw.targetNodeId, moveTarget: sw.moveTarget }], mode: sw.mode, type: sw.type });
        }
      }
      this.switchConns = Array.from(map.values());
    }

    // Patrols 복원
    this.patrolConns = (data.patrols ?? []).map(p => ({ ...p }));
    this._rebuildPatrolArrows();
    this.rebuildPatrolList();

    // Zones 복원
    this.zones = (data.zones ?? []).map(z => ({
      id:    z.id,
      gridX: z.gridX,
      gridZ: z.gridZ,
      width: z.width,
      depth: z.depth,
    }));
    const maxZoneNum = this.zones
      .map(z => { const m = z.id.match(/(\d+)$/); return m ? parseInt(m[1]) : 0; })
      .reduce((a, b) => Math.max(a, b), 0);
    this.zoneCounter = maxZoneNum;

    // initialCamera 복원
    this.initCam = data.initialCamera
      ? { ...data.initialCamera }
      : null;
    this.rebuildCameraPanel();
    this.rebuildZoneList();

    // Rebuild panel lists
    this.rebuildIllusionList();
    this.rebuildLadderList();
    this.rebuildCondLadderList();
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
    const modules = import.meta.glob<{ default: unknown }>('../levels/level_custom_*.json');
    const loader  = modules[`../levels/level_custom_${stageNum}.json`];
    if (!loader) return;
    const mod  = await loader();
    const data = mod.default as unknown as LevelData;
    this.loadFromLevelData(data);
    this.stageNum = stageNum;
    this.rebuildPanel();
  }

  show(): void {
    this.el.classList.add('visible');
    // 모바일에서는 패널 기본 닫힘으로 시작
    const isMobile = window.innerWidth < 768;
    if (isMobile && this.panelVisible) {
      this.panelVisible = false;
      this.panelEl.classList.add('editor-panel--hidden');
      this.panelToggleBtn.innerHTML = '&#9776;';
    } else if (!isMobile && !this.panelVisible) {
      this.panelVisible = true;
      this.panelEl.classList.remove('editor-panel--hidden');
      this.panelToggleBtn.innerHTML = '&#10005;';
    }
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

    for (const arr of this.patrolArrows) this.scene.remove(arr);
    this.patrolArrows = [];
    for (const arr of this.axisArrows) this.scene.remove(arr);
    this.axisArrows = [];

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
