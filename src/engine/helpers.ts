/**
 * Helpers for pair counting, singular match, and dead-discard priority.
 */
import type { Card, Rank } from './types';
import { isWild } from './types';

export function countPairsInHand(hand: Card[]): number {
  const ranks = new Map<Rank, number>();
  let wildCount = 0;
  for (const c of hand) {
    if (isWild(c)) wildCount++;
    else {
      const r = c.rank;
      ranks.set(r, (ranks.get(r) ?? 0) + 1);
    }
  }
  let normalPairs = 0;
  let singles = 0;
  for (const count of ranks.values()) {
    normalPairs += Math.floor(count / 2);
    singles += count % 2;
  }
  // Step 1: use wilds to cover unpaired singles
  const wildForSingles = Math.min(wildCount, singles);
  const remainingWilds = wildCount - wildForSingles;
  // Step 2: remaining wilds (in pairs) can each break up a normal pair into two wild-pairs,
  // gaining a net +1 pair per break (e.g. 2 wilds + K♠K♥ → 2♦+K♠ and 2♣+K♥ = 2 pairs vs 1).
  const canBreak = Math.min(Math.floor(remainingWilds / 2), normalPairs);
  return normalPairs + wildForSingles + canBreak;
}

/** Total pair count: board + hand (including wilds). */
export function totalPairCount(hand: Card[], pairsOnBoard: Card[][]): number {
  return pairsOnBoard.length + countPairsInHand(hand);
}

/**
 * Whether a player can claim a Turn Up card.
 * - Wild Turn Up: always claimable — the wild goes into the player's hand.
 * - Regular Turn Up: player needs exactly ONE non-wild card of that rank in hand.
 *   Wilds in hand do NOT count as a match for a regular Turn Up.
 */
export function canClaimTurnUp(hand: Card[], turnUp: Card): boolean {
  if (isWild(turnUp)) {
    return true;
  }
  const nonWildMatches = hand.filter((c) => !isWild(c) && c.rank === turnUp.rank);
  return nonWildMatches.length === 1;
}

/** Check if player has exactly one card that matches target rank (singular match). Wild counts as match. */
export function hasSingularMatch(hand: Card[], targetRank: Rank): boolean {
  let matchCount = 0;
  for (const c of hand) {
    if (isWild(c)) matchCount++;
    else if (c.rank === targetRank) matchCount++;
  }
  return matchCount === 1;
}

/** Check if player has any card of a dead rank (for discard priority). */
export function hasDeadRankInHand(hand: Card[], deadRanks: Set<Rank>): boolean {
  for (const c of hand) {
    if (isWild(c)) continue;
    if (deadRanks.has(c.rank)) return true;
  }
  return false;
}

/** Get legal discard choices: if any dead rank in hand, only those; else any non-wild. */
export function getLegalDiscards(hand: Card[], deadRanks: Set<Rank>): Card[] {
  if (hasDeadRankInHand(hand, deadRanks)) {
    return hand.filter((c) => !isWild(c) && deadRanks.has(c.rank));
  }
  return hand.filter((c) => !isWild(c));
}

export function cloneState<T>(s: T): T {
  return JSON.parse(JSON.stringify(s));
}

/** Clone GameState and convert deadRanks Set to/from array for JSON. */
export function gameStateFromJSON(obj: Record<string, unknown>): import('./types').GameState {
  const dead = obj.deadRanks;
  const deadSet = new Set<Rank>(Array.isArray(dead) ? dead : []);
  return { ...obj, deadRanks: deadSet } as import('./types').GameState;
}

export function gameStateToJSON(state: import('./types').GameState): Record<string, unknown> {
  return { ...state, deadRanks: [...state.deadRanks] };
}
