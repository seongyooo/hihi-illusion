import { GraphicsSettings, COLOR_DEFAULTS, EXPOSURE_DEFAULT } from '../core/GraphicsSettings';
import { SettingsPreview } from './SettingsPreview';

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
  private charBodyRow!:       ColorRow;
  private charHeadRow!:       ColorRow;
  private ambRow!:            SliderRow;
  private dirRow!:            SliderRow;
  private hemiRow!:           SliderRow;
  private expRow!:            SliderRow;

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
    previewPanel.appendChild(previewLabel);

    this.preview = new SettingsPreview(220, 220);
    previewPanel.appendChild(this.preview.el);
    layout.appendChild(previewPanel);

    // ── Right: settings body ──────────────────────────────────────────
    const body = document.createElement('div');
    body.className = 'settings-screen__body';

    // — GRAPHICS —
    body.appendChild(this.makeSection('GRAPHICS'));

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
    // Enhanced Rendering (QA-15)
    GraphicsSettings.enhanced = false;
    this.qualityCheckbox.checked = false;
    this.onQualityChange(false);

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

    this.preview.refresh();
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
