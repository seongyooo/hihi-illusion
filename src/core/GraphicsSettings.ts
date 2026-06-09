const KEY_ENHANCED      = 'hihi_graphics_enhanced';
const KEY_STAR_BG       = 'hihi_star_bg';
const KEY_BG_COLOR      = 'hihi_bg_color';
const KEY_BLOCK_COLOR   = 'hihi_block_color';
const KEY_BLOCK_VARIANT = 'hihi_block_variant';
const KEY_BLOCK_RADIUS  = 'hihi_block_radius';
const KEY_BLOCK_XZ      = 'hihi_block_xz';
const KEY_CHAR_BODY     = 'hihi_char_body';
const KEY_CHAR_HEAD     = 'hihi_char_head';
const KEY_CHAR_TYPE     = 'hihi_char_type';
const KEY_LIGHT_AMB      = 'hihi_light_amb';
const KEY_LIGHT_DIR      = 'hihi_light_dir';
const KEY_LIGHT_HEMI     = 'hihi_light_hemi';
const KEY_EXPOSURE       = 'hihi_exposure';

export const EXPOSURE_DEFAULT      = 0.48; // Enhanced 모드 기본 노출값
export const BLOCK_RADIUS_DEFAULT  = 0.04; // 블록 모서리 반지름 비율 기본값
export const BLOCK_XZ_DEFAULT      = 0.0;  // XZ 팽창 비율 기본값

export const COLOR_DEFAULTS = {
  charBody:   '#ffffff',
  charHead:   '#f2dfc8',
  bgStandard: '#f5f0e8',
  bgEnhanced: '#eae6dc',
} as const;

/** 조명 강도 모드별 기본값 */
export const LIGHT_DEFAULTS = {
  standard: { ambient: 0.6,  dir: 1.2,  hemi: 0.4  },
  enhanced:  { ambient: 0.32, dir: 1.45, hemi: 0.45 },
} as const;

// ── localStorage helpers ──────────────────────────────────────────────────
function getNum(key: string): number | null {
  const v = localStorage.getItem(key);
  if (v === null) return null;
  const n = parseFloat(v);
  return isNaN(n) ? null : n;
}
function setNum(key: string, val: number | null): void {
  if (val !== null) localStorage.setItem(key, val.toString());
  else localStorage.removeItem(key);
}

export class GraphicsSettings {
  // ── Graphics quality ──────────────────────────────────────────────────
  // 미설정 시 기본값 true (Enhanced on)
  static get enhanced(): boolean { return localStorage.getItem(KEY_ENHANCED) !== 'false'; }
  static set enhanced(val: boolean) { localStorage.setItem(KEY_ENHANCED, val ? 'true' : 'false'); }

  static get starBackground(): boolean { return localStorage.getItem(KEY_STAR_BG) === 'true'; }
  static set starBackground(val: boolean) {
    if (val) localStorage.setItem(KEY_STAR_BG, 'true');
    else localStorage.removeItem(KEY_STAR_BG);
  }

  // ── Color overrides (null = use mode/level default) ───────────────────
  static get backgroundColor(): string | null { return localStorage.getItem(KEY_BG_COLOR); }
  static set backgroundColor(val: string | null) {
    if (val) localStorage.setItem(KEY_BG_COLOR, val);
    else localStorage.removeItem(KEY_BG_COLOR);
  }

  static get blockColorOverride(): string | null { return localStorage.getItem(KEY_BLOCK_COLOR); }
  static set blockColorOverride(val: string | null) {
    if (val) localStorage.setItem(KEY_BLOCK_COLOR, val);
    else localStorage.removeItem(KEY_BLOCK_COLOR);
  }

  static get blockVariant(): string { return localStorage.getItem(KEY_BLOCK_VARIANT) ?? 'default'; }
  static set blockVariant(val: string) {
    if (val === 'default') localStorage.removeItem(KEY_BLOCK_VARIANT);
    else localStorage.setItem(KEY_BLOCK_VARIANT, val);
  }

  static get blockRadiusRatio(): number {
    const v = localStorage.getItem(KEY_BLOCK_RADIUS);
    if (v === null) return BLOCK_RADIUS_DEFAULT;
    const n = parseFloat(v);
    return isNaN(n) ? BLOCK_RADIUS_DEFAULT : n;
  }
  static set blockRadiusRatio(val: number) {
    if (val === BLOCK_RADIUS_DEFAULT) localStorage.removeItem(KEY_BLOCK_RADIUS);
    else localStorage.setItem(KEY_BLOCK_RADIUS, val.toString());
  }

  static get blockXZRatio(): number {
    const v = localStorage.getItem(KEY_BLOCK_XZ);
    if (v === null) return BLOCK_XZ_DEFAULT;
    const n = parseFloat(v);
    return isNaN(n) ? BLOCK_XZ_DEFAULT : n;
  }
  static set blockXZRatio(val: number) {
    if (val === BLOCK_XZ_DEFAULT) localStorage.removeItem(KEY_BLOCK_XZ);
    else localStorage.setItem(KEY_BLOCK_XZ, val.toString());
  }

  static get characterBodyColor(): string {
    return localStorage.getItem(KEY_CHAR_BODY) || COLOR_DEFAULTS.charBody;
  }
  static set characterBodyColor(val: string) { localStorage.setItem(KEY_CHAR_BODY, val); }

  static get characterHeadColor(): string {
    return localStorage.getItem(KEY_CHAR_HEAD) || COLOR_DEFAULTS.charHead;
  }
  static set characterHeadColor(val: string) { localStorage.setItem(KEY_CHAR_HEAD, val); }

  static get characterType(): string {
    return localStorage.getItem(KEY_CHAR_TYPE) ?? 'default';
  }
  static set characterType(val: string) {
    if (val === 'default') localStorage.removeItem(KEY_CHAR_TYPE);
    else localStorage.setItem(KEY_CHAR_TYPE, val);
  }

  // ── Light intensity overrides (null = use mode default) ───────────────
  static get lightAmbient(): number | null { return getNum(KEY_LIGHT_AMB); }
  static set lightAmbient(val: number | null) { setNum(KEY_LIGHT_AMB, val); }

  static get lightDir(): number | null { return getNum(KEY_LIGHT_DIR); }
  static set lightDir(val: number | null) { setNum(KEY_LIGHT_DIR, val); }

  static get lightHemi(): number | null { return getNum(KEY_LIGHT_HEMI); }
  static set lightHemi(val: number | null) { setNum(KEY_LIGHT_HEMI, val); }

  // null = Enhanced 기본값(0.88) 사용. Standard 모드에서는 렌더러가 무시.
  static get exposureOverride(): number | null { return getNum(KEY_EXPOSURE); }
  static set exposureOverride(val: number | null) { setNum(KEY_EXPOSURE, val); }

  static getEffectiveExposure(): number {
    return GraphicsSettings.exposureOverride ?? EXPOSURE_DEFAULT;
  }

  // ── Helpers ───────────────────────────────────────────────────────────
  static getEffectiveBgColor(): string {
    if (GraphicsSettings.starBackground) return '#0A0B1A';
    return GraphicsSettings.backgroundColor
      ?? (GraphicsSettings.enhanced ? COLOR_DEFAULTS.bgEnhanced : COLOR_DEFAULTS.bgStandard);
  }

  /** 현재 모드의 조명 기본값 */
  static getLightDefaults() {
    return GraphicsSettings.enhanced ? LIGHT_DEFAULTS.enhanced : LIGHT_DEFAULTS.standard;
  }

  static resetColors(): void {
    localStorage.removeItem(KEY_BG_COLOR);
    localStorage.removeItem(KEY_BLOCK_COLOR);
    localStorage.removeItem(KEY_BLOCK_VARIANT);
    localStorage.removeItem(KEY_BLOCK_RADIUS);
    localStorage.removeItem(KEY_BLOCK_XZ);
    localStorage.removeItem(KEY_CHAR_BODY);
    localStorage.removeItem(KEY_CHAR_HEAD);
    localStorage.removeItem(KEY_CHAR_TYPE);
  }

  static resetLights(): void {
    localStorage.removeItem(KEY_LIGHT_AMB);
    localStorage.removeItem(KEY_LIGHT_DIR);
    localStorage.removeItem(KEY_LIGHT_HEMI);
    localStorage.removeItem(KEY_EXPOSURE);
  }
}
