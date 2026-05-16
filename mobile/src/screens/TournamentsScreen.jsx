import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown, ChevronUp, Plus, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';

function TournamentsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [tournaments, setTournaments] = useState(null);
  const [myTournaments, setMyTournaments] = useState([]);
  const [mySegments, setMySegments] = useState([]);
  const [expandedAdd, setExpandedAdd] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [all, mine, segments] = await Promise.all([api.tournaments(), api.myTournaments(), api.mySegments()]);
      setTournaments(all);
      setMyTournaments(mine);
      setMySegments(segments);
    } catch {
      setTournaments([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [all, mine, segments] = await Promise.all([api.tournaments(), api.myTournaments(), api.mySegments()]);
        if (cancelled) {
          return;
        }
        setTournaments(all);
        setMyTournaments(mine);
        setMySegments(segments);
      } catch {
        if (!cancelled) {
          setTournaments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function handleAddSegment(tournament, segment) {
    const orderNumber = (tournament.segments?.length || 0) + 1;
    try {
      await api.addTournamentSegment(tournament.slug, {
        segment_id: segment.id,
        order_number: orderNumber,
        is_rated: '1'
      });
      setExpandedAdd(null);
      await load();
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function handleSubmitForReview(tournament) {
    try {
      await api.submitTournamentForReview(tournament.slug);
      await load();
      Alert.alert(t('creator.title'), t('creator.submitted'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || t('creator.failed'));
    }
  }

  if (!tournaments) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#e53935" />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-100 p-3"
      data={tournaments}
      keyExtractor={(tn) => tn.id.toString()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e53935" />}
      ListEmptyComponent={<Text className="text-center text-gray-500 mt-16">{t('tournaments.noTournaments')}</Text>}
      ListFooterComponent={
        myTournaments.length > 0 ? (
          <MyTournamentsList
            myTournaments={myTournaments}
            mySegments={mySegments}
            expandedAdd={expandedAdd}
            setExpandedAdd={setExpandedAdd}
            onAddSegment={handleAddSegment}
            onSubmitForReview={handleSubmitForReview}
            t={t}
          />
        ) : null
      }
      renderItem={({ item: tn }) => (
        <TouchableOpacity
          className="bg-white rounded-xl p-4 mb-2.5"
          onPress={() => navigation.navigate('Tournament', { slug: tn.slug })}
        >
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-base font-bold flex-1 mr-2">{tn.name}</Text>
            <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: badgeColor(tn.status) }}>
              <Text className="text-white text-[11px] font-bold">{t(`tournaments.${tn.status}`).toUpperCase()}</Text>
            </View>
          </View>
          {tn.city && (
            <Text className="text-gray-500 text-[13px] mt-0.5">
              {tn.city}
              {tn.country ? ` · ${tn.country}` : ''}
            </Text>
          )}
          <Text className="text-gray-500 text-[13px] mt-0.5">
            {t('tournaments.participants', { count: tn.participants_count ?? 0 })}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

function MyTournamentsList({
  myTournaments,
  mySegments,
  expandedAdd,
  setExpandedAdd,
  onAddSegment,
  onSubmitForReview,
  t
}) {
  return (
    <View className="mt-2">
      <Text className="text-base font-bold mb-2.5">{t('creator.myTournaments')}</Text>
      {myTournaments.map((tournament) => {
        const isEditable = tournament.status === 'draft' || tournament.status === 'rejected';
        const sortedSegments = [...(tournament.segments || [])].sort((a, b) => a.order_number - b.order_number);
        const available = mySegments.filter((seg) => !tournament.segments?.some((ts) => ts.segment.id === seg.id));
        const isExpanded = expandedAdd === tournament.id;

        return (
          <View key={tournament.id} className="bg-white rounded-xl p-3.5 mb-2.5">
            <View className="flex-row items-start mb-2">
              <View className="flex-1">
                <Text className="text-[15px] font-bold mb-1">{tournament.name}</Text>
                <View
                  className="self-start rounded px-2 py-0.5"
                  style={{ backgroundColor: statusBg(tournament.status) }}
                >
                  <Text className="text-[10px] font-bold tracking-wider" style={{ color: statusFg(tournament.status) }}>
                    {t(`creator.status_${tournament.status}`).toUpperCase()}
                  </Text>
                </View>
              </View>
              {isEditable && (
                <TouchableOpacity
                  className="bg-brand-navy rounded-md px-2.5 py-1.5 ml-2"
                  onPress={() => onSubmitForReview(tournament)}
                >
                  <Text className="text-white text-xs font-bold">{t('creator.submitReview')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {tournament.review_note ? (
              <Text className="text-red-700 text-[13px] mb-2 leading-[18px]">{tournament.review_note}</Text>
            ) : null}

            <Text className="text-gray-500 text-xs mb-2">
              {sortedSegments.length}/{tournament.total_segments_count} {t('creator.segments')}
            </Text>

            {sortedSegments.length === 0 ? (
              <Text className="text-gray-500 text-[13px]">{t('creator.noSegmentsAdded')}</Text>
            ) : (
              sortedSegments.map((ts) => (
                <View key={ts.segment.id} className="flex-row items-center py-1.5 border-b border-gray-100">
                  <Text className="text-gray-300 font-bold text-xs w-[26px]">#{ts.order_number}</Text>
                  <Text className="flex-1 text-sm text-brand-navy">{ts.segment.name}</Text>
                  <View className="flex-row items-center gap-1.5">
                    {ts.is_rated ? <Star size={13} color="#c97c00" fill="#c97c00" /> : null}
                    {ts.segment.distance_meters != null ? (
                      <Text className="text-gray-500 text-xs">{(ts.segment.distance_meters / 1000).toFixed(2)} km</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {isEditable && (
              <>
                <TouchableOpacity
                  className="flex-row items-center justify-center gap-1.5 border border-gray-300 rounded-lg p-2.5 mt-2.5"
                  onPress={() => setExpandedAdd(isExpanded ? null : tournament.id)}
                >
                  {isExpanded ? <ChevronUp size={16} color="#1a1a2e" /> : <ChevronDown size={16} color="#1a1a2e" />}
                  <Text className="text-brand-navy font-semibold text-sm">
                    {isExpanded ? t('creator.cancelAdd') : t('creator.addSegmentBtn')}
                  </Text>
                </TouchableOpacity>
                {isExpanded &&
                  (available.length === 0 ? (
                    <Text className="text-gray-500 text-[13px] mt-2">{t('creator.noSegments')}</Text>
                  ) : (
                    available.map((seg) => (
                      <TouchableOpacity
                        key={seg.id}
                        className="flex-row items-center py-2.5 px-1 border-b border-gray-100 mt-1"
                        onPress={() => onAddSegment(tournament, seg)}
                      >
                        <Text className="flex-1 text-sm text-brand-navy">{seg.name}</Text>
                        {seg.distance_meters != null ? (
                          <Text className="text-gray-500 text-xs mr-2">
                            {(seg.distance_meters / 1000).toFixed(2)} km
                          </Text>
                        ) : null}
                        <Plus size={18} color="#1a1a2e" strokeWidth={2.4} />
                      </TouchableOpacity>
                    ))
                  ))}
              </>
            )}
          </View>
        );
      })}
    </View>
  );
}

function badgeColor(status) {
  return status === 'active' ? '#4caf50' : status === 'completed' ? '#9e9e9e' : '#ff9800';
}

function statusBg(status) {
  return (
    { draft: '#fff3cd', pending_review: '#cce5ff', active: '#d4edda', rejected: '#f8d7da', completed: '#e2e3e5' }[
      status
    ] || '#eee'
  );
}

function statusFg(status) {
  return (
    { draft: '#856404', pending_review: '#004085', active: '#155724', rejected: '#721c24', completed: '#383d41' }[
      status
    ] || '#555'
  );
}

export default TournamentsScreen;
