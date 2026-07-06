import * as THREE from 'three';
import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const DRAG_THRESHOLD  = 5;    // px — below this = click, above = drag
const DRAG_SCALE      = 0.015; // radians per pixel
// 레이캐스트 폴백: 카메라 up 벡터와의 내적이 이 값 이하인 면(측면·바닥면)은 무시
const TOP_FACE_DOT_MIN = 0.1;

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

    this.hitBlockId   = null;
    this.hitSectionId = null;

    const ray = this.raycaster.ray;

    // ── Primary: camera-relative top-surface plane intersection ─────────
    // For each block, compute the world-space AABB dynamically (box.max.y is
    // the current world-space top — correct even after map rotation).
    // Collect ALL blocks whose top-plane footprint the ray passes through,
    // then pick the one with the smallest t (closest to the camera).
    // This replaces the old "sort by userData.blockTopY → return first match"
    // approach, which broke after rotation because blockTopY was stale and
    // first-match ≠ nearest-to-camera.

    type PlaneHit = { blockId: string; sectionId: string | null; t: number };
    const planeHits: PlaneHit[] = [];

    if (Math.abs(ray.direction.y) >= 1e-6) {
      const seen = new Set<string>();
      const pt   = new THREE.Vector3();
      const box  = new THREE.Box3();

      for (const target of this.targets) {
        const blockId = target.userData.blockId as string | undefined;
        if (!blockId || seen.has(blockId)) continue;
        seen.add(blockId);

        // World-space AABB — accounts for RotatingSection and mapRotate pivots
        box.setFromObject(target);
        const topY = box.max.y;
        const t    = (topY - ray.origin.y) / ray.direction.y;
        if (t <= 0) continue; // plane is behind camera

        ray.at(t, pt);
        if (pt.x >= box.min.x && pt.x <= box.max.x &&
            pt.z >= box.min.z && pt.z <= box.max.z) {
          planeHits.push({
            blockId,
            sectionId: (target.userData.sectionId as string) ?? null,
            t,
          });
        }
      }

      if (planeHits.length > 0) {
        // Smallest t = closest block to camera = visually "in front"
        planeHits.sort((a, b) => a.t - b.t);
        this.hitBlockId   = planeHits[0].blockId;
        this.hitSectionId = planeHits[0].sectionId;
        return;
      }
    }

    // ── Fallback: traditional mesh raycast ───────────────────────────────
    // Handles near-horizontal camera angles where the top-plane approach
    // produces no hits (ray barely descends).
    // Only accept faces whose world-space normal aligns with camera.up
    // (i.e. top-facing surfaces only — side/bottom faces are rejected).
    const normalMatrix = new THREE.Matrix3();
    const worldNormal  = new THREE.Vector3();
    const hits = this.raycaster.intersectObjects(this.targets, true);
    for (const hit of hits) {
      if (!(hit.object instanceof THREE.Mesh) || !hit.face) continue;
      normalMatrix.getNormalMatrix(hit.object.matrixWorld);
      worldNormal.copy(hit.face.normal).applyMatrix3(normalMatrix).normalize();
      if (worldNormal.dot(this.camera.up) <= TOP_FACE_DOT_MIN) continue; // skip side/bottom faces
      let obj: THREE.Object3D | null = hit.object;
      while (obj) {
        if (obj.userData.blockId) {
          this.hitBlockId   = obj.userData.blockId   as string;
          this.hitSectionId = (obj.userData.sectionId as string) ?? null;
          return;
        }
        obj = obj.parent;
      }
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
