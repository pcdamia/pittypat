import { View, Text, StyleSheet } from 'react-native';
import type { Card } from '../../engine/types';
import { isWild } from '../../engine/types';

const SUIT_SYMBOLS: Record<string, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const SIZE_MAP = { small: 36, medium: 56, large: 76 } as const;

interface Props {
  card: Card;
  size?: 'small' | 'medium' | 'large';
}

export function CardComponent({ card, size = 'medium' }: Props) {
  const w = SIZE_MAP[size];
  const h = Math.round(w * 1.45);

  if (isWild(card)) {
    const label = card.kind === 'deuce' ? '2' : '🃏';
    return (
      <View style={[styles.card, { width: w, height: h }, styles.wildCard]}>
        <Text style={[styles.corner, { fontSize: w * 0.28, color: '#b8860b' }]}>{label}</Text>
        <Text style={[styles.wildCenter, { fontSize: w * 0.22 }]}>WILD</Text>
        <Text style={[styles.cornerBottom, { fontSize: w * 0.28, color: '#b8860b' }]}>{label}</Text>
      </View>
    );
  }

  const isRed = card.suit === 'diamonds' || card.suit === 'hearts';
  const color = isRed ? '#c0392b' : '#1a1a2e';
  const suit = SUIT_SYMBOLS[card.suit];

  return (
    <View style={[styles.card, { width: w, height: h }]}>
      <Text style={[styles.corner, { fontSize: w * 0.28, color }]}>{card.rank}</Text>
      <Text style={[styles.suitCenter, { fontSize: w * 0.38, color }]}>{suit}</Text>
      <Text style={[styles.cornerBottom, { fontSize: w * 0.28, color }]}>{card.rank}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  wildCard: {
    backgroundColor: '#fffde7',
    borderColor: '#f9a825',
    borderWidth: 2,
  },
  corner: {
    fontWeight: '800',
    alignSelf: 'flex-start',
    marginLeft: 5,
  },
  cornerBottom: {
    fontWeight: '800',
    alignSelf: 'flex-end',
    marginRight: 5,
    transform: [{ rotate: '180deg' }],
  },
  suitCenter: {
    lineHeight: undefined,
  },
  wildCenter: {
    fontWeight: '900',
    color: '#e65100',
    letterSpacing: 1,
  },
});
