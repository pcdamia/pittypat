/**
 * Pitty Pat – authoritative types for state and actions.
 */

// --- Card model ---
export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
export type Rank = (typeof RANKS)[number];

export const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'] as const;
export type Suit = (typeof SUITS)[number];

export type CardKind = 'standard' | 'deuce' | 'joker';

export interface Card {
  id: string;
  rank: Rank;
  suit: Suit;
  kind: CardKind;
}

export function isWild(card: Card): boolean {
  return card.kind === 'deuce' || card.kind === 'joker';
}

export function cardRankKey(card: Card): Rank | null {
  if (isWild(card)) return null;
  return card.rank;
}

// --- Player ---
export interface PlayerState {
  seatIndex: number;
  hand: Card[];
  pairsOnBoard: Card[][]; // pairs removed during initialPairs
  isPat: boolean;   // one card away from going out (derived)
  isOut: boolean;   // has completed 3 pairs this hand
  isDealer: boolean;
  isHuman: boolean;
  sideBetOptIn: boolean;
}

// --- Game phase ---
export type GamePhase =
  | 'lobby'
  | 'initialPairs'      // players removing pairs before first turn
  | 'claimWindow'       // around-the-table claim for Turn Up
  | 'activeTurnPluck'   // active player must pluck from deck
  | 'discardSelection'  // player who took a card must discard
  | 'winCheck'          // check for winner before next phase
  | 'ended';

// --- Game state ---
export interface GameState {
  phase: GamePhase;
  seed: number;
  deck: Card[];
  turnUp: Card | null;
  deadRanks: Set<Rank>;
  players: PlayerState[];
  dealerSeat: number;
  activeSeat: number;           // whose turn (or who is in claim window / discard)
  claimWindowOrder: number[];   // seat order for current claim window (clockwise from next after dealer for first turn)
  winnerSeat: number | null;
  /** Index into deck for next pluck (deterministic). */
  deckIndex: number;
  /** Optional: for discardSelection, card just taken (Turn Up or pluck) for UI. */
  lastTakenCard: Card | null;
}

// --- Actions (intents from client / AI) ---
export type Action =
  | { type: 'START_GAME'; payload: { playerCount: number; seed: number; aiSeats?: number[] } }
  | { type: 'REMOVE_PAIRS'; payload: { seatIndex: number; pairs: Card[][] } }
  | { type: 'CLAIM_TURN_UP'; payload: { seatIndex: number } }
  | { type: 'PASS_CLAIM'; payload: { seatIndex: number } }
  | { type: 'PLUCK'; payload: { seatIndex: number } }
  | { type: 'DISCARD'; payload: { seatIndex: number; card: Card } }
  | { type: 'ACK_END_HAND' };

export type ActionResult = { success: true; state: GameState } | { success: false; error: string };
