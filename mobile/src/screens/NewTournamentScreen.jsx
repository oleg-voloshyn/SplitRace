import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { City, Country } from 'country-state-city';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, Text, View } from 'react-native';
import { useAddTournamentSegment, useCreateTournament, useMySegments } from '../api/queries';
import SearchableListModal from '../components/SearchableListModal';
import {
  addDaysToDateString,
  getTournamentDateValidation,
  localDateString,
  localDateTimeIso
} from '../utils/tournamentDates';
import {
  buildTournamentSegmentSubmitOrder,
  firstAvailableRatedOrder,
  hasCompleteRatedOrder
} from '../utils/tournamentSegments';
import BottomNav from './NewTournament/BottomNav';
import DatesStep from './NewTournament/DatesStep';
import DescriptionStep from './NewTournament/DescriptionStep';
import LocationStep from './NewTournament/LocationStep';
import NameStep from './NewTournament/NameStep';
import PickSegmentsStep from './NewTournament/PickSegmentsStep';
import SegmentsCountStep from './NewTournament/SegmentsCountStep';
import StepProgress from './NewTournament/StepProgress';

const TOTAL_STEPS = 6;

function defaultFormValues() {
  const today = localDateString(new Date());
  return {
    name: '',
    description: '',
    country: null, // ISO code, e.g. "UA"
    countryLabel: '',
    city: '',
    startsAt: today,
    endsAt: addDaysToDateString(today, 7),
    totalSegments: '4',
    ratedSegments: '2'
  };
}

function NewTournamentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const { data: mySegments, isLoading: mySegmentsLoading, refetch: refetchSegments } = useMySegments();
  const createTournament = useCreateTournament();
  // Segment association happens inside handleSubmit after the tournament is
  // created. We instantiate without a slug and pass it per-mutation below.
  const addSegment = useAddTournamentSegment();

  const { control, handleSubmit, setValue } = useForm({ defaultValues: defaultFormValues() });
  // The wizard's "can I advance?" logic needs to react to specific fields.
  // useWatch subscribes narrowly so Controller-driven inputs themselves don't
  // trigger a wizard re-render until one of these tracked values changes.
  const name = useWatch({ control, name: 'name' });
  const country = useWatch({ control, name: 'country' });
  const startsAt = useWatch({ control, name: 'startsAt' });
  const endsAt = useWatch({ control, name: 'endsAt' });
  const totalSegments = useWatch({ control, name: 'totalSegments' });
  const ratedSegments = useWatch({ control, name: 'ratedSegments' });
  const city = useWatch({ control, name: 'city' });

  // Map of segmentId -> { rated: boolean, order: number (insertion order), ratedOrder?: number }
  const [selectedSegments, setSelectedSegments] = useState({});
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const cities = useMemo(() => (country ? City.getCitiesOfCountry(country) || [] : []), [country]);

  // Refresh segments whenever this screen regains focus (e.g. user came back
  // from NewSegmentScreen after creating one inline).
  useFocusEffect(
    useCallback(() => {
      if (step === 6) {
        refetchSegments();
      }
    }, [step, refetchSegments])
  );

  const ratedTarget = Number(ratedSegments) || 0;
  const totalTarget = Number(totalSegments) || 0;
  const selectedCount = Object.keys(selectedSegments).length;
  const ratedSelected = Object.values(selectedSegments).filter((s) => s.rated).length;

  function selectCountry(c) {
    setValue('country', c.isoCode);
    setValue('countryLabel', c.name);
    setValue('city', '');
    setShowCountryPicker(false);
  }

  function selectCity(c) {
    setValue('city', c.name);
    setShowCityPicker(false);
  }

  function toggleSegment(segment) {
    setSelectedSegments((prev) => {
      const next = { ...prev };
      if (next[segment.id]) {
        delete next[segment.id];
      } else {
        const order = Object.keys(next).length;
        next[segment.id] = { rated: false, order };
      }
      return next;
    });
  }

  function toggleSegmentRated(segment) {
    const entry = selectedSegments[segment.id];
    if (!entry) {
      return;
    }
    if (!entry.rated && ratedSelected >= ratedTarget) {
      Alert.alert(t('common.error'), t('creator.ratedSegmentsLimit'));
      return;
    }

    setSelectedSegments((prev) => {
      const current = prev[segment.id];
      if (!current) {
        return prev;
      }
      if (current.rated) {
        return { ...prev, [segment.id]: { ...current, rated: false, ratedOrder: null } };
      }

      return {
        ...prev,
        [segment.id]: {
          ...current,
          rated: true,
          ratedOrder: firstAvailableRatedOrder(prev, ratedTarget)
        }
      };
    });
  }

  function setRatedPosition(segment, position) {
    setSelectedSegments((prev) => {
      const entry = prev[segment.id];
      if (!entry?.rated) {
        return prev;
      }

      const next = {
        ...prev,
        [segment.id]: { ...entry, ratedOrder: position }
      };
      const previousPosition = entry.ratedOrder;
      const occupied = Object.entries(prev).find(
        ([id, meta]) => id !== String(segment.id) && meta.rated && meta.ratedOrder === position
      );
      if (occupied && previousPosition) {
        const [occupiedId, occupiedMeta] = occupied;
        next[occupiedId] = { ...occupiedMeta, ratedOrder: previousPosition };
      }

      return next;
    });
  }

  function canGoNext() {
    if (step === 1) {
      return name.trim().length > 0;
    }
    if (step === 2) {
      return true; // description is optional
    }
    if (step === 3) {
      return Boolean(country); // city is optional
    }
    if (step === 4) {
      return getTournamentDateValidation(startsAt, endsAt).valid;
    }
    if (step === 5) {
      const total = Number(totalSegments);
      const rated = Number(ratedSegments);
      return Number.isInteger(total) && total > 0 && Number.isInteger(rated) && rated > 0 && rated < total;
    }
    return false;
  }

  function canSubmit() {
    return selectedCount === totalTarget && hasCompleteRatedOrder(selectedSegments, ratedTarget);
  }

  const onSubmit = handleSubmit(async (values) => {
    const dateValidation = getTournamentDateValidation(values.startsAt, values.endsAt);
    if (!dateValidation.valid) {
      Alert.alert(t('common.error'), t(dateValidation.startError || dateValidation.endError || 'creator.dateRequired'));
      return;
    }

    try {
      const tournament = await createTournament.mutateAsync({
        name: values.name.trim(),
        description: values.description.trim(),
        city: values.city.trim(),
        country: values.country || '',
        starts_at: localDateTimeIso(values.startsAt, 'start'),
        ends_at: localDateTimeIso(values.endsAt, 'end'),
        total_segments_count: String(Number(values.totalSegments) || 0),
        rated_segments_count: String(Number(values.ratedSegments) || 0)
      });

      const ordered = buildTournamentSegmentSubmitOrder(selectedSegments);
      for (const [index, [segmentId, meta]] of ordered.entries()) {
        await addSegment.mutateAsync({
          slug: tournament.slug,
          segment_id: segmentId,
          order_number: String(index + 1),
          is_rated: meta.rated ? '1' : '0'
        });
      }

      Alert.alert(t('creator.title'), t('creator.tournamentCreated'));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), error?.errors?.join(', ') || error?.error || t('creator.failed'));
    }
  });

  return (
    <View className="flex-1 bg-gray-100">
      <StepProgress current={step} total={TOTAL_STEPS} t={t} />

      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-4">
        {step === 1 && <NameStep control={control} t={t} />}
        {step === 2 && <DescriptionStep control={control} t={t} />}
        {step === 3 && (
          <LocationStep
            control={control}
            cities={cities}
            onPickCountry={() => setShowCountryPicker(true)}
            onPickCity={() => setShowCityPicker(true)}
            onClearCity={() => setValue('city', '')}
            t={t}
          />
        )}
        {step === 4 && <DatesStep control={control} t={t} />}
        {step === 5 && <SegmentsCountStep control={control} t={t} />}
        {step === 6 && (
          <PickSegmentsStep
            mySegments={mySegments}
            loading={mySegmentsLoading}
            selectedSegments={selectedSegments}
            totalTarget={totalTarget}
            ratedTarget={ratedTarget}
            selectedCount={selectedCount}
            ratedSelected={ratedSelected}
            tournamentCity={city}
            onToggle={toggleSegment}
            onToggleRated={toggleSegmentRated}
            onSetRatedPosition={setRatedPosition}
            onCreateNew={() => navigation.navigate('NewSegment')}
            t={t}
          />
        )}
      </ScrollView>

      <BottomNav
        step={step}
        totalSteps={TOTAL_STEPS}
        canGoNext={canGoNext()}
        canSubmit={canSubmit()}
        submitting={createTournament.isPending || addSegment.isPending}
        onBack={() => setStep((s) => Math.max(1, s - 1))}
        onNext={() => setStep((s) => Math.min(TOTAL_STEPS, s + 1))}
        onSubmit={onSubmit}
        t={t}
      />

      <SearchableListModal
        visible={showCountryPicker}
        onClose={() => setShowCountryPicker(false)}
        onSelect={selectCountry}
        title={t('creator.selectCountry')}
        searchPlaceholder={t('creator.searchCountry')}
        emptyText={t('creator.noResults')}
        items={countries}
        keyFor={(c) => c.isoCode}
        labelFor={(c) => c.name}
        leading={(c) => <Text className="text-xl">{c.flag}</Text>}
      />

      <SearchableListModal
        visible={showCityPicker}
        onClose={() => setShowCityPicker(false)}
        onSelect={selectCity}
        title={t('creator.selectCity')}
        searchPlaceholder={t('creator.searchCity')}
        emptyText={t('creator.noResults')}
        items={cities}
        keyFor={(c) => `${c.stateCode}-${c.name}`}
        labelFor={(c) => c.name}
      />
    </View>
  );
}

export default NewTournamentScreen;
