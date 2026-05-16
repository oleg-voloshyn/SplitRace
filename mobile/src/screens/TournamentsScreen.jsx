import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { ChevronDown, ChevronUp, Plus, Star } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
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
    load();
  }, [load]);

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
      <View style={s.center}>
        <ActivityIndicator color="#e53935" />
      </View>
    );
  }

  return (
    <FlatList
      style={s.list}
      data={tournaments}
      keyExtractor={(tn) => tn.id.toString()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e53935" />}
      ListEmptyComponent={<Text style={s.empty}>{t('tournaments.noTournaments')}</Text>}
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
        <TouchableOpacity style={s.card} onPress={() => navigation.navigate('Tournament', { slug: tn.slug })}>
          <View style={s.cardHeader}>
            <Text style={s.name}>{tn.name}</Text>
            <View style={[s.badge, { backgroundColor: badgeColor(tn.status) }]}>
              <Text style={s.badgeText}>{t(`tournaments.${tn.status}`).toUpperCase()}</Text>
            </View>
          </View>
          {tn.city && (
            <Text style={s.meta}>
              {tn.city}
              {tn.country ? ` · ${tn.country}` : ''}
            </Text>
          )}
          <Text style={s.meta}>{t('tournaments.participants', { count: tn.participants_count ?? 0 })}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

function MyTournamentsList({ myTournaments, mySegments, expandedAdd, setExpandedAdd, onAddSegment, onSubmitForReview, t }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{t('creator.myTournaments')}</Text>
      {myTournaments.map((tournament) => {
        const isEditable = tournament.status === 'draft' || tournament.status === 'rejected';
        const sortedSegments = [...(tournament.segments || [])].sort((a, b) => a.order_number - b.order_number);
        const available = mySegments.filter((seg) => !tournament.segments?.some((ts) => ts.segment.id === seg.id));
        const isExpanded = expandedAdd === tournament.id;

        return (
          <View key={tournament.id} style={s.myCard}>
            <View style={s.myCardHead}>
              <View style={{ flex: 1 }}>
                <Text style={s.myCardName}>{tournament.name}</Text>
                <View style={[s.statusBadge, { backgroundColor: statusBg(tournament.status) }]}>
                  <Text style={[s.statusText, { color: statusFg(tournament.status) }]}>
                    {t(`creator.status_${tournament.status}`).toUpperCase()}
                  </Text>
                </View>
              </View>
              {isEditable && (
                <TouchableOpacity style={s.reviewBtn} onPress={() => onSubmitForReview(tournament)}>
                  <Text style={s.reviewBtnText}>{t('creator.submitReview')}</Text>
                </TouchableOpacity>
              )}
            </View>

            {tournament.review_note ? <Text style={s.reviewNote}>{tournament.review_note}</Text> : null}

            <Text style={s.segCount}>
              {sortedSegments.length}/{tournament.total_segments_count} {t('creator.segments')}
            </Text>

            {sortedSegments.length === 0 ? (
              <Text style={s.muted}>{t('creator.noSegmentsAdded')}</Text>
            ) : (
              sortedSegments.map((ts) => (
                <View key={ts.segment.id} style={s.segRow}>
                  <Text style={s.segNum}>#{ts.order_number}</Text>
                  <Text style={s.segName}>{ts.segment.name}</Text>
                  <View style={s.segRight}>
                    {ts.is_rated ? <Star size={13} color="#c97c00" fill="#c97c00" /> : null}
                    {ts.segment.distance_meters != null ? (
                      <Text style={s.segDist}>{(ts.segment.distance_meters / 1000).toFixed(2)} km</Text>
                    ) : null}
                  </View>
                </View>
              ))
            )}

            {isEditable && (
              <>
                <TouchableOpacity style={s.addToggle} onPress={() => setExpandedAdd(isExpanded ? null : tournament.id)}>
                  {isExpanded ? <ChevronUp size={16} color="#1a1a2e" /> : <ChevronDown size={16} color="#1a1a2e" />}
                  <Text style={s.addToggleText}>{isExpanded ? t('creator.cancelAdd') : t('creator.addSegmentBtn')}</Text>
                </TouchableOpacity>
                {isExpanded &&
                  (available.length === 0 ? (
                    <Text style={[s.muted, { marginTop: 8 }]}>{t('creator.noSegments')}</Text>
                  ) : (
                    available.map((seg) => (
                      <TouchableOpacity key={seg.id} style={s.availSeg} onPress={() => onAddSegment(tournament, seg)}>
                        <Text style={s.availSegName}>{seg.name}</Text>
                        {seg.distance_meters != null ? (
                          <Text style={s.availSegDist}>{(seg.distance_meters / 1000).toFixed(2)} km</Text>
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

const s = StyleSheet.create({
  list: { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { textAlign: 'center', color: '#888', marginTop: 60 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 1 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name: { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  meta: { color: '#888', fontSize: 13, marginTop: 2 },
  badge: { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  // My tournaments section
  section: { marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  myCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 10, elevation: 1 },
  myCardHead: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  myCardName: { fontSize: 15, fontWeight: '700', marginBottom: 4 },
  statusBadge: { alignSelf: 'flex-start', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  reviewBtn: { backgroundColor: '#1a1a2e', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  reviewBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  reviewNote: { color: '#a33', fontSize: 13, marginBottom: 8, lineHeight: 18 },
  segCount: { color: '#888', fontSize: 12, marginBottom: 8 },
  segRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#f4f4f4' },
  segNum: { color: '#bbb', fontWeight: '700', fontSize: 12, width: 26 },
  segName: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  segRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  star: { color: '#c97c00', fontSize: 13 },
  segDist: { color: '#888', fontSize: 12 },
  muted: { color: '#888', fontSize: 13 },
  addToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginTop: 10 },
  addToggleText: { color: '#1a1a2e', fontWeight: '600', fontSize: 14 },
  availSeg: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#f4f4f4', marginTop: 4 },
  availSegName: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  availSegDist: { color: '#888', fontSize: 12, marginRight: 8 },
  addIcon: { color: '#1a1a2e', fontSize: 18, fontWeight: '700' }
});

export default TournamentsScreen;
