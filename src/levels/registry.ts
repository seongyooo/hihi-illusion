import type { LevelData } from '../world/Level';

export interface LevelMeta {
  id:              string;
  title:           string;
  backgroundColor: string;
  file:            () => Promise<{ default: LevelData }>;
}

export const LEVELS: LevelMeta[] = [
  {
    id:              'level_01',
    title:           'Tutorial',
    backgroundColor: '#F5F0E8',
    file:            () => import('./level01.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_1',
    title:           'The Prologue',
    backgroundColor: '#F5F0E8',
    file:            () => import('./level_custom_1.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_2',
    title:           'Stage 2',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_2.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_3',
    title:           'Stage 3',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_3.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_4',
    title:           'Stage 4',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_4.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_5',
    title:           'Stage 5',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_5.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_6',
    title:           'Stage 6',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_6.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_7',
    title:           'The Relay',
    backgroundColor: '#E8F0EE',
    file:            () => import('./level_custom_7.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_8',
    title:           'The Elevator',
    backgroundColor: '#F0EDE8',
    file:            () => import('./level_custom_8.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_9',
    title:           'Mirage',
    backgroundColor: '#EDE8F0',
    file:            () => import('./level_custom_9.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_10',
    title:           'Convergence',
    backgroundColor: '#E8EBF0',
    file:            () => import('./level_custom_10.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_11',
    title:           'Stage 11',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_11.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_12',
    title:           'Pressure Gate',
    backgroundColor: '#E8F0EE',
    file:            () => import('./level_custom_12.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_13',
    title:           'Stage 13',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_13.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_15',
    title:           'Double Key',
    backgroundColor: '#ECF0EA',
    file:            () => import('./level_custom_15.json') as unknown as Promise<{ default: LevelData }>,
  },
];
