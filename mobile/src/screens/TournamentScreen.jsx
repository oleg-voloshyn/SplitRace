import { useEffect, useState } from 'react';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Award,
  CalendarDays,
  Check,
  Clock3,
  Flag,
  MapPin,
  Medal,
  Route,
  Share2,
  Target,
  Trophy,
  UserRound,
  Users
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { WEB_URL, api } from '../api/client';
import { useJoinTournament, useLeaderboard, useReportCheating, useTournament } from '../api/queries';
import EntityShareCard from '../components/EntityShareCard';
import RichDescription from '../components/RichDescription';
import SegmentPreviewModal from '../components/SegmentPreviewModal';
import SegmentsMap from '../components/SegmentsMap';
import ShareFormatModal from '../components/ShareFormatModal';
import { useAuth } from '../contexts/AuthContext';
import { useShareCard } from '../hooks/useShareCard';
import { shareEntityImage } from '../utils/entityShare';
import { fmtTime } from '../utils/runUtils';

function TournamentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const { slug } = useRoute().params;
  const { user } = useAuth();
  const { data } = useTournament(slug);
  const joinMutation = useJoinTournament(slug);
  const [tab, setTab] = useState('info');
  const [reportTarget, setReportTarget] = useState(null);
  const [shareTarget, setShareTarget] = useState(null); // { kind: 'tournament' | 'segment', entity }
  const [previewSegment, setPreviewSegment] = useState(null);
  const { share, HiddenCard } = useShareCard({
    renderCard: (payload) => (
      <EntityShareCard
        entity={payload.entity}
        kind={payload.kind}
        format={payload.format}
        url={payload.url}
        stats={payload.stats}
        polylines={payload.polylines}
      />
    ),
    onCapture: (ref, payload) => shareEntityImage(ref, payload)
  });

  const {
    items: board,
    isFetchingNextPage: boardLoadingMore,
    isRefetching: boardRefreshing,
    hasNextPage: boardHasNext,
    fetchNextPage: boardFetchNext,
    refetch: boardRefresh
  } = useLeaderboard(slug);

  useEffect(() => {
    if (data?.name) {
      navigation.setOptions({ title: data.name });
    }
  }, [data?.name, navigation]);

  async function join() {
    try {
      await joinMutation.mutateAsync();
    } catch (e) {
      Alert.alert(t('common.error'), e?.error || t('tournaments.couldNotJoin'));
    }
  }

  async function shareTournamentImage(format) {
    const url = `${WEB_URL}/tournaments/${data.slug}`;
    // `data.segments` already includes polyline coords for the tournament view.
    const polylines = (data.segments ?? [])
      .map((ts) => ts.segment?.polyline)
      .filter((line) => Array.isArray(line) && line.length >= 2);
    share({
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
    share({
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
  const totalSegments = data.total_segments_count ?? data.segments?.length ?? 0;
  const ratedSegments = data.rated_segments_count ?? 0;
  const locationLabel = [data.city, data.country].filter(Boolean).join(', ') || t('tournaments.locationUnknown');

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
          <View className="bg-white rounded-2xl p-4 mb-3">
            <View className="flex-row items-center justify-between mb-4">
              <View className="rounded px-2 py-1" style={{ backgroundColor: badgeColor(data.status) }}>
                <Text className="text-white text-[11px] font-bold">
                  {t(`tournaments.${data.status}`).toUpperCase()}
                </Text>
              </View>
              <TouchableOpacity
                className="flex-row items-center gap-1.5 bg-brand-red rounded-xl py-2.5 px-3"
                onPress={() => openShareModal('tournament', data)}
              >
                <Share2 size={16} color="#fff" />
                <Text className="text-white font-bold text-sm">{t('tournaments.share')}</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap gap-2">
              <TournamentInfoMetric
                icon={<Users size={15} color="#6b7280" />}
                label={t('tournaments.participantsLabel')}
                value={String(data.participants_count ?? 0)}
              />
              <TournamentInfoMetric
                icon={<Route size={15} color="#6b7280" />}
                label={t('tournaments.segmentPlan')}
                value={`${ratedSegments}/${totalSegments}`}
              />
              <TournamentInfoMetric
                icon={<CalendarDays size={15} color="#6b7280" />}
                label={t('tournaments.period')}
                value={formatDateRange(data.starts_at, data.ends_at, t)}
              />
              <TournamentInfoMetric
                icon={<MapPin size={15} color="#6b7280" />}
                label={t('tournaments.location')}
                value={locationLabel}
              />
            </View>
          </View>

          {canJoin && (
            <TouchableOpacity
              className="bg-brand-red rounded-xl p-3.5 items-center mb-3"
              onPress={join}
              disabled={joinMutation.isPending}
            >
              <Text className="text-white font-bold text-base">
                {joinMutation.isPending ? '...' : t('tournaments.join')}
              </Text>
            </TouchableOpacity>
          )}
          {isParticipant && (
            <View className="bg-green-100 rounded-xl p-3 mb-3 flex-row items-center justify-center gap-1.5">
              <Check size={16} color="#2e7d32" strokeWidth={2.5} />
              <Text className="text-green-800 font-semibold">{t('tournaments.youParticipate')}</Text>
            </View>
          )}

          <InfoSection title={t('tournaments.description')}>
            {data.description ? (
              <RichDescription html={data.description} />
            ) : (
              <Text className="text-gray-500 text-sm">{t('tournaments.noDescription')}</Text>
            )}
          </InfoSection>

          <InfoSection title={t('tournaments.organizer')}>
            <View className="flex-row items-center gap-2.5">
              <View className="w-9 h-9 rounded-full bg-gray-100 items-center justify-center">
                <UserRound size={18} color="#6b7280" />
              </View>
              <View className="flex-1">
                <Text className="text-brand-navy font-bold text-sm" numberOfLines={1}>
                  {data.created_by?.display_name ?? '-'}
                </Text>
                <Text className="text-gray-500 text-xs mt-0.5">
                  {data.created_by?.account_type ? t(`auth.account_${data.created_by.account_type}`) : '-'}
                </Text>
              </View>
            </View>
          </InfoSection>

          <View className="bg-white rounded-2xl p-4 mb-3">
            <Text className="text-brand-navy font-extrabold text-base mb-2">{t('tournaments.latestNews')}</Text>
            {data.feed?.length > 0 ? (
              data.feed.slice(0, 3).map((event) => (
                <View key={event.id} className="border-b border-gray-100 py-2">
                  <Text className="font-bold text-brand-navy">{event.title}</Text>
                  {event.body && <Text className="text-gray-700 text-[13px] mt-0.5">{event.body}</Text>}
                  <Text className="text-gray-500 text-[11px] mt-1">{formatDateTime(event.created_at)}</Text>
                </View>
              ))
            ) : (
              <Text className="text-gray-500 text-sm">{t('tournaments.noNews')}</Text>
            )}
          </View>
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
                <TouchableOpacity
                  key={ts.segment.id}
                  activeOpacity={0.85}
                  onPress={() => setPreviewSegment(ts.segment)}
                  className="bg-white rounded-xl p-3 mb-2"
                >
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
                    onPress={(e) => {
                      e.stopPropagation?.();
                      openShareModal('segment', ts.segment);
                    }}
                    className="flex-row items-center gap-1.5 self-start mt-2.5 bg-white border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <Share2 size={14} color="#1a1a2e" />
                    <Text className="text-brand-navy font-bold text-[13px]">{t('tournaments.share')}</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>
      )}

      {tab === 'leaderboard' && (
        <FlatList
          className="flex-1"
          data={board ?? []}
          contentContainerClassName="py-2 pb-8"
          keyExtractor={(r) => String(r.user?.id ?? Math.random())}
          refreshControl={<RefreshControl refreshing={boardRefreshing} onRefresh={boardRefresh} tintColor="#e53935" />}
          onEndReached={() => boardHasNext && boardFetchNext()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={boardLoadingMore ? <ActivityIndicator color="#e53935" className="py-4" /> : null}
          ListEmptyComponent={<Text className="text-center text-gray-500 mt-16">{t('tournaments.noResults')}</Text>}
          renderItem={({ item: r, index }) => {
            const isMe = r.user?.id === user?.id;
            return (
              <LeaderboardCard
                entry={r}
                fallbackRank={index + 1}
                isMe={isMe}
                onReport={() => setReportTarget({ user_id: r.user.id, full_name: r.user.full_name })}
                t={t}
              />
            );
          }}
        />
      )}

      {reportTarget && (
        <ReportModal target={reportTarget} tournamentSlug={slug} onClose={() => setReportTarget(null)} />
      )}

      <SegmentPreviewModal
        segment={previewSegment}
        visible={Boolean(previewSegment)}
        onClose={() => setPreviewSegment(null)}
      />

      <ShareFormatModal
        visible={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        onSelect={handleShareFormatSelected}
      />

      <HiddenCard />
    </View>
  );
}

function ReportModal({ target, tournamentSlug, onClose }) {
  const { t } = useTranslation();
  const reportCheating = useReportCheating();
  const [reason, setReason] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const submitting = reportCheating.isPending;

  async function submit() {
    if (reason.trim().length < 10) {
      setError(t('report.tooShort'));
      return;
    }
    setError(null);
    try {
      await reportCheating.mutateAsync({
        reported_user_id: target.user_id,
        tournament_slug: tournamentSlug,
        reason
      });
      setSuccess(true);
      setTimeout(onClose, 1500);
    } catch (e) {
      setError(e?.errors?.join(', ') || t('report.failed'));
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

function InfoSection({ title, children }) {
  return (
    <View className="bg-white rounded-2xl p-4 mb-3">
      <Text className="text-brand-navy font-extrabold text-base mb-2">{title}</Text>
      {children}
    </View>
  );
}

function TournamentInfoMetric({ icon, label, value }) {
  return (
    <View className="w-[48%] rounded-xl bg-gray-50 p-3">
      <View className="flex-row items-center gap-1.5 mb-1.5">
        {icon}
        <Text className="text-gray-500 text-[11px] font-bold uppercase" numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text className="text-brand-navy text-sm font-extrabold" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function formatDateRange(startsAt, endsAt, t) {
  if (!startsAt && !endsAt) {
    return '-';
  }
  if (startsAt && endsAt) {
    return `${formatShortDate(startsAt)} - ${formatShortDate(endsAt)}`;
  }
  if (startsAt) {
    return `${t('tournaments.starts')}: ${formatShortDate(startsAt)}`;
  }
  return `${t('tournaments.ends')}: ${formatShortDate(endsAt)}`;
}

function formatShortDate(value) {
  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  return new Date(value).toLocaleString();
}

function LeaderboardCard({ entry, fallbackRank, isMe, onReport, t }) {
  const rank = entry.rank ?? fallbackRank;
  const completed = entry.completed_segments ?? 0;
  const total = entry.rated_segments_count ?? 0;
  const progress = total > 0 ? completed / total : 0;
  const nextLabel = entry.next_required_position
    ? t('tournaments.nextSegment', { position: entry.next_required_position })
    : t('tournaments.completed');
  const initials = initialsFor(entry.user?.full_name);

  return (
    <View className={`mx-3 mt-2 rounded-2xl p-3.5 ${isMe ? 'bg-amber-50 border border-amber-300' : 'bg-white'}`}>
      <View className="flex-row items-center gap-3">
        <View className="w-9 items-center">
          <Text className="text-gray-500 text-[11px] font-bold">#{rank}</Text>
          {rank <= 3 && <Trophy size={18} color={rank === 1 ? '#d97706' : '#9ca3af'} strokeWidth={2.4} />}
        </View>
        <View className="w-11 h-11 rounded-full bg-brand-navy items-center justify-center overflow-hidden">
          {entry.user?.avatar_url ? (
            <Image source={{ uri: entry.user.avatar_url }} className="w-full h-full" />
          ) : (
            <Text className="text-white font-black text-sm">{initials}</Text>
          )}
        </View>
        <View className="flex-1">
          <Text className="text-brand-navy text-[15px] font-extrabold" numberOfLines={1}>
            {entry.user?.full_name ?? '—'}
          </Text>
          <Text className="text-gray-500 text-[12px] mt-0.5">
            {t('tournaments.progress', { completed, total })} · {nextLabel}
          </Text>
        </View>
        <View className="items-end">
          <Text className="text-brand-red text-[18px] font-black">
            {entry.score != null ? entry.score.toFixed(1) : '—'}
          </Text>
          <Text className="text-gray-500 text-[10px] font-bold">PTS</Text>
        </View>
        {!isMe && entry.user?.id && (
          <TouchableOpacity onPress={onReport} className="p-1.5" hitSlop={8}>
            <Flag size={16} color="#bbb" />
          </TouchableOpacity>
        )}
      </View>

      <View className="h-2 rounded-full bg-gray-100 overflow-hidden mt-3">
        <View className="h-full rounded-full bg-brand-red" style={{ width: `${Math.min(progress * 100, 100)}%` }} />
      </View>

      <View className="flex-row flex-wrap gap-2 mt-3">
        <LeaderboardPill
          icon={<Clock3 size={13} color="#6b7280" />}
          label={t('tournaments.totalTime')}
          value={entry.total_time_seconds ? fmtTime(entry.total_time_seconds) : '—'}
        />
        <LeaderboardPill
          icon={<Award size={13} color="#b45309" />}
          label={t('tournaments.firstOpeners')}
          value={String(entry.first_opener_bonus_count ?? 0)}
        />
        <LeaderboardPill
          icon={<Target size={13} color="#6b7280" />}
          label={t('tournaments.lastUnlock')}
          value={formatLeaderboardDate(entry.last_unlock_at, t)}
        />
        {entry.gender_rank && (
          <LeaderboardPill
            icon={<Medal size={13} color="#6b7280" />}
            label={t('tournaments.genderRank', { rank: entry.gender_rank })}
            value={entry.user?.gender || '—'}
          />
        )}
      </View>
    </View>
  );
}

function LeaderboardPill({ icon, label, value }) {
  return (
    <View className="flex-row items-center gap-1.5 bg-gray-50 rounded-full px-2.5 py-1.5">
      {icon}
      <Text className="text-gray-500 text-[10px] font-bold">{label}</Text>
      <Text className="text-brand-navy text-[11px] font-extrabold">{value}</Text>
    </View>
  );
}

function initialsFor(name) {
  return String(name || '?')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');
}

function formatLeaderboardDate(value, t) {
  if (!value) {
    return t('tournaments.noUnlockYet');
  }
  return new Date(value).toLocaleDateString();
}

export default TournamentScreen;
