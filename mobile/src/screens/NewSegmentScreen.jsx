import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MapPin } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    <ScrollView className="flex-1 bg-gray-100" contentContainerClassName="p-4 pb-10">
      <View className="mb-3">
        <Text className="text-xs text-gray-600 mb-1">{t('creator.segmentName')}</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white"
          value={form.name}
          onChangeText={setField('name')}
        />
      </View>

      <Text className="text-gray-700 text-xs mb-1.5">{t('creator.mapHint')}</Text>
      <SegmentMapPicker
        points={form.points}
        onPointsChange={handlePointsChange}
        initialCenter={userLocation}
        hint={t('creator.routePoints', { count: form.points.length })}
        undoLabel={t('creator.undoPoint')}
        clearLabel={t('creator.clearRoute')}
      />

      <View className="flex-row flex-wrap gap-3 mt-2 mb-4">
        <Text className="text-gray-700 text-[13px]">
          {t('creator.distance')}:{' '}
          <Text className="font-bold text-brand-navy">{formatDistance(routeDistance(form.points))}</Text>
        </Text>
        {form.city || form.country ? (
          <View className="flex-row items-center gap-1">
            <MapPin size={14} color="#555" />
            <Text className="font-bold text-brand-navy">{[form.city, form.country].filter(Boolean).join(', ')}</Text>
          </View>
        ) : null}
      </View>

      <TouchableOpacity
        className={`bg-brand-red rounded-lg p-3.5 items-center ${submitting ? 'opacity-60' : ''}`}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text className="text-white font-bold text-[15px]">{submitting ? '...' : t('creator.createSegment')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default NewSegmentScreen;
