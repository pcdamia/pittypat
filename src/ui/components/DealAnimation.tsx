import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, Animated, StyleSheet, Dimensions, Image,
} from 'react-native';

const { width: W, height: H } = Dimensions.get('window');

const CARD_W = 38;
const CARD_H = 54;

// Deck position on screen (matches Table.tsx play area)
const DECK_X = W * 0.35 - CARD_W / 2;
const DECK_Y = H * 0.44 - CARD_H / 2;
const TURNUP_X = W * 0.65 - CARD_W / 2;
const TURNUP_Y = H * 0.44 - CARD_H / 2;

/**
 * Returns the approximate on-screen position for each seat's card pile,
 * matching the Table.tsx layout logic.
 *
 * Assumes seat 0 = human (bottom center).
 * Opponents (seats 1..N-1) are placed top-left/center/right then side slots.
 */
function getSeatPos(seatIndex: number, playerCount: number): { x: number; y: number } {
  if (seatIndex === 0) {
    // Human: bottom center
    return { x: W * 0.5 - CARD_W / 2, y: H * 0.80 - CARD_H / 2 };
  }

  const oppIdx = seatIndex - 1; // 0-based among opponents
  const numOpponents = playerCount - 1;

  if (numOpponents === 1) {
    // Only one opponent: top center
    return { x: W * 0.5 - CARD_W / 2, y: H * 0.12 };
  }
  if (numOpponents === 2) {
    const positions = [
      { x: W * 0.20 - CARD_W / 2, y: H * 0.16 },
      { x: W * 0.80 - CARD_W / 2, y: H * 0.16 },
    ];
    return positions[oppIdx] ?? positions[0];
  }
  // 3–5 opponents
  const positions = [
    { x: W * 0.18 - CARD_W / 2, y: H * 0.14 }, // top-left
    { x: W * 0.50 - CARD_W / 2, y: H * 0.09 }, // top-center
    { x: W * 0.82 - CARD_W / 2, y: H * 0.14 }, // top-right
    { x: W * 0.06 - CARD_W / 2, y: H * 0.44 }, // left side
    { x: W * 0.94 - CARD_W / 2, y: H * 0.44 }, // right side
  ];
  return positions[oppIdx] ?? positions[0];
}

interface DealStep {
  x: number;
  y: number;
  seatIndex: number | null; // null = turn up
}

function buildDealSequence(playerCount: number): DealStep[] {
  const steps: DealStep[] = [];
  // Deal round-robin: 1 card per player per round, 5 rounds
  for (let round = 0; round < 5; round++) {
    for (let seat = 0; seat < playerCount; seat++) {
      const pos = getSeatPos(seat, playerCount);
      steps.push({ ...pos, seatIndex: seat });
    }
  }
  // Turn up card
  steps.push({ x: TURNUP_X, y: TURNUP_Y, seatIndex: null });
  return steps;
}

// ms between each card being sent
const STAGGER_MS = 160;
// ms for a single card to fly to its destination
const FLY_MS = 210;

interface Props {
  playerCount: number;
  playerNames: string[]; // name per seat index
  onComplete: () => void;
}

export function DealAnimation({ playerCount, playerNames, onComplete }: Props) {
  const dealSequence = useRef(buildDealSequence(playerCount)).current;
  const totalSteps = dealSequence.length;

  // Tracks how many cards each seat has received so far (for showing card backs)
  const [dealtPerSeat, setDealtPerSeat] = useState<number[]>(Array(playerCount).fill(0));
  const [turnUpDealt, setTurnUpDealt] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [done, setDone] = useState(false);

  // Animated values for the single flying card
  const flyX = useRef(new Animated.Value(DECK_X)).current;
  const flyY = useRef(new Animated.Value(DECK_Y)).current;
  const flyOpacity = useRef(new Animated.Value(0)).current;

  // Kick off: start step 0 after a short pause
  useEffect(() => {
    const t = setTimeout(() => setCurrentStep(0), 400);
    return () => clearTimeout(t);
  }, []);

  // Drive each deal step
  useEffect(() => {
    if (currentStep < 0) return;

    if (currentStep >= totalSteps) {
      // All done
      Animated.timing(flyOpacity, { toValue: 0, duration: 100, useNativeDriver: false }).start();
      const t = setTimeout(() => {
        setDone(true);
        onComplete();
      }, 700);
      return () => clearTimeout(t);
    }

    const step = dealSequence[currentStep];

    // Snap the flying card back to the deck, then fly to target
    flyX.setValue(DECK_X);
    flyY.setValue(DECK_Y);
    flyOpacity.setValue(1);

    Animated.parallel([
      Animated.timing(flyX, { toValue: step.x, duration: FLY_MS, useNativeDriver: false }),
      Animated.timing(flyY, { toValue: step.y, duration: FLY_MS, useNativeDriver: false }),
    ]).start(() => {
      // Card arrived — update seat card count, then hide flying card
      if (step.seatIndex !== null) {
        setDealtPerSeat((prev) => {
          const next = [...prev];
          next[step.seatIndex!] = (next[step.seatIndex!] ?? 0) + 1;
          return next;
        });
      } else {
        setTurnUpDealt(true);
      }
      flyOpacity.setValue(0);

      // Pause briefly before next card
      const t = setTimeout(() => setCurrentStep((s) => s + 1), STAGGER_MS - FLY_MS + 60);
      return () => clearTimeout(t);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep]);

  if (done) return null;

  const remainingInDeck = Math.max(0, totalSteps - 1 - Math.max(0, currentStep));

  return (
    <View style={styles.overlay} pointerEvents="box-only">

      {/* ── Label ── */}
      <View style={styles.topLabel}>
        <Text style={styles.dealingText}>DEALING</Text>
        <Text style={styles.dealingDots}>{currentStep < totalSteps ? '...' : ''}</Text>
      </View>

      {/* ── Deck pile (shrinks as cards are dealt) ── */}
      <View style={[styles.deckPile, { left: DECK_X - 4, top: DECK_Y - 4 }]}>
        <View style={[styles.deckCard, { opacity: remainingInDeck > 0 ? 1 : 0.2 }]}>
          <Image
            source={require('../../../assets/wpp_icon.png')}
            style={styles.deckCardImage}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.deckCount}>{remainingInDeck}</Text>
      </View>

      {/* ── Turn up slot ── */}
      <View style={[styles.turnUpSlot, { left: TURNUP_X - 4, top: TURNUP_Y - 4 }]}>
        {turnUpDealt ? (
          <View style={styles.turnUpCard}>
            <Text style={styles.turnUpQ}>?</Text>
          </View>
        ) : (
          <View style={styles.turnUpEmpty} />
        )}
        <Text style={styles.pileLabel}>Turn Up</Text>
      </View>

      {/* ── Seat mini-piles ── */}
      {Array.from({ length: playerCount }).map((_, seat) => {
        const pos = getSeatPos(seat, playerCount);
        const count = dealtPerSeat[seat] ?? 0;
        return (
          <View
            key={seat}
            style={[styles.seatPile, { left: pos.x - 8, top: pos.y - 20 }]}
          >
            <Text style={styles.seatLabel}>
              {seat === 0 ? 'You' : playerNames[seat] ?? `Seat ${seat}`}
            </Text>
            <View style={styles.seatCardRow}>
              {Array.from({ length: 5 }).map((_, i) => (
                <View
                  key={i}
                  style={[styles.seatMiniCard, i < count && styles.seatMiniCardDealt]}
                />
              ))}
            </View>
          </View>
        );
      })}

      {/* ── Flying card ── */}
      <Animated.View
        style={[
          styles.flyingCard,
          {
            left: flyX,
            top: flyY,
            opacity: flyOpacity,
          },
        ]}
      >
        <Image
          source={require('../../../assets/wpp_icon.png')}
          style={styles.flyingCardImage}
          resizeMode="contain"
        />
      </Animated.View>

    </View>
  );
}

const C = {
  gold: '#ffd700',
  overlay: 'rgba(0,0,0,0.82)',
};

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: C.overlay,
    zIndex: 100,
  },

  topLabel: {
    position: 'absolute',
    top: 60,
    left: 0, right: 0,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4,
  },
  dealingText: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 4,
  },
  dealingDots: {
    color: C.gold,
    fontSize: 22,
    fontWeight: '900',
  },

  // ── Deck pile ──
  deckPile: {
    position: 'absolute',
    alignItems: 'center',
  },
  deckCard: {
    width: CARD_W + 8,
    height: CARD_H + 8,
    borderRadius: 6,
    backgroundColor: '#1c1c1e',
    borderWidth: 2,
    borderColor: C.gold,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deckCardImage: { width: '90%', height: '90%' },
  deckCount: {
    color: '#aaa',
    fontSize: 10,
    marginTop: 3,
  },

  // ── Turn up slot ──
  turnUpSlot: {
    position: 'absolute',
    alignItems: 'center',
  },
  turnUpCard: {
    width: CARD_W + 8,
    height: CARD_H + 8,
    borderRadius: 6,
    backgroundColor: '#2a1010',
    borderWidth: 2,
    borderColor: '#cc4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  turnUpQ: {
    color: '#cc4444',
    fontSize: 22,
    fontWeight: '900',
  },
  turnUpEmpty: {
    width: CARD_W + 8,
    height: CARD_H + 8,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#333',
    borderStyle: 'dashed',
  },
  pileLabel: {
    color: '#666',
    fontSize: 9,
    marginTop: 3,
  },

  // ── Seat mini piles ──
  seatPile: {
    position: 'absolute',
    alignItems: 'center',
  },
  seatLabel: {
    color: '#aaa',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
  },
  seatCardRow: {
    flexDirection: 'row',
    gap: 3,
  },
  seatMiniCard: {
    width: 14,
    height: 20,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: '#333',
    backgroundColor: 'transparent',
  },
  seatMiniCardDealt: {
    backgroundColor: '#1c1c1e',
    borderColor: C.gold,
  },

  // ── Flying card ──
  flyingCard: {
    position: 'absolute',
    width: CARD_W,
    height: CARD_H,
    borderRadius: 5,
    backgroundColor: '#1c1c1e',
    borderWidth: 2,
    borderColor: C.gold,
    overflow: 'hidden',
    shadowColor: C.gold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 10,
  },
  flyingCardImage: { width: '100%', height: '100%' },
});
