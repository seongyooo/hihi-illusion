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
  /** 스테이지별 인게임 나레이션. stageNarrations[0] = startStage의 나레이션 */
  stageNarrations: string[];
}

export const WORLDS: WorldDef[] = [
  {
    id: 1,
    name: '첫 걸음',
    subtitle: '낯선 공간에 눈을 뜨다',
    startStage: 1,
    endStage: 5,
    hasTutorial: false,
    color: {
      bg: 'rgba(80,60,180,0.18)',
      border: 'rgba(140,120,255,0.45)',
      accent: '#a89aff',
    },
    stageNarrations: [
      '낯선 세계에 눈을 뜬다.\n아무것도 알 수 없지만, 발은 저절로 움직인다.',
      '한 걸음. 또 한 걸음.\n이 공간에는 분명 어떤 목적이 있다.',
      '보이는 것이 전부가 아닐 수도 있다.\n하지만 지금은, 그냥 걸어가면 된다.',
      '목표가 보인다.\n멀어 보여도, 길은 이미 만들어져 있다.',
      '첫 번째 문이 열린다.\n이것이 진짜 시작이었다.',
    ],
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
    stageNarrations: [
      '이 방은 다르다.\n공간이 어딘가 뒤틀려 있다.',
      '보이지 않는 다리가 있다.\n믿음이 곧 발판이 된다.',
      '눈이 거짓말을 한다.\n하지만 발은 거짓말하지 않는다.',
      '착시는 혼란이 아니다.\n새로운 시각일 뿐이다.',
      '현실과 환상이 뒤섞인다.\n과연 어느 것이 진짜인가.',
      '환영을 통과했다.\n이제 세상이 조금 달리 보인다.',
    ],
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
    stageNarrations: [
      '공장은 잠들지 않는다.\n언제나 무언가가 돌아가고 있다.',
      '스위치 하나가 모든 것을 바꾼다.\n신중하게 선택하라.',
      '기계들이 의지를 가진 듯 움직인다.\n누가 이것을 설계했을까.',
      '연결고리를 찾아라.\n보이지 않는 선이 모든 것을 잇는다.',
      '타이밍이 전부다.\n이 공장의 리듬을 익혀야 한다.',
      '문은 열리고 또 닫힌다.\n기회는 언제나 순간이다.',
      '복잡해 보여도 결국 하나의 규칙이 지배한다.\n그 규칙을 찾아라.',
      '공장의 끝이 보인다.\n하지만 마지막은 항상 가장 어렵다.',
      '기계를 이겼다.\n이해가 곧 힘이었다.',
    ],
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
    stageNarrations: [
      '발을 디디자 세계가 뒤집혔다.\n이제 아래가 위다.',
      '중력은 절대적이지 않다.\n모든 방향이 \'아래\'가 될 수 있다.',
      '가시들이 기다린다.\n한 발짝도 허투루 디딜 수 없다.',
      '뒤집힌 채로 걷는다.\n이상하지만, 이것이 새로운 정상이다.',
      '위험 속에서 별이 빛난다.\n모험이 아니면 닿을 수 없는 것들.',
      '아래에도 길이 있다.\n익숙함을 버려야 비로소 보인다.',
      '두려움은 자연스럽다.\n하지만 멈추는 이유는 될 수 없다.',
      '세계가 또 뒤집힌다.\n이번엔 더 이상 놀랍지 않다.',
      '위험 지대를 빠져나왔다.\n중력은 이제 더 이상 적이 아니다.',
    ],
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
    stageNarrations: [
      '모든 것이 살아 움직인다.\n이 세계는 숨을 쉬고 있다.',
      '움직이는 것 위에 서야 한다.\n멈추는 것은 허용되지 않는다.',
      '리듬을 타라.\n세계의 박자에 맞춰 나아가라.',
      '기다리는 것도 기술이다.\n흐름을 읽어야 앞으로 나아갈 수 있다.',
      '혼돈 속에도 질서가 있다.\n그 패턴을 발견하는 자가 나아간다.',
      '마지막 질주.\n세계와 하나가 되어 달린다.',
    ],
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
    stageNarrations: [
      '지도에도 없는 곳에 도달했다.\n여기서부터는 아무것도 알 수 없다.',
      '이 공간은 이전과 다르다.\n모든 규칙이 의심스럽다.',
      '끝과 시작이 맞닿아 있다.\n모든 것은 처음부터 연결되어 있었다.',
      '...',
    ],
  },
];

export function getWorldByStage(stageNum: number): WorldDef | undefined {
  return WORLDS.find(w => stageNum >= w.startStage && stageNum <= w.endStage);
}

export function getWorldById(id: number): WorldDef | undefined {
  return WORLDS.find(w => w.id === id);
}
