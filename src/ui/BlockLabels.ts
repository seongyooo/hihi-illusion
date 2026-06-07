import * as THREE from 'three';
import type { PathNode } from '../world/PathGraph';

export class BlockLabels {
  private container: HTMLElement;
  private camera:    THREE.Camera;
  private labels:    Array<{ el: HTMLElement; node: PathNode }> = [];
  private readonly _v = new THREE.Vector3();

  constructor(container: HTMLElement, camera: THREE.Camera) {
    this.container = container;
    this.camera    = camera;
  }

  build(nodes: PathNode[]): void {
    // Clear existing
    for (const { el } of this.labels) el.remove();
    this.labels = [];

    for (const node of nodes) {
      const el = document.createElement('div');
      el.className     = 'block-label';
      el.textContent   = node.id;
      this.container.appendChild(el);
      this.labels.push({ el, node });
    }
  }

  update(): void {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    for (const { el, node } of this.labels) {
      this._v.copy(node.position).project(this.camera);
      if (this._v.z > 1) {          // behind camera
        el.style.display = 'none';
        continue;
      }
      el.style.display = 'block';
      el.style.left    = `${(this._v.x *  0.5 + 0.5) * w}px`;
      el.style.top     = `${(this._v.y * -0.5 + 0.5) * h}px`;
    }
  }

  dispose(): void {
    for (const { el } of this.labels) el.remove();
    this.labels = [];
  }
}
