import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { City, Country } from 'country-state-city';
import { Calendar, ChevronLeft, ChevronRight, Info, MapPin, Plus, Search, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAddTournamentSegment, useCreateTournament, useMySegments } from '../api/queries';
import SearchableListModal from '../components/SearchableListModal';
import SegmentPreviewModal from '../components/SegmentPreviewModal';

const TOTAL_STEPS = 6;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function localDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateString(dateString, days) {
  const date = parseLocalDate(dateString) || new Date();
  date.setDate(date.getDate() + days);
  return localDateString(date);
}

function parseLocalDate(value) {
  if (!DATE_PATTERN.test(value || '')) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }

  return date;
}

function localDateTimeIso(dateString, boundary) {
  const date = parseLocalDate(dateString);
  if (!date) {
    return null;
  }

  if (boundary === 'end') {
    date.setHours(23, 59, 59, 999);
  } else {
    date.setHours(0, 0, 0, 0);
  }

  return date.toISOString();
}

function formatDateInput(value) {
  const digits = value.replace(/[^0-9]/g, '').slice(0, 8);
  if (digits.length <= 4) {
    return digits;
  }
  if (digits.length <= 6) {
    return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  }
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`;
}

function getTournamentDateValidation(startsAt, endsAt) {
  const today = localDateString(new Date());
  const startDate = parseLocalDate(startsAt);
  const endDate = parseLocalDate(endsAt);

  if (!startDate) {
    return { valid: false, startError: 'creator.dateRequired', today };
  }
  if (!endDate) {
    return { valid: false, endError: 'creator.dateRequired', today };
  }
  if (startsAt < today) {
    return { valid: false, startError: 'creator.startDateInPast', today };
  }
  if (endsAt < startsAt) {
    return { valid: false, endError: 'creator.endDateBeforeStart', today };
  }

  return { valid: true, today };
}

function firstAvailableRatedOrder(selectedSegments, ratedTarget) {
  const used = new Set(
    Object.values(selectedSegments)
      .filter((meta) => meta.rated && meta.ratedOrder)
      .map((meta) => meta.ratedOrder)
  );

  for (let position = 1; position <= ratedTarget; position += 1) {
    if (!used.has(position)) {
      return position;
    }
  }

  return ratedTarget + 1;
}

function hasCompleteRatedOrder(selectedSegments, ratedTarget) {
  const positions = Object.values(selectedSegments)
    .filter((meta) => meta.rated)
    .map((meta) => meta.ratedOrder)
    .filter(Boolean);
  if (positions.length !== ratedTarget) {
    return false;
  }

  const uniquePositions = new Set(positions);
  return (
    uniquePositions.size === ratedTarget &&
    Array.from({ length: ratedTarget }, (_, i) => i + 1).every((position) => uniquePositions.has(position))
  );
}

function buildTournamentSegmentSubmitOrder(selectedSegments) {
  const entries = Object.entries(selectedSegments);
  const rated = entries
    .filter(([, meta]) => meta.rated)
    .sort(([, a], [, b]) => (a.ratedOrder || Number.MAX_SAFE_INTEGER) - (b.ratedOrder || Number.MAX_SAFE_INTEGER));
  const unrated = entries.filter(([, meta]) => !meta.rated).sort(([, a], [, b]) => a.order - b.order);

  return [...rated, ...unrated];
}

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

  const ratedTarget = Number(form.ratedSegments) || 0;
  const totalTarget = Number(form.totalSegments) || 0;
  const selectedCount = Object.keys(selectedSegments).length;
  const ratedSelected = Object.values(selectedSegments).filter((s) => s.rated).length;

  function canGoNext() {
    if (step === 1) {
      return form.name.trim().length > 0;
    }
    if (step === 2) {
      return true;
    } // description is optional
    if (step === 3) {
      return Boolean(form.country);
    } // city is optional
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

      // Rated segments are submitted first in the explicit rated order because
      // TournamentSegment.order_number is the source of truth for unlock order.
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

function StepProgress({ current, total, t }) {
  return (
    <View className="bg-white px-4 pt-3 pb-3 border-b border-gray-200">
      <Text className="text-xs text-gray-500 mb-2">{t('creator.wizardStep', { current, total })}</Text>
      <View className="flex-row gap-1.5">
        {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
          <View key={n} className={`flex-1 h-1 rounded-full ${n <= current ? 'bg-brand-red' : 'bg-gray-200'}`} />
        ))}
      </View>
    </View>
  );
}

function NameStep({ form, setField, t }) {
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">{t('creator.tournamentName')}</Text>
      <TextInput
        className="bg-white border border-gray-300 rounded-lg p-3.5 text-base mt-3"
        value={form.name}
        onChangeText={(v) => setField('name', v)}
        placeholder={t('creator.tournamentNamePlaceholder')}
        placeholderTextColor="#9ca3af"
        autoFocus
        maxLength={120}
      />
    </View>
  );
}

function DescriptionStep({ form, setField, t }) {
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">{t('creator.description')}</Text>
      <TextInput
        className="bg-white border border-gray-300 rounded-lg p-3.5 text-base mt-3 min-h-[140px]"
        value={form.description}
        onChangeText={(v) => setField('description', v)}
        placeholder={t('creator.descriptionPlaceholder')}
        placeholderTextColor="#9ca3af"
        multiline
        textAlignVertical="top"
        maxLength={10000}
      />
    </View>
  );
}

function LocationStep({ form, cities, onPickCountry, onPickCity, onClearCity, t }) {
  const hasCountry = Boolean(form.country);
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">
        {t('creator.country')} & {t('creator.city')}
      </Text>

      <Text className="text-xs text-gray-500 mt-3 mb-1.5">{t('creator.country')}</Text>
      <TouchableOpacity
        onPress={onPickCountry}
        className="flex-row items-center bg-white border border-gray-300 rounded-lg p-3.5"
      >
        <MapPin size={16} color="#6b7280" />
        <Text className={`ml-2 flex-1 text-base ${hasCountry ? 'text-brand-navy' : 'text-gray-400'}`}>
          {hasCountry ? form.countryLabel : t('creator.selectCountry')}
        </Text>
        <ChevronRight size={18} color="#9ca3af" />
      </TouchableOpacity>

      <Text className="text-xs text-gray-500 mt-4 mb-1.5">{t('creator.city')}</Text>
      <TouchableOpacity
        onPress={hasCountry ? onPickCity : undefined}
        disabled={!hasCountry}
        className={`flex-row items-center bg-white border rounded-lg p-3.5 ${
          hasCountry ? 'border-gray-300' : 'border-gray-200 opacity-60'
        }`}
      >
        <Text className={`flex-1 text-base ${form.city ? 'text-brand-navy' : 'text-gray-400'}`}>
          {form.city || (hasCountry ? t('creator.selectCity') : t('creator.selectCountryFirst'))}
        </Text>
        {form.city ? (
          <TouchableOpacity onPress={onClearCity} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-brand-red font-bold">×</Text>
          </TouchableOpacity>
        ) : (
          <ChevronRight size={18} color="#9ca3af" />
        )}
      </TouchableOpacity>
      {hasCountry && cities.length === 0 && (
        <Text className="text-xs text-gray-500 mt-2">{t('creator.noResults')}</Text>
      )}
    </View>
  );
}

function DatesStep({ form, setField, t }) {
  const validation = getTournamentDateValidation(form.startsAt, form.endsAt);
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">{t('creator.tournamentDates')}</Text>
      <Text className="text-xs text-gray-500 mt-1 leading-[18px]">{t('creator.tournamentDatesHelp')}</Text>

      <DateInput
        label={t('creator.startsAt')}
        value={form.startsAt}
        onChange={(value) => setField('startsAt', formatDateInput(value))}
        placeholder={t('creator.datePlaceholder')}
        error={validation.startError ? t(validation.startError) : null}
        t={t}
      />

      <DateInput
        label={t('creator.endsAt')}
        value={form.endsAt}
        onChange={(value) => setField('endsAt', formatDateInput(value))}
        placeholder={t('creator.datePlaceholder')}
        error={validation.endError ? t(validation.endError) : null}
        t={t}
      />

      <View className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 mt-4">
        <Text className="text-[12px] text-gray-500 leading-[17px]">
          {t('creator.dateInputHelp', { date: validation.today })}
        </Text>
      </View>
    </View>
  );
}

function DateInput({ label, value, onChange, placeholder, error, t }) {
  return (
    <View className="mt-4">
      <Text className="text-sm font-semibold text-brand-navy mb-1.5">{label}</Text>
      <View
        className={`flex-row items-center bg-white border rounded-lg px-3 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
      >
        <Calendar size={16} color={error ? '#dc2626' : '#6b7280'} />
        <TextInput
          className="flex-1 p-3 text-base text-brand-navy"
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#9ca3af"
          keyboardType="number-pad"
          maxLength={10}
        />
      </View>
      {error ? (
        <Text className="text-red-600 text-xs mt-1.5 leading-[16px]">{error}</Text>
      ) : (
        <Text className="text-gray-500 text-xs mt-1.5 leading-[16px]">{t('creator.datePlaceholder')}</Text>
      )}
    </View>
  );
}

function SegmentsCountStep({ form, setField, t }) {
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-3">{t('creator.tournamentSegments')}</Text>

      <View>
        <Text className="text-sm font-semibold text-brand-navy mb-1">{t('creator.totalSegments')}</Text>
        <Text className="text-xs text-gray-500 mb-2 leading-[18px]">{t('creator.totalSegmentsHelp')}</Text>
        <TextInput
          className="bg-white border border-gray-300 rounded-lg p-3.5 text-base w-24"
          value={form.totalSegments}
          onChangeText={(v) => setField('totalSegments', v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          maxLength={3}
        />
      </View>

      <View className="mt-5">
        <Text className="text-sm font-semibold text-brand-navy mb-1">{t('creator.ratedSegments')}</Text>
        <Text className="text-xs text-gray-500 mb-2 leading-[18px]">{t('creator.ratedSegmentsHelp')}</Text>
        <TextInput
          className="bg-white border border-gray-300 rounded-lg p-3.5 text-base w-24"
          value={form.ratedSegments}
          onChangeText={(v) => setField('ratedSegments', v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          maxLength={3}
        />
      </View>
    </View>
  );
}

function PickSegmentsStep({
  mySegments,
  selectedSegments,
  totalTarget,
  ratedTarget,
  selectedCount,
  ratedSelected,
  tournamentCity,
  onToggle,
  onToggleRated,
  onSetRatedPosition,
  onCreateNew,
  t
}) {
  const [query, setQuery] = useState('');
  const [filterByCity, setFilterByCity] = useState(Boolean(tournamentCity));
  const [previewSegment, setPreviewSegment] = useState(null);

  const ratedPositionOwners = useMemo(() => {
    return Object.entries(selectedSegments).reduce((acc, [id, meta]) => {
      if (meta.rated && meta.ratedOrder) {
        acc[meta.ratedOrder] = id;
      }
      return acc;
    }, {});
  }, [selectedSegments]);

  const cityMatcher = tournamentCity?.trim().toLowerCase();
  const visibleSegments = useMemo(() => {
    if (!mySegments) {
      return [];
    }
    const normalizedQuery = query.trim().toLowerCase();
    return mySegments.filter((s) => {
      if (filterByCity && cityMatcher) {
        if (!s.city || s.city.toLowerCase() !== cityMatcher) {
          return false;
        }
      }
      if (normalizedQuery) {
        const haystack = [s.name, s.city, s.country].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(normalizedQuery)) {
          return false;
        }
      }
      return true;
    });
  }, [mySegments, query, filterByCity, cityMatcher]);

  if (mySegments === null) {
    return (
      <View className="items-center py-8">
        <ActivityIndicator color="#e53935" />
      </View>
    );
  }

  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">{t('creator.pickSegments')}</Text>
      <Text className="text-xs text-gray-500 mb-2">{t('creator.pickSegmentsHint')}</Text>

      <View className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 mb-3">
        <Text className="text-[13px] text-brand-navy">
          {t('creator.segmentsProgress', {
            selected: selectedCount,
            total: totalTarget,
            rated: ratedSelected,
            ratedTotal: ratedTarget
          })}
        </Text>
        <Text className="text-[11px] text-gray-500 mt-1.5 leading-[16px]">{t('creator.segmentRatedHint')}</Text>
      </View>

      <View className="flex-row items-center bg-white border border-gray-300 rounded-lg px-3 mb-2">
        <Search size={16} color="#888" />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('creator.searchSegments')}
          placeholderTextColor="#9ca3af"
          className="flex-1 py-2.5 px-2 text-[15px] text-brand-navy"
        />
      </View>

      {cityMatcher ? (
        <TouchableOpacity
          onPress={() => setFilterByCity((v) => !v)}
          className={`self-start px-3 py-1.5 rounded-full border mb-3 ${
            filterByCity ? 'border-brand-red bg-red-50' : 'border-gray-300 bg-white'
          }`}
        >
          <Text className={`text-xs font-semibold ${filterByCity ? 'text-brand-red' : 'text-gray-700'}`}>
            {filterByCity ? t('creator.showAllCities') : t('creator.showCityOnly', { city: tournamentCity })}
          </Text>
        </TouchableOpacity>
      ) : null}

      <TouchableOpacity
        onPress={onCreateNew}
        className="flex-row items-center justify-center bg-brand-navy rounded-lg py-3 mb-3 gap-2"
      >
        <Plus size={16} color="#fff" />
        <Text className="text-white font-bold">{t('creator.createNewSegment')}</Text>
      </TouchableOpacity>

      {visibleSegments.length === 0 ? (
        <Text className="text-gray-500 text-center py-4">
          {mySegments.length === 0 ? t('creator.noSegmentsYet') : t('creator.noMatchingSegments')}
        </Text>
      ) : (
        visibleSegments.map((segment) => {
          const entry = selectedSegments[segment.id];
          const isSelected = Boolean(entry);
          const isRated = isSelected && entry.rated;
          const ratedPosition = isRated ? entry.ratedOrder : null;
          return (
            <View
              key={segment.id}
              className={`bg-white border rounded-lg mb-2 ${isSelected ? 'border-brand-red' : 'border-gray-200'}`}
            >
              <View className="flex-row items-center p-3">
                <TouchableOpacity onPress={() => onToggle(segment)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <View
                    className={`w-5 h-5 rounded items-center justify-center ${
                      isSelected ? 'bg-brand-red' : 'border-2 border-gray-300'
                    }`}
                  >
                    {isSelected && <Text className="text-white text-xs font-bold">✓</Text>}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onToggle(segment)} className="flex-1 ml-3">
                  <Text className="text-[15px] font-semibold text-brand-navy">{segment.name}</Text>
                  <View className="flex-row gap-2 mt-0.5">
                    {segment.distance_meters != null && (
                      <Text className="text-xs text-gray-500">{(segment.distance_meters / 1000).toFixed(2)} km</Text>
                    )}
                    {segment.city ? <Text className="text-xs text-gray-500">· {segment.city}</Text> : null}
                  </View>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setPreviewSegment(segment)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="p-1.5 mr-1"
                >
                  <Info size={18} color="#1a1a2e" />
                </TouchableOpacity>
                {isSelected && (
                  <TouchableOpacity
                    onPress={() => onToggleRated(segment)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    className="flex-row items-center"
                  >
                    {ratedPosition != null && (
                      <Text className="text-amber-700 font-extrabold text-xs mr-1">#{ratedPosition}</Text>
                    )}
                    <Star
                      size={20}
                      color={isRated ? '#c97c00' : '#cbd5e1'}
                      fill={isRated ? '#c97c00' : 'transparent'}
                    />
                  </TouchableOpacity>
                )}
              </View>
              {isRated && (
                <View className="px-3 pb-3">
                  <Text className="text-[11px] text-gray-500 mb-2">{t('creator.ratedOrderLabel')}</Text>
                  <View className="flex-row flex-wrap gap-1.5">
                    {Array.from({ length: ratedTarget }, (_, index) => {
                      const position = index + 1;
                      const active = ratedPosition === position;
                      const occupiedByOther =
                        ratedPositionOwners[position] && ratedPositionOwners[position] !== String(segment.id);
                      return (
                        <TouchableOpacity
                          key={position}
                          onPress={() => onSetRatedPosition(segment, position)}
                          className={`min-w-[42px] rounded-full border px-3 py-1.5 items-center ${
                            active
                              ? 'border-amber-600 bg-amber-50'
                              : occupiedByOther
                                ? 'border-gray-300 bg-gray-50'
                                : 'border-gray-200 bg-white'
                          }`}
                        >
                          <Text
                            className={`text-xs font-extrabold ${
                              active ? 'text-amber-700' : occupiedByOther ? 'text-gray-500' : 'text-brand-navy'
                            }`}
                          >
                            #{position}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}

      <SegmentPreviewModal
        segment={previewSegment}
        visible={Boolean(previewSegment)}
        onClose={() => setPreviewSegment(null)}
      />
    </View>
  );
}

function BottomNav({ step, canGoNext, canSubmit, submitting, onBack, onNext, onSubmit, t }) {
  const isFirst = step === 1;
  const isLast = step === TOTAL_STEPS;
  return (
    <View className="flex-row gap-3 bg-white border-t border-gray-200 px-4 py-3">
      <TouchableOpacity
        onPress={onBack}
        disabled={isFirst}
        className={`flex-row items-center justify-center px-4 py-3 rounded-lg border ${
          isFirst ? 'border-gray-200 opacity-40' : 'border-gray-300'
        }`}
      >
        <ChevronLeft size={18} color="#1a1a2e" />
        <Text className="text-brand-navy font-bold ml-1">{t('creator.back')}</Text>
      </TouchableOpacity>

      {isLast ? (
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
          className={`flex-1 items-center justify-center py-3 rounded-lg bg-brand-red ${
            !canSubmit || submitting ? 'opacity-60' : ''
          }`}
        >
          <Text className="text-white font-bold text-base">{submitting ? '...' : t('creator.createTournament')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onNext}
          disabled={!canGoNext}
          className={`flex-1 flex-row items-center justify-center py-3 rounded-lg bg-brand-red ${
            !canGoNext ? 'opacity-60' : ''
          }`}
        >
          <Text className="text-white font-bold text-base">{t('creator.next')}</Text>
          <ChevronRight size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default NewTournamentScreen;
export { buildTournamentSegmentSubmitOrder, firstAvailableRatedOrder, hasCompleteRatedOrder };
