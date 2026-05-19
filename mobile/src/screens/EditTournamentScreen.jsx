import { useCallback, useState } from 'react';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { ChevronDown, ChevronUp, Plus, Star, Trash2 } from 'lucide-react-native';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import {
  useAddTournamentSegment,
  useDeleteTournament,
  useMySegments,
  useRemoveTournamentSegment,
  useSubmitTournamentForReview,
  useTournament,
  useUpdateTournament
} from '../api/queries';
import SegmentPreviewModal from '../components/SegmentPreviewModal';
import FormTextInput from '../components/form/FormTextInput';

function EditTournamentScreen() {
  const { slug } = useRoute().params;
  const { data: tournament, refetch: refetchTournament } = useTournament(slug);
  const { refetch: refetchSegments } = useMySegments();

  useFocusEffect(
    useCallback(() => {
      refetchTournament();
      refetchSegments();
    }, [refetchTournament, refetchSegments])
  );

  if (!tournament) {
    return (
      <View className="flex-1 items-center justify-center bg-gray-100">
        <ActivityIndicator color="#e53935" />
      </View>
    );
  }

  // Re-mount the body when navigating to a different tournament so RHF
  // re-seeds its defaultValues from the new record.
  return <EditTournamentBody key={tournament.id} tournament={tournament} slug={slug} />;
}

function EditTournamentBody({ tournament, slug }) {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { data: mySegments = [] } = useMySegments();
  const updateMutation = useUpdateTournament(slug);
  const deleteMutation = useDeleteTournament();
  const addSegmentMutation = useAddTournamentSegment();
  const removeSegmentMutation = useRemoveTournamentSegment(slug);
  const submitMutation = useSubmitTournamentForReview(slug);
  const [showAdd, setShowAdd] = useState(false);
  const [previewSegment, setPreviewSegment] = useState(null);

  const { control, handleSubmit } = useForm({
    defaultValues: {
      name: tournament.name || '',
      description: stripTags(tournament.description) || '',
      total_segments_count: String(tournament.total_segments_count ?? ''),
      rated_segments_count: String(tournament.rated_segments_count ?? '')
    }
  });

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({ title: tournament.name });
    }, [navigation, tournament.name])
  );

  const isEditable = tournament.status === 'draft' || tournament.status === 'rejected';
  const isDraft = tournament.status === 'draft';
  const sortedSegments = [...(tournament.segments || [])].sort((a, b) => a.order_number - b.order_number);
  const ratedOrder = sortedSegments
    .filter((ts) => ts.is_rated)
    .reduce((acc, ts, i) => ({ ...acc, [ts.segment.id]: i + 1 }), {});
  const available = mySegments.filter((seg) => !tournament.segments?.some((ts) => ts.segment.id === seg.id));

  const onSave = handleSubmit(async (values) => {
    try {
      await updateMutation.mutateAsync({
        name: values.name.trim(),
        description: values.description.trim(),
        total_segments_count: values.total_segments_count,
        rated_segments_count: values.rated_segments_count
      });
      Alert.alert(t('creator.title'), t('creator.tournamentUpdated'));
    } catch (error) {
      Alert.alert(t('common.error'), error?.errors?.join(', ') || error?.error || t('creator.failed'));
    }
  });

  async function addSegment(segment) {
    try {
      await addSegmentMutation.mutateAsync({
        slug,
        segment_id: segment.id,
        order_number: String((tournament.segments?.length || 0) + 1),
        is_rated: '0'
      });
      setShowAdd(false);
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  async function removeSegment(segmentId) {
    try {
      await removeSegmentMutation.mutateAsync(segmentId);
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || error?.errors?.join(', ') || t('creator.failed'));
    }
  }

  function confirmDelete() {
    Alert.alert(t('creator.deleteTournamentConfirm'), t('creator.deleteTournamentConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('creator.delete'), style: 'destructive', onPress: deleteTournament }
    ]);
  }

  async function deleteTournament() {
    try {
      await deleteMutation.mutateAsync(slug);
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || t('creator.failed'));
    }
  }

  async function submitForReview() {
    try {
      await submitMutation.mutateAsync();
      Alert.alert(t('creator.title'), t('creator.submitted'));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), error?.error || t('creator.failed'));
    }
  }

  const digitsOnly = (v) => v.replace(/[^0-9]/g, '');

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
        <FormTextInput
          control={control}
          name="name"
          label={t('creator.tournamentName')}
          editable={isEditable}
          maxLength={120}
        />

        <View className="mt-3">
          <FormTextInput
            control={control}
            name="description"
            label={t('creator.tournamentDescription')}
            editable={isEditable}
            multiline
            textAlignVertical="top"
            maxLength={10000}
            className="border border-gray-300 rounded-lg p-3 text-[15px] bg-white min-h-[100px]"
          />
        </View>

        <View className="flex-row gap-3 mt-3">
          <View className="flex-1">
            <FormTextInput
              control={control}
              name="total_segments_count"
              label={t('creator.totalSegments')}
              editable={isEditable}
              keyboardType="numeric"
              maxLength={3}
              transform={digitsOnly}
            />
          </View>
          <View className="flex-1">
            <FormTextInput
              control={control}
              name="rated_segments_count"
              label={t('creator.ratedSegments')}
              editable={isEditable}
              keyboardType="numeric"
              maxLength={3}
              transform={digitsOnly}
            />
          </View>
        </View>

        {isEditable && (
          <TouchableOpacity
            className={`mt-4 bg-brand-navy rounded-lg p-3 items-center ${updateMutation.isPending ? 'opacity-60' : ''}`}
            onPress={onSave}
            disabled={updateMutation.isPending}
          >
            <Text className="text-white font-bold">{updateMutation.isPending ? '...' : t('creator.saveChanges')}</Text>
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
          sortedSegments.map((ts) => {
            const ratedPosition = ratedOrder[ts.segment.id];
            return (
              <View key={ts.segment.id} className="flex-row items-center py-2 border-b border-gray-100">
                <Text className="text-gray-300 font-bold text-xs w-[26px]">#{ts.order_number}</Text>
                <TouchableOpacity onPress={() => setPreviewSegment(ts.segment)} activeOpacity={0.7} className="flex-1">
                  <Text className="text-sm text-brand-navy underline-offset-2">{ts.segment.name}</Text>
                  {ts.segment.distance_meters != null ? (
                    <Text className="text-xs text-gray-500 mt-0.5">
                      {(ts.segment.distance_meters / 1000).toFixed(2)} km
                    </Text>
                  ) : null}
                </TouchableOpacity>
                {ts.is_rated ? (
                  <View className="flex-row items-center mr-1">
                    {ratedPosition != null ? (
                      <Text className="text-amber-700 font-extrabold text-xs mr-1">#{ratedPosition}</Text>
                    ) : null}
                    <Star size={14} color="#c97c00" fill="#c97c00" />
                  </View>
                ) : null}
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
            );
          })
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
          className={`bg-brand-red rounded-lg p-3.5 items-center ${submitMutation.isPending ? 'opacity-60' : ''}`}
          onPress={submitForReview}
          disabled={submitMutation.isPending}
        >
          <Text className="text-white font-bold text-base">
            {submitMutation.isPending ? '...' : t('creator.submitReview')}
          </Text>
        </TouchableOpacity>
      )}

      {isDraft && (
        <TouchableOpacity
          className={`mt-3 flex-row items-center justify-center gap-2 rounded-lg p-3 border border-red-300 bg-white ${
            deleteMutation.isPending ? 'opacity-60' : ''
          }`}
          onPress={confirmDelete}
          disabled={deleteMutation.isPending}
        >
          <Trash2 size={16} color="#dc2626" />
          <Text className="text-red-700 font-bold">
            {deleteMutation.isPending ? '...' : t('creator.deleteTournament')}
          </Text>
        </TouchableOpacity>
      )}

      <SegmentPreviewModal
        segment={previewSegment}
        visible={Boolean(previewSegment)}
        onClose={() => setPreviewSegment(null)}
      />
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
