import type { DiceResult, Difficulty } from './contracts';

const d20 = () => Math.floor(Math.random() * 20) + 1;

export function rollSkillCheck(modifier: number, difficulty: number, mode: Difficulty): DiceResult {
  const first = d20();
  const second = mode === 'normal' ? first : d20();
  const keptRoll = mode === 'easy' ? Math.max(first, second) : mode === 'hard' ? Math.min(first, second) : first;
  const total = keptRoll + modifier;

  return {
    roll: first,
    keptRoll,
    modifier,
    total,
    difficulty,
    success: total >= difficulty,
    mode,
  };
}
