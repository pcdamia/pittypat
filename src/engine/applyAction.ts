/**
 * Authoritative applyAction(state, action) => newState with validation.
 */
import type { GameState, PlayerState, Card, Rank, Action } from './types';
import { isWild } from './types';
import { buildDeck, seededShuffle } from './deck';
import {
  countPairsInHand,
  totalPairCount,
  hasSingularMatch,
  canClaimTurnUp,
  getLegalDiscards,
  hasDeadRankInHand,
} from './helpers';

const PAIRS_TO_WIN = 3;

function clonePlayers(players: PlayerState[]): PlayerState[] {
  return players.map((p) => ({
    ...p,
    hand: [...p.hand],
    pairsOnBoard: p.pairsOnBoard.map((pair) => [...pair]),
  }));
}

function addDeadRank(deadRanks: Set<Rank>, rank: Rank): Set<Rank> {
  const next = new Set(deadRanks);
  next.add(rank);
  return next;
}

function updatePlayer(players: PlayerState[], seatIndex: number, update: Partial<PlayerState>): PlayerState[] {
  const out = clonePlayers(players);
  const p = out[seatIndex];
  if (!p) return out;
  out[seatIndex] = { ...p, ...update };
  return out;
}

function derivePatAndOut(players: PlayerState[]): PlayerState[] {
  return players.map((p) => {
    const total = totalPairCount(p.hand, p.pairsOnBoard);
    const isOut = total >= PAIRS_TO_WIN;
    const isPat = !isOut && total === 2 && p.hand.length <= 2;
    return { ...p, isPat, isOut };
  });
}

function nextSeat(seat: number, count: number): number {
  return (seat + 1) % count;
}

function claimWindowOrderFrom(dealerSeat: number, playerCount: number): number[] {
  const order: number[] = [];
  let s = nextSeat(dealerSeat, playerCount);
  for (let i = 0; i < playerCount; i++) {
    order.push(s);
    s = nextSeat(s, playerCount);
  }
  return order;
}

export function createLobbyState(): GameState {
  return {
    phase: 'lobby',
    seed: 0,
    deck: [],
    turnUp: null,
    deadRanks: new Set<Rank>(),
    players: [],
    dealerSeat: 0,
    activeSeat: 0,
    claimWindowOrder: [],
    winnerSeat: null,
    deckIndex: 0,
    lastTakenCard: null,
  };
}

export function createInitialState(
  playerCount: number,
  seed: number,
  aiSeats: number[] = []
): GameState {
  if (playerCount < 2 || playerCount > 6) throw new Error('playerCount must be 2–6');
  const deck = buildDeck(playerCount);
  const shuffled = seededShuffle(deck, seed);
  const dealerSeat = 0;
  const cardsPerPlayer = 5;
  let idx = 0;
  const players: PlayerState[] = [];
  for (let i = 0; i < playerCount; i++) {
    const hand = shuffled.slice(idx, idx + cardsPerPlayer);
    idx += cardsPerPlayer;
    players.push({
      seatIndex: i,
      hand,
      pairsOnBoard: [],
      isPat: false,
      isOut: false,
      isDealer: i === dealerSeat,
      isHuman: !aiSeats.includes(i),
      sideBetOptIn: false,
    });
  }
  const turnUp = shuffled[idx];
  idx += 1;
  const deadRanks = new Set<Rank>();
  const deckRemaining = shuffled.slice(idx);
  const order = claimWindowOrderFrom(dealerSeat, playerCount);
  return {
    phase: 'initialPairs',
    seed,
    deck: deckRemaining,
    turnUp,
    deadRanks,
    players: derivePatAndOut(players),
    dealerSeat,
    activeSeat: order[0],
    claimWindowOrder: order,
    winnerSeat: null,
    deckIndex: 0,
    lastTakenCard: null,
  };
}

export function applyAction(state: GameState, action: Action): { success: true; state: GameState } | { success: false; error: string } {
  const N = state.players.length;

  if (action.type === 'START_GAME') {
    const { playerCount, seed, aiSeats = [] } = action.payload;
    if (state.phase !== 'lobby') return { success: false, error: 'START_GAME only in lobby' };
    if (playerCount < 2 || playerCount > 6) return { success: false, error: 'playerCount must be 2–6' };
    try {
      const newState = createInitialState(playerCount, seed, aiSeats);
      return { success: true, state: newState };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }

  if (action.type === 'REMOVE_PAIRS') {
    if (state.phase !== 'initialPairs') return { success: false, error: 'REMOVE_PAIRS only in initialPairs' };
    const { seatIndex, pairs } = action.payload;
    if (seatIndex !== state.activeSeat) return { success: false, error: 'Not your turn to remove pairs' };
    const player = state.players[seatIndex];
    const handIds = new Set(player.hand.map((c) => c.id));
    const newHand = [...player.hand];
    const newPairsOnBoard: Card[][] = [];
    const newDeadRanks = new Set(state.deadRanks);
    for (const pair of pairs) {
      if (pair.length !== 2) return { success: false, error: 'Each pair must be exactly 2 cards' };
      const [a, b] = pair;
      if (!handIds.has(a.id) || !handIds.has(b.id)) return { success: false, error: 'Cards must be from your hand' };
      if (isWild(a) && isWild(b)) return { success: false, error: 'Wild cards cannot be paired with each other' };
      const rankA = isWild(a) ? null : a.rank;
      const rankB = isWild(b) ? null : b.rank;
      if (rankA !== null) newDeadRanks.add(rankA);
      if (rankB !== null && rankB !== rankA) newDeadRanks.add(rankB);
      newHand.splice(newHand.findIndex((c) => c.id === a.id), 1);
      newHand.splice(newHand.findIndex((c) => c.id === b.id), 1);
      handIds.delete(a.id);
      handIds.delete(b.id);
      newPairsOnBoard.push([a, b]);
    }
    const nextActive = nextSeat(state.activeSeat, N);
    // Check if we've completed all players: if next player would be the one who started initialPairs
    const startedAt = state.claimWindowOrder[0]; // First in claim order is who starts initialPairs
    const allDone = nextActive === startedAt;
    const phase: GameState['phase'] = allDone ? 'claimWindow' : 'initialPairs';
    const claimOrder = claimWindowOrderFrom(state.dealerSeat, N);
    const nextActiveSeat = allDone ? claimOrder[0] : nextActive;
    const players = updatePlayer(state.players, seatIndex, {
      hand: newHand,
      pairsOnBoard: [...player.pairsOnBoard, ...newPairsOnBoard],
    });
    const next = derivePatAndOut(players);
    if (next[seatIndex].isOut) {
      return {
        success: true,
        state: {
          ...state,
          phase: 'ended',
          players: next,
          winnerSeat: seatIndex,
          deadRanks: newDeadRanks,
        },
      };
    }
    return {
      success: true,
      state: {
        ...state,
        phase,
        activeSeat: nextActiveSeat,
        claimWindowOrder: claimOrder,
        deadRanks: newDeadRanks,
        players: next,
      },
    };
  }

  if (action.type === 'CLAIM_TURN_UP') {
    if (state.phase !== 'claimWindow') return { success: false, error: 'CLAIM_TURN_UP only in claimWindow' };
    if (!state.turnUp) return { success: false, error: 'No Turn Up to claim' };
    const { seatIndex } = action.payload;
    const order = state.claimWindowOrder;
    const idx = order.indexOf(seatIndex);
    if (idx < 0) return { success: false, error: 'Not in claim window order' };
    const player = state.players[seatIndex];
    if (player.isOut) {
      return { success: true, state: { ...state, phase: 'ended', winnerSeat: seatIndex } };
    }
    const turnUp = state.turnUp;
    if (!canClaimTurnUp(player.hand, turnUp)) return { success: false, error: 'Cannot claim this Turn Up' };

    if (isWild(turnUp)) {
      // Wild Turn Up goes directly into the player's hand — no pairing
      const newHand = [...player.hand, turnUp];
      const players = updatePlayer(state.players, seatIndex, { hand: newHand });
      const withPat = derivePatAndOut(players);
      if (withPat[seatIndex].isOut) {
        return {
          success: true,
          state: { ...state, phase: 'ended', turnUp: null, activeSeat: seatIndex, players: withPat, winnerSeat: seatIndex, lastTakenCard: turnUp },
        };
      }
      // Safety: if no legal discards (e.g. hand is all wilds now), skip discard
      const legalAfterWild = getLegalDiscards(newHand, state.deadRanks);
      if (legalAfterWild.length === 0) {
        const nextPluck = nextSeat(seatIndex, N);
        return {
          success: true,
          state: { ...state, turnUp: null, phase: 'activeTurnPluck', activeSeat: nextPluck, players: withPat, claimWindowOrder: claimWindowOrderFrom(nextPluck, N), lastTakenCard: turnUp },
        };
      }
      return {
        success: true,
        state: { ...state, phase: 'discardSelection', turnUp: null, activeSeat: seatIndex, players: withPat, lastTakenCard: turnUp },
      };
    }

    // Non-wild Turn Up: pair with the exact rank match in hand
    const rankMatch = player.hand.find((c) => !isWild(c) && c.rank === turnUp.rank)!;
    const newHand = player.hand.filter((c) => c.id !== rankMatch.id);
    const newPair: Card[] = [turnUp, rankMatch];
    const players = updatePlayer(state.players, seatIndex, {
      hand: newHand,
      pairsOnBoard: [...player.pairsOnBoard, newPair],
    });
    const withPat = derivePatAndOut(players);
    // Claiming may complete the 3rd pair — end game immediately if so
    if (withPat[seatIndex].isOut) {
      return {
        success: true,
        state: {
          ...state,
          phase: 'ended',
          turnUp: null,
          activeSeat: seatIndex,
          players: withPat,
          winnerSeat: seatIndex,
          lastTakenCard: turnUp,
        },
      };
    }
    // Safety: if no legal discards remain (e.g. hand is all wilds), skip discard turn
    const legalAfterClaim = getLegalDiscards(newHand, state.deadRanks);
    if (legalAfterClaim.length === 0) {
      const nextPluck = nextSeat(seatIndex, N);
      return {
        success: true,
        state: {
          ...state,
          turnUp: null,
          phase: 'activeTurnPluck',
          activeSeat: nextPluck,
          players: withPat,
          claimWindowOrder: claimWindowOrderFrom(nextPluck, N),
          lastTakenCard: turnUp,
        },
      };
    }
    return {
      success: true,
      state: {
        ...state,
        phase: 'discardSelection',
        turnUp: null,
        activeSeat: seatIndex,
        players: withPat,
        lastTakenCard: turnUp,
      },
    };
  }

  if (action.type === 'PASS_CLAIM') {
    if (state.phase !== 'claimWindow') return { success: false, error: 'PASS_CLAIM only in claimWindow' };
    const { seatIndex } = action.payload;
    const order = state.claimWindowOrder;
    const idx = order.indexOf(seatIndex);
    if (idx < 0) return { success: false, error: 'Not in claim window order' };
    const passingPlayer = state.players[seatIndex];
    if (passingPlayer.isOut) {
      return { success: true, state: { ...state, phase: 'ended', winnerSeat: seatIndex } };
    }
    const nextOrder = order.slice(idx + 1);
    if (nextOrder.length > 0) {
      return {
        success: true,
        state: { ...state, claimWindowOrder: nextOrder, activeSeat: nextOrder[0] },
      };
    }
    // Everyone passed: next player clockwise from the last passer plucks
    const pluckSeat = nextSeat(seatIndex, N);
    return {
      success: true,
      state: {
        ...state,
        phase: 'activeTurnPluck',
        activeSeat: pluckSeat,
        claimWindowOrder: claimWindowOrderFrom(pluckSeat, N),
      },
    };
  }

  if (action.type === 'PLUCK') {
    if (state.phase !== 'activeTurnPluck') return { success: false, error: 'PLUCK only in activeTurnPluck' };
    const { seatIndex } = action.payload;
    if (seatIndex !== state.activeSeat) return { success: false, error: 'Not your turn to pluck' };
    if (state.deckIndex >= state.deck.length) return { success: false, error: 'Deck empty' };
    const player = state.players[seatIndex];
    // If player is already at a winning hand composition before drawing, end the game now
    if (player.isOut) {
      return { success: true, state: { ...state, phase: 'ended', winnerSeat: seatIndex } };
    }
    const plucked = state.deck[state.deckIndex];
    const newDeckIndex = state.deckIndex + 1;
    if (isWild(plucked)) {
      // Special rule: PAT player who draws a wild wins immediately
      if (player.isPat) {
        const newHand = [...player.hand, plucked];
        const players = updatePlayer(state.players, seatIndex, { hand: newHand });
        const withPat = derivePatAndOut(players);
        return {
          success: true,
          state: {
            ...state,
            deckIndex: newDeckIndex,
            phase: 'ended',
            players: withPat,
            winnerSeat: seatIndex,
            lastTakenCard: plucked,
          },
        };
      }
      const newHand = [...player.hand, plucked];
      const players = updatePlayer(state.players, seatIndex, { hand: newHand });
      const withPat = derivePatAndOut(players);
      // Check win via full pair count (handles all wild-majority cases)
      if (withPat[seatIndex].isOut) {
        return {
          success: true,
          state: {
            ...state,
            deckIndex: newDeckIndex,
            phase: 'ended',
            players: withPat,
            winnerSeat: seatIndex,
            lastTakenCard: plucked,
          },
        };
      }
      // Safety: if no legal discards (hand is all wilds), skip discard turn
      const legalAfterWild = getLegalDiscards(newHand, state.deadRanks);
      if (legalAfterWild.length === 0) {
        const nextPluck = nextSeat(seatIndex, N);
        return {
          success: true,
          state: {
            ...state,
            deckIndex: newDeckIndex,
            phase: 'activeTurnPluck',
            activeSeat: nextPluck,
            players: withPat,
            claimWindowOrder: claimWindowOrderFrom(nextPluck, N),
            lastTakenCard: plucked,
          },
        };
      }
      return {
        success: true,
        state: {
          ...state,
          deckIndex: newDeckIndex,
          phase: 'discardSelection',
          players: withPat,
          lastTakenCard: plucked,
        },
      };
    }
    // Auto-pair only when there is exactly one non-wild card of the plucked rank in hand
    const rankMatches = player.hand.filter((c) => !isWild(c) && c.rank === plucked.rank);
    if (rankMatches.length === 1) {
      // Auto-pair: exact rank match in hand + plucked card → pairsOnBoard
      const matchCard = rankMatches[0];
      const newHand = player.hand.filter((c) => c.id !== matchCard.id);
      const newPair: Card[] = [plucked, matchCard];
      const players = updatePlayer(state.players, seatIndex, {
        hand: newHand,
        pairsOnBoard: [...player.pairsOnBoard, newPair],
      });
      const withPat = derivePatAndOut(players);
      // Auto-pair may complete the 3rd pair — end game immediately if so
      if (withPat[seatIndex].isOut) {
        return {
          success: true,
          state: {
            ...state,
            deckIndex: newDeckIndex,
            phase: 'ended',
            players: withPat,
            winnerSeat: seatIndex,
            lastTakenCard: plucked,
          },
        };
      }
      // Safety: if no legal discards remain (all wilds), skip discard turn
      const legal = getLegalDiscards(newHand, state.deadRanks);
      if (legal.length === 0) {
        const nextPluck = nextSeat(seatIndex, N);
        return {
          success: true,
          state: {
            ...state,
            deckIndex: newDeckIndex,
            phase: 'activeTurnPluck',
            activeSeat: nextPluck,
            players: withPat,
            claimWindowOrder: claimWindowOrderFrom(nextPluck, N),
            lastTakenCard: plucked,
          },
        };
      }
      return {
        success: true,
        state: {
          ...state,
          deckIndex: newDeckIndex,
          phase: 'discardSelection',
          players: withPat,
          lastTakenCard: plucked,
        },
      };
    }
    const newTurnUp = plucked;
    const newDeadRanks = addDeadRank(state.deadRanks, plucked.rank);
    const order = claimWindowOrderFrom(seatIndex, N);
    return {
      success: true,
      state: {
        ...state,
        deckIndex: newDeckIndex,
        turnUp: newTurnUp,
        deadRanks: newDeadRanks,
        phase: 'claimWindow',
        claimWindowOrder: order,
        activeSeat: order[0],
        lastTakenCard: null,
      },
    };
  }

  if (action.type === 'DISCARD') {
    if (state.phase !== 'discardSelection') return { success: false, error: 'DISCARD only in discardSelection' };
    const { seatIndex, card } = action.payload;
    if (seatIndex !== state.activeSeat) return { success: false, error: 'Not your turn to discard' };
    const player = state.players[seatIndex];
    // If player is already in a winning hand composition before discarding, end the game now
    if (player.isOut) {
      return { success: true, state: { ...state, phase: 'ended', winnerSeat: seatIndex } };
    }
    const inHand = player.hand.some((c) => c.id === card.id);
    if (!inHand) return { success: false, error: 'Card not in hand' };
    if (isWild(card)) return { success: false, error: 'Cannot discard wild (Deuce/Joker)' };
    const legal = getLegalDiscards(player.hand, state.deadRanks);
    if (!legal.some((c) => c.id === card.id)) return { success: false, error: 'Must discard a dead-rank card if you have one, otherwise any non-wild' };
    const newHand = player.hand.filter((c) => c.id !== card.id);
    const newDeadRanks = addDeadRank(state.deadRanks, card.rank);
    const players = updatePlayer(state.players, seatIndex, { hand: newHand });
    const withPat = derivePatAndOut(players);
    const discardingPlayer = withPat[seatIndex];
    let phase: GameState['phase'] = 'activeTurnPluck';
    let winnerSeat: number | null = state.winnerSeat;
    if (discardingPlayer.isOut) {
      phase = 'ended';
      winnerSeat = seatIndex;
    }
    if (phase === 'ended') {
      return {
        success: true,
        state: {
          ...state,
          phase,
          deadRanks: newDeadRanks,
          players: withPat,
          activeSeat: seatIndex,
          winnerSeat,
          lastTakenCard: null,
        },
      };
    }
    // Discarded card becomes new Turn Up; next player gets claim window
    const claimOrder = claimWindowOrderFrom(seatIndex, N);
    return {
      success: true,
      state: {
        ...state,
        phase: 'claimWindow',
        turnUp: card,
        deadRanks: newDeadRanks,
        players: withPat,
        activeSeat: claimOrder[0],
        claimWindowOrder: claimOrder,
        winnerSeat,
        lastTakenCard: null,
      },
    };
  }

  if (action.type === 'ACK_END_HAND') {
    if (state.phase !== 'ended') return { success: false, error: 'ACK_END_HAND only in ended' };
    return { success: true, state: state };
  }

  return { success: false, error: 'Unknown action' };
}
