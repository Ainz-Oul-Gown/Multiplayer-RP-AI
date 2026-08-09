import type { Ability } from './contracts';

export interface WorldArchive {
  version: 1;
  world: { name: string; settings: Record<string, unknown> };
  loreFiles: Array<{ folder: string; title: string; content: string; tags: string[] }>;
}

export interface CharacterArchive {
  version: 1;
  character: {
    name: string;
    race: string;
    class: string;
    appearance: string;
    personality: Record<string, unknown>;
    bio: string;
    powerLevel: number;
    stats: Record<Ability, number>;
    hp: number;
    maxHp: number;
    money: number;
  };
  inventory: Array<{ itemName: string; quantity: number; type: string; attributes: Record<string, unknown> }>;
}

export function downloadJson(filename: string, payload: unknown): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function validateWorldArchive(value: unknown): value is WorldArchive {
  const archive = value as Partial<WorldArchive>;
  return archive?.version === 1 && Boolean(archive.world?.name) && Array.isArray(archive.loreFiles);
}
