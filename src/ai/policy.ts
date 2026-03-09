/**
 * Simple heuristic AI: emits same action intents as humans (claim, pluck, discard).
 * Wild cards (deuces/jokers) are never discarded and never used in board pairs.
 */
import type { GameState, Card, Action, Rank } from '../engine/types';
import { isWild } from '../engine/types';
import { canClaimTurnUp, getLegalDiscards } from '../engine/helpers';

export function getAIAction(state: GameState, seatIndex: number): Action | null {
  const player = state.players[seatIndex];
  if (!player || player.isHuman) return null;

  if (state.phase === 'initialPairs') {
    if (state.activeSeat !== seatIndex) return null;
    const pairs = findStandardPairs(player.hand);
    return { type: 'REMOVE_PAIRS', payload: { seatIndex, pairs } };
  }

  if (state.phase === 'claimWindow') {
    if (state.activeSeat !== seatIndex) return null;
    if (!state.turnUp) return { type: 'PASS_CLAIM', payload: { seatIndex } };
    if (canClaimTurnUp(player.hand, state.turnUp))
      return { type: 'CLAIM_TURN_UP', payload: { seatIndex } };
    return { type: 'PASS_CLAIM', payload: { seatIndex } };
  }

  if (state.phase === 'activeTurnPluck') {
    if (state.activeSeat !== seatIndex) return null;
    return { type: 'PLUCK', payload: { seatIndex } };
  }

  if (state.phase === 'discardSelection') {
    if (state.activeSeat !== seatIndex) return null;
    const legal = getLegalDiscards(player.hand, state.deadRanks);
    if (legal.length === 0) return null;
    const card = chooseDiscard(legal, player.hand);
    return { type: 'DISCARD', payload: { seatIndex, card } };
  }

  if (state.phase === 'ended') {
    return { type: 'ACK_END_HAND' };
  }

  return null;
}

/** Only pair up standard cards by rank. Wilds stay in hand. */
function findStandardPairs(hand: Card[]): Card[][] {
  const pairs: Card[][] = [];
  const byRank = new Map<Rank, Card[]>();
  for (const c of hand) {
    if (isWild(c)) continue;
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank)!.push(c);
  }
  for (const cards of byRank.values()) {
    while (cards.length >= 2) {
      pairs.push([cards.pop()!, cards.pop()!]);
    }
  }
  return pairs;
}

/**
 * Prefer discarding lone cards (rank appears only once — not forming a pair).
 * Never discards wilds (getLegalDiscards already filters them out).
 */
function chooseDiscard(legal: Card[], hand: Card[]): Card {
  if (legal.length === 1) return legal[0];

  // Count rank occurrences in full hand (excluding wilds)
  const rankCounts = new Map<Rank, number>();
  for (const c of hand) {
    if (!isWild(c)) rankCounts.set(c.rank, (rankCounts.get(c.rank) ?? 0) + 1);
  }

  // Prefer discarding a card whose rank only appears once (lone card, not a pair)
  const loneCards = legal.filter((c) => (rankCounts.get(c.rank) ?? 0) === 1);
  if (loneCards.length > 0) return loneCards[0];

  // Fallback: first legal card
  return legal[0];
}
