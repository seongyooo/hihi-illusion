import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DRAG_THRESHOLD = 5;   // px — below this = click, above = drag
const DRAG_SCALE     = 0.015; // radians per pixel

export interface InputCallbacks {
  onBlockClick:   (blockId: string) => void;
  onSectionDrag:  (sectionId: string, deltaRad: number) => void;
  onSectionSnap:  (sectionId: string) => void;
}

export class InputManager {
  private canvas: HTMLCanvasElement;
  private camera: THREE.Camera;
  private targets: THREE.Object3D[];
  private callbacks: InputCallbacks;
  private orbitControls: OrbitControls | null = null;

  private raycaster = new THREE.Raycaster();
  private pointer   = new THREE.Vector2();

  // Drag state
  private mouseDownX  = 0;
  private mouseDownY  = 0;
  private dragStartX  = 0;
  private isDragging  = false;
  private hitBlockId:   string | null = null;
  private hitSectionId: string | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    camera: THREE.Camera,
    targets: THREE.Object3D[],
    callbacks: InputCallbacks
  ) {
    this.canvas    = canvas;
    this.camera    = camera;
    this.targets   = targets;
    this.callbacks = callbacks;
    this.raycaster.params.Line = { threshold: 0.05 };

    canvas.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup',   this.onPointerUp);
  }

  setOrbitControls(oc: OrbitControls): void {
    this.orbitControls = oc;
  }

  private raycast(e: PointerEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    this.pointer.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hits = this.raycaster.intersectObjects(this.targets, true);
    this.hitBlockId   = null;
    this.hitSectionId = null;

    if (hits.length === 0) return;
    let obj: THREE.Object3D | null = hits[0].object;
    while (obj) {
      if (obj.userData.blockId) {
        this.hitBlockId   = obj.userData.blockId   as string;
        this.hitSectionId = (obj.userData.sectionId as string) ?? null;
        return;
      }
      obj = obj.parent;
    }
  }

  private onPointerDown = (e: PointerEvent): void => {
    this.mouseDownX = e.clientX;
    this.mouseDownY = e.clientY;
    this.dragStartX = e.clientX;
    this.isDragging = false;
    this.raycast(e);

    if (this.hitSectionId && this.orbitControls) {
      this.orbitControls.enabled = false;
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const moved = Math.hypot(e.clientX - this.mouseDownX, e.clientY - this.mouseDownY);
    if (!this.isDragging && moved > DRAG_THRESHOLD) {
      this.isDragging = true;
    }

    if (this.isDragging && this.hitSectionId !== null) {
      const deltaRad = (e.clientX - this.dragStartX) * DRAG_SCALE;
      this.dragStartX = e.clientX;
      this.callbacks.onSectionDrag(this.hitSectionId, deltaRad);
    }
  };

  private onPointerUp = (_e: PointerEvent): void => {
    if (this.isDragging && this.hitSectionId) {
      this.callbacks.onSectionSnap(this.hitSectionId);
    } else if (!this.isDragging && this.hitBlockId) {
      this.callbacks.onBlockClick(this.hitBlockId);
    }
    this.isDragging   = false;
    this.hitBlockId   = null;
    this.hitSectionId = null;

    if (this.orbitControls) this.orbitControls.enabled = true;
  };

  /** 런타임에 raycast 대상 추가 (튜토리얼 동적 블록 등) */
  addTarget(mesh: THREE.Object3D): void {
    if (!this.targets.includes(mesh)) this.targets.push(mesh);
  }

  dispose(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup',   this.onPointerUp);
  }
}
