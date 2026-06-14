import * as THREE from 'three';
import gsap from 'gsap';
import { GraphicsSettings } from '../core/GraphicsSettings';

export type CharacterType = 'default' | 'robot' | 'human';

export class Character {
  public mesh: THREE.Group;

  /** 바디 컬러가 적용되는 메시 목록 */
  private bodyMeshes: THREE.Mesh[] = [];
  /** 헤드 컬러가 적용되는 메시 목록 */
  private headMeshes: THREE.Mesh[] = [];

  /** 걷기 애니 대상 — limb 그룹 피벗 */
  private leftLeg:  THREE.Group | null = null;
  private rightLeg: THREE.Group | null = null;
  private leftArm:  THREE.Group | null = null;
  private rightArm: THREE.Group | null = null;

  private walkTl: gsap.core.Timeline | null = null;

  constructor(type: CharacterType = 'default') {
    this.mesh = new THREE.Group();
    switch (type) {
      case 'robot': this._buildRobot(); break;
      case 'human': this._buildHuman(); break;
      default:      this._buildDefault(); break;
    }
  }

  // ── Default (원본 두 박스) ────────────────────────────────────────────

  private _buildDefault(): void {
    const body = this._addMesh(
      new THREE.BoxGeometry(0.28, 0.40, 0.28),
      this._bodyMat(),
      [0, 0.20, 0],
    );
    this.bodyMeshes.push(body);

    const head = this._addMesh(
      new THREE.BoxGeometry(0.22, 0.22, 0.22),
      this._headMat(),
      [0, 0.51, 0],
    );
    this.headMeshes.push(head);
  }

  // ── Robot ─────────────────────────────────────────────────────────────
  // 총 높이 ~0.77 u / 발 y=0 / 머리 top y≈0.77

  private _buildRobot(): void {
    // 다리 (힙 피벗 → 아래로 늘어짐)
    this.leftLeg  = this._robotLeg(-1);
    this.rightLeg = this._robotLeg(+1);
    this.mesh.add(this.leftLeg, this.rightLeg);

    // 몸통
    const body = this._addMesh(
      new THREE.BoxGeometry(0.28, 0.22, 0.20),
      this._bodyMat(),
      [0, 0.37, 0],
    );
    this.bodyMeshes.push(body);

    // 팔 (어깨 피벗)
    this.leftArm  = this._robotArm(-1);
    this.rightArm = this._robotArm(+1);
    this.mesh.add(this.leftArm, this.rightArm);

    // 넥
    const neck = this._addMesh(
      new THREE.BoxGeometry(0.09, 0.07, 0.09),
      this._bodyMat(),
      [0, 0.515, 0],
    );
    this.bodyMeshes.push(neck);

    // 머리
    const head = this._addMesh(
      new THREE.BoxGeometry(0.26, 0.22, 0.26),
      this._headMat(),
      [0, 0.66, 0],
    );
    this.headMeshes.push(head);

    // 발광 눈 (항상 MeshStandardMaterial + emissive)
    const eyeGeo = new THREE.BoxGeometry(0.07, 0.04, 0.01);
    const eyeMat = new THREE.MeshStandardMaterial({
      color: 0x88ffff, emissive: new THREE.Color(0x88ffff), emissiveIntensity: 1.0,
    });
    for (const xSign of [-1, 1] as const) {
      const eye = new THREE.Mesh(eyeGeo, eyeMat.clone());
      eye.position.set(xSign * 0.07, 0.665, 0.135);
      eye.castShadow = false;
      this.mesh.add(eye);
    }
    eyeMat.dispose();
  }

  private _robotLeg(side: -1 | 1): THREE.Group {
    const g = new THREE.Group();
    g.position.set(side * 0.08, 0.26, 0);

    const leg = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.07, 0.26, 8),
      this._bodyMat(),
    );
    leg.position.y = -0.13;
    leg.castShadow = true;
    this.bodyMeshes.push(leg);
    g.add(leg);
    return g;
  }

  private _robotArm(side: -1 | 1): THREE.Group {
    const g = new THREE.Group();
    g.position.set(side * 0.22, 0.44, 0);

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.24, 0.11),
      this._bodyMat(),
    );
    arm.position.y = -0.12;
    arm.castShadow = true;
    this.bodyMeshes.push(arm);
    g.add(arm);
    return g;
  }

  // ── Human ──────────────────────────────────────────────────────────────
  // 총 높이 ~0.84 u / 발 y≈0.01 / 머리 top y≈0.84

  private _buildHuman(): void {
    // 다리
    this.leftLeg  = this._humanLeg(-1);
    this.rightLeg = this._humanLeg(+1);
    this.mesh.add(this.leftLeg, this.rightLeg);

    // 몸통
    const body = this._addMesh(
      new THREE.BoxGeometry(0.25, 0.27, 0.18),
      this._bodyMat(),
      [0, 0.415, 0],
    );
    this.bodyMeshes.push(body);

    // 팔
    this.leftArm  = this._humanArm(-1);
    this.rightArm = this._humanArm(+1);
    this.mesh.add(this.leftArm, this.rightArm);

    // 목
    const neck = new THREE.Mesh(
      new THREE.CylinderGeometry(0.055, 0.065, 0.08, 8),
      this._bodyMat(),
    );
    neck.position.set(0, 0.59, 0);
    this.bodyMeshes.push(neck);
    this.mesh.add(neck);

    // 머리
    const head = this._addMesh(
      new THREE.BoxGeometry(0.21, 0.21, 0.21),
      this._headMat(),
      [0, 0.735, 0],
    );
    this.headMeshes.push(head);
  }

  private _humanLeg(side: -1 | 1): THREE.Group {
    const g = new THREE.Group();
    g.position.set(side * 0.07, 0.28, 0);

    const upper = new THREE.Mesh(
      new THREE.BoxGeometry(0.12, 0.13, 0.12),
      this._bodyMat(),
    );
    upper.position.y = -0.065;
    upper.castShadow = true;
    this.bodyMeshes.push(upper);
    g.add(upper);

    const lower = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.14, 0.11),
      this._bodyMat(),
    );
    lower.position.y = -0.20;
    lower.castShadow = true;
    this.bodyMeshes.push(lower);
    g.add(lower);

    return g;
  }

  private _humanArm(side: -1 | 1): THREE.Group {
    const g = new THREE.Group();
    g.position.set(side * 0.18, 0.50, 0);

    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.10, 0.24, 0.10),
      this._bodyMat(),
    );
    arm.position.y = -0.12;
    arm.castShadow = true;
    this.bodyMeshes.push(arm);
    g.add(arm);

    return g;
  }

  // ── Walk animation ─────────────────────────────────────────────────────

  startWalk(): void {
    if (this.walkTl) return;
    if (!this.leftLeg || !this.rightLeg) return; // default 타입은 no-op

    const swing = 0.45;      // rad
    const dur   = 0.15;      // 반주기(초) — step 0.25s에 맞게 조정

    const tl = gsap.timeline({ repeat: -1 });

    // Phase A: 왼다리 앞 / 오른다리 뒤
    tl.to(this.leftLeg.rotation,  { x: -swing, duration: dur, ease: 'sine.inOut' }, 0)
      .to(this.rightLeg.rotation, { x:  swing, duration: dur, ease: 'sine.inOut' }, 0);
    if (this.leftArm && this.rightArm) {
      tl.to(this.leftArm.rotation,  { x:  swing * 0.55, duration: dur, ease: 'sine.inOut' }, 0)
        .to(this.rightArm.rotation, { x: -swing * 0.55, duration: dur, ease: 'sine.inOut' }, 0);
    }

    // Phase B: 반전
    tl.to(this.leftLeg.rotation,  { x:  swing, duration: dur, ease: 'sine.inOut' })
      .to(this.rightLeg.rotation, { x: -swing, duration: dur, ease: 'sine.inOut' }, '<');
    if (this.leftArm && this.rightArm) {
      tl.to(this.leftArm.rotation,  { x: -swing * 0.55, duration: dur, ease: 'sine.inOut' }, '<')
        .to(this.rightArm.rotation, { x:  swing * 0.55, duration: dur, ease: 'sine.inOut' }, '<');
    }

    this.walkTl = tl;
  }

  stopWalk(): void {
    if (!this.walkTl) return;
    this.walkTl.kill();
    this.walkTl = null;

    const d = 0.12;
    if (this.leftLeg)  gsap.to(this.leftLeg.rotation,  { x: 0, duration: d, ease: 'power1.out' });
    if (this.rightLeg) gsap.to(this.rightLeg.rotation, { x: 0, duration: d, ease: 'power1.out' });
    if (this.leftArm)  gsap.to(this.leftArm.rotation,  { x: 0, duration: d, ease: 'power1.out' });
    if (this.rightArm) gsap.to(this.rightArm.rotation, { x: 0, duration: d, ease: 'power1.out' });
  }

  // ── Color setters ──────────────────────────────────────────────────────

  setBodyColor(hexStr: string): void {
    this.bodyMeshes.forEach(m => {
      (m.material as THREE.Material).dispose();
      m.material = this._matFrom(hexStr, false);
    });
  }

  setHeadColor(hexStr: string): void {
    this.headMeshes.forEach(m => {
      (m.material as THREE.Material).dispose();
      m.material = this._matFrom(hexStr, true);
    });
  }

  setPosition(x: number, y: number, z: number): void {
    this.mesh.position.set(x, y, z);
  }

  setFlipped(flipped: boolean): void {
    this.mesh.rotation.x = flipped ? Math.PI : 0;
  }

  // ── Private helpers ────────────────────────────────────────────────────

  /** 메시 생성 + scene 추가 헬퍼 */
  private _addMesh(
    geo: THREE.BufferGeometry,
    mat: THREE.Material,
    pos: [number, number, number],
  ): THREE.Mesh {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...pos);
    m.castShadow = true;
    this.mesh.add(m);
    return m;
  }

  private _bodyMat(): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
    return this._matFrom(GraphicsSettings.characterBodyColor, false);
  }

  private _headMat(): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
    return this._matFrom(GraphicsSettings.characterHeadColor, true);
  }

  private _matFrom(hexStr: string, _isHead: boolean): THREE.MeshLambertMaterial | THREE.MeshStandardMaterial {
    const color = new THREE.Color(hexStr);
    if (GraphicsSettings.enhanced) {
      return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05 });
    }
    return new THREE.MeshLambertMaterial({ color });
  }
}
