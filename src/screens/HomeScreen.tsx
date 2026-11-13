import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Alert, RefreshControl } from 'react-native';
import { useNavigation, useFocusEffect, CompositeNavigationProp } from '@react-navigation/native';
import MapView, { Marker, Circle as MapCircle } from 'react-native-maps';
import * as Location from 'expo-location';
import { StackNavigationProp } from '@react-navigation/stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { RootStackParamList, TabParamList } from '../navigation';
import { Reminder } from '../types';
import { storageService } from '../services/storage';
import { backgroundTaskService, evaluateRemindersAtLocation } from '../services/backgroundTasks';
import { getHaversineDistance } from '../utils/geo';
import { MapPin, Clock, Plus, Trash2, Map as MapIcon, Navigation, Lock } from 'lucide-react-native';

type NavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<TabParamList, 'Home'>,
  StackNavigationProp<RootStackParamList>
>;

export default function HomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Location.LocationObject | null>(null);
  const [mapRegion, setMapRegion] = useState({
    latitude: 37.78825,
    longitude: -122.4324,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  });

  const fetchReminders = useCallback(async () => {
    setRefreshing(true);
    const data = await storageService.getReminders();
    // Only show active (non-triggered) reminders on Home
    setReminders(data.filter((r) => !r.isTriggered));
    setRefreshing(false);
  }, []);

  const fetchLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        setCurrentLocation(loc);
        setMapRegion((prev) => ({
          ...prev,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }));

        // Also evaluate foreground location against reminders
        await evaluateRemindersAtLocation(loc.coords);
        const data = await storageService.getReminders();
        setReminders(data.filter((r) => !r.isTriggered));
      }
    } catch (e) {
      console.log('Error fetching foreground location:', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchReminders();
      fetchLocation();
    }, [fetchReminders])
  );

  const deleteReminder = async (id: string) => {
    Alert.alert('Delete Reminder', 'Are you sure you want to delete this reminder?', [
      { text: 'Cancel', style: 'cancel' },
      { 
        text: 'Delete', 
        style: 'destructive',
        onPress: async () => {
          await storageService.deleteReminder(id);
          fetchReminders();
        }
      }
    ]);
  };

  const toggleReminder = async (reminder: Reminder) => {
    const updated = { 
      ...reminder, 
      isEnabled: !reminder.isEnabled,
    };
    await storageService.updateReminder(updated);
    await backgroundTaskService.refreshSamplingMode();
    fetchReminders();
  };

  const getDistanceString = (target: { latitude: number; longitude: number }): string | null => {
    if (!currentLocation) return null;
    const dist = getHaversineDistance(
      { latitude: currentLocation.coords.latitude, longitude: currentLocation.coords.longitude },
      target
    );
    if (dist < 1000) {
      return `${Math.round(dist)}m away`;
    }
    return `${(dist / 1000).toFixed(1)}km away`;
  };

  const renderItem = ({ item }: { item: Reminder }) => {
    const distStr = getDistanceString(item.location);
    const parent = item.dependsOnId ? reminders.find((candidate) => candidate.id === item.dependsOnId) : undefined;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{item.title}</Text>
            {item.notes ? <Text style={styles.notes}>{item.notes}</Text> : null}
            {parent && !parent.isTriggered && (
              <View style={styles.detailRow}>
                <Lock size={14} color="#6b7280" />
                <Text style={styles.detailText}>Starts after {parent.title}</Text>
              </View>
            )}
          </View>
          <TouchableOpacity 
            style={styles.deleteBtn}
            onPress={() => deleteReminder(item.id)}
            accessibilityLabel="Delete reminder"
          >
            <Trash2 size={20} color="#ef4444" />
          </TouchableOpacity>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <MapPin size={16} color="#6b7280" />
            <Text style={styles.detailText}>
              Radius: {item.radius}m
              {item.location.altitude !== undefined ? ` • Alt: ${item.location.altitude}m` : ''}
            </Text>
          </View>

          {distStr && (
            <View style={styles.detailRow}>
              <Navigation size={16} color="#2563eb" />
              <Text style={[styles.detailText, styles.distHighlight]}>
                {distStr}
              </Text>
            </View>
          )}

          {item.timeConditions && (
            <View style={styles.detailRow}>
              <Clock size={16} color="#6b7280" />
              <Text style={styles.detailText}>
                Active: {item.timeConditions.startTime} - {item.timeConditions.endTime}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardFooter}>
          <View style={[styles.badge, item.isEnabled ? styles.activeBadge : styles.inactiveBadge]}>
            <Text style={[styles.badgeText, item.isEnabled ? styles.activeBadgeText : styles.inactiveBadgeText]}>
              {item.isEnabled ? 'Active' : 'Disabled'}
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.toggleBtn, item.isEnabled ? styles.disableBtn : styles.enableBtn]}
            onPress={() => toggleReminder(item)}
          >
            <Text style={styles.toggleBtnText}>
              {item.isEnabled ? 'Disable' : 'Enable'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapContainer}>
        <MapView
          style={styles.map}
          region={mapRegion}
          onRegionChangeComplete={setMapRegion}
          showsUserLocation
          showsMyLocationButton
        >
          {reminders.map((reminder) => (
            <React.Fragment key={reminder.id}>
              <Marker
                coordinate={{
                  latitude: reminder.location.latitude,
                  longitude: reminder.location.longitude,
                }}
                title={reminder.title}
                description={reminder.notes}
                pinColor={reminder.isEnabled ? '#2563eb' : '#9ca3af'}
              />
              <MapCircle
                center={{
                  latitude: reminder.location.latitude,
                  longitude: reminder.location.longitude,
                }}
                radius={reminder.radius}
                fillColor={reminder.isEnabled ? "rgba(37, 99, 235, 0.15)" : "rgba(156, 163, 175, 0.15)"}
                strokeColor={reminder.isEnabled ? "rgba(37, 99, 235, 0.4)" : "rgba(156, 163, 175, 0.4)"}
              />
            </React.Fragment>
          ))}
        </MapView>
      </View>

      <View style={styles.listHeader}>
        <View style={styles.headerIndicator} />
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Active Tasks</Text>
          <Text style={styles.taskCount}>{reminders.length} upcoming</Text>
        </View>
      </View>

      {reminders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MapIcon size={48} color="#e5e7eb" />
          <Text style={styles.emptyText}>No active reminders.</Text>
          <Text style={styles.emptySubText}>Tap + below to set a new geofence!</Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchReminders} />}
        />
      )}
      
      <TouchableOpacity 
        style={styles.fab}
        onPress={() => navigation.navigate('AddReminder', {})}
        accessibilityLabel="Add new reminder"
      >
        <Plus size={32} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    height: '42%',
    width: '100%',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    elevation: 4,
  },
  listHeader: {
    backgroundColor: 'rgba(255,255,255,0.98)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    marginTop: -28,
    paddingTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  headerIndicator: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 8,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  taskCount: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '600',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
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
    marginBottom: 14,
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
  distHighlight: {
    color: '#2563eb',
    fontWeight: '600',
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  activeBadge: {
    backgroundColor: '#eff6ff',
  },
  inactiveBadge: {
    backgroundColor: '#f3f4f6',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeBadgeText: {
    color: '#2563eb',
  },
  inactiveBadgeText: {
    color: '#6b7280',
  },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 8,
  },
  disableBtn: {
    backgroundColor: '#fee2e2',
  },
  enableBtn: {
    backgroundColor: '#2563eb',
  },
  toggleBtnText: {
    color: '#1f2937',
    fontSize: 12,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#2563eb',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
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
