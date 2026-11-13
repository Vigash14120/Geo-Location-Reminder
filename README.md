# Geo-Location Reminder

Geo-Location Reminder (GLR) is a React Native application built with Expo SDK 54. It evaluates location samples locally and sends reminders when a person reaches an eligible place.

## Features

- Interactive map-based reminder creation with configurable radius.
- Optional altitude and tolerance matching.
- Daily time windows, including overnight ranges such as `22:00-06:00`.
- Background location monitoring and local notifications.
- Accuracy filtering, enter/exit hysteresis, consecutive-reading protection, and configurable dwell time.
- Chained reminders with cycle validation, locked children, and unlock-on-parent-trigger behavior.
- Adaptive location sampling with `idle`, `near`, `mid`, and `far` modes.
- History, reactivation, engine settings, and battery-saver metrics.

## Screenshots

![Active reminders](SS/Active%20remainders.jpeg)
![Add reminder map](SS/WhatsApp%20Image%202026-04-17%20at%2010.17.24%20AM.jpeg)
![Reminder notification](SS/Notification.jpeg)
![Reminder details](SS/WhatsApp%20Image%202026-04-17%20at%2010.23.38%20AM.jpeg)

## How it works

The foreground and background adapters pass a timestamped location sample into the pure TypeScript engine:

```text
location sample
  -> normalization and accuracy filter
  -> distance check with enter/exit hysteresis
  -> consecutive-inside and dwell-time check
  -> dependency/chain eligibility check
  -> cooldown and per-run trigger limit
  -> notification action and persisted runtime state
```

Adaptive sampling runs alongside the decision pipeline. It finds the nearest active, eligible reminder and selects:

| Mode | Distance | Accuracy | Time interval | Distance interval |
|---|---:|---|---:|---:|
| `near` | below `max(1 km, 3 × radius)` | high | 5 s | 10 m |
| `mid` | 1–5 km | balanced | 20 s | 100 m |
| `far` | above 5 km | low | 60 s | 500 m |
| `idle` | no active eligible reminders | stopped | — | — |

A 15% transition margin prevents mode flapping near thresholds. The adapter restarts location updates only when the selected mode changes and preserves the Android foreground-service notification configuration.

## Technical decisions and trade-offs

- `src/engine/` is pure TypeScript. It has no React, React Native, Expo, storage, or clock dependencies, so the decision behavior can run in deterministic tests.
- The adapter supplies `now`; engine state is persisted separately from reminder definitions.
- Poor-accuracy samples are rejected before they can change inside/outside state. Missing or invalid accuracy is reported separately as `location-accuracy-unknown`.
- Hysteresis and dwell reduce false triggers at geofence edges, at the cost of slower triggering in some cases.
- Adaptive sampling reduces update frequency when reminders are distant, while high-accuracy updates are reserved for nearby reminders.
- Reminder writes are serialized to avoid foreground/background read-modify-write races.
- Legacy `@geo_reminders` data is normalized and migrated idempotently to schema-versioned `@geo_reminders_v2`.
- Deleting a parent reminder unlocks its children by removing their dependency. Reactivating a parent naturally re-locks untriggered children until the parent triggers again.

## Known limitations

- GPS accuracy varies by device, sky visibility, permissions, and operating system power policies.
- Android OEM battery optimizers may stop or delay background location tasks; users may need to exempt the app from battery optimization.
- Expo Go is suitable for development but does not provide the same background execution behavior as a standalone development or production build.
- Background execution and notification delivery should be verified on a physical device.

## Getting started

### Prerequisites

- Node.js 20 or newer
- Expo Go or a development build on a physical iOS or Android device for location testing

### Install and run

```bash
git clone https://github.com/Vigash14120/Geo-Location-Reminder.git
cd Geo-Location-Reminder
npm ci
npx expo start
```

Platform scripts are also available:

```bash
npm run android
npm run ios
npm run web
```

## Validation

```bash
npm run typecheck
npm test
npm run coverage
```

## Project structure

```text
├── App.tsx
├── app.json
├── src/
│   ├── engine/              # Pure decision engine and adaptive sampling
│   ├── navigation/          # Navigation configuration
│   ├── screens/             # Home, Add Reminder, History, and Settings
│   ├── services/            # Location, notifications, storage, and adapters
│   ├── types/               # Reminder, runtime, settings, and statistics types
│   └── utils/               # Geographic and time-window helpers
├── SS/                      # Application screenshots
└── tests/                   # Device-independent engine tests
```

## License

MIT License
