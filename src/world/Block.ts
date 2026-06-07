import * as THREE from 'three';

export interface BlockOptions {
  position: [number, number, number];
  color?: number;
  size?: [number, number, number];
  castShadow?: boolean;
  receiveShadow?: boolean;
}

// BoxGeometry face order: +x, -x, +y, -y, +z, -z
// Isometric camera from (10,10,10): +y(top), +x(right), +z(left-screen) are visible
const FACE_BRIGHTNESS = [0.82, 0.65, 1.0, 0.45, 0.70, 0.55];

function makeFaceMaterials(hex: number): THREE.MeshLambertMaterial[] {
  const base = new THREE.Color(hex);
  return FACE_BRIGHTNESS.map(b =>
    new THREE.MeshLambertMaterial({ color: base.clone().multiplyScalar(b) })
  );
}

export class Block {
  public mesh: THREE.Group;

  constructor(options: BlockOptions) {
    const {
      position,
      color = 0xA8D8EA,
      size = [1, 1, 1],
      castShadow = true,
      receiveShadow = true,
    } = options;

    this.mesh = new THREE.Group();

    // Main box with per-face shading
    const geo = new THREE.BoxGeometry(...size);
    const box = new THREE.Mesh(geo, makeFaceMaterials(color));
    box.castShadow = castShadow;
    box.receiveShadow = receiveShadow;
    this.mesh.add(box);

    // Edge outline
    const edges = new THREE.EdgesGeometry(geo);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.09 });
    const wireframe = new THREE.LineSegments(edges, lineMat);
    this.mesh.add(wireframe);

    this.mesh.position.set(...position);
  }
}
