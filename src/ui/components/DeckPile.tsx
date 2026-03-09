import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

const CARD_BACK = require('../../../assets/wpp_icon.png');

interface Props {
  count: number;
  onPress: () => void;
  active?: boolean;
}

export function DeckPile({ count, onPress, active = false }: Props) {
  return (
    <TouchableOpacity onPress={onPress} disabled={!active} style={styles.wrapper}>
      <View style={[styles.shadow, active && styles.shadowActive]} />
      <View style={[styles.cardBack, active && styles.cardBackActive]}>
        <Image source={CARD_BACK} style={styles.cardBackImage} resizeMode="contain" />
      </View>
      {active && <Text style={styles.tapHint}>Tap to draw</Text>}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 4,
  },
  shadow: {
    position: 'absolute',
    top: 4,
    left: 4,
    width: 76,
    height: 110,
    backgroundColor: '#111',
    borderRadius: 8,
    opacity: 0.3,
  },
  shadowActive: {
    opacity: 0.5,
  },
  cardBack: {
    width: 76,
    height: 110,
    backgroundColor: '#1c1c1e',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#ffd700',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  cardBackActive: {
    borderColor: '#ffd700',
    borderWidth: 2.5,
    backgroundColor: '#1a3a8f',
  },
  cardBackImage: {
    width: '100%',
    height: '100%',
  },
  tapHint: {
    color: '#ffd700',
    fontSize: 11,
    fontWeight: '600',
  },
});
