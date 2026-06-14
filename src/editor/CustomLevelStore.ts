import type { LevelData } from '../world/Level';

export interface CustomLevel {
  stageNum: number;
  data: LevelData;
}

const STORAGE_KEY = 'illusion_custom_levels';
const BUILTIN_ORDER_KEY = 'illusion_builtin_order';

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

  reorderAll(newOrder: CustomLevel[]): void {
    const reindexed = newOrder.map((level, i) => ({
      stageNum: i + 1,
      data: { ...level.data, id: `custom_stage_${i + 1}` },
    }));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(reindexed));
  },

  getBuiltinOrder(defaultNums: number[]): number[] {
    try {
      const raw = localStorage.getItem(BUILTIN_ORDER_KEY);
      if (!raw) return defaultNums;
      const saved = JSON.parse(raw) as number[];
      // defaultNums에 없는 번호 제거, 새로 추가된 번호는 뒤에 붙임
      const valid = saved.filter(n => defaultNums.includes(n));
      const added = defaultNums.filter(n => !valid.includes(n));
      return [...valid, ...added];
    } catch {
      return defaultNums;
    }
  },

  saveBuiltinOrder(order: number[]): void {
    localStorage.setItem(BUILTIN_ORDER_KEY, JSON.stringify(order));
  },
};
