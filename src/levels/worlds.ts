export interface WorldDef {
  id: number;
  name: string;
  subtitle: string;
  startStage: number;
  endStage: number;
  hasTutorial: boolean;
  color: {
    bg: string;
    border: string;
    accent: string;
  };
}

export const WORLDS: WorldDef[] = [
  {
    id: 1,
    name: '첫 걸음',
    subtitle: '낯선 공간에 눈을 뜨다',
    startStage: 1,
    endStage: 5,
    hasTutorial: true,
    color: {
      bg: 'rgba(80,60,180,0.18)',
      border: 'rgba(140,120,255,0.45)',
      accent: '#a89aff',
    },
  },
  {
    id: 2,
    name: '환영의 방',
    subtitle: '눈을 믿지 마라',
    startStage: 6,
    endStage: 11,
    hasTutorial: false,
    color: {
      bg: 'rgba(60,150,120,0.18)',
      border: 'rgba(90,220,180,0.45)',
      accent: '#5ddcb4',
    },
  },
  {
    id: 3,
    name: '기계 공장',
    subtitle: '모든 것은 연결되어 있다',
    startStage: 12,
    endStage: 20,
    hasTutorial: false,
    color: {
      bg: 'rgba(180,80,60,0.18)',
      border: 'rgba(255,140,100,0.45)',
      accent: '#ffb07a',
    },
  },
  {
    id: 4,
    name: '위험 지대',
    subtitle: '중력조차 믿을 수 없다',
    startStage: 21,
    endStage: 29,
    hasTutorial: false,
    color: {
      bg: 'rgba(160,130,30,0.18)',
      border: 'rgba(240,210,60,0.45)',
      accent: '#f0d44a',
    },
  },
  {
    id: 5,
    name: '추격전',
    subtitle: '움직이는 것들 사이에서',
    startStage: 30,
    endStage: 35,
    hasTutorial: false,
    color: {
      bg: 'rgba(80,140,200,0.18)',
      border: 'rgba(100,190,255,0.45)',
      accent: '#7dd0ff',
    },
  },
  {
    id: 6,
    name: '???',
    subtitle: '...',
    startStage: 36,
    endStage: 39,
    hasTutorial: false,
    color: {
      bg: 'rgba(80,80,80,0.18)',
      border: 'rgba(180,180,180,0.35)',
      accent: '#aaaaaa',
    },
  },
];

export function getWorldByStage(stageNum: number): WorldDef | undefined {
  return WORLDS.find(w => stageNum >= w.startStage && stageNum <= w.endStage);
}

export function getWorldById(id: number): WorldDef | undefined {
  return WORLDS.find(w => w.id === id);
}
