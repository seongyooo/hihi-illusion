/**
 * StagePreviewRenderer
 * 스테이지 선택 화면의 미리보기 이미지 생성기.
 * 레벨 JSON에서 블록만 읽어 작은 Three.js 씬을 렌더링한 뒤
 * data URL로 반환하고, 이후 같은 스테이지는 캐시에서 즉시 반환.
 */
import * as THREE from 'three';
import type { LevelData } from '../world/Level';
import { customModules } from '../levels/registry';

const PREVIEW_W = 256;
const PREVIEW_H = 192;

const _cache = new Map<string, string>();
let _renderer: THREE.WebGLRenderer | null = null;

function getRenderer(): THREE.WebGLRenderer {
  if (!_renderer) {
    _renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
    _renderer.setSize(PREVIEW_W, PREVIEW_H);
    _renderer.setPixelRatio(1);
  }
  return _renderer;
}

function buildPreviewScene(data: LevelData): {
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
} {
  const scene = new THREE.Scene();

  // 조명
  scene.add(new THREE.AmbientLight(0xffffff, 0.75));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(6, 10, 6);
  scene.add(dir);

  // 블록 메시 생성 (단순 BoxGeometry — 빠른 렌더 우선)
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  for (const bd of data.blocks) {
    const [x, y, z] = bd.position;
    const [w, h, d] = bd.size;

    minX = Math.min(minX, x - w / 2); maxX = Math.max(maxX, x + w / 2);
    minY = Math.min(minY, y - h / 2); maxY = Math.max(maxY, y + h / 2);
    minZ = Math.min(minZ, z - d / 2); maxZ = Math.max(maxZ, z + d / 2);

    const geo  = new THREE.BoxGeometry(w * 0.96, h * 0.96, d * 0.96);
    const mat  = new THREE.MeshLambertMaterial({ color: new THREE.Color(bd.color) });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y, z);
    scene.add(mesh);
  }

  // 빈 레벨 방어
  if (!isFinite(minX)) { minX = -1; maxX = 1; minY = -1; maxY = 1; minZ = -1; maxZ = 1; }

  const cx   = (minX + maxX) / 2;
  const cy   = (minY + maxY) / 2;
  const cz   = (minZ + maxZ) / 2;
  const span = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 2);

  // 직교 카메라 — 게임과 동일한 아이소메트릭 시점
  const aspect = PREVIEW_W / PREVIEW_H;
  const halfH  = span * 0.68;
  const halfW  = halfH * aspect;

  const camera = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 5000);
  camera.position.set(cx + span * 1.1, cy + span * 0.85, cz + span * 1.1);
  camera.lookAt(cx, cy, cz);

  return { scene, camera };
}

/** stageNum: 0 = 튜토리얼, 1-N = custom stage */
export async function renderStagePreview(stageNum: number): Promise<string> {
  const key = String(stageNum);
  if (_cache.has(key)) return _cache.get(key)!;

  let data: LevelData;

  if (stageNum === 0) {
    const mod = await import('../levels/level01.json') as unknown as { default: LevelData };
    data = mod.default;
  } else {
    const path   = `./level_custom_${stageNum}.json`;
    const loader = customModules[path];
    if (!loader) throw new Error(`No level module for stage ${stageNum}`);
    const mod = await loader();
    data = mod.default;
  }

  const renderer = getRenderer();
  const { scene, camera } = buildPreviewScene(data);

  const bgColor = data.backgroundColor ?? '#1a1a2e';
  renderer.setClearColor(new THREE.Color(bgColor), 1);
  renderer.render(scene, camera);

  const dataURL = renderer.domElement.toDataURL('image/webp', 0.85);

  // dispose — 메모리 정리
  scene.traverse(obj => {
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(m => (m as THREE.Material).dispose());
    }
  });

  _cache.set(key, dataURL);
  return dataURL;
}

/** 특정 스테이지의 캐시를 지운다 (에디터에서 저장 후 호출) */
export function invalidatePreviewCache(stageNum: number): void {
  _cache.delete(String(stageNum));
}
