/**
 * SeamMeshBuilder — 인접한 같은 색 블록 사이의 이음새를 제거하는 merged mesh 빌더.
 *
 * 전략:
 *   - 각 색상 그룹의 블록들을 BoxGeometry로 머지한 단일 메시를 생성
 *   - polygonOffset(양수)으로 개별 블록 메시보다 뒤에 렌더링
 *   - 개별 블록은 평탄한 면 앞에서 seam mesh를 가리고,
 *     둥근 모서리 틈새(gap)에서만 seam mesh가 보여 이음새를 채움
 *   - 블록 측면 크기를 건드리지 않으므로 사다리에 영향 없음
 */

import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GraphicsSettings } from '../core/GraphicsSettings';
import type { BlockData } from './Level';

function makeMat(hex: number): THREE.Material {
  const color = new THREE.Color(hex);
  const mat = GraphicsSettings.enhanced
    ? new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.03 })
    : new THREE.MeshLambertMaterial({ color });
  // 양수 polygonOffset → 개별 블록(오프셋 없음) 보다 뒤에서 렌더링
  mat.polygonOffset      = true;
  mat.polygonOffsetFactor = 2;
  mat.polygonOffsetUnits  = 4;
  return mat;
}

/**
 * blocks 배열로부터 seam-filler 메시 그룹을 생성한다.
 *
 * @param blocks     레벨의 BlockData 배열
 * @param colorOverride  null이면 원본 색상별로 그룹화, 숫자면 전체 단색
 */
export function buildSeamMesh(
  blocks: BlockData[],
  colorOverride: number | null,
): THREE.Group {
  const group = new THREE.Group();
  group.userData.isSeamGroup = true;

  // 스파이크·웨지 제외 (형태가 달라 BoxGeometry로 커버 불가)
  const candidates = blocks.filter(b => !b.isSpike && b.shape !== 'wedge');
  if (candidates.length === 0) return group;

  if (colorOverride !== null) {
    // 단색 오버라이드: 전체를 하나의 메시로
    const geos = candidates.map(bd => {
      const [cx, cy, cz] = bd.position;
      const [w, h, d]    = bd.size;
      const g = new THREE.BoxGeometry(w, h, d);
      g.translate(cx, cy, cz);
      return g;
    });
    const merged = mergeGeometries(geos);
    geos.forEach(g => g.dispose());

    const mesh = new THREE.Mesh(merged, makeMat(colorOverride));
    mesh.receiveShadow = true;
    mesh.castShadow    = true;
    mesh.userData.isSeamMesh = true;
    group.add(mesh);
  } else {
    // 원본 색상별 그룹화
    const byColor = new Map<string, BlockData[]>();
    for (const bd of candidates) {
      if (!byColor.has(bd.color)) byColor.set(bd.color, []);
      byColor.get(bd.color)!.push(bd);
    }

    for (const [color, colorBlocks] of byColor) {
      const geos = colorBlocks.map(bd => {
        const [cx, cy, cz] = bd.position;
        const [w, h, d]    = bd.size;
        const g = new THREE.BoxGeometry(w, h, d);
        g.translate(cx, cy, cz);
        return g;
      });
      const merged = mergeGeometries(geos);
      geos.forEach(g => g.dispose());

      const hex = parseInt(color.replace('#', ''), 16);
      const mesh = new THREE.Mesh(merged, makeMat(hex));
      mesh.receiveShadow = true;
      mesh.castShadow    = true;
      mesh.userData.isSeamMesh = true;
      group.add(mesh);
    }
  }

  return group;
}

/** seamGroup을 dispose하고 씬에서 제거한다. */
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
