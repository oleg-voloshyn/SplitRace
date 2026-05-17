import { useEffect, useRef, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Check, Flag, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { WEB_URL, api } from '../api/client';
import EntityShareCard from '../components/EntityShareCard';
import RichDescription from '../components/RichDescription';
import { RUN_SHARE_FORMATS } from '../components/RunShareCard';
import SegmentsMap from '../components/SegmentsMap';
import ShareFormatModal from '../components/ShareFormatModal';
import { useAuth } from '../contexts/AuthContext';
import { shareEntityImage, shareEntityLink } from '../utils/entityShare';

function TournamentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { slug } = useRoute().params;
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [board, setBoard] = useState(null);
  const [tab, setTab] = useState('info');
  const [joining, setJoining] = useState(false);
  const [reportTarget, setReportTarget] = useState(null);
  const [pendingShare, setPendingShare] = useState(null);
  const [shareTarget, setShareTarget] = useState(null); // { kind: 'tournament' | 'segment', entity }
  const shareCardRef = useRef(null);

  useEffect(() => {
    api
      .tournament(slug)
      .then(setData)
      .catch(() => {});
    api
      .leaderboard(slug)
      .then(setBoard)
      .catch(() => {});
  }, [slug]);

  useEffect(() => {
    if (data?.name) {
      navigation.setOptions({ title: data.name });
    }
  }, [data?.name, navigation]);

  useEffect(() => {
    if (!pendingShare) {
      return;
    }

    const timeout = setTimeout(() => {
      shareEntityImage(shareCardRef, pendingShare).finally(() => setPendingShare(null));
    }, 60);

    return () => clearTimeout(timeout);
  }, [pendingShare]);

  async function join() {
    setJoining(true);
    try {
      await api.joinTournament(slug);
      const updated = await api.tournament(slug);
      setData(updated);
    } catch (e) {
      Alert.alert(t('common.error'), e?.error || t('tournaments.couldNotJoin'));
    } finally {
      setJoining(false);
    }
  }

  function shareTournamentLink() {
    const url = `${WEB_URL}/tournaments/${data.slug}`;
    shareEntityLink({
      title: data.name,
      message: t('tournaments.shareText', { name: data.name }),
      url
    });
  }

  async function shareTournamentImage(format) {
    const url = `${WEB_URL}/tournaments/${data.slug}`;
    // `data.segments` already includes polyline coords for the tournament view.
    const polylines = (data.segments ?? [])
      .map((ts) => ts.segment?.polyline)
      .filter((line) => Array.isArray(line) && line.length >= 2);
    setPendingShare({
      format,
      entity: data,
      kind: 'tournament',
      title: data.name,
      message: t('tournaments.shareText', { name: data.name }),
      url,
      polylines,
      dialogTitle: t('tournaments.shareTournament'),
      stats: [
        {
          label: t('tournaments.participantsLabel'),
          value: String(data.participants_count ?? 0)
        },
        { label: t('tournaments.segments'), value: String(data.total_segments_count ?? data.segments?.length ?? 0) },
        { label: t('tournaments.active'), value: t(`tournaments.${data.status}`) }
      ]
    });
  }

  async function shareSegmentImage(segment, format) {
    const url = `${WEB_URL}/segments/${segment.id}`;
    // The list-view segment object doesn't include polyline — pull the
    // detailed payload so the share card can render the actual route.
    let polylines = [];
    try {
      const detailed = await api.segment(segment.id);
      if (Array.isArray(detailed?.polyline) && detailed.polyline.length >= 2) {
        polylines = [detailed.polyline];
      }
    } catch {
      // Network error — fall back to icon hero.
    }
    setPendingShare({
      format,
      entity: segment,
      kind: 'segment',
      title: segment.name,
      message: t('tournaments.shareText', { name: segment.name }),
      url,
      polylines,
      dialogTitle: t('tournaments.shareSegment'),
      stats: [
        {
          label: t('tournaments.distance'),
          value: segment.distance_meters ? `${(segment.distance_meters / 1000).toFixed(2)} km` : '-'
        },
        { label: t('tournaments.location'), value: [segment.city, segment.country].filter(Boolean).join(', ') || '-' }
      ]
    });
  }

  function openShareModal(kind, entity) {
    setShareTarget({ kind, entity });
  }

  function handleShareFormatSelected(format) {
    const target = shareTarget;
    setShareTarget(null);
    if (!target) {
      return;
    }
    if (target.kind === 'segment') {
      shareSegmentImage(target.entity, format);
    } else {
      shareTournamentImage(format);
    }
  }

  if (!data) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#e53935" />
      </View>
    );
  }

  const isParticipant = data.is_participating;
  const canJoin = data.status === 'active' && data.can_participate !== false && !isParticipant;
  const visibleSegments = segmentsForDisplay(data.segments ?? []);

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row bg-white border-b border-gray-200">
        {['info', 'segments', 'leaderboard'].map((key) => (
          <TouchableOpacity
            key={key}
            className={`flex-1 py-3.5 items-center ${tab === key ? 'border-b-2 border-brand-red' : ''}`}
            onPress={() => setTab(key)}
          >
            <Text className={`text-sm ${tab === key ? 'text-brand-red font-semibold' : 'text-gray-500'}`}>
              {key === 'info'
                ? t('tournaments.info')
                : key === 'segments'
                  ? t('tournaments.segmentsTab')
                  : t('tournaments.leaderboard')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'info' && (
        <ScrollView className="flex-1" contentContainerClassName="p-4 pb-8">
          <View className="self-start rounded px-2 py-1 mb-3" style={{ backgroundColor: badgeColor(data.status) }}>
            <Text className="text-white text-[11px] font-bold">{t(`tournaments.${data.status}`).toUpperCase()}</Text>
          </View>
          <RichDescription html={data.description} className="mb-3" />
          <View className="mb-3">
            <Text className="text-gray-500 text-sm mb-1">
              {t('tournaments.participants', { count: data.participants_count ?? 0 })}
            </Text>
            {data.starts_at && (
              <Text className="text-gray-500 text-sm mb-1">
                {t('tournaments.starts')}: {new Date(data.starts_at).toLocaleDateString()}
              </Text>
            )}
            {data.ends_at && (
              <Text className="text-gray-500 text-sm mb-1">
                {t('tournaments.ends')}: {new Date(data.ends_at).toLocaleDateString()}
              </Text>
            )}
          </View>
          {canJoin && (
            <TouchableOpacity
              className="bg-brand-red rounded-lg p-3.5 items-center mt-5"
              onPress={join}
              disabled={joining}
            >
              <Text className="text-white font-bold text-base">{joining ? '...' : t('tournaments.join')}</Text>
            </TouchableOpacity>
          )}
          {isParticipant && (
            <View className="bg-green-100 rounded-lg p-3 mt-5 flex-row items-center justify-center gap-1.5">
              <Check size={16} color="#2e7d32" strokeWidth={2.5} />
              <Text className="text-green-800 font-semibold">{t('tournaments.youParticipate')}</Text>
            </View>
          )}
          <View className="flex-row gap-2 mt-3 mb-3">
            <TouchableOpacity
              className="flex-row items-center gap-1.5 border border-gray-300 rounded-lg py-2.5 px-3 bg-white"
              onPress={shareTournamentLink}
            >
              <Text className="text-brand-navy font-bold text-sm">{t('tournaments.shareLink')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center gap-1.5 bg-brand-red rounded-lg py-2.5 px-3"
              onPress={() => openShareModal('tournament', data)}
            >
              <Share2 size={16} color="#fff" />
              <Text className="text-white font-bold text-sm">{t('tournaments.share')}</Text>
            </TouchableOpacity>
          </View>
          {data.feed?.length > 0 && (
            <View className="bg-white rounded-xl p-3 mb-3">
              <Text className="text-base font-bold mb-2">{t('tournaments.feed')}</Text>
              {data.feed.map((event) => (
                <View key={event.id} className="border-b border-gray-100 py-2">
                  <Text className="font-bold text-brand-navy">{event.title}</Text>
                  {event.body && <Text className="text-gray-700 text-[13px] mt-0.5">{event.body}</Text>}
                  <Text className="text-gray-500 text-[11px] mt-1">{new Date(event.created_at).toLocaleString()}</Text>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      )}

      {tab === 'segments' && (
        <ScrollView className="flex-1">
          <SegmentsMap segments={data.segments ?? []} style={{ height: 280 }} />
          <View className="p-3 pb-8">
            {visibleSegments.length === 0 ? (
              <Text className="text-center text-gray-500 mt-16">{t('tournaments.noSegments')}</Text>
            ) : (
              visibleSegments.map((ts, i) => (
                <View key={ts.segment.id} className="bg-white rounded-xl p-3 mb-2">
                  <View className="flex-row items-center gap-2.5">
                    <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: segColor(i) }} />
                    <View className="flex-1">
                      <Text className="text-sm font-semibold text-brand-navy mb-0.5">{ts.segment.name}</Text>
                      {ts.segment.city || ts.segment.country ? (
                        <Text className="text-xs text-gray-500">
                          {[ts.segment.city, ts.segment.country].filter(Boolean).join(', ')}
                        </Text>
                      ) : null}
                    </View>
                    <View className="items-end">
                      {ts.segment.distance_meters != null ? (
                        <Text className="text-xs text-gray-700">
                          {(ts.segment.distance_meters / 1000).toFixed(2)} km
                        </Text>
                      ) : null}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => openShareModal('segment', ts.segment)}
                    className="flex-row items-center gap-1.5 self-start mt-2.5 bg-white border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <Share2 size={14} color="#1a1a2e" />
                    <Text className="text-brand-navy font-bold text-[13px]">{t('tournaments.share')}</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {tab === 'leaderboard' && (
        <FlatList
          className="flex-1"
          data={board ?? []}
          keyExtractor={(r) => String(r.user?.id ?? Math.random())}
          ListEmptyComponent={<Text className="text-center text-gray-500 mt-16">{t('tournaments.noResults')}</Text>}
          renderItem={({ item: r, index }) => {
            const isMe = r.user?.id === user?.id;
            return (
              <View
                className={`flex-row items-center p-3.5 mx-3 mt-2 rounded-xl ${
                  isMe ? 'bg-amber-50 border border-amber-400' : 'bg-white'
                }`}
              >
                <Text className="w-9 text-gray-500 font-bold">#{r.rank ?? index + 1}</Text>
                <Text className="flex-1 text-[15px]">{r.user?.full_name ?? '—'}</Text>
                <View className="items-end mr-2">
                  <Text className="font-bold text-[15px]">{r.score != null ? `${r.score.toFixed(1)} pts` : '—'}</Text>
                  <Text className="text-gray-500 text-xs">
                    {r.completed_segments ?? 0} {t('tournaments.segments')}
                  </Text>
                </View>
                {!isMe && r.user?.id && (
                  <TouchableOpacity
                    onPress={() => setReportTarget({ user_id: r.user.id, full_name: r.user.full_name })}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    className="p-1 ml-1"
                  >
                    <Flag size={18} color="#bbb" />
                  </TouchableOpacity>
                )}
              </View>
            );
          }}
        />
      )}

      {reportTarget && (
        <ReportModal target={reportTarget} tournamentSlug={slug} onClose={() => setReportTarget(null)} />
      )}

      <ShareFormatModal
        visible={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        onSelect={handleShareFormatSelected}
      />

      {pendingShare && (
        <ViewShot
          ref={shareCardRef}
          options={{ format: 'png', quality: 1 }}
          style={{
            position: 'absolute',
            left: -10000,
            top: 0,
            width: RUN_SHARE_FORMATS[pendingShare.format].width,
            height: RUN_SHARE_FORMATS[pendingShare.format].height
          }}
        >
          <EntityShareCard
            entity={pendingShare.entity}
            kind={pendingShare.kind}
            format={pendingShare.format}
            url={pendingShare.url}
            stats={pendingShare.stats}
            polylines={pendingShare.polylines}
          />
        </ViewShot>
      )}
    </View>
  );
}

function ReportModal({ target, tournamentSlug, onClose }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  async function submit() {
    if (reason.trim().length < 10) {
      setError(t('report.tooShort'));
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await api.reportCheating({
        reported_user_id: target.user_id,
        tournament_slug: tournamentSlug,
        reason
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e?.errors?.join(', ') || t('report.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-center p-5">
        <View className="bg-white rounded-xl p-5">
          {success ? (
            <View className="items-center py-4">
              <Check size={40} color="#4caf50" strokeWidth={2.5} />
              <Text className="text-green-600 font-bold text-base mt-1.5">{t('report.submitted')}</Text>
              <Text className="text-gray-500 text-[13px] mt-1.5">{t('report.reviewNote')}</Text>
            </View>
          ) : (
            <>
              <Text className="text-lg font-bold mb-1.5">{t('report.title')}</Text>
              <Text className="text-gray-600 text-[13px] mb-3.5">
                {t('report.subtitle', { name: target.full_name })}
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={t('report.placeholder')}
                multiline
                numberOfLines={5}
                className="border border-gray-300 rounded-lg p-2.5 text-sm min-h-[100px]"
                textAlignVertical="top"
              />
              {error && <Text className="text-brand-red text-[13px] mt-2">{error}</Text>}
              <View className="flex-row gap-2.5 justify-end mt-4">
                <TouchableOpacity
                  onPress={onClose}
                  disabled={submitting}
                  className="py-2.5 px-4 rounded-md border border-gray-300"
                >
                  <Text className="text-gray-700">{t('report.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={submit}
                  disabled={submitting}
                  className="py-2.5 px-4 rounded-md bg-brand-red"
                >
                  <Text className="text-white font-bold">
                    {submitting ? t('report.submitting') : t('report.submit')}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function badgeColor(status) {
  return status === 'active' ? '#4caf50' : status === 'completed' ? '#9e9e9e' : '#ff9800';
}

const SEG_COLORS = ['#e53935', '#1976d2', '#388e3c', '#f57c00', '#7b1fa2', '#0097a7', '#c2185b', '#5d4037'];
function segColor(index) {
  return SEG_COLORS[index % SEG_COLORS.length];
}

function segmentsForDisplay(segments) {
  const copy = [...segments];
  if (copy.every((ts) => ts.order_number != null)) {
    return copy.sort((a, b) => a.order_number - b.order_number);
  }

  return copy.sort((a, b) => (a.segment?.name || '').localeCompare(b.segment?.name || ''));
}

export default TournamentScreen;
