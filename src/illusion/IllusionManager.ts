import * as THREE from 'three';
import type { PathGraph } from '../world/PathGraph';

export interface IllusionConnectionConfig {
  nodeAId:            string;
  nodeBId:            string;
  activateAzimuth:    number; // 활성화 기준 방위각 (도, -180~180)
  azimuthTolerance:   number; // 방위각 허용 오차 (도)
  activateElevation:  number; // 활성화 기준 고도각 (도, 0~90)
  elevationTolerance: number; // 고도각 허용 오차 (도)
}

interface IllusionConnectionState extends IllusionConnectionConfig {
  wasActive:     boolean;
  pendingActive: boolean | null; // 확정 대기 중인 다음 상태
  pendingStart:  number;         // 대기 시작 시각 (performance.now())
}

export interface IllusionCallbacks {
  onActivate?:   (nodeAId: string, nodeBId: string) => void;
  onDeactivate?: (nodeAId: string, nodeBId: string) => void;
}

export class IllusionManager {

  private camera:      THREE.Camera;
  private orbitTarget: THREE.Vector3;
  private connections: IllusionConnectionState[];
  private callbacks:   IllusionCallbacks;

  constructor(
    camera:      THREE.Camera,
    orbitTarget: THREE.Vector3,
    connections: IllusionConnectionConfig[],
    callbacks:   IllusionCallbacks = {}
  ) {
    this.camera      = camera;
    this.orbitTarget = orbitTarget;
    this.connections = connections.map(c => ({
      ...c,
      wasActive:     false,
      pendingActive: null,
      pendingStart:  0,
    }));
    this.callbacks   = callbacks;
  }

  private angularDiff(a: number, b: number): number {
    let diff = Math.abs(a - b);
    if (diff > 180) diff = 360 - diff;
    return diff;
  }

  get currentAzimuth(): number {
    const dx = this.camera.position.x - this.orbitTarget.x;
    const dz = this.camera.position.z - this.orbitTarget.z;
    return Math.atan2(dx, dz) * (180 / Math.PI);
  }

  /** 수평면 기준 고도각 (도). 0° = 수평, 90° = 바로 위 */
  get currentElevation(): number {
    const dx = this.camera.position.x - this.orbitTarget.x;
    const dy = this.camera.position.y - this.orbitTarget.y;
    const dz = this.camera.position.z - this.orbitTarget.z;
    const horizDist = Math.sqrt(dx * dx + dz * dz);
    return Math.atan2(dy, horizDist) * (180 / Math.PI);
  }

  get anyActive(): boolean {
    return this.connections.some(c => c.wasActive);
  }

  // 상태 변경 확정에 필요한 지속 시간 (프레임률 무관)
  private static readonly DEBOUNCE_MS = 100;

  update(graph: PathGraph): void {
    const azimuth   = this.currentAzimuth;
    const elevation = this.currentElevation;
    const now       = performance.now();

    for (const conn of this.connections) {
      const azDiff  = this.angularDiff(azimuth, conn.activateAzimuth);
      const elDiff  = Math.abs(elevation - conn.activateElevation);

      const AZ_ACT  = conn.azimuthTolerance;
      const AZ_DEAC = conn.azimuthTolerance * 2;
      const EL_ACT  = conn.elevationTolerance;
      const EL_DEAC = conn.elevationTolerance * 2;

      const desired = conn.wasActive
        ? azDiff < AZ_DEAC && elDiff < EL_DEAC
        : azDiff < AZ_ACT  && elDiff < EL_ACT;

      if (desired === conn.wasActive) {
        conn.pendingActive = null;
        conn.pendingStart  = 0;
      } else {
        if (conn.pendingActive !== desired) {
          conn.pendingActive = desired;
          conn.pendingStart  = now;
        }

        if (now - conn.pendingStart >= IllusionManager.DEBOUNCE_MS) {
          conn.wasActive     = desired;
          conn.pendingActive = null;
          conn.pendingStart  = 0;
          graph.setIllusionEdge(conn.nodeAId, conn.nodeBId, desired);
          if (desired) this.callbacks.onActivate?.(conn.nodeAId, conn.nodeBId);
          else         this.callbacks.onDeactivate?.(conn.nodeAId, conn.nodeBId);
        }
      }
    }
  }
}
