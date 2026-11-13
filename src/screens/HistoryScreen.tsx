import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Reminder } from '../types';
import { storageService } from '../services/storage';
import { backgroundTaskService } from '../services/backgroundTasks';
import { MapPin, Clock, History as HistoryIcon, Trash2, CheckCircle2, RotateCcw } from 'lucide-react-native';

export default function HistoryScreen() {
  const [historyReminders, setHistoryReminders] = useState<Reminder[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHistory = useCallback(async () => {
    setRefreshing(true);
    const data = await storageService.getReminders();
    const triggered = data.filter((r) => r.isTriggered);
    // Sort by created time (descending)
    triggered.sort((a, b) => b.createdAt - a.createdAt);
    setHistoryReminders(triggered);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const deleteHistoryItem = async (id: string) => {
    Alert.alert('Delete Entry', 'Remove this from your history?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          await storageService.deleteReminder(id);
          fetchHistory();
        }
      }
    ]);
  };

  const reactivateReminder = async (item: Reminder) => {
    await storageService.reactivateReminder(item.id);
    await backgroundTaskService.refreshSamplingMode();
    Alert.alert('Reminder Reactivated', `"${item.title}" is now active again.`);
    fetchHistory();
  };

  const clearAllHistory = async () => {
    Alert.alert('Clear History', 'Delete all triggered reminders permanently?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Clear All', 
        style: 'destructive',
        onPress: async () => {
          await storageService.clearTriggeredReminders();
          fetchHistory();
        }
      }
    ]);
  };

  const renderItem = ({ item }: { item: Reminder }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{item.title}</Text>
          {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
        </View>
        <TouchableOpacity 
          style={styles.deleteBtn}
          onPress={() => deleteHistoryItem(item.id)}
          accessibilityLabel="Delete history item"
        >
          <Trash2 size={20} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <View style={styles.cardDetails}>
        <View style={styles.detailRow}>
          <MapPin size={16} color="#6b7280" />
          <Text style={styles.detailText}>
            Radius: {item.radius}m
            {item.location.altitude !== undefined ? ` • Alt: ${Math.round(item.location.altitude)}m` : ''}
          </Text>
        </View>
        {item.timeConditions && (
          <View style={styles.detailRow}>
            <Clock size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              Range: {item.timeConditions.startTime} - {item.timeConditions.endTime}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.cardFooter}>
        <View style={styles.triggeredBadge}>
          <CheckCircle2 size={14} color="#10b981" />
          <Text style={styles.badgeText}>Completed</Text>
        </View>

        <View style={styles.footerActions}>
          <TouchableOpacity 
            style={styles.reactivateBtn}
            onPress={() => reactivateReminder(item)}
            accessibilityLabel="Reactivate reminder"
          >
            <RotateCcw size={14} color="#2563eb" />
            <Text style={styles.reactivateText}>Reactivate</Text>
          </TouchableOpacity>
          <Text style={styles.dateText}>
            {new Date(item.createdAt).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>History</Text>
        {historyReminders.length > 0 && (
          <TouchableOpacity onPress={clearAllHistory} style={styles.clearBtn}>
            <Trash2 size={16} color="#ef4444" />
            <Text style={styles.clearBtnText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {historyReminders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <HistoryIcon size={64} color="#d1d5db" />
          <Text style={styles.emptyText}>No history yet.</Text>
          <Text style={styles.emptySubText}>Triggered and completed reminders will appear here.</Text>
        </View>
      ) : (
        <FlatList
          data={historyReminders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchHistory} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#111827',
  },
  clearBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fee2e2',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  clearBtnText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '700',
    marginLeft: 4,
  },
  listContent: {
    padding: 16,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  notes: {
    fontSize: 14,
    color: '#6b7280',
  },
  deleteBtn: {
    padding: 6,
  },
  cardDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  detailText: {
    fontSize: 14,
    color: '#4b5563',
    marginLeft: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  triggeredBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: '600',
    color: '#047857',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactivateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginRight: 10,
  },
  reactivateText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2563eb',
    marginLeft: 4,
  },
  dateText: {
    fontSize: 12,
    color: '#9ca3af',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginTop: 16,
  },
  emptySubText: {
    fontSize: 15,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 8,
  },
});
