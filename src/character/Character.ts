import * as THREE from 'three';

export class Character {
  public mesh: THREE.Group;

  constructor() {
    this.mesh = new THREE.Group();

    const bodyGeo  = new THREE.BoxGeometry(0.28, 0.40, 0.28);
    const bodyMat  = new THREE.MeshLambertMaterial({ color: 0xFFFFFF });
    const body     = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.20; // feet at y=0
    body.castShadow = true;
    this.mesh.add(body);

    const headGeo  = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const headMat  = new THREE.MeshLambertMaterial({ color: 0xF2DFC8 });
    const head     = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0.51;
    head.castShadow = true;
    this.mesh.add(head);
  }

  setPosition(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z);
  }
}
