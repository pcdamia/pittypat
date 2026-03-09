# Pitty Pat

React Native (TypeScript) mobile card game for iPad + Android.

## Architecture

- **Engine**: Pure TypeScript rules engine in `/src/engine` with deterministic seeded shuffle
- **AI**: Simple heuristic policy in `/src/ai`
- **UI**: React Native screens (Lobby, Table, End-of-Hand) in `/src/ui`
- **Backend**: Firebase (Firestore + Cloud Functions) for server-authoritative multiplayer

## Folder Structure

```
pittypat/
├── src/
│   ├── engine/              # Pure TS rules engine
│   │   ├── types.ts         # Card, Rank, Suit, GameState, Action types
│   │   ├── deck.ts          # Deck building + seeded shuffle
│   │   ├── helpers.ts       # Pair counting, singular match, dead-discard logic
│   │   ├── applyAction.ts   # Authoritative applyAction(state, action) => newState
│   │   ├── index.ts         # Exports
│   │   └── __tests__/       # Jest tests (>=12 tests)
│   ├── ai/                  # AI policy
│   │   └── policy.ts        # Simple heuristic: emits same action intents as humans
│   ├── ui/                  # React Native UI
│   │   ├── screens/         # Lobby, Table, EndOfHand
│   │   └── components/      # Card, DeckPile
│   └── firebase/            # Firebase integration
│       ├── config.ts        # Firebase init + anonymous auth
│       └── game.ts          # Firestore model + Cloud Function helpers
├── functions/               # Cloud Functions (server-authoritative)
│   └── src/index.ts        # executeAction: validates + applies server-side
├── App.tsx                 # Main RN entry point
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md
```

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run engine tests:
   ```bash
   npm test
   ```

3. Start Expo dev server:
   ```bash
   npm start
   ```

## Game Rules Summary

- **Players**: 2–6
- **Deal**: 5 cards each, Turn Up flipped after dealing
- **Deck**: Standard 52 + 1 Deuce per player + Jokers (players - 4) if players > 4
- **Wild**: Deuces + Jokers (stay in hand, not discardable)
- **Dead Ranks**: Any discarded rank becomes dead globally
- **Initial Pairs**: Before first turn, each player removes pairs (makes those ranks dead)
- **Turns**: Claim Turn Up if singular match, else pluck from deck
- **Pluck**: If wild or singular match → keep; else → drop as new Turn Up (rank becomes dead)
- **Discard**: Priority: dead-rank cards if you have any; else any non-wild
- **Win**: Complete 3 pairs (can include wilds); only on your turn
- **Pat**: One card away from going out (derived status)

## Development Status

- ✅ Engine: Types, shuffle, applyAction, phases, deadRanks
- ✅ Tests: Jest suite covering deadRanks, pluck behavior, dead-discard priority, turn-based win, initialPairs, claim window
- ✅ UI: Lobby, Table, End-of-Hand screens (local play)
- ✅ AI: Simple heuristic policy
- ✅ Firebase: Scaffolding (config, Firestore model, Cloud Function stub)

## Next Steps

1. **For local play**: App should work now. Firebase has been removed from dependencies to prevent Expo Go crashes.
2. **For multiplayer**: 
   - Install Firebase: `npm install firebase`
   - Firebase config is already set up in `src/firebase/config.ts` with your credentials
   - Deploy Cloud Functions: `cd functions && npm install && npm run deploy`
3. Implement side bet logic
4. Add offline mode: single human vs AI with bank sync
5. Polish UI: drag-to-discard, animations, settings for action buttons

**Note**: Firebase was temporarily removed from `package.json` because Expo Go auto-initializes Firebase when it detects the package, causing crashes. When you're ready for multiplayer, add `firebase` back to dependencies.
