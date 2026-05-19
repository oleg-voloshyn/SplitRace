import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { City, Country } from 'country-state-city';
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

function NewTournamentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [step, setStep] = useState(1);
  const { data: mySegments, refetch: refetchSegments } = useMySegments();
  const createTournament = useCreateTournament();
  // Segment association happens inside handleSubmit after the tournament is
  // created. We instantiate without a slug and pass it per-mutation below.
  const addSegment = useAddTournamentSegment();
  const [form, setForm] = useState(() => {
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
  });
  // Map of segmentId -> { rated: boolean, order: number (insertion order), ratedOrder?: number }
  const [selectedSegments, setSelectedSegments] = useState({});
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);

  const countries = useMemo(() => Country.getAllCountries(), []);
  const cities = useMemo(() => (form.country ? City.getCitiesOfCountry(form.country) || [] : []), [form.country]);

  // Refresh segments whenever this screen regains focus (e.g. user came back
  // from NewSegmentScreen after creating one inline).
  useFocusEffect(
    useCallback(() => {
      if (step === 6) {
        refetchSegments();
      }
    }, [step, refetchSegments])
  );

  const ratedTarget = Number(form.ratedSegments) || 0;
  const totalTarget = Number(form.totalSegments) || 0;
  const selectedCount = Object.keys(selectedSegments).length;
  const ratedSelected = Object.values(selectedSegments).filter((s) => s.rated).length;

  function setField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function selectCountry(country) {
    setForm((f) => ({ ...f, country: country.isoCode, countryLabel: country.name, city: '' }));
    setShowCountryPicker(false);
  }

  function selectCity(city) {
    setField('city', city.name);
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
      return form.name.trim().length > 0;
    }
    if (step === 2) {
      return true; // description is optional
    }
    if (step === 3) {
      return Boolean(form.country); // city is optional
    }
    if (step === 4) {
      return getTournamentDateValidation(form.startsAt, form.endsAt).valid;
    }
    if (step === 5) {
      const total = Number(form.totalSegments);
      const rated = Number(form.ratedSegments);
      return Number.isInteger(total) && total > 0 && Number.isInteger(rated) && rated > 0 && rated < total;
    }
    return false;
  }

  function canSubmit() {
    return selectedCount === totalTarget && hasCompleteRatedOrder(selectedSegments, ratedTarget);
  }

  async function handleSubmit() {
    const dateValidation = getTournamentDateValidation(form.startsAt, form.endsAt);
    if (!dateValidation.valid) {
      Alert.alert(t('common.error'), t(dateValidation.startError || dateValidation.endError || 'creator.dateRequired'));
      return;
    }

    try {
      const tournament = await createTournament.mutateAsync({
        name: form.name.trim(),
        description: form.description.trim(),
        city: form.city.trim(),
        country: form.country || '',
        starts_at: localDateTimeIso(form.startsAt, 'start'),
        ends_at: localDateTimeIso(form.endsAt, 'end'),
        total_segments_count: String(totalTarget),
        rated_segments_count: String(ratedTarget)
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
  }

  return (
    <View className="flex-1 bg-gray-100">
      <StepProgress current={step} total={TOTAL_STEPS} t={t} />

      <ScrollView className="flex-1" contentContainerClassName="p-4 pb-4">
        {step === 1 && <NameStep form={form} setField={setField} t={t} />}
        {step === 2 && <DescriptionStep form={form} setField={setField} t={t} />}
        {step === 3 && (
          <LocationStep
            form={form}
            cities={cities}
            onPickCountry={() => setShowCountryPicker(true)}
            onPickCity={() => setShowCityPicker(true)}
            onClearCity={() => setField('city', '')}
            t={t}
          />
        )}
        {step === 4 && <DatesStep form={form} setField={setField} t={t} />}
        {step === 5 && <SegmentsCountStep form={form} setField={setField} t={t} />}
        {step === 6 && (
          <PickSegmentsStep
            mySegments={mySegments}
            selectedSegments={selectedSegments}
            totalTarget={totalTarget}
            ratedTarget={ratedTarget}
            selectedCount={selectedCount}
            ratedSelected={ratedSelected}
            tournamentCity={form.city}
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
        onSubmit={handleSubmit}
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
