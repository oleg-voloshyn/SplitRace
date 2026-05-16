import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import SegmentMapPicker from '../components/SegmentMapPicker';
import { formatDistance, reverseGeocode, routeDistance } from '../utils/geoUtils';

const initialSegment = {
  name: '',
  city: '',
  country: '',
  points: []
};

function NewSegmentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [form, setForm] = useState(initialSegment);
  const [userLocation, setUserLocation] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then((pos) => {
        if (pos) {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        }
      })
      .catch(() => {});
  }, []);

  async function handleSubmit() {
    if (form.points.length < 2) {
      Alert.alert(t('common.error'), t('creator.routeRequired'));
      return;
    }
    setSubmitting(true);
    try {
      await api.createSegment(form);
      Alert.alert(t('creator.title'), t('creator.segmentCreated'));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), error?.errors?.join(', ') || t('creator.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  function handlePointsChange(points) {
    setForm((current) => {
      const next = { ...current, points };
      if (current.points.length === 0 && points.length === 1) {
        reverseGeocode(points[0].lat, points[0].lng).then((location) => {
          if (location.city || location.country) {
            setForm((f) => ({ ...f, ...location }));
          }
        });
      }
      return next;
    });
  }

  function setField(key) {
    return (value) => setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <View style={s.field}>
        <Text style={s.label}>{t('creator.segmentName')}</Text>
        <TextInput style={s.input} value={form.name} onChangeText={setField('name')} />
      </View>

      <Text style={s.mapHint}>{t('creator.mapHint')}</Text>
      <SegmentMapPicker
        points={form.points}
        onPointsChange={handlePointsChange}
        initialCenter={userLocation}
        hint={t('creator.routePoints', { count: form.points.length })}
        undoLabel={t('creator.undoPoint')}
        clearLabel={t('creator.clearRoute')}
      />

      <View style={s.routeMeta}>
        <Text style={s.metaText}>
          {t('creator.distance')}: <Text style={s.metaBold}>{formatDistance(routeDistance(form.points))}</Text>
        </Text>
        {form.city || form.country ? (
          <Text style={s.metaText}>
            📍 <Text style={s.metaBold}>{[form.city, form.country].filter(Boolean).join(', ')}</Text>
          </Text>
        ) : null}
      </View>

      <TouchableOpacity style={[s.primaryBtn, submitting && s.disabled]} onPress={handleSubmit} disabled={submitting}>
        <Text style={s.primaryBtnText}>{submitting ? '...' : t('creator.createSegment')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 16, paddingBottom: 40 },
  field: { marginBottom: 12 },
  label: { color: '#666', fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff'
  },
  mapHint: { color: '#555', fontSize: 12, marginBottom: 6 },
  routeMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 8, marginBottom: 16 },
  metaText: { color: '#555', fontSize: 13 },
  metaBold: { fontWeight: '700', color: '#1a1a2e' },
  primaryBtn: { backgroundColor: '#e53935', borderRadius: 8, padding: 14, alignItems: 'center' },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 }
});

export default NewSegmentScreen;
