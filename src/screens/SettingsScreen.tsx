import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, ScrollView } from 'react-native';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { EngineSettings, EngineStats } from '../types';
import { DEFAULT_ENGINE_SETTINGS } from '../engine';
import { storageService } from '../services/storage';
import { Activity, RotateCcw, Settings as SettingsIcon } from 'lucide-react-native';

export default function SettingsScreen() {
  const [settings, setSettings] = useState<EngineSettings>(DEFAULT_ENGINE_SETTINGS);
  const [stats, setStats] = useState<EngineStats>();

  const load = useCallback(async () => {
    const [savedSettings, savedStats] = await Promise.all([
      storageService.getSettings(),
      storageService.getStats(),
    ]);
    setSettings(savedSettings);
    setStats(savedStats);
  }, []);

  useFocusEffect(useCallback(() => {
    load();
  }, [load]));

  const updateSettings = async (patch: Partial<EngineSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await storageService.saveSettings(next);
  };

  const resetStats = async () => {
    const next: EngineStats = { evaluations: 0, eligibleEvaluations: 0, triggered: 0, skipped: 0 };
    setStats(next);
    await storageService.saveStats(next);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.titleRow}>
        <SettingsIcon size={24} color="#2563eb" />
        <Text style={styles.title}>Smart decisions</Text>
      </View>
      <Text style={styles.subtitle}>Tune how Geo-Reminder evaluates location signals before notifying you.</Text>

      <View style={styles.card}>
        <View style={styles.row}>
          <View style={styles.flex}>
            <Text style={styles.label}>Decision engine</Text>
            <Text style={styles.hint}>Enable background evaluation and notifications</Text>
          </View>
          <Switch value={settings.enabled} onValueChange={(enabled) => updateSettings({ enabled })} />
        </View>
        <Text style={styles.label}>Minimum confidence: {Math.round(settings.minimumScore * 100)}%</Text>
        <Slider minimumValue={0} maximumValue={1} step={0.05} value={settings.minimumScore}
          onValueChange={(minimumScore) => setSettings((current) => ({ ...current, minimumScore }))}
          onSlidingComplete={(minimumScore) => updateSettings({ minimumScore })}
          minimumTrackTintColor="#2563eb" />
        <Text style={styles.label}>Accuracy limit: {settings.locationAccuracyMeters}m</Text>
        <Slider minimumValue={25} maximumValue={250} step={25} value={settings.locationAccuracyMeters}
          onValueChange={(locationAccuracyMeters) => setSettings((current) => ({ ...current, locationAccuracyMeters }))}
          onSlidingComplete={(locationAccuracyMeters) => updateSettings({ locationAccuracyMeters })}
          minimumTrackTintColor="#2563eb" />
        <Text style={styles.label}>Max reminders per location: {settings.maxTriggersPerRun}</Text>
        <Slider minimumValue={1} maximumValue={10} step={1} value={settings.maxTriggersPerRun}
          onValueChange={(maxTriggersPerRun) => setSettings((current) => ({ ...current, maxTriggersPerRun }))}
          onSlidingComplete={(maxTriggersPerRun) => updateSettings({ maxTriggersPerRun })}
          minimumTrackTintColor="#2563eb" />
      </View>

      <View style={styles.card}>
        <View style={styles.statsHeader}>
          <Activity size={20} color="#10b981" />
          <Text style={styles.sectionTitle}>Engine activity</Text>
        </View>
        <View style={styles.statsGrid}>
          <Stat label="Evaluations" value={stats?.evaluations ?? 0} />
          <Stat label="Eligible" value={stats?.eligibleEvaluations ?? 0} />
          <Stat label="Triggered" value={stats?.triggered ?? 0} />
          <Stat label="Skipped" value={stats?.skipped ?? 0} />
        </View>
        <TouchableOpacity style={styles.resetButton} onPress={resetStats}>
          <RotateCcw size={16} color="#6b7280" />
          <Text style={styles.resetText}>Reset activity</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingBottom: 40 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginLeft: 10 },
  subtitle: { color: '#6b7280', fontSize: 14, lineHeight: 20, marginBottom: 18 },
  card: { backgroundColor: '#fff', borderRadius: 18, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: '#e5e7eb' },
  row: { flexDirection: 'row', alignItems: 'center', marginBottom: 18 },
  flex: { flex: 1 },
  label: { color: '#1f2937', fontSize: 15, fontWeight: '700', marginBottom: 6 },
  hint: { color: '#6b7280', fontSize: 13 },
  statsHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#1f2937', marginLeft: 8 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', marginBottom: 16 },
  statValue: { fontSize: 24, fontWeight: '800', color: '#111827' },
  statLabel: { color: '#6b7280', fontSize: 12 },
  resetButton: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingTop: 8 },
  resetText: { color: '#6b7280', marginLeft: 6, fontWeight: '600' },
});
