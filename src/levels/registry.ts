import type { LevelData } from '../world/Level';

export interface LevelMeta {
  id:              string;
  title:           string;
  backgroundColor: string;
  file:            () => Promise<{ default: LevelData }>;
}

// Auto-discover all level_custom_N.json files in this directory
export const customModules = import.meta.glob<{ default: LevelData }>('./level_custom_*.json');

export const CUSTOM_STAGE_NUMS: number[] = Object.keys(customModules)
  .flatMap(p => {
    const m = p.match(/level_custom_(\d+)\.json$/);
    return m ? [parseInt(m[1])] : [];
  })
  .sort((a, b) => a - b);

export const LEVELS: LevelMeta[] = [
  ...CUSTOM_STAGE_NUMS.map(num => ({
    id:              `custom_stage_${num}`,
    title:           `Stage ${num}`,
    backgroundColor: '#E8EEF5',
    file:            customModules[`./level_custom_${num}.json`],
  })),
];
