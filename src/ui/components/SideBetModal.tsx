import React, { useState, useEffect } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, SafeAreaView,
} from 'react-native';

export type SideBetChoice = 'low-suit' | 'high-suit' | 'low-card' | 'high-card';

export interface SideBetDecision {
  seatIndex: number;
  optedIn: boolean;
  choice?: SideBetChoice;
}

interface Props {
  visible: boolean;
  seatName: string;
  isDealer: boolean;
  onDecline: () => void;
  onAccept: (choice: SideBetChoice) => void;
}

export function SideBetModal({ visible, seatName, isDealer, onDecline, onAccept }: Props) {
  const [showOptions, setShowOptions] = useState(false);

  useEffect(() => {
    if (!visible) setShowOptions(false);
  }, [visible]);

  const handleChoice = (choice: SideBetChoice) => {
    setShowOptions(false);
    onAccept(choice);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>

          {!showOptions ? (
            <>
              <Text style={styles.eyebrow}>SIDE BET</Text>
              <Text style={styles.playerName}>
                {isDealer ? '🃏 ' : ''}{seatName}
              </Text>
              <Text style={styles.prompt}>
                Would you like to place a side bet on the Turn Up card?
              </Text>

              <View style={styles.buttonRow}>
                <TouchableOpacity style={[styles.btn, styles.btnNo]} onPress={onDecline}>
                  <Text style={styles.btnNoText}>No Thanks</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btn, styles.btnYes]} onPress={() => setShowOptions(true)}>
                  <Text style={styles.btnYesText}>Place Bet</Text>
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.eyebrow}>CHOOSE YOUR BET</Text>
              <Text style={styles.playerName}>{seatName}</Text>
              <Text style={styles.prompt}>What are you betting on the Turn Up card?</Text>

              <View style={styles.optionsGrid}>
                <TouchableOpacity style={styles.optionBtn} onPress={() => handleChoice('low-suit')}>
                  <Text style={styles.optionIcon}>♣ ♦</Text>
                  <Text style={styles.optionLabel}>Low Suit</Text>
                  <Text style={styles.optionDesc}>Turn up is Clubs or Diamonds</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionBtn} onPress={() => handleChoice('high-suit')}>
                  <Text style={styles.optionIcon}>♥ ♠</Text>
                  <Text style={styles.optionLabel}>High Suit</Text>
                  <Text style={styles.optionDesc}>Turn up is Hearts or Spades</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionBtn} onPress={() => handleChoice('low-card')}>
                  <Text style={styles.optionIcon}>2–7</Text>
                  <Text style={styles.optionLabel}>Low Card</Text>
                  <Text style={styles.optionDesc}>Turn up rank is 2 through 7</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.optionBtn} onPress={() => handleChoice('high-card')}>
                  <Text style={styles.optionIcon}>8–A</Text>
                  <Text style={styles.optionLabel}>High Card</Text>
                  <Text style={styles.optionDesc}>Turn up rank is 8 through Ace</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.backBtn} onPress={() => setShowOptions(false)}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
            </>
          )}

        </View>
      </View>
    </Modal>
  );
}

const C = {
  felt: '#1a472a',
  feltDark: '#0a1a10',
  gold: '#ffd700',
  overlay: 'rgba(0,0,0,0.75)',
  sheet: '#0f2e1a',
  border: '#2a5a3a',
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: C.sheet,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: C.border,
    padding: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 20,
  },

  eyebrow: {
    color: C.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 6,
  },
  playerName: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 10,
  },
  prompt: {
    color: '#9ab89a',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },

  // ── Ask page ──
  buttonRow: {
    flexDirection: 'row',
    gap: 14,
    width: '100%',
  },
  btn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1.5,
  },
  btnNo: {
    borderColor: '#3a5a3a',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  btnNoText: {
    color: '#7a9a7a',
    fontSize: 14,
    fontWeight: '700',
  },
  btnYes: {
    borderColor: C.gold,
    backgroundColor: 'rgba(255,215,0,0.12)',
  },
  btnYesText: {
    color: C.gold,
    fontSize: 14,
    fontWeight: '900',
  },

  // ── Options page ──
  optionsGrid: {
    width: '100%',
    gap: 10,
  },
  optionBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1.5,
    borderColor: '#2a5a3a',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  optionIcon: {
    color: C.gold,
    fontSize: 18,
    fontWeight: '900',
    width: 46,
    textAlign: 'center',
  },
  optionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    flex: 1,
  },
  optionDesc: {
    color: '#7a9a7a',
    fontSize: 11,
    flex: 2,
    textAlign: 'right',
  },

  backBtn: {
    marginTop: 18,
    padding: 8,
  },
  backBtnText: {
    color: '#7a9a7a',
    fontSize: 13,
    fontWeight: '700',
  },
});
