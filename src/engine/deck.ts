/**
 * Deck composition and deterministic shuffle.
 */
import type { Card, Rank, Suit } from './types';
import { RANKS, SUITS } from './types';

let cardIdCounter = 0;
function nextId(): string {
  return `c${++cardIdCounter}`;
}

export function buildDeck(playerCount: number): Card[] {
  cardIdCounter = 0;
  const cards: Card[] = [];

  // Standard 52 — all deuces (rank '2') are wild
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      const kind = rank === '2' ? 'deuce' : 'standard';
      cards.push({ id: nextId(), rank, suit, kind });
    }
  }

  // Extra jokers for 5–6 player games
  const jokerCount = playerCount > 4 ? playerCount - 4 : 0;
  for (let i = 0; i < jokerCount; i++) {
    cards.push({ id: nextId(), rank: '2', suit: 'spades', kind: 'joker' });
  }

  return cards;
}

/**
 * Deterministic seeded shuffle (Fisher–Yates with seeded RNG).
 */
export function seededShuffle<T>(array: T[], seed: number): T[] {
  const arr = [...array];
  let s = seed;
  const next = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
