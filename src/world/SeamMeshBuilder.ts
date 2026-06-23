/**
 * SeamMeshBuilder — 인접한 같은 색 블록 사이의 이음새를 완전히 제거하는 merged mesh 빌더.
 *
 * 전략: 각 블록의 6개 면 중 같은 색 블록과 맞닿는 내부 면은 제거하고,
 * 외부 면만 PlaneGeometry로 수집해 색상별 단일 메시로 합친다.
 * → 블록 경계에 면이 전혀 없으므로 조명 노멀 불연속이 사라져
 *   어떤 카메라 각도에서도 구분선이 보이지 않는다.
 * → 개별 블록 메시는 별도로 visible=false 처리된다(Level.ts).
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GraphicsSettings } from '../core/GraphicsSettings';
import type { BlockData } from './Level';

// ── 재질 ──────────────────────────────────────────────────────────────────

const VARIANT_PBR: Record<string, { roughness: number; metalness: number }> = {
  default: { roughness: 0.78, metalness: 0.03 },
  stone:   { roughness: 0.92, metalness: 0.01 },
  metal:   { roughness: 0.28, metalness: 0.50 },
};

function makeMat(hex: number): THREE.Material {
  const color   = new THREE.Color(hex);
  const variant = GraphicsSettings.blockVariant;
  if (GraphicsSettings.enhanced) {
    const { roughness, metalness } = VARIANT_PBR[variant] ?? VARIANT_PBR.default;
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }
  return new THREE.MeshLambertMaterial({ color });
}

// ── 면(face) 정의 ─────────────────────────────────────────────────────────

interface FaceSpec {
  axis: 'x' | 'y' | 'z';
  dir: 1 | -1;
  axisPos: number;
  c0: number; e0: number;   // 첫 번째 보조 축 중심·반폭
  c1: number; e1: number;   // 두 번째 보조 축 중심·반폭
}

function getBlockFaces(bd: BlockData): FaceSpec[] {
  const [cx, cy, cz] = bd.position;
  const [w, h, d]    = bd.size;
  return [
    { axis: 'x', dir:  1, axisPos: cx + w / 2, c0: cy, e0: h / 2, c1: cz, e1: d / 2 },
    { axis: 'x', dir: -1, axisPos: cx - w / 2, c0: cy, e0: h / 2, c1: cz, e1: d / 2 },
    { axis: 'y', dir:  1, axisPos: cy + h / 2, c0: cx, e0: w / 2, c1: cz, e1: d / 2 },
    { axis: 'y', dir: -1, axisPos: cy - h / 2, c0: cx, e0: w / 2, c1: cz, e1: d / 2 },
    { axis: 'z', dir:  1, axisPos: cz + d / 2, c0: cx, e0: w / 2, c1: cy, e1: h / 2 },
    { axis: 'z', dir: -1, axisPos: cz - d / 2, c0: cx, e0: w / 2, c1: cy, e1: h / 2 },
  ];
}

const EPS = 1e-4;

function rangesOverlap(a: number, ae: number, b: number, be: number): boolean {
  return a + ae > b - be + EPS && b + be > a - ae + EPS;
}

/** 이 면에 맞닿는 같은 색 블록이 존재하면 true (내부 면 → 제거 대상) */
function isInternal(face: FaceSpec, self: BlockData, peers: BlockData[]): boolean {
  for (const other of peers) {
    if (other === self) continue;
    const [ocx, ocy, ocz] = other.position;
    const [ow, oh, od]    = other.size;

    let opp: number, oc0: number, oe0: number, oc1: number, oe1: number;
    if (face.axis === 'x') {
      opp = face.dir === 1 ? ocx - ow / 2 : ocx + ow / 2;
      oc0 = ocy; oe0 = oh / 2; oc1 = ocz; oe1 = od / 2;
    } else if (face.axis === 'y') {
      opp = face.dir === 1 ? ocy - oh / 2 : ocy + oh / 2;
      oc0 = ocx; oe0 = ow / 2; oc1 = ocz; oe1 = od / 2;
    } else {
      opp = face.dir === 1 ? ocz - od / 2 : ocz + od / 2;
      oc0 = ocx; oe0 = ow / 2; oc1 = ocy; oe1 = oh / 2;
    }

    if (Math.abs(opp - face.axisPos) < EPS &&
        rangesOverlap(face.c0, face.e0, oc0, oe0) &&
        rangesOverlap(face.c1, face.e1, oc1, oe1)) {
      return true;
    }
  }
  return false;
}

/** 면 하나를 PlaneGeometry로 변환 */
function buildFaceGeo(f: FaceSpec): THREE.BufferGeometry {
  let g: THREE.BufferGeometry;
  if (f.axis === 'x') {
    g = new THREE.PlaneGeometry(f.e1 * 2, f.e0 * 2);
    g.rotateY(f.dir === 1 ? Math.PI / 2 : -Math.PI / 2);
    g.translate(f.axisPos, f.c0, f.c1);
  } else if (f.axis === 'y') {
    g = new THREE.PlaneGeometry(f.e0 * 2, f.e1 * 2);
    g.rotateX(f.dir === 1 ? -Math.PI / 2 : Math.PI / 2);
    g.translate(f.c0, f.axisPos, f.c1);
  } else {
    g = new THREE.PlaneGeometry(f.e0 * 2, f.e1 * 2);
    if (f.dir === -1) g.rotateY(Math.PI);
    g.translate(f.c0, f.c1, f.axisPos);
  }
  return g;
}

// ── 공개 API ──────────────────────────────────────────────────────────────

/**
 * blocks 배열로부터 이음새-제거 메시 그룹을 생성한다.
 * 인접 같은 색 블록 간 공유 면은 완전히 제거하여 조명 불연속을 없앤다.
 *
 * @param blocks        레벨의 BlockData 배열
 * @param colorOverride null이면 원본 색상별 그룹화, 숫자면 전체 단색
 * @param skipIds       이동·엘리베이터·패트롤 등 동적 블록 ID (seam mesh에서 제외)
 */
export function buildSeamMesh(
  blocks: BlockData[],
  colorOverride: number | null,
  skipIds?: Set<string>,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.isSeamGroup = true;

  // 스파이크·웨지·동적 블록 제외
  const candidates = blocks.filter(b => !b.isSpike && b.shape !== 'wedge' && !skipIds?.has(b.id));
  if (candidates.length === 0) return group;

  const buildMeshForGroup = (colorBlocks: BlockData[], hex: number) => {
    const faceGeos: THREE.BufferGeometry[] = [];
    for (const bd of colorBlocks) {
      for (const face of getBlockFaces(bd)) {
        if (!isInternal(face, bd, colorBlocks)) {
          faceGeos.push(buildFaceGeo(face));
        }
      }
    }
    if (faceGeos.length === 0) return;

    const merged = mergeGeometries(faceGeos);
    faceGeos.forEach(g => g.dispose());

    const mesh = new THREE.Mesh(merged, makeMat(hex));
    mesh.receiveShadow = true;
    mesh.castShadow    = true;
    mesh.userData.isSeamMesh = true;
    group.add(mesh);
  };

  if (colorOverride !== null) {
    buildMeshForGroup(candidates, colorOverride);
  } else {
    const byColor = new Map<string, BlockData[]>();
    for (const bd of candidates) {
      if (!byColor.has(bd.color)) byColor.set(bd.color, []);
      byColor.get(bd.color)!.push(bd);
    }
    for (const [color, colorBlocks] of byColor) {
      buildMeshForGroup(colorBlocks, parseInt(color.replace('#', ''), 16));
    }
  }

  return group;
}

/** seamGroup을 dispose하고 parent에서 제거한다. */
export function disposeSeamGroup(group: THREE.Group | null, parent: THREE.Group): void {
  if (!group) return;
  group.traverse(child => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
  parent.remove(group);
}
