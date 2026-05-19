import { useMemo, useState } from 'react';
import { Info, Plus, Search, Star } from 'lucide-react-native';
import { ActivityIndicator, Text, TextInput, TouchableOpacity, View } from 'react-native';
import SegmentPreviewModal from '../../components/SegmentPreviewModal';

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
        visibleSegments.map((segment) => (
          <SegmentRow
            key={segment.id}
            segment={segment}
            entry={selectedSegments[segment.id]}
            ratedTarget={ratedTarget}
            ratedPositionOwners={ratedPositionOwners}
            onToggle={onToggle}
            onToggleRated={onToggleRated}
            onSetRatedPosition={onSetRatedPosition}
            onPreview={setPreviewSegment}
            t={t}
          />
        ))
      )}

      <SegmentPreviewModal
        segment={previewSegment}
        visible={Boolean(previewSegment)}
        onClose={() => setPreviewSegment(null)}
      />
    </View>
  );
}

function SegmentRow({
  segment,
  entry,
  ratedTarget,
  ratedPositionOwners,
  onToggle,
  onToggleRated,
  onSetRatedPosition,
  onPreview,
  t
}) {
  const isSelected = Boolean(entry);
  const isRated = isSelected && entry.rated;
  const ratedPosition = isRated ? entry.ratedOrder : null;

  return (
    <View className={`bg-white border rounded-lg mb-2 ${isSelected ? 'border-brand-red' : 'border-gray-200'}`}>
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
          onPress={() => onPreview(segment)}
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
            <Star size={20} color={isRated ? '#c97c00' : '#cbd5e1'} fill={isRated ? '#c97c00' : 'transparent'} />
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
}

export default PickSegmentsStep;
