const SIGNAL_PATTERNS = [
  /subentrega/gi,
  /hito/gi,
  /seguimiento/gi,
  /avance/gi,
  /entrega parcial/gi,
  /fase/gi,
  /parte\s+\d+/gi,
  /antes del/gi,
  /para el d[ií]a/gi
];

export interface DeadlineSignal extends Record<string, unknown> {
  score: number;
  matches: string[];
}

export function extractDeadlineSignal(text: string | null | undefined): DeadlineSignal {
  if (!text) {
    return {
      score: 0,
      matches: []
    };
  }

  const matches = SIGNAL_PATTERNS.flatMap((pattern) => text.match(pattern) ?? []).map((match) => match.toLowerCase());

  return {
    score: matches.length,
    matches: Array.from(new Set(matches))
  };
}
