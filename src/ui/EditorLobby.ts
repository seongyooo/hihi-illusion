import { CustomLevelStore } from '../editor/CustomLevelStore';
import { ProgressStore }    from '../core/ProgressStore';
import { CUSTOM_STAGE_NUMS, customModules } from '../levels/registry';
import type { LevelData } from '../world/Level';
import { renderStagePreview } from './StagePreviewRenderer';

export class EditorLobby {
  private el: HTMLElement;
  private gridEl!: HTMLElement;

  onNew:          () => void                  = () => {};
  onEdit:         (stageNum: number) => void  = () => {};
  onPlay:         (stageNum: number) => void  = () => {};
  onEditBuiltin:  (stageNum: number) => void  = () => {};
  onClose:        () => void                  = () => {};

  constructor(container: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'editor-lobby';
    container.appendChild(this.el);
    this.buildLayout();
  }

  private buildLayout(): void {
    this.el.innerHTML = '';

    // Close
    const closeBar = document.createElement('div');
    closeBar.className = 'editor-close';
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.onClose());
    closeBar.appendChild(closeBtn);
    this.el.appendChild(closeBar);

    // Header
    const header = document.createElement('div');
    header.className = 'editor-lobby__header';

    const title = document.createElement('h2');
    title.className = 'editor-lobby__title';
    title.textContent = 'DEV MODE';
    header.appendChild(title);

    const newBtn = document.createElement('button');
    newBtn.className = 'editor-btn primary editor-lobby__new-btn';
    newBtn.textContent = '+ New Stage';
    newBtn.addEventListener('click', () => this.onNew());
    header.appendChild(newBtn);

    this.el.appendChild(header);

    // Built-in stages section (개발자 모드일 때만 표시)
    if (ProgressStore.isDeveloperMode()) {
      const builtinSection = document.createElement('div');
      builtinSection.className = 'editor-lobby__section';

      const builtinHeader = document.createElement('div');
      builtinHeader.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';

      const builtinTitle = document.createElement('h3');
      builtinTitle.textContent = 'BUILT-IN STAGES';
      builtinTitle.style.margin = '0';

      const applyOrderBtn = document.createElement('button');
      applyOrderBtn.className = 'editor-btn primary';
      applyOrderBtn.textContent = '↓ Apply Order';
      applyOrderBtn.title = '현재 순서로 리넘버링된 JSON 파일 다운로드 → src/levels/ 에 덮어쓰기';
      applyOrderBtn.addEventListener('click', () => this._downloadReorderedBuiltins());

      builtinHeader.appendChild(builtinTitle);
      builtinHeader.appendChild(applyOrderBtn);
      builtinSection.appendChild(builtinHeader);

      const builtinGrid = document.createElement('div');
      builtinGrid.className = 'editor-lobby__grid';
      builtinSection.appendChild(builtinGrid);

      this.el.appendChild(builtinSection);
      this._buildBuiltinGrid(builtinGrid);
    }

    // Custom stages section
    const section = document.createElement('div');
    section.className = 'editor-lobby__section';

    const sectionHeader = document.createElement('div');
    sectionHeader.style.cssText = 'display:flex;align-items:center;gap:8px;';

    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = 'CUSTOM STAGES';
    sectionTitle.style.margin = '0';

    const downloadAllBtn = document.createElement('button');
    downloadAllBtn.className = 'editor-btn';
    downloadAllBtn.textContent = '↓ All';
    downloadAllBtn.title = '전체 커스텀 스테이지 JSON 일괄 다운로드';
    downloadAllBtn.addEventListener('click', () => {
      const all = CustomLevelStore.getAll().sort((a, b) => a.stageNum - b.stageNum);
      if (all.length === 0) return;
      const json = JSON.stringify(all.map(l => l.data), null, 2);
      this.downloadJson(json, 'custom_stages_all.json');
    });

    const deleteAllBtn = document.createElement('button');
    deleteAllBtn.className = 'editor-btn danger';
    deleteAllBtn.textContent = '🗑 All';
    deleteAllBtn.title = '전체 커스텀 스테이지 삭제';
    deleteAllBtn.addEventListener('click', () => {
      const all = CustomLevelStore.getAll();
      if (all.length === 0) return;
      if (!confirm(`커스텀 스테이지 ${all.length}개를 모두 삭제할까요?`)) return;
      all.forEach(l => CustomLevelStore.delete(l.stageNum));
      this.rebuildGrid();
    });

    sectionHeader.appendChild(sectionTitle);
    sectionHeader.appendChild(downloadAllBtn);
    sectionHeader.appendChild(deleteAllBtn);
    section.appendChild(sectionHeader);

    this.gridEl = document.createElement('div');
    this.gridEl.className = 'editor-lobby__grid';
    section.appendChild(this.gridEl);

    this.el.appendChild(section);
  }

  private rebuildGrid(): void {
    this.gridEl.innerHTML = '';
    const all = CustomLevelStore.getAll().sort((a, b) => a.stageNum - b.stageNum);

    if (all.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'editor-lobby__empty';
      empty.textContent = 'No custom stages yet.';
      this.gridEl.appendChild(empty);
      return;
    }

    let dragSrcIndex = -1;

    for (let idx = 0; idx < all.length; idx++) {
      const level = all[idx];
      const card = document.createElement('div');
      card.className = 'editor-lobby__card';
      card.draggable = true;
      card.dataset.index = String(idx);

      card.addEventListener('dragstart', e => {
        dragSrcIndex = idx;
        card.classList.add('dragging');
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('text/plain', String(idx));
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        this.gridEl.querySelectorAll('.editor-lobby__card').forEach(c => c.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        this.gridEl.querySelectorAll('.editor-lobby__card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });
      card.addEventListener('drop', e => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const destIndex = idx;
        if (dragSrcIndex === -1 || dragSrcIndex === destIndex) return;
        const reordered = [...all];
        const [moved] = reordered.splice(dragSrcIndex, 1);
        reordered.splice(destIndex, 0, moved);
        CustomLevelStore.reorderAll(reordered);
        this.rebuildGrid();
      });

      const dragHandle = document.createElement('span');
      dragHandle.className = 'editor-lobby__card-handle';
      dragHandle.textContent = '⠿';
      dragHandle.title = '드래그해서 순서 변경';

      const thumb = document.createElement('img');
      thumb.className = 'editor-lobby__card-thumb';
      thumb.draggable = false;
      renderStagePreview(level.stageNum).then(url => { thumb.src = url; }).catch(() => {});

      const num = document.createElement('span');
      num.className = 'editor-lobby__card-num';
      num.textContent = `Stage ${level.stageNum}`;

      const name = document.createElement('span');
      name.className = 'editor-lobby__card-name';
      name.textContent = level.data.name;

      const playBtn = document.createElement('button');
      playBtn.className = 'editor-btn primary';
      playBtn.textContent = '▶ Play';
      playBtn.draggable = false;
      playBtn.addEventListener('click', () => this.onPlay(level.stageNum));

      const dlBtn = document.createElement('button');
      dlBtn.className = 'editor-btn';
      dlBtn.textContent = '↓';
      dlBtn.title = 'JSON 다운로드';
      dlBtn.draggable = false;
      dlBtn.addEventListener('click', () => {
        const json = JSON.stringify(level.data, null, 2);
        const filename = `level_custom_${level.stageNum}.json`;
        this.downloadJson(json, filename);
      });

      const editBtn = document.createElement('button');
      editBtn.className = 'editor-btn';
      editBtn.textContent = 'Edit';
      editBtn.draggable = false;
      editBtn.addEventListener('click', () => this.onEdit(level.stageNum));

      const delBtn = document.createElement('button');
      delBtn.className = 'editor-btn danger';
      delBtn.textContent = 'Delete';
      delBtn.draggable = false;
      delBtn.addEventListener('click', () => {
        if (!confirm(`Stage ${level.stageNum} "${level.data.name}"을 삭제할까요?`)) return;
        CustomLevelStore.delete(level.stageNum);
        this.rebuildGrid();
      });

      const btnRow = document.createElement('div');
      btnRow.className = 'editor-lobby__card-btns';
      btnRow.appendChild(playBtn);
      btnRow.appendChild(dlBtn);
      btnRow.appendChild(editBtn);
      btnRow.appendChild(delBtn);

      card.appendChild(dragHandle);
      card.appendChild(thumb);
      card.appendChild(num);
      card.appendChild(name);
      card.appendChild(btnRow);
      this.gridEl.appendChild(card);
    }
  }

  private _buildBuiltinGrid(gridEl: HTMLElement): void {
    gridEl.innerHTML = '';
    const order = CustomLevelStore.getBuiltinOrder(CUSTOM_STAGE_NUMS);
    let dragSrcIndex = -1;

    for (let idx = 0; idx < order.length; idx++) {
      const num = order[idx];
      const card = document.createElement('div');
      card.className = 'editor-lobby__card';
      card.draggable = true;

      card.addEventListener('dragstart', e => {
        dragSrcIndex = idx;
        card.classList.add('dragging');
        e.dataTransfer!.effectAllowed = 'move';
        e.dataTransfer!.setData('text/plain', String(idx));
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        gridEl.querySelectorAll('.editor-lobby__card').forEach(c => c.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer!.dropEffect = 'move';
        gridEl.querySelectorAll('.editor-lobby__card').forEach(c => c.classList.remove('drag-over'));
        card.classList.add('drag-over');
      });
      card.addEventListener('dragleave', () => card.classList.remove('drag-over'));
      card.addEventListener('drop', e => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (dragSrcIndex === -1 || dragSrcIndex === idx) return;
        const reordered = [...order];
        const [moved] = reordered.splice(dragSrcIndex, 1);
        reordered.splice(idx, 0, moved);
        CustomLevelStore.saveBuiltinOrder(reordered);
        this._buildBuiltinGrid(gridEl);
      });

      const dragHandle = document.createElement('span');
      dragHandle.className = 'editor-lobby__card-handle';
      dragHandle.textContent = '⠿';

      const thumbEl = document.createElement('img');
      thumbEl.className = 'editor-lobby__card-thumb';
      thumbEl.draggable = false;
      renderStagePreview(num).then(url => { thumbEl.src = url; }).catch(() => {});

      const numEl = document.createElement('span');
      numEl.className = 'editor-lobby__card-num';
      numEl.textContent = `Stage ${num}`;

      const editBtn = document.createElement('button');
      editBtn.className = 'editor-btn primary';
      editBtn.textContent = 'Edit';
      editBtn.draggable = false;
      editBtn.addEventListener('click', () => this.onEditBuiltin(num));

      card.appendChild(dragHandle);
      card.appendChild(thumbEl);
      card.appendChild(numEl);
      card.appendChild(editBtn);
      gridEl.appendChild(card);
    }
  }

  private async _downloadReorderedBuiltins(): Promise<void> {
    const order = CustomLevelStore.getBuiltinOrder(CUSTOM_STAGE_NUMS);
    for (let i = 0; i < order.length; i++) {
      const srcNum = order[i];
      const newNum = i + 1;
      const key = `./level_custom_${srcNum}.json`;
      const mod = await customModules[key]();
      const data: LevelData = { ...mod.default, id: `custom_stage_${newNum}` };
      this.downloadJson(JSON.stringify(data, null, 2), `level_custom_${newNum}.json`);
      // 브라우저 다운로드 팝업 겹침 방지
      await new Promise(r => setTimeout(r, 100));
    }
  }

  private downloadJson(json: string, filename: string): void {
    const blob = new Blob([json], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  show(): void {
    this.rebuildGrid();  // always fresh
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
