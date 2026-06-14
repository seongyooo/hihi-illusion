import { GraphicsSettings, COLOR_DEFAULTS, EXPOSURE_DEFAULT, BLOCK_RADIUS_DEFAULT, BLOCK_XZ_DEFAULT, ROTATE_SPEED_DEFAULT, DAMPING_FACTOR_DEFAULT } from '../core/GraphicsSettings';
import { SettingsPreview } from './SettingsPreview';
import { ProgressStore } from '../core/ProgressStore';

const TOTAL_STAGES     = 30;
const DEV_UNLOCK_TAPS  = 10;
const DEV_RESET_MS     = 3000;

interface ColorRow { swatch: HTMLDivElement; picker: HTMLInputElement; }
interface SliderRow { slider: HTMLInputElement; valueEl: HTMLSpanElement; }

export class SettingsScreen {
  private el:      HTMLElement;
  private preview: SettingsPreview;

  // Stored refs for Reset All
  private qualityCheckbox!:   HTMLInputElement;
  private bgRow!:             ColorRow;
  private blockToggle!:       HTMLInputElement;
  private blockRow!:          ColorRow;
  private variantBtns!:       HTMLButtonElement[];
  private radiusRow!:         SliderRow;
  private xzRow!:             SliderRow;
  private charTypeBtns!:      HTMLButtonElement[];
  private charBodyRow!:       ColorRow;
  private charHeadRow!:       ColorRow;
  private ambRow!:            SliderRow;
  private dirRow!:            SliderRow;
  private hemiRow!:           SliderRow;
  private expRow!:            SliderRow;
  private rotateRow!:         SliderRow;
  private dampingRow!:        SliderRow;

  private tapCount  = 0;
  private tapTimer: ReturnType<typeof setTimeout> | null = null;
  private graphicsTapCount  = 0;
  private graphicsTapTimer: ReturnType<typeof setTimeout> | null = null;

  onClose:                () => void = () => {};
  onQualityChange:        (enhanced: boolean)      => void = () => {};
  onBgColorChange:        (hexStr: string | null)  => void = () => {};
  onBlockColorChange:     (hexStr: string | null)  => void = () => {};
  onBlockVariantChange:   (variant: string)        => void = () => {};
  onCharBodyColorChange:  (hexStr: string)          => void = () => {};
  onCharHeadColorChange:  (hexStr: string)          => void = () => {};
  onLightChange:          (type: 'ambient' | 'dir' | 'hemi', val: number | null) => void = () => {};
  onExposureChange:       (val: number | null)     => void = () => {};
  onStarBgChange:         (enabled: boolean)       => void = () => {};
  onCharacterTypeChange:  (type: string)            => void = () => {};
  onBlockRadiusChange:    (val: number)             => void = () => {};
  onBlockXZChange:        (val: number)             => void = () => {};
  onRotateSpeedChange:    (val: number)             => void = () => {};
  onDampingFactorChange:  (val: number)             => void = () => {};

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'settings-screen';

    // ── Header (full width) ───────────────────────────────────────────
    const header = document.createElement('div');
    header.className = 'settings-screen__header';

    const backBtn = document.createElement('button');
    backBtn.className = 'settings-screen__back';
    backBtn.textContent = '← BACK';
    backBtn.addEventListener('click', () => this.onClose());

    const titleEl = document.createElement('span');
    titleEl.className = 'settings-screen__title';
    titleEl.textContent = 'SETTINGS';

    header.appendChild(backBtn);
    header.appendChild(titleEl);
    this.el.appendChild(header);

    // ── 2-column layout: preview | settings ──────────────────────────
    const layout = document.createElement('div');
    layout.className = 'settings-screen__layout';

    // ── Left: preview panel ───────────────────────────────────────────
    const previewPanel = document.createElement('div');
    previewPanel.className = 'settings-screen__preview-panel';

    const previewLabel = document.createElement('div');
    previewLabel.className = 'settings-section-label settings-section-label--first';
    previewLabel.textContent = 'PREVIEW';
    previewLabel.style.cursor = 'default';
    previewLabel.addEventListener('click', () => this.onPreviewTap(previewLabel));
    previewPanel.appendChild(previewLabel);

    this.preview = new SettingsPreview(220, 220);
    previewPanel.appendChild(this.preview.el);
    layout.appendChild(previewPanel);

    // ── Right: settings body ──────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'settings-screen__body';

    // — GRAPHICS —
    const graphicsLabel = document.createElement('div');
    graphicsLabel.className = 'settings-section-label';
    graphicsLabel.textContent = 'GRAPHICS';
    graphicsLabel.style.cursor = 'default';
    graphicsLabel.addEventListener('click', () => this.onGraphicsTap(graphicsLabel));
    body.appendChild(graphicsLabel);

    const qualityRow = this.makeToggleRow(
      'Enhanced Rendering',
      GraphicsSettings.enhanced,
      (val) => { this.onQualityChange(val); this.preview.refresh(); },
    );
    this.qualityCheckbox = qualityRow.checkbox;
    body.appendChild(qualityRow.el);

    const starRow = this.makeToggleRow(
      'Star Background',
      GraphicsSettings.starBackground,
      (val) => { this.onStarBgChange(val); this.preview.refresh(); },
    );
    body.appendChild(starRow.el);

    // — COLORS —
    body.appendChild(this.makeSection('COLORS'));

    const bgR = this.makeColorRow(
      'Background',
      GraphicsSettings.getEffectiveBgColor(),
      (hex) => { this.onBgColorChange(hex); this.preview.refresh(); },
      () => {
        this.onBgColorChange(null);
        const def = GraphicsSettings.getEffectiveBgColor();
        this.bgRow.swatch.style.backgroundColor = def;
        this.bgRow.picker.value = def;
        this.preview.refresh();
      },
    );
    this.bgRow = bgR.colorRow;
    body.appendChild(bgR.el);

    const blockR = this.makeColorToggleRow(
      'All Blocks',
      GraphicsSettings.blockColorOverride !== null,
      GraphicsSettings.blockColorOverride ?? '#a8d8ea',
      (enabled, hex) => { this.onBlockColorChange(enabled ? hex : null); this.preview.refresh(); },
    );
    this.blockToggle = blockR.checkbox;
    this.blockRow    = blockR.colorRow;
    body.appendChild(blockR.el);

    const variantR = this.makeVariantRow(
      GraphicsSettings.blockVariant,
      (v) => { this.onBlockVariantChange(v); this.preview.refresh(); },
    );
    this.variantBtns = variantR.btns;
    body.appendChild(variantR.el);

    const radiusR = this.makeSliderRow(
      'Block Roundness', GraphicsSettings.blockRadiusRatio, 0.00, 0.20, 0.01,
      (v) => { this.onBlockRadiusChange(v); this.preview.refresh(); },
      () => {
        this.onBlockRadiusChange(BLOCK_RADIUS_DEFAULT);
        this.radiusRow.slider.value    = String(BLOCK_RADIUS_DEFAULT);
        this.radiusRow.valueEl.textContent = BLOCK_RADIUS_DEFAULT.toFixed(2);
        this.preview.refresh();
      },
    );
    this.radiusRow = radiusR.sliderRow;
    body.appendChild(radiusR.el);

    const xzR = this.makeSliderRow(
      'XZ Expand', GraphicsSettings.blockXZRatio, 0.00, 0.20, 0.01,
      (v) => { this.onBlockXZChange(v); this.preview.refresh(); },
      () => {
        this.onBlockXZChange(BLOCK_XZ_DEFAULT);
        this.xzRow.slider.value        = String(BLOCK_XZ_DEFAULT);
        this.xzRow.valueEl.textContent = BLOCK_XZ_DEFAULT.toFixed(2);
        this.preview.refresh();
      },
    );
    this.xzRow = xzR.sliderRow;
    body.appendChild(xzR.el);

    const charTypeR = this.makeCharTypeRow(
      GraphicsSettings.characterType,
      (t) => { this.onCharacterTypeChange(t); this.preview.refresh(); },
    );
    this.charTypeBtns = charTypeR.btns;
    body.appendChild(charTypeR.el);

    const charBodyR = this.makeColorRow(
      'Character Body',
      GraphicsSettings.characterBodyColor,
      (hex) => { this.onCharBodyColorChange(hex); this.preview.refresh(); },
      () => {
        this.onCharBodyColorChange(COLOR_DEFAULTS.charBody);
        this.charBodyRow.swatch.style.backgroundColor = COLOR_DEFAULTS.charBody;
        this.charBodyRow.picker.value = COLOR_DEFAULTS.charBody;
        this.preview.refresh();
      },
    );
    this.charBodyRow = charBodyR.colorRow;
    body.appendChild(charBodyR.el);

    const charHeadR = this.makeColorRow(
      'Character Head',
      GraphicsSettings.characterHeadColor,
      (hex) => { this.onCharHeadColorChange(hex); this.preview.refresh(); },
      () => {
        this.onCharHeadColorChange(COLOR_DEFAULTS.charHead);
        this.charHeadRow.swatch.style.backgroundColor = COLOR_DEFAULTS.charHead;
        this.charHeadRow.picker.value = COLOR_DEFAULTS.charHead;
        this.preview.refresh();
      },
    );
    this.charHeadRow = charHeadR.colorRow;
    body.appendChild(charHeadR.el);

    // — LIGHTING —
    body.appendChild(this.makeSection('LIGHTING'));

    const expR = this.makeSliderRow(
      'Exposure', GraphicsSettings.getEffectiveExposure(), 0.2, 2.0, 0.01,
      (v) => { this.onExposureChange(v); this.preview.refresh(); },
      () => {
        this.onExposureChange(null);
        this.expRow.slider.value = String(EXPOSURE_DEFAULT);
        this.expRow.valueEl.textContent = EXPOSURE_DEFAULT.toFixed(2);
        this.preview.refresh();
      },
    );
    this.expRow = expR.sliderRow;
    body.appendChild(expR.el);

    const defs = GraphicsSettings.getLightDefaults();

    const ambR = this.makeSliderRow(
      'Ambient', GraphicsSettings.lightAmbient ?? defs.ambient, 0, 1.5, 0.01,
      (v) => { this.onLightChange('ambient', v); this.preview.refresh(); },
      () => {
        this.onLightChange('ambient', null);
        const d = GraphicsSettings.getLightDefaults().ambient;
        this.ambRow.slider.value = String(d);
        this.ambRow.valueEl.textContent = d.toFixed(2);
        this.preview.refresh();
      },
    );
    this.ambRow = ambR.sliderRow;
    body.appendChild(ambR.el);

    const dirR = this.makeSliderRow(
      'Directional', GraphicsSettings.lightDir ?? defs.dir, 0, 3.0, 0.01,
      (v) => { this.onLightChange('dir', v); this.preview.refresh(); },
      () => {
        this.onLightChange('dir', null);
        const d = GraphicsSettings.getLightDefaults().dir;
        this.dirRow.slider.value = String(d);
        this.dirRow.valueEl.textContent = d.toFixed(2);
        this.preview.refresh();
      },
    );
    this.dirRow = dirR.sliderRow;
    body.appendChild(dirR.el);

    const hemiR = this.makeSliderRow(
      'Hemisphere', GraphicsSettings.lightHemi ?? defs.hemi, 0, 1.5, 0.01,
      (v) => { this.onLightChange('hemi', v); this.preview.refresh(); },
      () => {
        this.onLightChange('hemi', null);
        const d = GraphicsSettings.getLightDefaults().hemi;
        this.hemiRow.slider.value = String(d);
        this.hemiRow.valueEl.textContent = d.toFixed(2);
        this.preview.refresh();
      },
    );
    this.hemiRow = hemiR.sliderRow;
    body.appendChild(hemiR.el);

    // — CAMERA —
    body.appendChild(this.makeSection('CAMERA'));

    const rotateR = this.makeSliderRow(
      'Rotate Speed', GraphicsSettings.rotateSpeed, 0.3, 2.0, 0.05,
      (v) => { this.onRotateSpeedChange(v); },
      () => {
        this.onRotateSpeedChange(ROTATE_SPEED_DEFAULT);
        this.rotateRow.slider.value        = String(ROTATE_SPEED_DEFAULT);
        this.rotateRow.valueEl.textContent = ROTATE_SPEED_DEFAULT.toFixed(2);
      },
    );
    this.rotateRow = rotateR.sliderRow;
    body.appendChild(rotateR.el);

    const dampingR = this.makeSliderRow(
      'Damping', GraphicsSettings.dampingFactor, 0.01, 0.30, 0.01,
      (v) => { this.onDampingFactorChange(v); },
      () => {
        this.onDampingFactorChange(DAMPING_FACTOR_DEFAULT);
        this.dampingRow.slider.value        = String(DAMPING_FACTOR_DEFAULT);
        this.dampingRow.valueEl.textContent = DAMPING_FACTOR_DEFAULT.toFixed(2);
      },
    );
    this.dampingRow = dampingR.sliderRow;
    body.appendChild(dampingR.el);

    // Reset all
    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-screen__reset-all';
    resetBtn.textContent = 'RESET ALL';
    resetBtn.addEventListener('click', () => this.resetAll());
    body.appendChild(resetBtn);

    layout.appendChild(body);
    this.el.appendChild(layout);
    container.appendChild(this.el);
  }

  show(): void {
    requestAnimationFrame(() => this.el.classList.add('visible'));
    this.preview.resumeLoop();
  }
  hide(): void {
    this.el.classList.remove('visible');
    this.preview.pauseLoop();
  }

  // ── Builders ───────────────────────────────────────────────────────

  private makeSection(label: string): HTMLElement {
    const el = document.createElement('div');
    el.className = 'settings-section-label';
    el.textContent = label;
    return el;
  }

  private makeToggleRow(
    label: string,
    initial: boolean,
    onChange: (val: boolean) => void,
  ): { el: HTMLElement; checkbox: HTMLInputElement } {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const lbl = document.createElement('span');
    lbl.className = 'settings-row__label';
    lbl.textContent = label;

    const switchLabel = document.createElement('label');
    switchLabel.className = 'toggle-switch';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = initial;
    checkbox.addEventListener('change', () => onChange(checkbox.checked));

    const slider = document.createElement('span');
    slider.className = 'toggle-switch__slider';
    switchLabel.appendChild(checkbox);
    switchLabel.appendChild(slider);

    row.appendChild(lbl);
    row.appendChild(switchLabel);
    return { el: row, checkbox };
  }

  private makeColorRow(
    label: string,
    initialHex: string,
    onChange: (hex: string) => void,
    onReset: () => void,
  ): { el: HTMLElement; colorRow: ColorRow } {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const lbl = document.createElement('span');
    lbl.className = 'settings-row__label';
    lbl.textContent = label;

    const right = document.createElement('div');
    right.className = 'settings-row__right';

    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = initialHex;

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = this.toHex6(initialHex);
    picker.className = 'color-picker-input';

    swatch.appendChild(picker);
    swatch.addEventListener('click', (e) => { e.stopPropagation(); picker.click(); });
    picker.addEventListener('input', () => {
      swatch.style.backgroundColor = picker.value;
      onChange(picker.value);
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-row__reset';
    resetBtn.title = 'Reset to default';
    resetBtn.textContent = '↺';
    resetBtn.addEventListener('click', onReset);

    right.appendChild(swatch);
    right.appendChild(resetBtn);
    row.appendChild(lbl);
    row.appendChild(right);
    return { el: row, colorRow: { swatch, picker } };
  }

  private makeColorToggleRow(
    label: string,
    initialEnabled: boolean,
    initialHex: string,
    onChange: (enabled: boolean, hex: string) => void,
  ): { el: HTMLElement; checkbox: HTMLInputElement; colorRow: ColorRow } {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const lbl = document.createElement('span');
    lbl.className = 'settings-row__label';
    lbl.textContent = label;

    const right = document.createElement('div');
    right.className = 'settings-row__right';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'toggle-switch toggle-switch--small';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = initialEnabled;

    const toggleSlider = document.createElement('span');
    toggleSlider.className = 'toggle-switch__slider';
    toggleLabel.appendChild(checkbox);
    toggleLabel.appendChild(toggleSlider);

    const swatch = document.createElement('div');
    swatch.className = 'color-swatch';
    swatch.style.backgroundColor = initialHex;
    swatch.style.opacity = initialEnabled ? '1' : '0.3';
    swatch.style.pointerEvents = initialEnabled ? 'auto' : 'none';

    const picker = document.createElement('input');
    picker.type = 'color';
    picker.value = this.toHex6(initialHex);
    picker.className = 'color-picker-input';

    swatch.appendChild(picker);
    swatch.addEventListener('click', (e) => {
      if (!checkbox.checked) return;
      e.stopPropagation();
      picker.click();
    });
    picker.addEventListener('input', () => {
      swatch.style.backgroundColor = picker.value;
      onChange(true, picker.value);
    });
    checkbox.addEventListener('change', () => {
      const enabled = checkbox.checked;
      swatch.style.opacity = enabled ? '1' : '0.3';
      swatch.style.pointerEvents = enabled ? 'auto' : 'none';
      onChange(enabled, picker.value);
    });

    right.appendChild(toggleLabel);
    right.appendChild(swatch);
    row.appendChild(lbl);
    row.appendChild(right);
    return { el: row, checkbox, colorRow: { swatch, picker } };
  }

  private makeCharTypeRow(
    initial: string,
    onChange: (type: string) => void,
  ): { el: HTMLElement; btns: HTMLButtonElement[] } {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const lbl = document.createElement('span');
    lbl.className = 'settings-row__label';
    lbl.textContent = 'Character';

    const right = document.createElement('div');
    right.className = 'settings-row__right';

    const types: { key: string; label: string }[] = [
      { key: 'default', label: 'DEFAULT' },
      { key: 'robot',   label: 'ROBOT'   },
      { key: 'human',   label: 'HUMAN'   },
    ];

    const btns: HTMLButtonElement[] = types.map(({ key, label }) => {
      const btn = document.createElement('button');
      btn.className = 'variant-btn';
      btn.dataset.charType = key;
      btn.textContent = label;
      if (key === initial) btn.classList.add('active');
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(key);
      });
      right.appendChild(btn);
      return btn;
    });

    row.appendChild(lbl);
    row.appendChild(right);
    return { el: row, btns };
  }

  private makeVariantRow(
    initial: string,
    onChange: (variant: string) => void,
  ): { el: HTMLElement; btns: HTMLButtonElement[] } {
    const row = document.createElement('div');
    row.className = 'settings-row';

    const lbl = document.createElement('span');
    lbl.className = 'settings-row__label';
    lbl.textContent = 'Block Material';

    const right = document.createElement('div');
    right.className = 'settings-row__right';

    const variants: { key: string; label: string }[] = [
      { key: 'default', label: 'DEFAULT' },
      { key: 'stone',   label: 'STONE'   },
      { key: 'metal',   label: 'METAL'   },
    ];

    const btns: HTMLButtonElement[] = variants.map(({ key, label }) => {
      const btn = document.createElement('button');
      btn.className = 'variant-btn';
      btn.dataset.variant = key;
      btn.textContent = label;
      if (key === initial) btn.classList.add('active');
      btn.addEventListener('click', () => {
        btns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        onChange(key);
      });
      right.appendChild(btn);
      return btn;
    });

    row.appendChild(lbl);
    row.appendChild(right);
    return { el: row, btns };
  }

  private makeSliderRow(
    label: string,
    initial: number,
    min: number, max: number, step: number,
    onChange: (val: number) => void,
    onReset: () => void,
  ): { el: HTMLElement; sliderRow: SliderRow } {
    const row = document.createElement('div');
    row.className = 'settings-row settings-row--slider';

    const lbl = document.createElement('span');
    lbl.className = 'settings-row__label';
    lbl.textContent = label;

    const right = document.createElement('div');
    right.className = 'settings-row__right settings-row__right--slider';

    const slider = document.createElement('input');
    slider.type  = 'range';
    slider.min   = String(min);
    slider.max   = String(max);
    slider.step  = String(step);
    slider.value = String(initial);
    slider.className = 'settings-slider';

    const valueEl = document.createElement('span');
    valueEl.className = 'settings-slider__value';
    valueEl.textContent = initial.toFixed(2);

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      valueEl.textContent = v.toFixed(2);
      onChange(v);
    });

    const resetBtn = document.createElement('button');
    resetBtn.className = 'settings-row__reset';
    resetBtn.title = 'Reset to default';
    resetBtn.textContent = '↺';
    resetBtn.addEventListener('click', onReset);

    right.appendChild(slider);
    right.appendChild(valueEl);
    right.appendChild(resetBtn);
    row.appendChild(lbl);
    row.appendChild(right);
    return { el: row, sliderRow: { slider, valueEl } };
  }

  // ── Reset ──────────────────────────────────────────────────────────

  private resetAll(): void {
    // Enhanced Rendering — 기본값 true
    GraphicsSettings.enhanced = true;
    this.qualityCheckbox.checked = true;
    this.onQualityChange(true);

    // Star Background
    GraphicsSettings.starBackground = false;
    this.onStarBgChange(false);

    // Colors
    GraphicsSettings.resetColors();

    const defBg = GraphicsSettings.getEffectiveBgColor();
    this.bgRow.swatch.style.backgroundColor = defBg;
    this.bgRow.picker.value = defBg;

    this.blockToggle.checked = false;
    this.blockRow.swatch.style.opacity = '0.3';
    this.blockRow.swatch.style.pointerEvents = 'none';

    // Variant reset to 'default'
    this.variantBtns.forEach(b => b.classList.toggle('active', b.dataset.variant === 'default'));
    this.onBlockVariantChange('default');

    // Block roundness reset
    this.radiusRow.slider.value        = String(BLOCK_RADIUS_DEFAULT);
    this.radiusRow.valueEl.textContent = BLOCK_RADIUS_DEFAULT.toFixed(2);
    this.onBlockRadiusChange(BLOCK_RADIUS_DEFAULT);

    // XZ expand reset
    this.xzRow.slider.value        = String(BLOCK_XZ_DEFAULT);
    this.xzRow.valueEl.textContent = BLOCK_XZ_DEFAULT.toFixed(2);
    this.onBlockXZChange(BLOCK_XZ_DEFAULT);

    // Character type reset to 'default'
    this.charTypeBtns.forEach(b => b.classList.toggle('active', b.dataset.charType === 'default'));
    this.onCharacterTypeChange('default');

    this.charBodyRow.swatch.style.backgroundColor = COLOR_DEFAULTS.charBody;
    this.charBodyRow.picker.value = COLOR_DEFAULTS.charBody;
    this.charHeadRow.swatch.style.backgroundColor = COLOR_DEFAULTS.charHead;
    this.charHeadRow.picker.value = COLOR_DEFAULTS.charHead;

    this.onBgColorChange(null);
    this.onBlockColorChange(null);
    this.onCharBodyColorChange(COLOR_DEFAULTS.charBody);
    this.onCharHeadColorChange(COLOR_DEFAULTS.charHead);

    // Lights
    GraphicsSettings.resetLights();

    const defs = GraphicsSettings.getLightDefaults();
    this.ambRow.slider.value = String(defs.ambient);
    this.ambRow.valueEl.textContent = defs.ambient.toFixed(2);
    this.dirRow.slider.value = String(defs.dir);
    this.dirRow.valueEl.textContent = defs.dir.toFixed(2);
    this.hemiRow.slider.value = String(defs.hemi);
    this.hemiRow.valueEl.textContent = defs.hemi.toFixed(2);

    this.onLightChange('ambient', null);
    this.onLightChange('dir',     null);
    this.onLightChange('hemi',    null);

    this.expRow.slider.value = String(EXPOSURE_DEFAULT);
    this.expRow.valueEl.textContent = EXPOSURE_DEFAULT.toFixed(2);
    this.onExposureChange(null);

    // Camera
    GraphicsSettings.resetCamera();
    this.rotateRow.slider.value        = String(ROTATE_SPEED_DEFAULT);
    this.rotateRow.valueEl.textContent = ROTATE_SPEED_DEFAULT.toFixed(2);
    this.dampingRow.slider.value        = String(DAMPING_FACTOR_DEFAULT);
    this.dampingRow.valueEl.textContent = DAMPING_FACTOR_DEFAULT.toFixed(2);
    this.onRotateSpeedChange(ROTATE_SPEED_DEFAULT);
    this.onDampingFactorChange(DAMPING_FACTOR_DEFAULT);

    this.preview.refresh();
  }

  // ── Dev unlock cheat ──────────────────────────────────────────────

  private onPreviewTap(labelEl: HTMLElement): void {
    if (this.tapTimer !== null) clearTimeout(this.tapTimer);
    this.tapTimer = setTimeout(() => {
      this.tapCount = 0;
      this.tapTimer = null;
      labelEl.textContent = 'PREVIEW';
      labelEl.style.color = '';
    }, DEV_RESET_MS);

    this.tapCount++;

    if (this.tapCount < DEV_UNLOCK_TAPS) {
      labelEl.textContent = `PREVIEW ${'·'.repeat(this.tapCount)}`;
      return;
    }

    // 10번 달성 → 전체 잠금 해제
    clearTimeout(this.tapTimer!);
    this.tapTimer = null;
    this.tapCount = 0;

    ProgressStore.unlockAll(TOTAL_STAGES);
    ProgressStore.setDeveloperMode();

    labelEl.textContent = '🔓 ALL UNLOCKED';
    labelEl.style.color = '#FFD700';
    setTimeout(() => {
      labelEl.textContent = 'PREVIEW';
      labelEl.style.color = '';
    }, 1500);
  }

  private onGraphicsTap(labelEl: HTMLElement): void {
    if (this.graphicsTapTimer !== null) clearTimeout(this.graphicsTapTimer);
    this.graphicsTapTimer = setTimeout(() => {
      this.graphicsTapCount = 0;
      this.graphicsTapTimer = null;
      labelEl.textContent = 'GRAPHICS';
      labelEl.style.color = '';
    }, DEV_RESET_MS);

    this.graphicsTapCount++;

    if (this.graphicsTapCount < DEV_UNLOCK_TAPS) {
      labelEl.textContent = `GRAPHICS ${'·'.repeat(this.graphicsTapCount)}`;
      return;
    }

    // 10번 달성 → 개발자 모드 토글
    clearTimeout(this.graphicsTapTimer!);
    this.graphicsTapTimer = null;
    this.graphicsTapCount = 0;

    if (ProgressStore.isDeveloperMode()) {
      ProgressStore.clearDeveloperMode();
      labelEl.textContent = '🔒 DEV MODE OFF';
      labelEl.style.color = '#FF8888';
    } else {
      ProgressStore.setDeveloperMode();
      labelEl.textContent = '🔓 DEV MODE ON';
      labelEl.style.color = '#FFD700';
    }
    setTimeout(() => {
      labelEl.textContent = 'GRAPHICS';
      labelEl.style.color = '';
    }, 1500);
  }

  // ── Helpers ────────────────────────────────────────────────────────

  private toHex6(hex: string): string {
    if (/^#[0-9a-f]{6}$/i.test(hex)) return hex;
    if (/^#[0-9a-f]{3}$/i.test(hex)) {
      const [, r, g, b] = hex;
      return `#${r}${r}${g}${g}${b}${b}`;
    }
    return '#a8d8ea';
  }
}
