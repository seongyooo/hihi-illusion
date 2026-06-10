import { CustomLevelStore } from '../editor/CustomLevelStore';
import { CUSTOM_STAGE_NUMS } from '../levels/registry';

export class EditorLobby {
  private el: HTMLElement;
  private gridEl!: HTMLElement;

  onNew:          () => void                  = () => {};
  onEdit:         (stageNum: number) => void  = () => {};
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

    // Built-in stages section
    const builtinSection = document.createElement('div');
    builtinSection.className = 'editor-lobby__section';

    const builtinTitle = document.createElement('h3');
    builtinTitle.textContent = 'BUILT-IN STAGES';
    builtinSection.appendChild(builtinTitle);

    const builtinGrid = document.createElement('div');
    builtinGrid.className = 'editor-lobby__grid';

    for (const num of CUSTOM_STAGE_NUMS) {
      const card = document.createElement('div');
      card.className = 'editor-lobby__card';

      const numEl = document.createElement('span');
      numEl.className = 'editor-lobby__card-num';
      numEl.textContent = `Stage ${num}`;

      const editBtn = document.createElement('button');
      editBtn.className = 'editor-btn primary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.onEditBuiltin(num));

      card.appendChild(numEl);
      card.appendChild(editBtn);
      builtinGrid.appendChild(card);
    }

    builtinSection.appendChild(builtinGrid);
    this.el.appendChild(builtinSection);

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

    sectionHeader.appendChild(sectionTitle);
    sectionHeader.appendChild(downloadAllBtn);
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

    for (const level of all) {
      const card = document.createElement('div');
      card.className = 'editor-lobby__card';

      const num = document.createElement('span');
      num.className = 'editor-lobby__card-num';
      num.textContent = `Stage ${level.stageNum}`;

      const name = document.createElement('span');
      name.className = 'editor-lobby__card-name';
      name.textContent = level.data.name;

      const dlBtn = document.createElement('button');
      dlBtn.className = 'editor-btn';
      dlBtn.textContent = '↓';
      dlBtn.title = 'JSON 다운로드';
      dlBtn.addEventListener('click', () => {
        const json = JSON.stringify(level.data, null, 2);
        const filename = `level_custom_${level.stageNum}.json`;
        this.downloadJson(json, filename);
      });

      const editBtn = document.createElement('button');
      editBtn.className = 'editor-btn primary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.onEdit(level.stageNum));

      const delBtn = document.createElement('button');
      delBtn.className = 'editor-btn danger';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        if (!confirm(`Stage ${level.stageNum} "${level.data.name}"을 삭제할까요?`)) return;
        CustomLevelStore.delete(level.stageNum);
        this.rebuildGrid();
      });

      const btnRow = document.createElement('div');
      btnRow.className = 'editor-lobby__card-btns';
      btnRow.appendChild(dlBtn);
      btnRow.appendChild(editBtn);
      btnRow.appendChild(delBtn);

      card.appendChild(num);
      card.appendChild(name);
      card.appendChild(btnRow);
      this.gridEl.appendChild(card);
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
