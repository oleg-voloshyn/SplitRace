import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronDown, ChevronUp, Plus, Star, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';

function EditTournamentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { slug } = useRoute().params;
  const [tournament, setTournament] = useState(null);
  const [mySegments, setMySegments] = useState([]);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t1, segs] = await Promise.all([api.tournament(slug), api.mySegments()]);
      setTournament(t1);
      setMySegments(segs);
      setForm({
        name: t1.name || '',
        description: stripTags(t1.description) || '',
        total_segments_count: String(t1.total_segments_count ?? ''),
        rated_segments_count: String(t1.rated_segments_count ?? '')
      });
      navigation.setOptions({ title: t1.name });
    } catch {
      Alert.alert(t('common.error'), t('creator.failed'));
    }
  }, [slug, navigation, t]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!tournament || !form) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color="#e53935" />
      </View>
    );
  }

  const isEditable = tournament.status === 'draft' || tournament.status === 'rejected';
  const sortedSegments = [...(tournament.segments || [])].sort((a, b) => a.order_number - b.order_number);
  const available = mySegments.filter((seg) => !tournament.segments?.some((ts) => ts.segment.id === seg.id));

  function setField(key) {
    return (value) => setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveChanges() {
    setSaving(true);
    try {
      const updated = await api.updateTournament(slug, {
        name: form.name.trim(),
        description: form.description.trim(),
        total_segments_count: form.total_segments_count,
        rated_segments_count: form.rated_segments_count
      });
      setTournament(updated);
      Alert.alert(t('creator.title'), t('creator.tournamentUpdated'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.errors?.join(', ') || error?.error || t('creator.failed'));
    } finally {
      setSaving(false);
    }
  }

  async function addSegment(segment) {
    try {
      const updated = await api.addTournamentSegment(slug, {
        segment_id: segment.id,
        order_number: String((tournament.segments?.length || 0) + 1),
        is_rated: '0'
      });
      setTournament(updated);
      setShowAdd(false);
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function removeSegment(segmentId) {
    try {
      const updated = await api.removeTournamentSegment(slug, segmentId);
      setTournament(updated);
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function submitForReview() {
    setSubmitting(true);
    try {
      const updated = await api.submitTournamentForReview(slug);
      setTournament(updated);
      Alert.alert(t('creator.title'), t('creator.submitted'));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || t('creator.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView className="flex-1 bg-gray-100" contentContainerClassName="p-4 pb-10">
      <View className="self-start rounded px-2 py-0.5 mb-3" style={{ backgroundColor: statusBg(tournament.status) }}>
        <Text className="text-[10px] font-bold tracking-wider" style={{ color: statusFg(tournament.status) }}>
          {t(`creator.status_${tournament.status}`).toUpperCase()}
        </Text>
      </View>

      {tournament.review_note ? (
        <Text className="text-red-700 text-[13px] mb-3 leading-[18px]">{tournament.review_note}</Text>
      ) : null}

      {!isEditable && (
        <View className="bg-amber-100 rounded-lg p-3 mb-4">
          <Text className="text-amber-900 text-[13px]">{t('creator.tournamentUpdated')}</Text>
        </View>
      )}

      <View className="bg-white rounded-xl p-4 mb-4">
        <Text className="text-xs text-gray-500 mb-1.5">{t('creator.tournamentName')}</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 text-[15px] bg-white"
          value={form.name}
          onChangeText={setField('name')}
          editable={isEditable}
          maxLength={120}
        />

        <Text className="text-xs text-gray-500 mt-3 mb-1.5">{t('creator.tournamentDescription')}</Text>
        <TextInput
          className="border border-gray-300 rounded-lg p-3 text-[15px] bg-white min-h-[100px]"
          value={form.description}
          onChangeText={setField('description')}
          editable={isEditable}
          multiline
          textAlignVertical="top"
          maxLength={10000}
        />

        <View className="flex-row gap-3 mt-3">
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1.5">{t('creator.totalSegments')}</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 text-[15px] bg-white"
              value={form.total_segments_count}
              onChangeText={(v) => setField('total_segments_count')(v.replace(/[^0-9]/g, ''))}
              editable={isEditable}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
          <View className="flex-1">
            <Text className="text-xs text-gray-500 mb-1.5">{t('creator.ratedSegments')}</Text>
            <TextInput
              className="border border-gray-300 rounded-lg p-3 text-[15px] bg-white"
              value={form.rated_segments_count}
              onChangeText={(v) => setField('rated_segments_count')(v.replace(/[^0-9]/g, ''))}
              editable={isEditable}
              keyboardType="numeric"
              maxLength={3}
            />
          </View>
        </View>

        {isEditable && (
          <TouchableOpacity
            className={`mt-4 bg-brand-navy rounded-lg p-3 items-center ${saving ? 'opacity-60' : ''}`}
            onPress={saveChanges}
            disabled={saving}
          >
            <Text className="text-white font-bold">{saving ? '...' : t('creator.saveChanges')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="bg-white rounded-xl p-4 mb-4">
        <Text className="text-base font-bold mb-2">
          {t('creator.tournamentSegments')} ({sortedSegments.length}/{tournament.total_segments_count})
        </Text>

        {sortedSegments.length === 0 ? (
          <Text className="text-gray-500 text-[13px]">{t('creator.noSegmentsAdded')}</Text>
        ) : (
          sortedSegments.map((ts) => (
            <View key={ts.segment.id} className="flex-row items-center py-2 border-b border-gray-100">
              <Text className="text-gray-300 font-bold text-xs w-[26px]">#{ts.order_number}</Text>
              <View className="flex-1">
                <Text className="text-sm text-brand-navy">{ts.segment.name}</Text>
                {ts.segment.distance_meters != null ? (
                  <Text className="text-xs text-gray-500 mt-0.5">
                    {(ts.segment.distance_meters / 1000).toFixed(2)} km
                  </Text>
                ) : null}
              </View>
              {ts.is_rated ? <Star size={14} color="#c97c00" fill="#c97c00" /> : null}
              {isEditable && (
                <TouchableOpacity
                  onPress={() => removeSegment(ts.segment.id)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  className="ml-2 p-1"
                >
                  <Trash2 size={16} color="#dc2626" />
                </TouchableOpacity>
              )}
            </View>
          ))
        )}

        {isEditable && (
          <>
            <TouchableOpacity
              className="flex-row items-center justify-center gap-1.5 border border-gray-300 rounded-lg p-2.5 mt-3"
              onPress={() => setShowAdd((v) => !v)}
            >
              {showAdd ? <ChevronUp size={16} color="#1a1a2e" /> : <ChevronDown size={16} color="#1a1a2e" />}
              <Text className="text-brand-navy font-semibold text-sm">
                {showAdd ? t('creator.cancelAdd') : t('creator.addSegmentToTournament')}
              </Text>
            </TouchableOpacity>
            {showAdd &&
              (available.length === 0 ? (
                <Text className="text-gray-500 text-[13px] mt-2">{t('creator.noSegments')}</Text>
              ) : (
                available.map((seg) => (
                  <TouchableOpacity
                    key={seg.id}
                    className="flex-row items-center py-2.5 px-1 border-b border-gray-100 mt-1"
                    onPress={() => addSegment(seg)}
                  >
                    <Text className="flex-1 text-sm text-brand-navy">{seg.name}</Text>
                    {seg.distance_meters != null ? (
                      <Text className="text-gray-500 text-xs mr-2">{(seg.distance_meters / 1000).toFixed(2)} km</Text>
                    ) : null}
                    <Plus size={18} color="#1a1a2e" strokeWidth={2.4} />
                  </TouchableOpacity>
                ))
              ))}
          </>
        )}
      </View>

      {isEditable && (
        <TouchableOpacity
          className={`bg-brand-red rounded-lg p-3.5 items-center ${submitting ? 'opacity-60' : ''}`}
          onPress={submitForReview}
          disabled={submitting}
        >
          <Text className="text-white font-bold text-base">{submitting ? '...' : t('creator.submitReview')}</Text>
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

function stripTags(html) {
  if (!html) {
    return '';
  }
  return html.replace(/<[^>]*>/g, '').trim();
}

export default EditTournamentScreen;
