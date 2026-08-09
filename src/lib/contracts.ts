export type Ability = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';
export type Difficulty = 'easy' | 'normal' | 'hard';
export type SessionMode = 'plot' | 'sandbox';

export interface ParsedAction {
  intent_type: 'skill_check' | 'social' | 'explore' | 'inventory' | 'other';
  target: string;
  required_check?: { skill: Ability; difficulty: number };
  items_used: string[];
}

export interface DiceResult {
  roll: number;
  keptRoll: number;
  modifier: number;
  total: number;
  difficulty: number;
  success: boolean;
  mode: Difficulty;
}

export interface NarrativeContext {
  sessionMode: SessionMode;
  currentPlotStage?: string;
  playerName: string;
  playerConcept: string;
  playerWeaknesses: string[];
  actionText: string;
  strictFacts: string[];
  loreSnippets: string[];
}
