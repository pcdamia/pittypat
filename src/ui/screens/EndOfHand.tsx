import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import type { GameState } from '../../engine/types';
import { CardComponent } from '../components/Card';

interface Props {
  state: GameState;
  balances: number[];      // post-payout balances indexed by seatIndex
  pot: number;             // original pot this hand
  stakeAmount: number;
  canPlayAgain: boolean;
  onPlayAgain: () => void;
  onLeaveTable: () => void;
}

export function EndOfHandScreen({ state, balances, pot, stakeAmount, canPlayAgain, onPlayAgain, onLeaveTable }: Props) {
  const winner = state.winnerSeat !== null ? state.players[state.winnerSeat] : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Hand Over</Text>

      {winner && (
        <View style={styles.winnerBanner}>
          <Text style={styles.winnerText}>
            {winner.isHuman ? '🏆 You Won!' : `🏆 Seat ${winner.seatIndex} Won!`}
          </Text>
          <Text style={styles.potText}>+${pot} collected</Text>
        </View>
      )}

      {/* Cards revealed on table */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.revealScroll} contentContainerStyle={styles.revealRow}>
        {state.players.map((p) => (
          <View key={p.seatIndex} style={[styles.revealSeat, p.seatIndex === state.winnerSeat && styles.revealWinner]}>
            <Text style={styles.revealName}>{p.isHuman ? 'You' : `Seat ${p.seatIndex}`}{p.isDealer ? ' 🃏' : ''}</Text>
            {/* Remaining hand cards */}
            <View style={styles.revealCards}>
              {p.hand.length > 0
                ? p.hand.map((c) => <CardComponent key={c.id} card={c} size="small" />)
                : <Text style={styles.revealEmpty}>—</Text>}
            </View>
            {/* Pairs on board */}
            {p.pairsOnBoard.length > 0 && (
              <View style={styles.revealPairsRow}>
                {p.pairsOnBoard.map((pair, pi) => (
                  <View key={pi} style={styles.revealPairGroup}>
                    {pair.map((c) => <CardComponent key={c.id} card={c} size="small" />)}
                    {pair.length === 1 && (
                      <Text style={styles.revealWildBadge}>+2</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        ))}
      </ScrollView>

      {/* Balance table */}
      <View style={styles.balanceCard}>
        <Text style={styles.balanceTitle}>Balances</Text>
        {state.players.map((p) => {
          const bal = balances[p.seatIndex] ?? 0;
          const isWinner = p.seatIndex === state.winnerSeat;
          const isBroke = bal < stakeAmount;
          return (
            <View key={p.seatIndex} style={styles.balanceRow}>
              <Text style={styles.playerName}>
                {p.isHuman ? 'You (Seat 0)' : `Seat ${p.seatIndex}`}
                {p.isDealer ? '  Dealer' : ''}
              </Text>
              <View style={styles.balanceRight}>
                {isWinner && <Text style={styles.winTag}>+${pot}  </Text>}
                <Text style={[styles.balanceAmount, isBroke && styles.brokeAmount]}>
                  ${bal}
                </Text>
                {isBroke && <Text style={styles.brokeTag}>  BROKE</Text>}
              </View>
            </View>
          );
        })}
      </View>

      {/* Can't afford message */}
      {!canPlayAgain && (
        <Text style={styles.brokeMsg}>
          A player can't cover the ${stakeAmount} stake — session over.
        </Text>
      )}

      <View style={styles.btnRow}>
        {canPlayAgain && (
          <TouchableOpacity style={styles.btnPlay} onPress={onPlayAgain}>
            <Text style={styles.btnText}>Play Again</Text>
            <Text style={styles.btnSub}>${stakeAmount} each</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.btnLeave} onPress={onLeaveTable}>
          <Text style={styles.btnText}>Leave Table</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const C = {
  green: '#1a472a',
  greenDark: '#0f2e1a',
  greenLight: '#1f5c38',
  gold: '#ffd700',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.green,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 32,
    fontWeight: '900',
    color: '#fff',
    marginBottom: 16,
    letterSpacing: 1,
  },
  winnerBanner: {
    backgroundColor: C.greenLight,
    borderRadius: 12,
    paddingHorizontal: 32,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: C.gold,
  },
  winnerText: {
    fontSize: 26,
    fontWeight: '900',
    color: C.gold,
  },
  potText: {
    fontSize: 18,
    color: '#b8e0b8',
    marginTop: 4,
    fontWeight: '700',
  },
  revealScroll: { maxHeight: 160, marginBottom: 20, width: '100%' },
  revealRow: { flexDirection: 'row', gap: 12, paddingHorizontal: 8, alignItems: 'flex-start', flexGrow: 1, justifyContent: 'center' },
  revealSeat: {
    backgroundColor: C.greenLight,
    borderRadius: 10,
    padding: 8,
    alignItems: 'center',
    gap: 6,
    minWidth: 90,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  revealWinner: { borderColor: C.gold },
  revealName: { color: '#ddd', fontSize: 11, fontWeight: '700' },
  revealCards: { flexDirection: 'row', gap: 3, flexWrap: 'wrap', justifyContent: 'center' },
  revealEmpty: { color: '#3a5a3a', fontSize: 12 },
  revealPairsRow: { flexDirection: 'row', gap: 4, flexWrap: 'wrap', justifyContent: 'center' },
  revealPairGroup: {
    flexDirection: 'row', gap: 1, alignItems: 'center',
    backgroundColor: 'rgba(255,215,0,0.1)',
    borderRadius: 4, padding: 2,
    borderWidth: 1, borderColor: 'rgba(255,215,0,0.3)',
  },
  revealWildBadge: {
    color: '#ffd700', fontSize: 10, fontWeight: '900',
    marginLeft: 2,
  },

  balanceCard: {
    backgroundColor: C.greenDark,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxWidth: 420,
    marginBottom: 24,
  },
  balanceTitle: {
    color: '#9e9e9e',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1f5c38',
  },
  playerName: {
    color: '#ddd',
    fontSize: 16,
    fontWeight: '600',
  },
  balanceRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  winTag: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  balanceAmount: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  brokeAmount: {
    color: '#f44',
  },
  brokeTag: {
    color: '#f44',
    fontSize: 12,
    fontWeight: '800',
  },
  brokeMsg: {
    color: '#f88',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    maxWidth: 320,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  btnPlay: {
    backgroundColor: C.gold,
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnLeave: {
    backgroundColor: '#555',
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  btnSub: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
});
