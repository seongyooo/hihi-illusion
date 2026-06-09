import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { GraphicsSettings } from '../core/GraphicsSettings';

export type BlockVariant = 'default' | 'stone' | 'metal';

export interface BlockOptions {
  position: [number, number, number];
  color?: number;
  size?: [number, number, number];
  variant?: BlockVariant;
  castShadow?: boolean;
  receiveShadow?: boolean;
}

// Per-variant PBR properties
const VARIANT_BODY: Record<BlockVariant, { roughness: number; metalness: number }> = {
  default: { roughness: 0.78, metalness: 0.03 },
  stone:   { roughness: 0.92, metalness: 0.01 },
  metal:   { roughness: 0.28, metalness: 0.50 },
};

// RoundedBox subdivision segments
const ROUNDED_SEGMENTS = 4;

// ── Material builders ──────────────────────────────────────────────────────

function makeBlockMat(hex: number, variant: BlockVariant): THREE.Material {
  const color = new THREE.Color(hex);
  if (GraphicsSettings.enhanced) {
    const { roughness, metalness } = VARIANT_BODY[variant];
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
  }
  return new THREE.MeshLambertMaterial({ color });
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * 블록 geometry 생성.
 * - ratio: 모서리 반지름 비율 (Y 방향 포함)
 * - xzRatio: XZ 팽창 비율 (인접 블록 이음새 제거용, radius와 독립 조절 가능)
 */
function makeBlockGeo(
  w: number, h: number, d: number,
  ratio   = GraphicsSettings.blockRadiusRatio,
  xzRatio = GraphicsSettings.blockXZRatio,
): THREE.BufferGeometry {
  const r       = Math.min(w, h, d) * Math.max(0, ratio);
  const inflate = Math.min(w, d)    * Math.max(0, xzRatio);
  if (r <= 0 && inflate <= 0) return new THREE.BoxGeometry(w, h, d);
  if (r <= 0)                 return new THREE.BoxGeometry(w + 2 * inflate, h, d + 2 * inflate);
  return new RoundedBoxGeometry(w + 2 * inflate, h, d + 2 * inflate, ROUNDED_SEGMENTS, r);
}

/**
 * Build a THREE.Group with a single (Rounded)BoxGeometry mesh.
 */
export function buildBlockMeshGroup(
  hex: number,
  size: [number, number, number] = [1, 1, 1],
  variant: BlockVariant = 'default',
  castShadow = true,
  receiveShadow = true,
): THREE.Group {
  const [w, h, d] = size;

  const group = new THREE.Group();
  const geo   = makeBlockGeo(w, h, d);
  const mesh  = new THREE.Mesh(geo, makeBlockMat(hex, variant));
  mesh.castShadow    = castShadow;
  mesh.receiveShadow = receiveShadow;
  mesh.userData.isBlock = true;
  group.add(mesh);

  return group;
}

/**
 * Recolor an existing block Group (body + cap) in-place.
 * Disposes old materials before creating new ones.
 */
export function recolorBlockGroup(
  group: THREE.Group,
  hex: number,
  variant: BlockVariant = 'default',
): void {
  for (const child of group.children) {
    const mesh = child as THREE.Mesh;
    (mesh.material as THREE.Material).dispose();
    mesh.material = makeBlockMat(hex, variant);
  }
}

// ── Block class ────────────────────────────────────────────────────────────

export class Block {
  public mesh: THREE.Group;
  private originalColor: number;
  private variant: BlockVariant;
  private currentHex: number; // 현재 적용된 색상 (revariant 시 재사용)
  private readonly size: [number, number, number];

  constructor(options: BlockOptions) {
    const {
      position,
      color    = 0xA8D8EA,
      size     = [1, 1, 1],
      variant  = 'default',
      castShadow    = true,
      receiveShadow = true,
    } = options;

    this.originalColor = color;
    this.currentHex    = color;
    this.variant       = variant;
    this.size          = size;

    this.mesh = buildBlockMeshGroup(color, size, variant, castShadow, receiveShadow);
    this.mesh.position.set(...position);
  }

  /** Swap to a global override color, or restore the block's original JSON color. */
  recolor(hexOverride: number | null): void {
    this.currentHex = hexOverride ?? this.originalColor;
    recolorBlockGroup(this.mesh, this.currentHex, this.variant);
  }

  /** Swap to a different material variant (roughness/metalness), keeping current color. */
  revariant(variant: BlockVariant): void {
    this.variant = variant;
    recolorBlockGroup(this.mesh, this.currentHex, this.variant);
  }

  /** 현재 GraphicsSettings.blockRadiusRatio로 geometry를 재생성한다. */
  rebuildGeometry(): void {
    const mesh = this.mesh.children[0] as THREE.Mesh;
    mesh.geometry.dispose();
    const [w, h, d] = this.size;
    mesh.geometry = makeBlockGeo(w, h, d);
  }
}
