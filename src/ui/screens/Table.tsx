import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ImageBackground, Image } from 'react-native';
import type { GameState, Card, Action, Rank } from '../../engine/types';
import { isWild } from '../../engine/types';
import { getLegalDiscards, canClaimTurnUp } from '../../engine/helpers';
import { CardComponent } from '../components/Card';
import { DeckPile } from '../components/DeckPile';
import { ChipStack } from '../components/ChipStack';

interface Props {
  state: GameState;
  onAction: (action: Action) => void;
  aiCountdown?: number | null;
  balances?: number[];
  pot?: number;
}

function getDiscardHint(lastTakenCard: Card | null): string {
  if (lastTakenCard && isWild(lastTakenCard)) return 'Wild drawn — keep the 2, discard any other card';
  return 'Select a highlighted card to discard';
}

export function TableScreen({ state, onAction, aiCountdown, balances, pot }: Props) {
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());

  const humanSeat = state.players.findIndex((p) => p.isHuman);
  const humanPlayer = humanSeat >= 0 ? state.players[humanSeat] : null;
  const isMyTurn = state.activeSeat === humanSeat;

  const legalDiscards = humanPlayer ? getLegalDiscards(humanPlayer.hand, state.deadRanks) : [];

  const canClaim =
    state.phase === 'claimWindow' &&
    isMyTurn &&
    state.turnUp !== null &&
    humanPlayer !== null &&
    canClaimTurnUp(humanPlayer.hand, state.turnUp);

  const canPass = state.phase === 'claimWindow' && isMyTurn;
  const canDraw = state.phase === 'activeTurnPluck' && isMyTurn;
  const canReady = state.phase === 'initialPairs' && isMyTurn;

  const pairsInHand = humanPlayer ? findAllPairs(humanPlayer.hand) : [];

  const sortedHand = humanPlayer
    ? [...humanPlayer.hand].sort((a, b) => (RANK_SORT[a.rank] ?? 99) - (RANK_SORT[b.rank] ?? 99))
    : [];

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTurnUpPress = () => {
    if (canClaim) onAction({ type: 'CLAIM_TURN_UP', payload: { seatIndex: humanSeat } });
  };

  const handleDeckPress = () => {
    if (canDraw) onAction({ type: 'PLUCK', payload: { seatIndex: humanSeat } });
  };

  const handleHandCardPress = (card: Card) => {
    if (state.phase === 'discardSelection' && isMyTurn) {
      if (legalDiscards.some((c) => c.id === card.id)) {
        onAction({ type: 'DISCARD', payload: { seatIndex: humanSeat, card } });
        setSelectedCards(new Set());
      }
      return;
    }
    if (state.phase === 'initialPairs' && isMyTurn) {
      setSelectedCards((prev) => {
        const next = new Set(prev);
        if (next.has(card.id)) next.delete(card.id); else next.add(card.id);
        return next;
      });
    }
  };

  const handleRemovePairs = () => {
    if (!humanPlayer || !canReady) return;
    onAction({ type: 'REMOVE_PAIRS', payload: { seatIndex: humanSeat, pairs: pairsInHand } });
    setSelectedCards(new Set());
  };

  const handlePass = () => {
    if (canPass) onAction({ type: 'PASS_CLAIM', payload: { seatIndex: humanSeat } });
  };

  // Auto-pass when human has nothing to claim
  useEffect(() => {
    if (state.phase === 'claimWindow' && isMyTurn && !canClaim && humanSeat >= 0) {
      onAction({ type: 'PASS_CLAIM', payload: { seatIndex: humanSeat } });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.activeSeat]);

  const opponents = state.players.filter((p) => !p.isHuman);
  const myBalance = balances?.[humanSeat];
  const displayPot = pot ?? state.players.length * 5;

  // Seat positions for up to 5 opponents (6-player game)
  let topLeftOpp = null, topCenterOpp = null, topRightOpp = null, leftSideOpp = null, rightSideOpp = null;
  if (opponents.length === 1) {
    topCenterOpp = opponents[0];
  } else if (opponents.length === 2) {
    topLeftOpp = opponents[0]; topRightOpp = opponents[1];
  } else if (opponents.length >= 3) {
    topLeftOpp = opponents[0]; topCenterOpp = opponents[1]; topRightOpp = opponents[2];
    if (opponents.length >= 4) leftSideOpp = opponents[3];
    if (opponents.length >= 5) rightSideOpp = opponents[4];
  }

  // ── Hint text ──────────────────────────────────────────────────────────────
  const hintText = (() => {
    if (state.phase === 'ended') return '🏆 Hand over!';
    if (isMyTurn) {
      if (state.phase === 'discardSelection') return getDiscardHint(state.lastTakenCard);
      if (state.phase === 'claimWindow') return canClaim ? 'Tap CLAIM — or PASS' : 'No match — passing…';
      if (state.phase === 'activeTurnPluck') return 'Tap DRAW or the deck';
      if (state.phase === 'initialPairs') return pairsInHand.length > 0 ? `Tap READY to remove ${pairsInHand.length} pair${pairsInHand.length > 1 ? 's' : ''}` : 'Tap READY — no pairs';
      return state.phase;
    }
    if (aiCountdown != null) return `Seat ${state.activeSeat} deciding… (${aiCountdown}s)`;
    return `Seat ${state.activeSeat}'s turn`;
  })();

  // rowRotation: rotates the entire card row (side players ±90°)
  // cardRotation: rotates individual cards (corner players ±45°)
  const renderOpponentSeat = (p: typeof opponents[0], rowRotation = 0, cardRotation = 0) => (
    <View key={p.seatIndex} style={[styles.seat, state.activeSeat === p.seatIndex && styles.seatActive]}>
      <View style={styles.seatHeader}>
        <Text style={styles.seatName}>
          {AI_NAMES[p.seatIndex % AI_NAMES.length]}{p.isDealer ? ' 🃏' : ''}
        </Text>
        {p.isPat && <Text style={styles.seatPat}>PAT</Text>}
      </View>
      {balances?.[p.seatIndex] !== undefined && (
        <Text style={styles.seatBal}>${balances[p.seatIndex]}</Text>
      )}
      <View style={[styles.seatCardRow, rowRotation !== 0 && { transform: [{ rotate: `${rowRotation}deg` }] }]}>
        {Array.from({ length: Math.min(p.hand.length, 5) }).map((_, i) => (
          <View
            key={i}
            style={[styles.miniCard, cardRotation !== 0 && { transform: [{ rotate: `${cardRotation}deg` }] }]}
          >
            <Image source={require('../../../assets/wpp_icon.png')} style={styles.miniCardImage} resizeMode="contain" />
          </View>
        ))}
        {p.hand.length === 0 && <Text style={styles.seatEmpty}>—</Text>}
      </View>
      {p.pairsOnBoard.length > 0 && (
        <View style={styles.oppPairsBox}>
          {p.pairsOnBoard.map((pair, pi) => (
            <View key={pi} style={styles.oppPairGroup}>
              {pair.map((c) => <CardComponent key={c.id} card={c} size="small" />)}
              {pair.length === 1 && <Text style={styles.wildBadge}>2</Text>}
            </View>
          ))}
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>

      {/* ── Felt ── */}
      <ImageBackground source={require('../../../assets/gameboard.png')} style={styles.felt} resizeMode="cover">

        {/* ── Hint bar ── */}
        <View style={[styles.hintBar, isMyTurn ? styles.hintActive : styles.hintWaiting]}>
          <Text style={styles.hintText} numberOfLines={1}>
            {isMyTurn ? '▶ ' : '⏳ '}{hintText}
          </Text>
          <Text style={styles.playerTag}>
            {humanPlayer?.isDealer ? '🃏 ' : ''}You{humanPlayer?.isPat ? '  🔥 PAT' : ''}
          </Text>
        </View>

        {/* ── Main area ── */}
        <View style={styles.mainArea}>

          {/* Top row: three opponent positions */}
          <View style={styles.topRow}>
            <View style={styles.topSlot}>
              {topLeftOpp && renderOpponentSeat(topLeftOpp, 0, -45)}
            </View>
            <View style={styles.topSlot}>
              {topCenterOpp && renderOpponentSeat(topCenterOpp, 0, 0)}
            </View>
            <View style={styles.topSlot}>
              {topRightOpp && renderOpponentSeat(topRightOpp, 0, 45)}
            </View>
          </View>

          {/* Middle row: left side | play area | right side */}
          <View style={styles.middleRow}>

            <View style={styles.sideCol}>
              {leftSideOpp && renderOpponentSeat(leftSideOpp, -90, 0)}
            </View>

            {/* Play area: deck + turn up */}
            <View style={styles.playArea}>
              <View style={styles.cardRow}>
                <View style={styles.pileSlot}>
                  <DeckPile
                    count={state.deck.length - state.deckIndex}
                    onPress={handleDeckPress}
                    active={canDraw}
                  />
                  <Text style={styles.pileLabel}>Deck</Text>
                </View>

                <View style={styles.pileSlot}>
                  {state.turnUp ? (
                    <TouchableOpacity
                      onPress={handleTurnUpPress}
                      style={[styles.turnUpWrap, canClaim && styles.turnUpGlow]}
                      activeOpacity={canClaim ? 0.75 : 1}
                    >
                      <CardComponent card={state.turnUp} size="large" />
                      {canClaim && <Text style={styles.turnUpHint}>CLAIM</Text>}
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.emptyTurnUp}>
                      <Text style={styles.emptyDash}>—</Text>
                    </View>
                  )}
                  <Text style={styles.pileLabel}>Turn Up</Text>
                </View>
              </View>

              {/* Human pairs on board */}
              {humanPlayer && humanPlayer.pairsOnBoard.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.humanPairsBox}>
                  {humanPlayer.pairsOnBoard.map((pair, pi) => (
                    <View key={pi} style={styles.oppPairGroup}>
                      {pair.map((c) => <CardComponent key={c.id} card={c} size="small" />)}
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>

            <View style={styles.sideCol}>
              {rightSideOpp && renderOpponentSeat(rightSideOpp, 90, 0)}
            </View>

          </View>

        </View>

        {/* Pot — on the gameboard circle */}
        <View style={styles.potAbsolute}>
          <ChipStack amount={displayPot} chipSize={100} showTotal />
        </View>

      {/* ── Hand area: cards only ── */}
      {humanPlayer && (
        <View style={styles.handArea}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.handScroll}
            style={styles.handScroller}
          >
            {sortedHand.map((card) => {
              const isLegal = state.phase === 'discardSelection' && isMyTurn && legalDiscards.some((c) => c.id === card.id);
              const isSelected = selectedCards.has(card.id);
              return (
                <TouchableOpacity
                  key={card.id}
                  onPress={() => handleHandCardPress(card)}
                  style={[styles.cardWrap, isLegal && styles.cardLegal, isSelected && styles.cardSelected]}
                >
                  <CardComponent card={card} size="large" />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Bottom strip ── */}
      <View style={styles.bottomStrip}>
        <View style={styles.balBox}>
          <Text style={styles.balLabel}>CASH BALANCE</Text>
          <Text style={styles.balAmount}>${myBalance ?? '—'}</Text>
        </View>

        <View style={styles.chipCol}>
          <View style={styles.handButtons}>
            <TouchableOpacity
              style={[styles.actionCircle, canClaim ? styles.circleGold : styles.circleIdle]}
              onPress={handleTurnUpPress}
              disabled={!canClaim}
              activeOpacity={0.8}
            >
              <Text style={[styles.circleLabel, canClaim ? styles.circleLabelGold : styles.circleLabelIdle]}>
                CLAIM
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionCircle, canPass ? styles.circleBlue : styles.circleIdle]}
              onPress={handlePass}
              disabled={!canPass}
              activeOpacity={0.8}
            >
              <Text style={[styles.circleLabel, canPass ? styles.circleLabelBlue : styles.circleLabelIdle]}>
                PASS
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionCircle, (canDraw || canReady) ? styles.circleGreen : styles.circleIdle]}
              onPress={canDraw ? handleDeckPress : handleRemovePairs}
              disabled={!canDraw && !canReady}
              activeOpacity={0.8}
            >
              <Text style={[styles.circleLabel, (canDraw || canReady) ? styles.circleLabelGreen : styles.circleLabelIdle]}>
                {canReady ? 'READY' : 'DRAW'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

      </View>

      </ImageBackground>
    </View>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────

function findAllPairs(hand: Card[]): Card[][] {
  const pairs: Card[][] = [];
  const byRank = new Map<Rank, Card[]>();
  for (const c of hand) {
    if (isWild(c)) continue;
    if (!byRank.has(c.rank)) byRank.set(c.rank, []);
    byRank.get(c.rank)!.push(c);
  }
  for (const cards of byRank.values()) {
    while (cards.length >= 2) pairs.push([cards.pop()!, cards.pop()!]);
  }
  return pairs;
}

const AI_NAMES = [
  'Maverick', 'Dolly', 'Ace', 'Blaze', 'Rio', 'Lucky', 'Cash', 'Duke',
  'Remy', 'Scarlett', 'Tex', 'Jolene', 'Hank', 'Daisy', 'Clint', 'Loretta',
  'Buck', 'Ruby', 'Wyatt', 'Belle',
];

const RANK_SORT: Record<string, number> = {
  '3':0, '4':1, '5':2, '6':3, '7':4, '8':5, '9':6, '10':7, 'J':8, 'Q':9, 'K':10, 'A':11, '2':99,
};


// ── Theme ──────────────────────────────────────────────────────────────────

const C = {
  felt: '#1a472a',
  feltDark: '#0f2e1a',
  feltMid: '#2d6a4f',
  feltLight: '#1f5c38',
  gold: '#ffd700',
  strip: '#0a1f12',
};

// ── Styles ─────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: 'transparent' },

  hintBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 9,
  },
  hintActive: { backgroundColor: C.feltMid },
  hintWaiting: { backgroundColor: C.feltDark },
  hintText: { color: '#fff', fontSize: 14, fontWeight: '600', flex: 1 },
  playerTag: { color: C.gold, fontSize: 13, fontWeight: '800', marginLeft: 8 },

  // ── Felt ──
  felt: {
    flex: 1,
    paddingHorizontal: 16, paddingTop: 4, paddingBottom: 4,
  },

  // ── Main area (left | center | right) ──
  mainArea: {
    flex: 1,
    flexDirection: 'column',
  },

  // Top row: three opponent slots (left, center, right)
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 8,
    paddingTop: 4,
  },
  topSlot: {
    flex: 1,
    alignItems: 'center',
  },

  // Middle row: left side player | play area | right side player
  middleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sideCol: {
    width: 130,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Play area: deck + turnup centered in remaining space
  playArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Opponent seats ──
  seat: {
    borderRadius: 10, padding: 10,
    minWidth: 120, alignItems: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  seatActive: { borderColor: C.gold },
  seatHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  seatName: { color: '#ddd', fontSize: 12, fontWeight: '700' },
  seatPat: { color: C.gold, fontSize: 9, fontWeight: '900' },
  seatBal: { color: C.gold, fontSize: 13, fontWeight: '800', marginBottom: 4 },
  seatCardRow: { flexDirection: 'row', gap: 3 },
  miniCard: {
    width: 42, height: 60, borderRadius: 4,
    backgroundColor: '#1c1c1e', borderWidth: 1.5, borderColor: '#ffd700',
    overflow: 'hidden',
  },
  miniCardImage: { width: '100%', height: '100%' },
  seatEmpty: { color: '#3a5a3a', fontSize: 10 },
  oppPairsBox: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 4,
    justifyContent: 'center', marginTop: 4,
  },
  humanPairsBox: {
    flexDirection: 'row', gap: 6,
    justifyContent: 'center', paddingTop: 8,
  },
  oppPairGroup: {
    flexDirection: 'row', gap: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4, padding: 2, alignItems: 'center',
  },
  wildBadge: {
    color: '#ffd700', fontSize: 9, fontWeight: '900',
    backgroundColor: 'rgba(255,215,0,0.15)',
    borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1,
    marginLeft: 2,
  },

  // ── Card area ──
  cardRow: { flexDirection: 'row', gap: 16, alignItems: 'flex-start' },
  pileSlot: { alignItems: 'center', gap: 5 },
  pileLabel: { color: '#7a9a7a', fontSize: 11 },
  turnUpWrap: {
    borderRadius: 10, padding: 3, alignItems: 'center', gap: 3,
    borderWidth: 2, borderColor: 'transparent',
  },
  turnUpGlow: { borderColor: C.gold },
  turnUpHint: { color: C.gold, fontSize: 10, fontWeight: '800' },
  emptyTurnUp: {
    width: 76, height: 110, borderRadius: 8,
    borderWidth: 2, borderColor: '#2a5a3a', borderStyle: 'dashed',
    justifyContent: 'center', alignItems: 'center',
  },
  emptyDash: { color: '#2a5a3a', fontSize: 22 },

  potAbsolute: {
    position: 'absolute', left: '20%', top: '40%',
    alignItems: 'center', gap: 4, zIndex: 2,
  },

  // ── Dead ranks ──
  deadBox: {
    backgroundColor: 'rgba(180,40,40,0.15)', borderRadius: 6, padding: 6,
    borderWidth: 1, borderColor: 'rgba(200,50,50,0.3)', alignSelf: 'center',
    marginTop: 8,
  },
  deadTitle: { color: '#f88', fontSize: 8, fontWeight: '800', letterSpacing: 0.5, marginBottom: 2 },
  deadList: { color: '#f88', fontSize: 10, fontWeight: '600' },

  // ── Action circles ──
  actionCircle: {
    width: 56, height: 56, borderRadius: 28,
    borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowRadius: 6, shadowOpacity: 0,
    elevation: 0,
  },
  circleGold: {
    borderColor: C.gold, backgroundColor: 'rgba(255,215,0,0.12)',
    shadowColor: C.gold, shadowOpacity: 0.6, elevation: 4,
  },
  circleBlue: {
    borderColor: '#42a5f5', backgroundColor: 'rgba(66,165,245,0.12)',
    shadowColor: '#42a5f5', shadowOpacity: 0.6, elevation: 4,
  },
  circleGreen: {
    borderColor: '#66bb6a', backgroundColor: 'rgba(102,187,106,0.12)',
    shadowColor: '#66bb6a', shadowOpacity: 0.6, elevation: 4,
  },
  circleIdle: { borderColor: '#2a4a3a', backgroundColor: 'rgba(0,0,0,0.15)' },
  circleLabel: { fontSize: 11, fontWeight: '900', letterSpacing: 0.8 },
  circleLabelGold: { color: C.gold },
  circleLabelBlue: { color: '#42a5f5' },
  circleLabelGreen: { color: '#66bb6a' },
  circleLabelIdle: { color: '#2a4a3a' },

  // ── Hand ──
  handArea: {
    paddingVertical: 4,
    zIndex: 10,
  },
  handScroller: { height: 150 },
  handScroll: {
    paddingHorizontal: 8, paddingTop: 14, paddingBottom: 4, flexGrow: 1,
    justifyContent: 'center', alignItems: 'center', gap: 2,
  },
  cardWrap: { marginHorizontal: 3, borderRadius: 10, borderWidth: 2.5, borderColor: 'transparent' },
  cardLegal: { borderColor: '#ff8f00', transform: [{ translateY: -10 }] },
  cardSelected: { borderColor: '#43a047', transform: [{ translateY: -10 }] },

  // ── Bottom strip ──
  bottomStrip: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'transparent', paddingHorizontal: 14, paddingVertical: 10,
    gap: 8,
  },
  balBox: { minWidth: 100 },
  balLabel: { color: '#6a8a6a', fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  balAmount: { color: C.gold, fontSize: 22, fontWeight: '900' },
  chipCol: { flex: 1, alignItems: 'center' },
  handButtons: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 10, flexShrink: 0,
  },
});
