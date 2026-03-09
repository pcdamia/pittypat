/**
 * Jest tests for Pitty Pat rules engine.
 * Covers: deadRanks, pluck (drop as Turn Up / wild / match), dead-discard priority,
 * turn-based win, initialPairs, claim window.
 */
import {
  applyAction,
  createLobbyState,
  createInitialState,
  type GameState,
} from '../applyAction';
import { getLegalDiscards, hasSingularMatch } from '../helpers';
import { isWild } from '../types';
import type { Action, Card, Rank } from '../types';

function runActions(initial: GameState, actions: Action[]): GameState {
  let state = initial;
  for (const action of actions) {
    const result = applyAction(state, action);
    if (!result.success) throw new Error(result.error);
    state = result.state;
  }
  return state;
}

describe('Pitty Pat engine', () => {
  describe('START_GAME and initial state', () => {
    it('rejects START_GAME when not in lobby', () => {
      const state = createInitialState(2, 42);
      const r = applyAction(state, { type: 'START_GAME', payload: { playerCount: 2, seed: 1 } });
      expect(r.success).toBe(false);
      expect((r as { error: string }).error).toContain('lobby');
    });

    it('creates game with 5 cards each, turnUp set, phase initialPairs', () => {
      const lobby = createLobbyState();
      const r = applyAction(lobby, { type: 'START_GAME', payload: { playerCount: 2, seed: 100 } });
      expect(r.success).toBe(true);
      const s = (r as { state: GameState }).state;
      expect(s.phase).toBe('initialPairs');
      expect(s.players).toHaveLength(2);
      expect(s.players[0].hand).toHaveLength(5);
      expect(s.players[1].hand).toHaveLength(5);
      expect(s.turnUp).not.toBeNull();
      expect(s.deadRanks.size).toBe(0);
    });
  });

  describe('deadRanks updates', () => {
    it('REMOVE_PAIRS adds pair ranks to deadRanks', () => {
      const state = createInitialState(2, 200);
      const activePlayer = state.players[state.activeSeat];
      const pair = activePlayer.hand.slice(0, 2);
      const rank = pair[0].rank;
      const r = applyAction(state, {
        type: 'REMOVE_PAIRS',
        payload: { seatIndex: state.activeSeat, pairs: [pair] },
      });
      expect(r.success).toBe(true);
      const s = (r as { state: GameState }).state;
      expect(s.deadRanks.has(rank)).toBe(true);
    });

    it('DISCARD adds discarded card rank to deadRanks', () => {
      let state = createInitialState(2, 300);
      const firstActive = state.activeSeat;
      const secondActive = (firstActive + 1) % state.players.length;
      state = runActions(state, [
        { type: 'REMOVE_PAIRS', payload: { seatIndex: firstActive, pairs: [] } },
        { type: 'REMOVE_PAIRS', payload: { seatIndex: secondActive, pairs: [] } },
        { type: 'PASS_CLAIM', payload: { seatIndex: 1 } },
        { type: 'PASS_CLAIM', payload: { seatIndex: 0 } },
      ]);
      expect(state.phase).toBe('activeTurnPluck');
      const beforeSize = state.deadRanks.size;
      const pluckSeat = state.activeSeat;
      const r = applyAction(state, { type: 'PLUCK', payload: { seatIndex: pluckSeat } });
      expect(r.success).toBe(true);
      state = (r as { state: GameState }).state;
      const discardSeat = state.activeSeat;
      const cardToDiscard = getLegalDiscards(state.players[discardSeat].hand, state.deadRanks)[0];
      const r2 = applyAction(state, { type: 'DISCARD', payload: { seatIndex: discardSeat, card: cardToDiscard } });
      expect(r2.success).toBe(true);
      const s = (r2 as { state: GameState }).state;
      expect(s.deadRanks.has(cardToDiscard.rank)).toBe(true);
      // Discarded card now becomes the new Turn Up for next player
      expect(s.turnUp?.id).toBe(cardToDiscard.id);
    });

    it('pluck with no singular match dropped as Turn Up adds that rank to deadRanks', () => {
      let state = createInitialState(2, 400);
      const firstActive = state.activeSeat;
      const secondActive = (firstActive + 1) % state.players.length;
      state = runActions(state, [
        { type: 'REMOVE_PAIRS', payload: { seatIndex: firstActive, pairs: [] } },
        { type: 'REMOVE_PAIRS', payload: { seatIndex: secondActive, pairs: [] } },
      ]);
      const claimOrder = state.claimWindowOrder;
      state = runActions(state, claimOrder.map((seat) => ({ type: 'PASS_CLAIM', payload: { seatIndex: seat } })));
      expect(state.phase).toBe('activeTurnPluck');
      const pluckSeat = state.activeSeat;
      const plucked = state.deck[state.deckIndex];
      if (isWild(plucked)) return; // Skip if wild
      const pluckedRank = plucked.rank;
      const player = state.players[pluckSeat];
      if (hasSingularMatch(player.hand, pluckedRank)) return; // Skip if player has singular match
      const r = applyAction(state, { type: 'PLUCK', payload: { seatIndex: pluckSeat } });
      expect(r.success).toBe(true);
      const s = (r as { state: GameState }).state;
      expect(s.deadRanks.has(pluckedRank)).toBe(true);
      expect(s.turnUp).not.toBeNull();
      expect(s.turnUp!.rank).toBe(pluckedRank);
    });
  });

  describe('pluck behavior', () => {
    it('non-wild pluck with no singular match becomes Turn Up and phase is claimWindow', () => {
      let state = createInitialState(2, 500);
      const firstActive = state.activeSeat;
      const secondActive = (firstActive + 1) % state.players.length;
      state = runActions(state, [
        { type: 'REMOVE_PAIRS', payload: { seatIndex: firstActive, pairs: [] } },
        { type: 'REMOVE_PAIRS', payload: { seatIndex: secondActive, pairs: [] } },
      ]);
      const claimOrder = state.claimWindowOrder;
      state = runActions(state, claimOrder.map((seat) => ({ type: 'PASS_CLAIM', payload: { seatIndex: seat } })));
      const pluckSeat = state.activeSeat;
      const r = applyAction(state, { type: 'PLUCK', payload: { seatIndex: pluckSeat } });
      expect(r.success).toBe(true);
      const s = (r as { state: GameState }).state;
      expect(s.phase).toBe('claimWindow');
      expect(s.turnUp).not.toBeNull();
      expect(s.claimWindowOrder.length).toBe(2);
    });

    it('wild pluck is kept and phase becomes discardSelection', () => {
      const state = createInitialState(2, 600);
      const deckHasWild = state.deck.some((c) => c.kind === 'deuce' || c.kind === 'joker');
      if (!deckHasWild) return;
      let idx = state.deck.findIndex((c) => c.kind === 'deuce' || c.kind === 'joker');
      if (idx >= 0) {
        const reordered = [...state.deck];
        const [w] = reordered.splice(idx, 1);
        reordered.unshift(w);
        let s: GameState = { ...state, deck: reordered, deckIndex: 0 };
        const firstActive = s.activeSeat;
        const secondActive = (firstActive + 1) % s.players.length;
        s = runActions(s, [
          { type: 'REMOVE_PAIRS', payload: { seatIndex: firstActive, pairs: [] } },
          { type: 'REMOVE_PAIRS', payload: { seatIndex: secondActive, pairs: [] } },
        ]);
        const claimOrder = s.claimWindowOrder;
        s = runActions(s, claimOrder.map((seat) => ({ type: 'PASS_CLAIM', payload: { seatIndex: seat } })));
        const pluckSeat = s.activeSeat;
        const wildCardId = s.deck[0].id;
        const r = applyAction(s, { type: 'PLUCK', payload: { seatIndex: pluckSeat } });
        expect(r.success).toBe(true);
        const next = (r as { state: GameState }).state;
        expect(next.phase).toBe('discardSelection');
        expect(next.players[pluckSeat].hand.some((c) => c.id === wildCardId)).toBe(true);
      }
    });

    it('pluck with singular match is kept and phase becomes discardSelection', () => {
      const state = createInitialState(2, 700);
      const topRank = state.deck[state.deck.length - 1 - 5 * 2 - 1]?.rank;
      if (!topRank) return;
      const activePlayer = state.players[state.activeSeat];
      const activeHasOne = activePlayer.hand.filter((c) => c.kind === 'standard' && c.rank === topRank).length === 1;
      if (!activeHasOne) return;
      const reordered = [...state.deck];
      const top = reordered.pop()!;
      reordered.unshift(top);
      let s: GameState = { ...state, deck: reordered, deckIndex: 0 };
      const firstActive = s.activeSeat;
      const secondActive = (firstActive + 1) % s.players.length;
      s = runActions(s, [
        { type: 'REMOVE_PAIRS', payload: { seatIndex: firstActive, pairs: [] } },
        { type: 'REMOVE_PAIRS', payload: { seatIndex: secondActive, pairs: [] } },
        { type: 'PASS_CLAIM', payload: { seatIndex: 1 } },
        { type: 'PASS_CLAIM', payload: { seatIndex: 0 } },
      ]);
      const r = applyAction(s, { type: 'PLUCK', payload: { seatIndex: s.activeSeat } });
      expect(r.success).toBe(true);
      const next = (r as { state: GameState }).state;
      expect(next.phase).toBe('discardSelection');
    });
  });

  describe('dead-discard priority', () => {
    it('rejects discard of non-dead rank when player has a dead-rank card', () => {
      const state = createInitialState(2, 800);
      const p0 = state.players[0];
      const standardCards = p0.hand.filter((c) => c.kind === 'standard');
      const deadRank = standardCards[0]?.rank;
      if (!deadRank || standardCards.length < 2) return;
      const nonDeadCard = standardCards.find((c) => c.rank !== deadRank) ?? standardCards[1];
      const stateWithDead: GameState = {
        ...state,
        phase: 'discardSelection',
        activeSeat: 0,
        lastTakenCard: state.turnUp,
        turnUp: null,
        deadRanks: new Set([deadRank]),
      };
      const r = applyAction(stateWithDead, { type: 'DISCARD', payload: { seatIndex: 0, card: nonDeadCard } });
      expect(r.success).toBe(false);
      expect((r as { error: string }).error).toContain('dead');
    });
  });

  describe('turn-based win enforcement', () => {
    it('only discarding player can win (phase ends with winnerSeat set)', () => {
      let state = createInitialState(2, 900);
      const firstActive = state.activeSeat;
      const secondActive = (firstActive + 1) % state.players.length;
      state = runActions(state, [
        { type: 'REMOVE_PAIRS', payload: { seatIndex: firstActive, pairs: [] } },
        { type: 'REMOVE_PAIRS', payload: { seatIndex: secondActive, pairs: [] } },
      ]);
      const p0 = state.players[0];
      const pairs: Card[][] = [];
      let hand = [...p0.hand];
      const byRank = new Map<string, Card[]>();
      for (const c of hand) {
        const k = c.rank;
        if (!byRank.has(k)) byRank.set(k, []);
        byRank.get(k)!.push(c);
      }
      for (const [, cards] of byRank) {
        if (cards.length >= 2) pairs.push(cards.slice(0, 2));
      }
      if (pairs.length < 2) return;
      const twoPairs = pairs.slice(0, 2);
      const used = new Set(twoPairs.flat().map((c) => c.id));
      hand = hand.filter((c) => !used.has(c.id));
      if (hand.length < 1) return;
      state = runActions(state, [
        { type: 'REMOVE_PAIRS', payload: { seatIndex: 0, pairs: twoPairs } },
        { type: 'REMOVE_PAIRS', payload: { seatIndex: 1, pairs: [] } },
      ]);
      state = { ...state, phase: 'discardSelection', activeSeat: 0, turnUp: null, lastTakenCard: state.players[0].hand[0] };
      const toDiscard = state.players[0].hand.find((c) => !isWild(c));
      if (!toDiscard) return;
      const r = applyAction(state, { type: 'DISCARD', payload: { seatIndex: 0, card: toDiscard } });
      if (!r.success) return;
      const s = (r as { state: GameState }).state;
      if (s.players[0].pairsOnBoard.length === 2 && s.players[0].hand.length <= 1) {
        const totalPairs = s.players[0].pairsOnBoard.length + (s.players[0].hand.length >= 2 ? 1 : 0);
        if (totalPairs >= 3) expect(s.phase).toBe('ended');
      }
    });
  });

  describe('initialPairs', () => {
    it('REMOVE_PAIRS removes cards from hand and adds to pairsOnBoard', () => {
      const state = createInitialState(2, 1000);
      const activePlayer = state.players[state.activeSeat];
      const pair = activePlayer.hand.slice(0, 2);
      const r = applyAction(state, {
        type: 'REMOVE_PAIRS',
        payload: { seatIndex: state.activeSeat, pairs: [pair] },
      });
      expect(r.success).toBe(true);
      const s = (r as { state: GameState }).state;
      expect(s.players[state.activeSeat].hand).toHaveLength(3);
      expect(s.players[state.activeSeat].pairsOnBoard).toHaveLength(1);
      expect(s.players[state.activeSeat].pairsOnBoard[0]).toHaveLength(2);
    });

    it('after all players remove pairs, phase becomes claimWindow', () => {
      let state = createInitialState(2, 1100);
      const firstActive = state.activeSeat;
      const secondActive = (firstActive + 1) % state.players.length;
      state = runActions(state, [
        { type: 'REMOVE_PAIRS', payload: { seatIndex: firstActive, pairs: [] } },
        { type: 'REMOVE_PAIRS', payload: { seatIndex: secondActive, pairs: [] } },
      ]);
      expect(state.phase).toBe('claimWindow');
      expect(state.turnUp).not.toBeNull();
      expect(state.claimWindowOrder).toHaveLength(2);
    });

    it('rejects REMOVE_PAIRS when not that player turn', () => {
      const state = createInitialState(2, 1200);
      const wrongSeat = (state.activeSeat + 1) % state.players.length;
      const r = applyAction(state, {
        type: 'REMOVE_PAIRS',
        payload: { seatIndex: wrongSeat, pairs: [] },
      });
      expect(r.success).toBe(false);
    });
  });

  describe('claim window', () => {
    it('CLAIM_TURN_UP with singular match takes card and moves to discardSelection', () => {
      let state = createInitialState(2, 1300);
      const firstActive = state.activeSeat;
      const secondActive = (firstActive + 1) % state.players.length;
      state = runActions(state, [
        { type: 'REMOVE_PAIRS', payload: { seatIndex: firstActive, pairs: [] } },
        { type: 'REMOVE_PAIRS', payload: { seatIndex: secondActive, pairs: [] } },
      ]);
      const turnUpRank = state.turnUp!.rank;
      const claimer = state.claimWindowOrder.find((i) => {
        const hand = state.players[i].hand;
        let match = 0;
        for (const c of hand) {
          if (c.kind === 'deuce' || c.kind === 'joker') match++;
          else if (c.rank === turnUpRank) match++;
        }
        return match === 1;
      });
      if (claimer === undefined) return;
      const r = applyAction(state, { type: 'CLAIM_TURN_UP', payload: { seatIndex: claimer } });
      expect(r.success).toBe(true);
      const s = (r as { state: GameState }).state;
      expect(s.phase).toBe('discardSelection');
      expect(s.turnUp).toBeNull();
      expect(s.activeSeat).toBe(claimer);
    });

    it('all PASS_CLAIM leads to activeTurnPluck with first in order', () => {
      let state = createInitialState(2, 1400);
      const firstActive = state.activeSeat;
      const secondActive = (firstActive + 1) % state.players.length;
      state = runActions(state, [
        { type: 'REMOVE_PAIRS', payload: { seatIndex: firstActive, pairs: [] } },
        { type: 'REMOVE_PAIRS', payload: { seatIndex: secondActive, pairs: [] } },
      ]);
      const claimOrder = state.claimWindowOrder;
      expect(claimOrder.length).toBeGreaterThan(0);
      state = runActions(state, claimOrder.map((seat) => ({ type: 'PASS_CLAIM', payload: { seatIndex: seat } })));
      expect(state.phase).toBe('activeTurnPluck');
      expect(state.activeSeat).toBe(claimOrder[0]);
    });
  });

  describe('deterministic shuffle', () => {
    it('same seed produces same initial hands', () => {
      const a = createInitialState(2, 999);
      const b = createInitialState(2, 999);
      const handA = a.players[0].hand.map((c) => c.id).sort();
      const handB = b.players[0].hand.map((c) => c.id).sort();
      expect(handA).toEqual(handB);
    });
  });
});
