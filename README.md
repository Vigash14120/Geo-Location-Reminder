# Geo-Location Reminder

Geo-Location Reminder (GLR) is a React Native application built with Expo SDK 54. It turns location, time-window, altitude, and confidence checks into local reminders that can be evaluated from both the foreground UI and background location tasks.

## Features

- **Interactive geofences**: Choose a location on the map, search for a place, and configure a radius from 50 m to 1,000 m.
- **Altitude-aware reminders**: Optionally match a target altitude with a configurable tolerance.
- **Time windows**: Restrict a reminder to a daily time range, including ranges that cross midnight.
- **Background monitoring**: Use `expo-location` and `expo-task-manager` to evaluate reminders in the background and send local notifications.
- **Smart decision engine**: Keep decision logic in pure TypeScript so it can be tested without a device.
- **Runtime controls**: Configure the minimum confidence score, cooldown period, maximum triggers per run, and accepted location accuracy from Settings.
- **Activity metrics**: Inspect evaluation count, eligible evaluations, triggers, skipped decisions, and the most recent engine run.
- **History and reactivation**: Review triggered reminders and reactivate them when needed.

## Smart decision engine

The engine is split into four deterministic phases under `src/engine/`:

1. **Normalization** validates coordinates and fills safe defaults for missing accuracy or timestamps.
2. **Evaluation** checks distance, accuracy, altitude, time windows, enabled state, and whether a reminder has already triggered.
3. **Ranking** filters by the configured minimum score and orders eligible reminders by confidence and distance.
4. **Decision application** enforces cooldowns and per-run trigger limits while updating runtime state and aggregate statistics.

The engine receives the current time as input when applying decisions. Expo-specific effects are kept in `src/services/backgroundTasks.ts`, which loads persisted data, invokes the engine, sends notifications for returned actions, and saves the updated runtime and statistics.

## Storage and migration

Reminder definitions are stored under `@geo_reminders_v2`. The storage service also keeps:

- a schema marker at `@geo_reminders_v2:schema`;
- per-reminder runtime state at `@geo_reminders_runtime`;
- aggregate engine statistics at `@geo_reminders_stats`;
- engine settings at `@geo_reminders_settings`.

Existing installations using the legacy `@geo_reminders` key are migrated automatically. Reminder data remains backward compatible because new storage keys and settings use defaults when they are absent.

## Tech stack

- [Expo](https://expo.dev/) SDK 54
- [React Native](https://reactnative.dev/) 0.81
- TypeScript 5.9
- React Navigation
- `react-native-maps`
- `expo-location`
- `expo-task-manager`
- `expo-notifications`
- `@react-native-async-storage/async-storage`
- `expo-sensors` for future sensor integrations

## Getting started

### Prerequisites

- Node.js 18 or newer
- Expo Go on a physical iOS or Android device for location testing

### Install

```bash
git clone https://github.com/Vigash14120/Geo-Location-Reminder.git
cd Geo-Location-Reminder
npm install
```

### Run

```bash
npx expo start
```

Scan the QR code with Expo Go, or run one of the platform scripts:

```bash
npm run android
npm run ios
npm run web
```

Background location behavior and notification delivery should be tested on a physical device. Expo Go and platform power-management policies can limit background execution.

## Validation

Run the TypeScript check and pure engine tests with:

```bash
npm run typecheck
npm test
```

## Project structure

```text
├── App.tsx
├── app.json
├── index.ts
├── src/
│   ├── engine/              # Pure normalization, evaluation, ranking, and decisions
│   ├── navigation/          # Stack and bottom-tab navigation
│   ├── screens/             # Home, Add Reminder, History, and Settings
│   ├── services/            # Background task, notifications, and storage adapters
│   ├── types/               # Reminder, engine settings, runtime, and stats types
│   └── utils/               # Haversine distance and time-window helpers
└── tests/
    └── engine.test.ts       # Device-independent engine coverage
```

## License

MIT License
