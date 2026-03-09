import React, { useState, useRef, useEffect } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { LobbyScreen } from './src/ui/screens/Lobby';
import { TableScreen } from './src/ui/screens/Table';
import { EndOfHandScreen } from './src/ui/screens/EndOfHand';
import { SideBetModal, type SideBetChoice, type SideBetDecision } from './src/ui/components/SideBetModal';
import { DealAnimation } from './src/ui/components/DealAnimation';
import { createLobbyState, applyAction, canClaimTurnUp, type GameState } from './src/engine';
import { getAIAction } from './src/ai';

const TABLE_STAKE = 5;
const STARTING_BALANCE = 100;

// Delay (ms) for an AI player to auto-decide the side-bet prompt
const AI_SIDEBET_DELAY = 800;

// Names used for AI seats (matches Table.tsx)
const AI_NAMES = [
  'Maverick', 'Dolly', 'Ace', 'Blaze', 'Rio', 'Lucky', 'Cash', 'Duke',
  'Remy', 'Scarlett', 'Tex', 'Jolene', 'Hank', 'Daisy', 'Clint', 'Loretta',
];

/** Main app phase — drives which screen / overlay is visible. */
type AppPhase = 'lobby' | 'sideBet' | 'dealing' | 'table' | 'end';

interface SessionConfig {
  playerCount: number;
  aiSeats: number[];
}

interface SideBetRound {
  /** Seat order for asking (dealer first, then clockwise). */
  seatOrder: number[];
  /** Index into seatOrder of who is currently being asked. */
  currentIdx: number;
  /** Decisions collected so far. */
  decisions: SideBetDecision[];
}

export default function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>('lobby');
  const [gameState, setGameState] = useState<GameState>(createLobbyState());
  const [aiCountdown, setAiCountdown] = useState<number | null>(null);
  const [balances, setBalances] = useState<number[]>([]);
  const [pot, setPot] = useState(0);
  const [sessionConfig, setSessionConfig] = useState<SessionConfig | null>(null);
  const [sideBetRound, setSideBetRound] = useState<SideBetRound | null>(null);
  // Side-bet decisions are stored for future resolution logic
  const [sideBetDecisions, setSideBetDecisions] = useState<SideBetDecision[]>([]);

  const potRef = useRef(0);

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** Returns the display name for a seat (human = 'You', AI = AI_NAMES). */
  const getSeatName = (seatIndex: number, config: SessionConfig): string => {
    if (!config.aiSeats.includes(seatIndex)) return 'You';
    return AI_NAMES[seatIndex % AI_NAMES.length];
  };

  const isDealer = (seatIndex: number): boolean => seatIndex === 0; // dealer is always seat 0

  // ── Side-bet round logic ───────────────────────────────────────────────────

  /**
   * Advance the side-bet round: record decision, move to next seat or finish.
   */
  const advanceSideBet = (decision: SideBetDecision) => {
    setSideBetRound((prev) => {
      if (!prev) return null;
      const decisions = [...prev.decisions, decision];
      const nextIdx = prev.currentIdx + 1;
      if (nextIdx >= prev.seatOrder.length) {
        // All seats decided — store decisions and move to dealing
        setSideBetDecisions(decisions);
        // Use setTimeout so the state update settles before we switch phase
        setTimeout(() => setAppPhase('dealing'), 50);
        return null;
      }
      return { ...prev, currentIdx: nextIdx, decisions };
    });
  };

  // When the current side-bet seat is an AI, auto-decide after a short delay
  useEffect(() => {
    if (appPhase !== 'sideBet' || !sideBetRound || !sessionConfig) return;
    const currentSeat = sideBetRound.seatOrder[sideBetRound.currentIdx];
    const isAI = sessionConfig.aiSeats.includes(currentSeat);
    if (!isAI) return;

    const t = setTimeout(() => {
      // AI always declines for now
      advanceSideBet({ seatIndex: currentSeat, optedIn: false });
    }, AI_SIDEBET_DELAY);

    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appPhase, sideBetRound?.currentIdx]);

  // ── Game start ─────────────────────────────────────────────────────────────

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

    if (!result.success) return;
    setGameState(result.state);

    // Build side-bet seat order: dealer (seat 0) first, then clockwise
    const seatOrder = Array.from({ length: config.playerCount }, (_, i) => i);
    setSideBetRound({ seatOrder, currentIdx: 0, decisions: [] });
    setSideBetDecisions([]);
    setAppPhase('sideBet');
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
    setAppPhase('lobby');
    setGameState(createLobbyState());
    setBalances([]);
    setPot(0);
    potRef.current = 0;
    setSessionConfig(null);
    setSideBetRound(null);
  };

  // ── Deal animation complete ────────────────────────────────────────────────

  const handleDealComplete = () => {
    setAppPhase('table');
    // Now kick off AI processing (initialPairs phase)
    setTimeout(() => processAITurns(gameState), 300);
  };

  // ── Side-bet human decision handlers ──────────────────────────────────────

  const handleSideBetDecline = () => {
    if (!sideBetRound) return;
    const currentSeat = sideBetRound.seatOrder[sideBetRound.currentIdx];
    advanceSideBet({ seatIndex: currentSeat, optedIn: false });
  };

  const handleSideBetAccept = (choice: SideBetChoice) => {
    if (!sideBetRound) return;
    const currentSeat = sideBetRound.seatOrder[sideBetRound.currentIdx];
    advanceSideBet({ seatIndex: currentSeat, optedIn: true, choice });
  };

  // ── Game action handling ───────────────────────────────────────────────────

  const handleGameEnd = (endedState: GameState) => {
    if (endedState.winnerSeat !== null) {
      const winSeat = endedState.winnerSeat;
      setBalances((prev) => {
        const next = [...prev];
        next[winSeat] += potRef.current;
        return next;
      });
    }
    setTimeout(() => setAppPhase('end'), 1000);
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

  // ── Render ─────────────────────────────────────────────────────────────────

  if (appPhase === 'lobby') {
    return <LobbyScreen onStart={handleStartGame} stakeAmount={TABLE_STAKE} startingBalance={STARTING_BALANCE} />;
  }

  if (appPhase === 'end') {
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

  // For sideBet and dealing phases, show the table frozen beneath overlays.
  // For the table phase, show the interactive table.
  const isTableInteractive = appPhase === 'table';

  // Determine which human seat is asking for the side bet modal
  const sideBetModalVisible =
    appPhase === 'sideBet' &&
    !!sideBetRound &&
    !!sessionConfig &&
    !sessionConfig.aiSeats.includes(sideBetRound.seatOrder[sideBetRound.currentIdx]);

  const currentSideBetSeat = sideBetRound
    ? sideBetRound.seatOrder[sideBetRound.currentIdx]
    : 0;

  // Player name list for deal animation (indexed by seat)
  const playerNames = sessionConfig
    ? Array.from({ length: sessionConfig.playerCount }, (_, i) => getSeatName(i, sessionConfig))
    : [];

  return (
    <SafeAreaView style={styles.container}>
      <TableScreen
        state={gameState}
        onAction={isTableInteractive ? handleAction : () => {}}
        aiCountdown={aiCountdown}
        balances={balances}
        pot={pot}
      />

      {/* Side-bet human modal (only shown for the human player's turn) */}
      {sessionConfig && (
        <SideBetModal
          visible={sideBetModalVisible}
          seatName={getSeatName(currentSideBetSeat, sessionConfig)}
          isDealer={isDealer(currentSideBetSeat)}
          onDecline={handleSideBetDecline}
          onAccept={handleSideBetAccept}
        />
      )}

      {/* Deal animation overlay */}
      {appPhase === 'dealing' && sessionConfig && (
        <DealAnimation
          playerCount={sessionConfig.playerCount}
          playerNames={playerNames}
          onComplete={handleDealComplete}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a472a',
  },
});
