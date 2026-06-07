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
    title:           'The Bridge',
    backgroundColor: '#EEE8F0',
    file:            () => import('./level_custom_2.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_3',
    title:           'The Illusion',
    backgroundColor: '#E8EFF5',
    file:            () => import('./level_custom_3.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_4',
    title:           'Custom Level',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_4.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_5',
    title:           'Custom Level',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_5.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_6',
    title:           'Custom Level',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_6.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_7',
    title:           'Custom Level',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_7.json') as unknown as Promise<{ default: LevelData }>,
  },
  {
    id:              'custom_stage_8',
    title:           'Custom Level',
    backgroundColor: '#E8EEF5',
    file:            () => import('./level_custom_8.json') as unknown as Promise<{ default: LevelData }>,
  },
];
