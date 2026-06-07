import type { LevelData } from '../world/Level';

export interface CustomLevel {
  stageNum: number;
  data: LevelData;
}

const STORAGE_KEY = 'illusion_custom_levels';

export const CustomLevelStore = {
  getAll(): CustomLevel[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw) as CustomLevel[];
    } catch {
      return [];
    }
  },

  save(level: CustomLevel): void {
    const all = this.getAll().filter(l => l.stageNum !== level.stageNum);
    all.push(level);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },

  delete(stageNum: number): void {
    const all = this.getAll().filter(l => l.stageNum !== stageNum);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  },

  getByStage(stageNum: number): CustomLevel | undefined {
    return this.getAll().find(l => l.stageNum === stageNum);
  },
};
