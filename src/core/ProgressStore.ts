const KEY_TUTORIAL = 'hihi_tutorial_done';
const KEY_UNLOCKED = 'hihi_unlocked_stages';
const KEY_DEV_MODE = 'hihi_dev_mode';

export class ProgressStore {
  static isTutorialDone(): boolean {
    return !!localStorage.getItem(KEY_TUTORIAL);
  }

  static setTutorialDone(): void {
    localStorage.setItem(KEY_TUTORIAL, '1');
  }

  static getUnlockedStages(): Set<number> {
    try {
      const raw = localStorage.getItem(KEY_UNLOCKED);
      if (!raw) return new Set([1]);
      const parsed = JSON.parse(raw) as number[];
      const s = new Set(parsed);
      s.add(1); // stage 1 always unlocked
      return s;
    } catch {
      return new Set([1]);
    }
  }

  static unlockStage(stageNum: number): void {
    const unlocked = ProgressStore.getUnlockedStages();
    unlocked.add(stageNum);
    localStorage.setItem(KEY_UNLOCKED, JSON.stringify([...unlocked]));
  }

  static isUnlocked(stageNum: number): boolean {
    return ProgressStore.getUnlockedStages().has(stageNum);
  }

  static unlockAll(totalStages: number): void {
    const all: number[] = [];
    for (let i = 1; i <= totalStages; i++) all.push(i);
    localStorage.setItem(KEY_TUTORIAL, '1');
    localStorage.setItem(KEY_UNLOCKED, JSON.stringify(all));
  }

  static isDeveloperMode(): boolean {
    return !!localStorage.getItem(KEY_DEV_MODE);
  }

  static setDeveloperMode(): void {
    localStorage.setItem(KEY_DEV_MODE, '1');
  }

  static clearDeveloperMode(): void {
    localStorage.removeItem(KEY_DEV_MODE);
    localStorage.removeItem(KEY_UNLOCKED); // 잠금 상태 초기화
  }
}
