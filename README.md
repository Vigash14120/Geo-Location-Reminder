# Geo-Location-Remainder (GLR)

A full-featured React Native & Expo application for smart geofenced reminders with 3D altitude support and time-based triggering.

---

## 📱 Features

- **📍 Interactive Geofencing**: Drop pins on the map, customize geofence radius (50m – 1000m), and visualize proximity circles in real time.
- **🏔️ 3D Geofencing (Altitude Matching)**: Set elevation thresholds with tolerance to trigger reminders only at specific building floors or altitudes.
- **⏰ Time Window Filters**: Constrain reminders to specific active windows (e.g. `09:00` - `17:00`) with overnight interval support.
- **🔔 Background Tracking & Notifications**: Background geofence monitoring via `expo-task-manager` and `expo-location` with high-priority Android notification channels.
- **📏 Live Proximity Distance**: Displays live distance (`150m away`, `2.4km away`) to all upcoming tasks directly on the Active Tasks list.
- **🔄 Task Management & History**:
  - Enable/Disable active tasks on the fly.
  - Automatically moves triggered reminders to History.
  - **Reactivate** completed reminders anytime with a single tap.
- **🧠 Smart Decision Engine**: A pure four-phase evaluator normalizes location signals, checks reminder constraints, ranks candidates by confidence, and applies cooldown/rate-limit decisions consistently in foreground and background execution.
- **📊 Runtime Stats & Settings**: Tune confidence, accuracy, and per-run trigger limits from Settings and inspect evaluation activity on-device.

---

## 🛠️ Tech Stack

- **Framework**: [Expo](https://expo.dev/) (SDK 54) & [React Native](https://reactnative.dev/) (0.81.5)
- **Language**: TypeScript (~5.9.2)
- **Navigation**: React Navigation (Bottom Tabs & Stack Navigator)
- **Maps**: `react-native-maps`
- **Location & Background Tasks**: `expo-location`, `expo-task-manager`
- **Local Storage**: `@react-native-async-storage/async-storage`
- **Notifications**: `expo-notifications`
- **Icons & Styling**: `lucide-react-native`, `expo-linear-gradient`

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v18+)
- [Expo Go](https://expo.dev/go) app installed on your physical device (iOS or Android)

### 2. Installation
```bash
git clone https://github.com/Vigash14120/Geo-Location-Remainder.git
cd Geo-Location-Remainder
npm install
```

### 3. Run the Development Server
```bash
npx expo start
```
Scan the QR code with **Expo Go** (Android) or the **Camera app** (iOS).

---

## 📂 Project Structure

```
├── assets/                  # App icons and splash screens
├── src/
│   ├── engine/              # Pure decision engine phases 1–4
│   ├── navigation/          # Bottom tabs and stack navigators
│   ├── screens/
│   │   ├── HomeScreen.tsx         # Active tasks list & live map
│   │   ├── AddReminderScreen.tsx  # Geofence creation, pin dropping & settings
│   │   └── HistoryScreen.tsx      # Triggered reminders & reactivation
│   │   └── SettingsScreen.tsx     # Engine controls and activity stats
│   ├── services/
│   │   ├── backgroundTasks.ts     # Thin TaskManager adapter around the engine
│   │   ├── notifications.ts       # Android notification channels & dispatcher
│   │   └── storage.ts             # AsyncStorage persistence
│   ├── types/               # TypeScript interfaces (Reminder, GeoPoint)
│   └── utils/               # Haversine distance & time window calculations
├── App.tsx                  # App entry & service initialization
├── app.json                 # Expo permissions, plugins & build config
└── index.ts                 # Root entry with gesture-handler setup
```

## Smart decision engine

The engine is deliberately independent of Expo and React Native:

1. **Normalize** location data and reject invalid or inaccurate signals.
2. **Evaluate** radius, altitude, time window, enabled, and triggered constraints.
3. **Rank** eligible reminders by proximity and altitude confidence.
4. **Apply** cooldown and per-run limits, returning notification actions and updated runtime state.

Reminder data is migrated to the versioned `@geo_reminders_v2` store. Runtime state, aggregate stats, and engine settings are persisted separately so evaluations remain deterministic and the background adapter stays thin.

Run the pure engine checks with:

```bash
npm run typecheck
npm test
```

---

## 📄 License
MIT License
