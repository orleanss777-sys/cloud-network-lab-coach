import type { Difficulty } from "./types";

export const BASE_SCORE: Record<Difficulty, number> = {
  iniciante: 100,
  n2: 160,
  n3: 240,
  cne: 320,
};

export function computeScore(opts: {
  difficulty: Difficulty;
  durationSec: number;
  hintsUsed: number;
  wrongGuesses: number;
  revealed: boolean;
}): { score: number; breakdown: { label: string; delta: number }[] } {
  if (opts.revealed) {
    return {
      score: 0,
      breakdown: [{ label: "Causa revelada", delta: 0 }],
    };
  }
  const base = BASE_SCORE[opts.difficulty];
  const breakdown: { label: string; delta: number }[] = [{ label: "Base", delta: base }];
  let score = base;

  const grace = opts.difficulty === "iniciante" ? 8 * 60 : 12 * 60;
  if (opts.durationSec > grace) {
    const over = opts.durationSec - grace;
    const penalty = Math.min(Math.floor(base * 0.35), Math.floor(over / 20));
    if (penalty) {
      score -= penalty;
      breakdown.push({ label: "Tempo", delta: -penalty });
    }
  }

  const hintCut = [0, 0.12, 0.22, 0.32][Math.min(opts.hintsUsed, 3)] ?? 0;
  if (hintCut) {
    const penalty = Math.round(base * hintCut);
    score -= penalty;
    breakdown.push({ label: `Pistas (${opts.hintsUsed})`, delta: -penalty });
  }

  if (opts.wrongGuesses) {
    const penalty = Math.round(base * 0.18 * opts.wrongGuesses);
    score -= penalty;
    breakdown.push({ label: `Diagnosticos incorretos (${opts.wrongGuesses})`, delta: -penalty });
  }

  score = Math.max(Math.round(base * 0.2), Math.round(score));
  return { score, breakdown };
}

export function rankForTotal(total: number): { title: string; next: number | null } {
  const tiers = [
    { min: 0, title: "Analista L1", next: 200 },
    { min: 200, title: "Operador N2", next: 500 },
    { min: 500, title: "Engenheiro N3", next: 1000 },
    { min: 1000, title: "Cloud Network Engineer", next: 2000 },
    { min: 2000, title: "Principal Network", next: 4000 },
    { min: 4000, title: "Fellow Connectivity", next: null },
  ];
  let current = tiers[0];
  for (const t of tiers) {
    if (total >= t.min) current = t;
  }
  return { title: current.title, next: current.next };
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
