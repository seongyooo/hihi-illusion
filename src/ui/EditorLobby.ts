import { CustomLevelStore } from '../editor/CustomLevelStore';

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

    const builtinStages = [
      { num: 1,  name: 'The Prologue' },
      { num: 2,  name: 'Custom Level' },
      { num: 3,  name: 'Custom Level' },
      { num: 4,  name: 'Custom Level' },
      { num: 5,  name: 'Custom Level' },
      { num: 6,  name: 'Custom Level' },
      { num: 7,  name: 'The Relay'    },
      { num: 8,  name: 'The Elevator' },
      { num: 9,  name: 'Mirage'       },
      { num: 10, name: 'Convergence'  },
    ];
    for (const s of builtinStages) {
      const card = document.createElement('div');
      card.className = 'editor-lobby__card';

      const num = document.createElement('span');
      num.className = 'editor-lobby__card-num';
      num.textContent = `Stage ${s.num}`;

      const name = document.createElement('span');
      name.className = 'editor-lobby__card-name';
      name.textContent = s.name;

      const editBtn = document.createElement('button');
      editBtn.className = 'editor-btn primary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.onEditBuiltin(s.num));

      card.appendChild(num);
      card.appendChild(name);
      card.appendChild(editBtn);
      builtinGrid.appendChild(card);
    }

    builtinSection.appendChild(builtinGrid);
    this.el.appendChild(builtinSection);

    // Custom stages section
    const section = document.createElement('div');
    section.className = 'editor-lobby__section';

    const sectionTitle = document.createElement('h3');
    sectionTitle.textContent = 'CUSTOM STAGES';
    section.appendChild(sectionTitle);

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

      const editBtn = document.createElement('button');
      editBtn.className = 'editor-btn primary';
      editBtn.textContent = 'Edit';
      editBtn.addEventListener('click', () => this.onEdit(level.stageNum));

      card.appendChild(num);
      card.appendChild(name);
      card.appendChild(editBtn);
      this.gridEl.appendChild(card);
    }
  }

  show(): void {
    this.rebuildGrid();  // always fresh
    requestAnimationFrame(() => this.el.classList.add('visible'));
  }

  hide(): void {
    this.el.classList.remove('visible');
  }
}
