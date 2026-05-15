import { useEffect, useState } from 'react';
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

const initialTournament = {
  name: '',
  city: '',
  country: '',
  total_segments_count: '2',
  rated_segments_count: '1'
};

function CreatorScreen() {
  const { t } = useTranslation();
  const [segments, setSegments] = useState([]);
  const [tournaments, setTournaments] = useState([]);
  const [segmentForm, setSegmentForm] = useState(initialSegment);
  const [tournamentForm, setTournamentForm] = useState(initialTournament);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    refresh();
    Location.getLastKnownPositionAsync()
      .then((pos) => {
        if (pos) {
          setUserLocation([pos.coords.latitude, pos.coords.longitude]);
        }
      })
      .catch(() => {});
  }, []);

  async function refresh() {
    const [mySegments, myTournaments] = await Promise.all([api.mySegments(), api.myTournaments()]);
    setSegments(mySegments);
    setTournaments(myTournaments);
  }

  async function createSegment() {
    if (segmentForm.points.length < 2) {
      Alert.alert(t('common.error'), t('creator.routeRequired'));
      return;
    }
    try {
      await api.createSegment(segmentForm);
      setSegmentForm(initialSegment);
      await refresh();
      Alert.alert(t('creator.title'), t('creator.segmentCreated'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function handlePointsChange(points) {
    setSegmentForm((current) => {
      const next = { ...current, points };
      if (current.points.length === 0 && points.length === 1) {
        reverseGeocode(points[0].lat, points[0].lng).then((location) => {
          if (location.city || location.country) {
            setSegmentForm((f) => ({ ...f, ...location }));
          }
        });
      }
      return next;
    });
  }

  async function createTournament() {
    try {
      await api.createTournament(tournamentForm);
      setTournamentForm(initialTournament);
      await refresh();
      Alert.alert(t('creator.title'), t('creator.tournamentCreated'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function addSegment(tournament, segment) {
    try {
      await api.addTournamentSegment(tournament.slug, {
        segment_id: segment.id,
        order_number: (tournament.segments?.length || 0) + 1,
        is_rated: '1'
      });
      await refresh();
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function submitForReview(tournament) {
    try {
      await api.submitTournamentForReview(tournament.slug);
      await refresh();
      Alert.alert(t('creator.title'), t('creator.submitted'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || t('creator.failed'));
    }
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <CreatorForm title={t('creator.newSegment')} action={t('creator.createSegment')} onSubmit={createSegment}>
        <CreatorInput label={t('creator.segmentName')} value={segmentForm.name} onChangeText={setSegment('name')} />
        <Text style={s.mapHint}>{t('creator.mapHint')}</Text>
        <SegmentMapPicker
          points={segmentForm.points}
          onPointsChange={handlePointsChange}
          initialCenter={userLocation}
          hint={t('creator.routePoints', { count: segmentForm.points.length })}
          undoLabel={t('creator.undoPoint')}
          clearLabel={t('creator.clearRoute')}
        />
        <View style={s.routeMeta}>
          <Text style={s.metaText}>
            {t('creator.distance')}: <Text style={s.metaBold}>{formatDistance(routeDistance(segmentForm.points))}</Text>
          </Text>
          {segmentForm.city || segmentForm.country ? (
            <Text style={s.metaText}>
              📍 <Text style={s.metaBold}>{[segmentForm.city, segmentForm.country].filter(Boolean).join(', ')}</Text>
            </Text>
          ) : null}
        </View>
      </CreatorForm>

      <CreatorForm
        title={t('creator.newTournament')}
        action={t('creator.createTournament')}
        onSubmit={createTournament}
      >
        <CreatorInput
          label={t('creator.tournamentName')}
          value={tournamentForm.name}
          onChangeText={setTournament('name')}
        />
        <CreatorInput label={t('creator.city')} value={tournamentForm.city} onChangeText={setTournament('city')} />
        <CreatorInput
          label={t('creator.country')}
          value={tournamentForm.country}
          onChangeText={setTournament('country')}
        />
        <View style={s.grid}>
          <CreatorInput
            label={t('creator.totalSegments')}
            value={tournamentForm.total_segments_count}
            onChangeText={setTournament('total_segments_count')}
          />
          <CreatorInput
            label={t('creator.ratedSegments')}
            value={tournamentForm.rated_segments_count}
            onChangeText={setTournament('rated_segments_count')}
          />
        </View>
      </CreatorForm>

      <Text style={s.sectionTitle}>{t('creator.myTournaments')}</Text>
      {tournaments.map((tournament) => (
        <View key={tournament.id} style={s.card}>
          <Text style={s.cardTitle}>{tournament.name}</Text>
          <Text style={s.muted}>{t(`creator.status_${tournament.status}`)}</Text>
          <Text style={s.muted}>
            {tournament.segments?.length || 0}/{tournament.total_segments_count} {t('creator.segments')}
          </Text>
          <Text style={s.label}>{t('creator.addSegment')}</Text>
          {segments
            .filter((candidate) => !tournament.segments?.some((entry) => entry.segment.id === candidate.id))
            .map((segment) => (
              <TouchableOpacity
                key={segment.id}
                style={s.segmentChoice}
                onPress={() => addSegment(tournament, segment)}
              >
                <Text style={s.segmentChoiceText}>{segment.name}</Text>
              </TouchableOpacity>
            ))}
          {segments.length === 0 && <Text style={s.muted}>{t('creator.noSegments')}</Text>}
          <TouchableOpacity style={s.primaryBtn} onPress={() => submitForReview(tournament)}>
            <Text style={s.primaryBtnText}>{t('creator.submitReview')}</Text>
          </TouchableOpacity>
        </View>
      ))}
    </ScrollView>
  );

  function setSegment(key) {
    return (value) => setSegmentForm((current) => ({ ...current, [key]: value }));
  }

  function setTournament(key) {
    return (value) => setTournamentForm((current) => ({ ...current, [key]: value }));
  }
}

function CreatorForm({ title, action, onSubmit, children }) {
  return (
    <View style={s.card}>
      <Text style={s.cardTitle}>{title}</Text>
      {children}
      <TouchableOpacity style={s.primaryBtn} onPress={onSubmit}>
        <Text style={s.primaryBtnText}>{action}</Text>
      </TouchableOpacity>
    </View>
  );
}

function CreatorInput({ label, value, onChangeText }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChangeText} />
    </View>
  );
}

const s = StyleSheet.create({
  mapHint: { color: '#555', fontSize: 12, marginBottom: 6 },
  routeMeta: { flexDirection: 'row', gap: 12, flexWrap: 'wrap', marginTop: 4, marginBottom: 6 },
  metaText: { color: '#555', fontSize: 12 },
  metaBold: { fontWeight: '700', color: '#1a1a2e' },
  scroll: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 16, paddingBottom: 40 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee'
  },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10, marginTop: 8 },
  field: { marginBottom: 10, flexGrow: 1, flexBasis: '47%' },
  label: { color: '#666', fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fafafa'
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  muted: { color: '#777', fontSize: 13, marginBottom: 4 },
  primaryBtn: { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 12, alignItems: 'center', marginTop: 4, flex: 1 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { borderColor: '#1a1a2e', borderWidth: 1, borderRadius: 8, padding: 12, alignItems: 'center', flex: 1 },
  secondaryBtnText: { color: '#1a1a2e', fontWeight: '700' },
  segmentChoice: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8 },
  segmentChoiceText: { color: '#1a1a2e', fontWeight: '600' }
});

export default CreatorScreen;
