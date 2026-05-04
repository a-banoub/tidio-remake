// Score deltas per signal kind. Tweak as needed; documented in spec §5.3.
const DELTAS: Record<string, number> = {
  calculator_used: 3,
  pricing_page_view: 2,
  returning_visitor: 2,
  google_ads_click: 2,
  exit_intent: 1,
  form_started: 2,
  scroll_70: 1,
  high_value_blog: 1,
};

export function scoreFor(kind: string): number {
  return DELTAS[kind] ?? 0;
}

export type ScoreReason = { kind: string; score_delta: number };

export function summarize(reasons: ScoreReason[]): { total: number; reasons: ScoreReason[] } {
  return { total: reasons.reduce((a, r) => a + r.score_delta, 0), reasons };
}
