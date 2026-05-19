import { useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import * as Location from 'expo-location';
import { MapPin } from 'lucide-react-native';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useCreateSegment } from '../api/queries';
import SegmentMapPicker from '../components/SegmentMapPicker';
import FormTextInput from '../components/form/FormTextInput';
import { formatDistance, reverseGeocode, routeDistance } from '../utils/geoUtils';

const initialSegment = {
  name: '',
  city: '',
  country: '',
  points: []
};
const MIN_SEGMENT_DISTANCE_METERS = 400;

function NewSegmentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [userLocation, setUserLocation] = useState(null);
  const createSegment = useCreateSegment();
  const submitting = createSegment.isPending;

  const { control, handleSubmit, setValue } = useForm({ defaultValues: initialSegment });
  // `points`, `city`, `country` aren't bound to TextInputs — the map widget
  // and reverse-geocoder set them imperatively via setValue. Subscribing via
  // useWatch keeps these specific reads narrow and React-Compiler-friendly.
  const points = useWatch({ control, name: 'points' });
  const city = useWatch({ control, name: 'city' });
  const country = useWatch({ control, name: 'country' });
  const distanceMeters = routeDistance(points);
  const routeTooShort = points.length >= 2 && distanceMeters < MIN_SEGMENT_DISTANCE_METERS;

  useEffect(() => {
    Location.getLastKnownPositionAsync()
      .then((pos) => {
        if (pos) {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        }
      })
      .catch(() => {});
  }, []);

  const onSubmit = handleSubmit(async (values) => {
    if (values.points.length < 2) {
      Alert.alert(t('common.error'), t('creator.routeRequired'));
      return;
    }
    if (routeDistance(values.points) < MIN_SEGMENT_DISTANCE_METERS) {
      Alert.alert(t('common.error'), t('creator.segmentTooShort', { meters: MIN_SEGMENT_DISTANCE_METERS }));
      return;
    }
    try {
      await createSegment.mutateAsync(values);
      Alert.alert(t('creator.title'), t('creator.segmentCreated'));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), error?.errors?.join(', ') || t('creator.failed'));
    }
  });

  function handlePointsChange(newPoints) {
    const wasEmpty = points.length === 0;
    setValue('points', newPoints);
    if (wasEmpty && newPoints.length === 1) {
      reverseGeocode(newPoints[0].lat, newPoints[0].lng).then((location) => {
        if (location.city) {
          setValue('city', location.city);
        }
        if (location.country) {
          setValue('country', location.country);
        }
      });
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-100" contentContainerClassName="p-4 pb-10">
      <View className="mb-3">
        <FormTextInput
          control={control}
          name="name"
          label={t('creator.segmentName')}
          className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white"
        />
      </View>

      <Text className="text-gray-700 text-xs mb-1.5">{t('creator.mapHint')}</Text>
      <SegmentMapPicker
        points={points}
        onPointsChange={handlePointsChange}
        initialCenter={userLocation}
        hint={t('creator.routePoints', { count: points.length })}
        undoLabel={t('creator.undoPoint')}
        clearLabel={t('creator.clearRoute')}
      />

      <View className="flex-row flex-wrap gap-3 mt-2 mb-4">
        <Text className="text-gray-700 text-[13px]">
          {t('creator.distance')}: <Text className="font-bold text-brand-navy">{formatDistance(distanceMeters)}</Text>
        </Text>
        {city || country ? (
          <View className="flex-row items-center gap-1">
            <MapPin size={14} color="#555" />
            <Text className="font-bold text-brand-navy">{[city, country].filter(Boolean).join(', ')}</Text>
          </View>
        ) : null}
      </View>
      {routeTooShort ? (
        <Text className="text-brand-red text-xs mb-4">
          {t('creator.segmentTooShort', { meters: MIN_SEGMENT_DISTANCE_METERS })}
        </Text>
      ) : (
        <Text className="text-gray-500 text-xs mb-4">
          {t('creator.segmentMinimumHint', { meters: MIN_SEGMENT_DISTANCE_METERS })}
        </Text>
      )}

      <TouchableOpacity
        className={`bg-brand-red rounded-lg p-3.5 items-center ${submitting ? 'opacity-60' : ''}`}
        onPress={onSubmit}
        disabled={submitting}
      >
        <Text className="text-white font-bold text-[15px]">{submitting ? '...' : t('creator.createSegment')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

export default NewSegmentScreen;
