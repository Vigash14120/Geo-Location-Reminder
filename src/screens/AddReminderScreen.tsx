import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, Alert, Switch, KeyboardAvoidingView, Platform } from 'react-native';
import MapView, { Marker, Circle } from 'react-native-maps';
import Slider from '@react-native-community/slider';
import * as Location from 'expo-location';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '../navigation';
import { storageService } from '../services/storage';
import { Reminder, GeoPoint } from '../types';
import { MapPin, Info, Save, X, Search, LocateFixed, Thermometer } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { parseTimeToMinutes } from '../utils/geo';
import { backgroundTaskService } from '../services/backgroundTasks';

type AddReminderRouteProp = RouteProp<RootStackParamList, 'AddReminder'>;

export default function AddReminderScreen() {
  const navigation = useNavigation();
  const route = useRoute<AddReminderRouteProp>();

  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [radius, setRadius] = useState(100);
  const [dwellSeconds, setDwellSeconds] = useState(0);
  const [existingReminders, setExistingReminders] = useState<Reminder[]>([]);
  const [dependsOnId, setDependsOnId] = useState<string | undefined>();
  const [location, setLocation] = useState<GeoPoint>({
    latitude: route.params?.location?.latitude || 37.78825,
    longitude: route.params?.location?.longitude || -122.4324,
    altitude: 0,
  });
  const [altitudeEnabled, setAltitudeEnabled] = useState(false);
  const [timeEnabled, setTimeEnabled] = useState(false);
  const [altitudeInput, setAltitudeInput] = useState('0');
  const [altitudeThreshold, setAltitudeThreshold] = useState(10);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [mapRegion, setMapRegion] = useState({
    latitude: route.params?.location?.latitude || 37.78825,
    longitude: route.params?.location?.longitude || -122.4324,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  useEffect(() => {
    storageService.getReminders().then(setExistingReminders);
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          return;
        }
        const currentLoc = await Location.getCurrentPositionAsync({});
        // Only override if no location parameter was passed
        if (!route.params?.location) {
          const newLoc = {
            latitude: currentLoc.coords.latitude,
            longitude: currentLoc.coords.longitude,
            altitude: currentLoc.coords.altitude || 0,
          };
          setLocation(newLoc);
          setMapRegion((prev) => ({
            ...prev,
            latitude: newLoc.latitude,
            longitude: newLoc.longitude,
          }));
        }
        setAltitudeInput(Math.round(currentLoc.coords.altitude || 0).toString());
      } catch (e) {
        console.log('Error obtaining initial location:', e);
      }
    })();
  }, [route.params?.location]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const results = await Location.geocodeAsync(searchQuery);
      if (results.length > 0) {
        const { latitude, longitude } = results[0];
        setLocation((prev) => ({ ...prev, latitude, longitude }));
        setMapRegion((prev) => ({
          ...prev,
          latitude,
          longitude,
        }));
      } else {
        Alert.alert('Not Found', 'Could not find that location. Please try a different search term.');
      }
    } catch (e) {
      Alert.alert('Error', 'An error occurred while searching for the location.');
    } finally {
      setIsSearching(false);
    }
  };

  const centerOnUser = async () => {
    try {
      const currentLoc = await Location.getCurrentPositionAsync({});
      const newLoc = {
        ...location,
        latitude: currentLoc.coords.latitude,
        longitude: currentLoc.coords.longitude,
      };
      setLocation(newLoc);
      setMapRegion((prev) => ({
        ...prev,
        latitude: newLoc.latitude,
        longitude: newLoc.longitude,
      }));
    } catch (e) {
      Alert.alert('Location Error', 'Unable to retrieve current position.');
    }
  };

  const saveReminder = async () => {
    if (!title.trim()) {
      Alert.alert('Required Field', 'Please provide a title for the reminder.');
      return;
    }

    let parsedAltitude: number | undefined = undefined;
    if (altitudeEnabled) {
      parsedAltitude = parseFloat(altitudeInput);
      if (isNaN(parsedAltitude)) {
        Alert.alert('Invalid Altitude', 'Please enter a valid numeric value for target altitude.');
        return;
      }
    }

    if (timeEnabled) {
      if (parseTimeToMinutes(startTime) === null) {
        Alert.alert('Invalid Time', 'Please enter a valid Start Time in HH:mm (24-hour) format, e.g. 09:00.');
        return;
      }
      if (parseTimeToMinutes(endTime) === null) {
        Alert.alert('Invalid Time', 'Please enter a valid End Time in HH:mm (24-hour) format, e.g. 17:00.');
        return;
      }
    }

    const newReminder: Reminder = {
      id: Date.now().toString(),
      title: title.trim(),
      notes: notes.trim(),
      location: {
        ...location,
        altitude: altitudeEnabled ? parsedAltitude : undefined,
      },
      radius,
      isEnabled: true,
      isTriggered: false,
      timeConditions: timeEnabled ? { startTime: startTime.trim(), endTime: endTime.trim() } : undefined,
      altitudeThreshold: altitudeEnabled ? altitudeThreshold : undefined,
      dwellSeconds,
      dependsOnId,
      createdAt: Date.now(),
    };

    await storageService.addReminder(newReminder);
    await backgroundTaskService.refreshSamplingMode();
    navigation.goBack();
  };

  return (
    <KeyboardAvoidingView 
      style={styles.flexOne}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            region={mapRegion}
            onRegionChangeComplete={setMapRegion}
            onPress={(e) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setLocation((prev) => ({ ...prev, latitude, longitude }));
            }}
          >
            <Marker 
              coordinate={location} 
              draggable 
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setLocation((prev) => ({ ...prev, latitude, longitude }));
              }}
            />
            <Circle
              center={location}
              radius={radius}
              fillColor="rgba(37, 99, 235, 0.15)"
              strokeColor="rgba(37, 99, 235, 0.8)"
              strokeWidth={2}
            />
          </MapView>

          {/* Floating Search Bar */}
          <View style={styles.searchBarWrapper}>
            <View style={styles.searchBar}>
              <Search size={18} color="#6b7280" />
              <TextInput
                style={styles.searchInput}
                placeholder="Search for a place..."
                placeholderTextColor="#9ca3af"
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
              />
              {isSearching && <View style={styles.searchLoader} />}
            </View>
          </View>

          <TouchableOpacity 
            style={styles.locateBtn} 
            onPress={centerOnUser}
            accessibilityLabel="Center on current location"
          >
            <LocateFixed size={24} color="#2563eb" />
          </TouchableOpacity>

          <View style={styles.mapOverlays}>
            <View style={styles.radiusTag}>
              <MapPin size={14} color="#fff" />
              <Text style={styles.radiusTagText}>{radius}m radius</Text>
            </View>
          </View>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Reminder Title *</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g., Pick up groceries"
              placeholderTextColor="#9ca3af"
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {existingReminders.length > 0 && (
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Start after (Optional)</Text>
              <TouchableOpacity
                style={[styles.choiceButton, !dependsOnId && styles.choiceButtonSelected]}
                onPress={() => setDependsOnId(undefined)}
              >
                <Text style={styles.choiceText}>Start immediately</Text>
              </TouchableOpacity>
              {existingReminders.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.choiceButton, dependsOnId === item.id && styles.choiceButtonSelected]}
                  onPress={() => setDependsOnId(item.id)}
                >
                  <Text style={styles.choiceText}>{item.title}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Additional details..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              value={notes}
              onChangeText={setNotes}
            />
          </View>

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Geofence Radius: {radius}m</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={50}
              maximumValue={1000}
              step={25}
              value={radius}
              onValueChange={setRadius}
              minimumTrackTintColor="#2563eb"
              maximumTrackTintColor="#d1d5db"
              thumbTintColor="#2563eb"
            />
          </View>

          <View style={styles.sectionHeader}>
            <Thermometer size={18} color="#4b5563" />
            <Text style={styles.sectionTitle}>3D Geofencing (Altitude)</Text>
            <Switch
              value={altitudeEnabled}
              onValueChange={setAltitudeEnabled}
              trackColor={{ false: '#d1d5db', true: '#2563eb' }}
            />
          </View>
          
          {altitudeEnabled && (
            <View style={styles.altitudeParams}>
              <View style={styles.altitudeInputRow}>
                <Text style={styles.subLabel}>Target Altitude (m):</Text>
                <TextInput
                  style={styles.smallInput}
                  keyboardType="numeric"
                  value={altitudeInput}
                  onChangeText={setAltitudeInput}
                  placeholder="0"
                />
              </View>
              <View style={styles.altitudeInputRow}>
                <Text style={styles.subLabel}>Match Tolerance: ±{altitudeThreshold}m</Text>
                <Slider
                  style={styles.smallSlider}
                  minimumValue={2}
                  maximumValue={50}
                  step={1}
                  value={altitudeThreshold}
                  onValueChange={setAltitudeThreshold}
                  minimumTrackTintColor="#10b981"
                  thumbTintColor="#10b981"
                />
              </View>
            </View>
          )}

          <View style={styles.inputGroup}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Dwell time: {dwellSeconds}s</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={0}
              maximumValue={300}
              step={5}
              value={dwellSeconds}
              onValueChange={setDwellSeconds}
              minimumTrackTintColor="#2563eb"
              maximumTrackTintColor="#d1d5db"
              thumbTintColor="#2563eb"
            />
            <Text style={styles.helperText}>
              Stay inside the geofence for this long after the accuracy checks pass. Zero triggers after the required consecutive readings.
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <Info size={18} color="#4b5563" />
            <Text style={styles.sectionTitle}>Time Window Trigger</Text>
            <Switch
              value={timeEnabled}
              onValueChange={setTimeEnabled}
              trackColor={{ false: '#d1d5db', true: '#2563eb' }}
            />
          </View>

          {timeEnabled && (
            <View style={styles.timeInputRow}>
              <View style={styles.timeInputCol}>
                <Text style={styles.subLabel}>Start (HH:mm)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={startTime}
                  onChangeText={setStartTime}
                  placeholder="09:00"
                  maxLength={5}
                />
              </View>
              <View style={styles.timeInputCol}>
                <Text style={styles.subLabel}>End (HH:mm)</Text>
                <TextInput
                  style={styles.smallInput}
                  value={endTime}
                  onChangeText={setEndTime}
                  placeholder="17:00"
                  maxLength={5}
                />
              </View>
            </View>
          )}

          <TouchableOpacity style={styles.saveBtn} onPress={saveReminder}>
            <LinearGradient
              colors={['#2563eb', '#4f46e5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveBtnGradient}
            >
              <Save size={20} color="#fff" />
              <Text style={styles.saveBtnText}>Save Geo-Reminder</Text>
            </LinearGradient>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
            <X size={20} color="#1f2937" />
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  mapContainer: {
    height: 300,
    width: '100%',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  radiusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e40af',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  radiusTagText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
    marginLeft: 6,
  },
  searchBarWrapper: {
    position: 'absolute',
    top: 16,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#1f2937',
  },
  locateBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#fff',
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  searchLoader: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#2563eb',
    borderTopColor: 'transparent',
  },
  mapOverlays: {
    position: 'absolute',
    bottom: 16,
    left: 16,
  },
  form: {
    padding: 20,
    paddingBottom: 40,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    marginBottom: 8,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: '#1f2937',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 12,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  sectionTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1f2937',
    marginLeft: 8,
  },
  subLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  helperText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
  },
  choiceButton: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  choiceButtonSelected: {
    borderColor: '#2563eb',
    backgroundColor: '#eff6ff',
  },
  choiceText: {
    color: '#1f2937',
    fontSize: 14,
  },
  altitudeParams: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
  },
  altitudeInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  smallSlider: {
    width: '50%',
    height: 30,
  },
  timeInputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timeInputCol: {
    width: '45%',
  },
  smallInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    textAlign: 'center',
    color: '#1f2937',
  },
  saveBtn: {
    marginTop: 32,
    borderRadius: 16,
    overflow: 'hidden',
  },
  saveBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  cancelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    padding: 12,
  },
  cancelBtnText: {
    color: '#1f2937',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
});
