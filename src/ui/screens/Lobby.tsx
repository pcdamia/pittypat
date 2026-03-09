import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface Props {
  onStart: (playerCount: number, aiSeats: number[]) => void;
  stakeAmount: number;
  startingBalance: number;
}

export function LobbyScreen({ onStart, stakeAmount, startingBalance }: Props) {
  const [playerCount, setPlayerCount] = useState(2);
  const [aiSeats, setAiSeats] = useState<number[]>([1]);

  const toggleAISeat = (seat: number) => {
    if (seat === 0) return;
    if (aiSeats.includes(seat)) {
      setAiSeats(aiSeats.filter((s) => s !== seat));
    } else {
      setAiSeats([...aiSeats, seat]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Pitty Pat</Text>
      <Text style={styles.stakeInfo}>Start: ${startingBalance}  ·  Stake: ${stakeAmount}/hand</Text>
      <Text style={styles.subtitle}>Select Players</Text>
      <View style={styles.playerCountRow}>
        {[2, 3, 4, 5, 6].map((count) => (
          <TouchableOpacity
            key={count}
            style={[styles.countButton, playerCount === count && styles.countButtonActive]}
            onPress={() => {
              setPlayerCount(count);
              setAiSeats([]);
            }}
          >
            <Text style={styles.countText}>{count}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={styles.label}>AI Seats (seat 0 is you):</Text>
      <View style={styles.seatsRow}>
        {Array.from({ length: playerCount }, (_, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.seatButton, i === 0 && styles.seatButtonHuman, aiSeats.includes(i) && styles.seatButtonAI]}
            onPress={() => toggleAISeat(i)}
            disabled={i === 0}
          >
            <Text style={styles.seatText}>{i === 0 ? 'You' : aiSeats.includes(i) ? 'AI' : 'Human'}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.startButton} onPress={() => onStart(playerCount, aiSeats)}>
        <Text style={styles.startText}>Start Solo vs AI</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a472a',
    padding: 20,
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 6,
  },
  stakeInfo: {
    fontSize: 16,
    color: '#ffd700',
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 24,
    color: '#ccc',
    marginBottom: 30,
  },
  playerCountRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 30,
  },
  countButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  countButtonActive: {
    backgroundColor: '#4a9',
  },
  countText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  label: {
    color: '#ccc',
    fontSize: 18,
    marginBottom: 10,
  },
  seatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 30,
  },
  seatButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#333',
  },
  seatButtonHuman: {
    backgroundColor: '#4a9',
  },
  seatButtonAI: {
    backgroundColor: '#a94',
  },
  seatText: {
    color: '#fff',
    fontSize: 16,
  },
  startButton: {
    backgroundColor: '#4a9',
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 8,
  },
  startText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
});
