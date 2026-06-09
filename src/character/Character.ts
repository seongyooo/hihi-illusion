import * as THREE from 'three';
import { GraphicsSettings } from '../core/GraphicsSettings';

export class Character {
  public mesh: THREE.Group;
  private bodyMesh: THREE.Mesh;
  private headMesh: THREE.Mesh;

  constructor() {
    this.mesh = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.28, 0.40, 0.28);
    const bodyMat = this.makeMat(GraphicsSettings.characterBodyColor);
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.20;
    this.bodyMesh.castShadow = true;
    this.mesh.add(this.bodyMesh);

    const headGeo = new THREE.BoxGeometry(0.22, 0.22, 0.22);
    const headMat = this.makeMat(GraphicsSettings.characterHeadColor);
    this.headMesh = new THREE.Mesh(headGeo, headMat);
    this.headMesh.position.y = 0.51;
    this.headMesh.castShadow = true;
    this.mesh.add(this.headMesh);
  }

  private makeMat(hexStr: string): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
    const color = new THREE.Color(hexStr);
    if (GraphicsSettings.enhanced) {
      return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05 });
    }
    return new THREE.MeshLambertMaterial({ color });
  }

  setBodyColor(hexStr: string): void {
    const mat = this.makeMat(hexStr);
    (this.bodyMesh.material as THREE.Material).dispose();
    this.bodyMesh.material = mat;
  }

  setHeadColor(hexStr: string): void {
    const mat = this.makeMat(hexStr);
    (this.headMesh.material as THREE.Material).dispose();
    this.headMesh.material = mat;
  }

  setPosition(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z);
  }
}
