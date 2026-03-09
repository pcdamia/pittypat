import React, { useState, useRef } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { LobbyScreen } from './src/ui/screens/Lobby';
import { TableScreen } from './src/ui/screens/Table';
import { EndOfHandScreen } from './src/ui/screens/EndOfHand';
import { createLobbyState, applyAction, canClaimTurnUp, type GameState } from './src/engine';
import { getAIAction } from './src/ai';

const TABLE_STAKE = 5;
const STARTING_BALANCE = 100;

type Screen = 'lobby' | 'table' | 'end';

interface SessionConfig {
  playerCount: number;
  aiSeats: number[];
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [gameState, setGameState] = useState<GameState>(createLobbyState());
  const [aiCountdown, setAiCountdown] = useState<number | null>(null);
  const [balances, setBalances] = useState<number[]>([]);
  const [pot, setPot] = useState(0);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);

  // Ref so setTimeout closures always read the current pot value
  const potRef = useRef(0);

  const startRound = (config: SessionConfig, currentBalances: number[]) => {
    const newBalances = currentBalances.map((b) => b - TABLE_STAKE);
    const newPot = config.playerCount * TABLE_STAKE;
    potRef.current = newPot;
    setBalances(newBalances);
    setPot(newPot);

    const seed = Math.floor(Math.random() * 1000000);
    const result = applyAction(createLobbyState(), {
      type: 'START_GAME',
      payload: { playerCount: config.playerCount, seed, aiSeats: config.aiSeats },
    });
    if (result.success) {
      setGameState(result.state);
      setScreen('table');
      setTimeout(() => processAITurns(result.state), 300);
    }
  };

  const handleGameEnd = (endedState: GameState) => {
    if (endedState.winnerSeat !== null) {
      const winSeat = endedState.winnerSeat;
      setBalances((prev) => {
        const next = [...prev];
        next[winSeat] += potRef.current;
        return next;
      });
    }
    setTimeout(() => setScreen('end'), 1000);
  };

  const handleStartGame = (playerCount: number, aiSeats: number[]) => {
    const config: SessionConfig = { playerCount, aiSeats };
    setSessionConfig(config);
    const initBalances = Array.from({ length: playerCount }, () => STARTING_BALANCE);
    startRound(config, initBalances);
  };

  const handlePlayAgain = () => {
    if (!sessionConfig) return;
    startRound(sessionConfig, balances);
  };

  const handleLeaveTable = () => {
    setScreen('lobby');
    setGameState(createLobbyState());
    setBalances([]);
    setPot(0);
    potRef.current = 0;
    setSessionConfig(null);
  };

  const handleAction = (action: Parameters<typeof applyAction>[1]) => {
    const result = applyAction(gameState, action);
    if (result.success) {
      const nextState = result.state;
      setGameState(nextState);
      if (nextState.phase === 'ended') {
        handleGameEnd(nextState);
        return;
      }
      setTimeout(() => processAITurns(nextState), 400);
    }
  };

  const processAITurns = (state: GameState) => {
    const activePlayer = state.players[state.activeSeat];
    if (!activePlayer || activePlayer.isHuman || state.phase === 'ended') return;

    if (state.phase === 'claimWindow') {
      const turnUp = state.turnUp;
      const canAIClaim = turnUp !== null && canClaimTurnUp(activePlayer.hand, turnUp);

      if (!canAIClaim) {
        setTimeout(() => {
          const aiAction = getAIAction(state, state.activeSeat);
          if (!aiAction) return;
          const result = applyAction(state, aiAction);
          if (!result.success) return;
          const nextState = result.state;
          setGameState(nextState);
          if (nextState.phase === 'ended') { handleGameEnd(nextState); return; }
          setTimeout(() => processAITurns(nextState), 150);
        }, 150);
        return;
      }

      setAiCountdown(3);
      setTimeout(() => setAiCountdown(2), 1000);
      setTimeout(() => setAiCountdown(1), 2000);
      setTimeout(() => {
        setAiCountdown(null);
        const aiAction = getAIAction(state, state.activeSeat);
        if (!aiAction) return;
        const result = applyAction(state, aiAction);
        if (!result.success) return;
        const nextState = result.state;
        setGameState(nextState);
        if (nextState.phase === 'ended') { handleGameEnd(nextState); return; }
        setTimeout(() => processAITurns(nextState), 300);
      }, 3000);
      return;
    }

    setTimeout(() => {
      const aiAction = getAIAction(state, state.activeSeat);
      if (!aiAction) return;
      const result = applyAction(state, aiAction);
      if (!result.success) return;
      const nextState = result.state;
      setGameState(nextState);
      if (nextState.phase === 'ended') { handleGameEnd(nextState); return; }
      setTimeout(() => processAITurns(nextState), 350);
    }, 350);
  };

  if (screen === 'lobby') {
    return <LobbyScreen onStart={handleStartGame} stakeAmount={TABLE_STAKE} startingBalance={STARTING_BALANCE} />;
  }

  if (screen === 'end') {
    const canPlayAgain = balances.length > 0 && balances.every((b) => b >= TABLE_STAKE);
    return (
      <EndOfHandScreen
        state={gameState}
        balances={balances}
        pot={pot}
        stakeAmount={TABLE_STAKE}
        canPlayAgain={canPlayAgain}
        onPlayAgain={handlePlayAgain}
        onLeaveTable={handleLeaveTable}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <TableScreen
        state={gameState}
        onAction={handleAction}
        aiCountdown={aiCountdown}
        balances={balances}
        pot={pot}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a472a',
  },
});
