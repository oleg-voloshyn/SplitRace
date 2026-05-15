import { useCallback, useEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { api } from '../api/client';

function CreatorTournamentScreen() {
  const { t } = useTranslation();
  const { slug } = useRoute().params;
  const navigation = useNavigation();
  const [tournament, setTournament] = useState(null);
  const [mySegments, setMySegments] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, segs] = await Promise.all([api.tournament(slug), api.mySegments()]);
      setTournament(data);
      navigation.setOptions({ title: data.name });
      setMySegments(segs);
    } catch {
      Alert.alert(t('common.error'), t('creator.failed'));
    } finally {
      setLoading(false);
    }
  }, [slug, navigation, t]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAddSegment(segment) {
    const orderNumber = (tournament.segments?.length || 0) + 1;
    try {
      await api.addTournamentSegment(slug, {
        segment_id: segment.id,
        order_number: orderNumber,
        is_rated: '1'
      });
      setShowAdd(false);
      await load();
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function handleSubmitForReview() {
    try {
      await api.submitTournamentForReview(slug);
      await load();
      Alert.alert(t('creator.title'), t('creator.submitted'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || t('creator.failed'));
    }
  }

  if (loading && !tournament) {
    return (
      <View style={s.center}>
        <ActivityIndicator color="#e53935" />
      </View>
    );
  }

  if (!tournament) return null;

  const isEditable = tournament.status === 'draft' || tournament.status === 'rejected';
  const sortedSegments = [...(tournament.segments || [])].sort((a, b) => a.order_number - b.order_number);
  const available = mySegments.filter(
    (seg) => !tournament.segments?.some((ts) => ts.segment.id === seg.id)
  );

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <View style={[s.statusBadge, { backgroundColor: statusBg(tournament.status) }]}>
        <Text style={[s.statusText, { color: statusFg(tournament.status) }]}>
          {t(`creator.status_${tournament.status}`).toUpperCase()}
        </Text>
      </View>

      {tournament.review_note ? <Text style={s.reviewNote}>{tournament.review_note}</Text> : null}

      <Text style={s.segCount}>
        {sortedSegments.length} / {tournament.total_segments_count} {t('creator.segments')}
      </Text>

      <View style={s.card}>
        <Text style={s.cardTitle}>{t('creator.tournamentSegments')}</Text>
        {sortedSegments.length === 0 ? (
          <Text style={s.muted}>{t('creator.noSegmentsAdded')}</Text>
        ) : (
          sortedSegments.map((ts) => (
            <View key={ts.segment.id} style={s.segItem}>
              <Text style={s.segNum}>#{ts.order_number}</Text>
              <Text style={s.segName}>{ts.segment.name}</Text>
              <View style={s.segRight}>
                {ts.is_rated ? <Text style={s.ratedStar}>★</Text> : null}
                {ts.segment.distance_meters != null ? (
                  <Text style={s.segDist}>{(ts.segment.distance_meters / 1000).toFixed(2)} km</Text>
                ) : null}
              </View>
            </View>
          ))
        )}
      </View>

      {isEditable && (
        <View style={s.card}>
          <TouchableOpacity style={s.addToggle} onPress={() => setShowAdd(!showAdd)}>
            <Text style={s.addToggleText}>
              {showAdd ? t('creator.cancelAdd') : t('creator.addSegmentBtn')}
            </Text>
          </TouchableOpacity>
          {showAdd &&
            (available.length === 0 ? (
              <Text style={s.muted}>{t('creator.noSegments')}</Text>
            ) : (
              available.map((seg) => (
                <TouchableOpacity key={seg.id} style={s.availSeg} onPress={() => handleAddSegment(seg)}>
                  <Text style={s.availSegName}>{seg.name}</Text>
                  <Text style={s.addIcon}>＋</Text>
                </TouchableOpacity>
              ))
            ))}
        </View>
      )}

      {isEditable && (
        <TouchableOpacity style={s.submitBtn} onPress={handleSubmitForReview}>
          <Text style={s.submitBtnText}>{t('creator.submitReview')}</Text>
        </TouchableOpacity>
      )}
    </ScrollView>
  );
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
  scroll: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 10
  },
  statusText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5 },
  reviewNote: { color: '#a33', fontSize: 13, marginBottom: 12, lineHeight: 18 },
  segCount: { color: '#666', fontSize: 13, marginBottom: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee'
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  segItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f4'
  },
  segNum: { color: '#bbb', fontWeight: '700', fontSize: 12, width: 28 },
  segName: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  segRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ratedStar: { color: '#c97c00', fontSize: 13 },
  segDist: { color: '#888', fontSize: 12 },
  muted: { color: '#888', fontSize: 13 },
  addToggle: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    alignItems: 'center'
  },
  addToggleText: { color: '#1a1a2e', fontWeight: '600', fontSize: 14 },
  availSeg: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f4f4f4',
    marginTop: 8
  },
  availSegName: { flex: 1, fontSize: 14, color: '#1a1a2e' },
  addIcon: { color: '#1a1a2e', fontSize: 18, fontWeight: '700' },
  submitBtn: {
    backgroundColor: '#1a1a2e',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center'
  },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 }
});

export default CreatorTournamentScreen;
