import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { City, Country } from 'country-state-city';
import * as Sharing from 'expo-sharing';
import { AlertTriangle, Check, ChevronRight, MapPin, Pencil, Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  Share,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import ViewShot from 'react-native-view-shot';
import { api } from '../api/client';
import LeafletMap from '../components/LeafletMap';
import { RUN_SHARE_FORMATS, RunShareCard } from '../components/RunShareCard';
import SearchableListModal from '../components/SearchableListModal';
import ShareFormatModal from '../components/ShareFormatModal';
import { useAuth } from '../contexts/AuthContext';
import { usePaginatedList } from '../hooks/usePaginatedList';
import { SUPPORTED_LANGS } from '../i18n';
import { buildShareText } from '../utils/runUtils';

function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const navigation = useNavigation();
  const { user, setUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => profileFormFromUser(user));
  const [bottomTab, setBottomTab] = useState('activities');

  const fetchActivities = useCallback((page) => api.activities(page), []);
  const activitiesList = usePaginatedList(fetchActivities);
  const activities = activitiesList.items;

  const fetchMyTournaments = useCallback((page) => api.myTournaments(page), []);
  const myTournamentsList = usePaginatedList(fetchMyTournaments);
  const myTournaments = myTournamentsList.items;
  const [expandedId, setExpandedId] = useState(null);
  const [pendingShare, setPendingShare] = useState(null);
  const [shareActivity, setShareActivity] = useState(null);
  const [showCountryPicker, setShowCountryPicker] = useState(false);
  const [showCityPicker, setShowCityPicker] = useState(false);
  const shareCardRef = useRef(null);
  const isClub = user?.account_type === 'club';
  const countries = useMemo(() => Country.getAllCountries(), []);
  const cities = useMemo(
    () => (form.countryCode ? City.getCitiesOfCountry(form.countryCode) || [] : []),
    [form.countryCode]
  );

  // Refresh "My tournaments" from page 1 each time the Profile screen regains focus.
  const reloadMyTournaments = myTournamentsList.reload;
  useFocusEffect(
    useCallback(() => {
      reloadMyTournaments();
    }, [reloadMyTournaments])
  );

  useEffect(() => {
    if (!pendingShare) {
      return;
    }

    const timeout = setTimeout(() => {
      shareActivityImage(shareCardRef, pendingShare.activity, t).finally(() => setPendingShare(null));
    }, 60);

    return () => clearTimeout(timeout);
  }, [pendingShare, t]);

  function startEdit() {
    setForm(profileFormFromUser(user));
    setEditing(true);
  }

  async function handleSave() {
    try {
      const updated = await api.updateMe(profilePayload(form, isClub));
      setUser(updated);
      setEditing(false);
    } catch {
      Alert.alert(t('common.error'), t('profile.saveError'));
    }
  }

  function cancelEdit() {
    setEditing(false);
  }

  function confirmLogout() {
    Alert.alert(t('profile.signOut'), t('profile.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOutBtn'), style: 'destructive', onPress: logout }
    ]);
  }

  const initials = (user?.club_name?.[0] || user?.first_name?.[0] || user?.email?.[0] || '?').toUpperCase();
  const fullName = isClub
    ? user?.club_name || '—'
    : [user?.first_name, user?.last_name].filter(Boolean).join(' ') || '—';

  return (
    <ScrollView className="flex-1 bg-gray-100" contentContainerClassName="p-4 pb-10">
      {/* User card */}
      <View className="bg-white rounded-xl items-center p-5 mb-4 border border-gray-200">
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} className="w-[72px] h-[72px] rounded-full mb-3 bg-gray-100" />
        ) : (
          <View className="w-[72px] h-[72px] rounded-full bg-brand-navy items-center justify-center mb-3">
            <Text className="text-white text-[28px] font-extrabold">{initials}</Text>
          </View>
        )}
        <Text className="text-lg font-bold mb-0.5">{fullName}</Text>
        <Text className="text-gray-500 text-[13px]">{user?.email}</Text>
      </View>

      {!isClub && !user?.gender && !editing && (
        <View className="bg-amber-100 rounded-lg p-3 mb-4 flex-row items-center gap-2">
          <AlertTriangle size={16} color="#856404" />
          <Text className="text-amber-900 text-[13px] flex-1">{t('profile.genderWarning')}</Text>
        </View>
      )}

      {/* Info view / edit */}
      <View className="bg-white rounded-xl p-4 mb-4 border border-gray-200">
        {!editing ? (
          <>
            {isClub ? (
              <InfoRow label={t('auth.clubName')} value={user?.club_name || '—'} />
            ) : (
              <>
                <InfoRow label={t('auth.firstName')} value={user?.first_name || '—'} />
                <InfoRow label={t('auth.lastName')} value={user?.last_name || '—'} />
                <InfoRow label={t('auth.gender')} value={user?.gender ? t(`auth.gender_${user.gender}`) : '—'} />
              </>
            )}
            <InfoRow
              label={t('profile.units')}
              value={user?.units === 'miles' ? t('profile.miles') : t('profile.km')}
            />
            <InfoRow label={t('profile.country')} value={user?.country || '—'} />
            <InfoRow label={t('profile.city')} value={user?.city || '—'} />
            <TouchableOpacity
              className="mt-3.5 py-2.5 rounded-lg border border-brand-navy items-center flex-row justify-center gap-1.5"
              onPress={startEdit}
            >
              <Pencil size={14} color="#1a1a2e" />
              <Text className="text-brand-navy font-bold">{t('profile.editInfo')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {isClub ? (
              <>
                <Label>{t('auth.clubName')}</Label>
                <Input
                  value={form.club_name}
                  onChangeText={(v) => setForm((f) => ({ ...f, club_name: v }))}
                  placeholder={t('auth.clubName')}
                />
              </>
            ) : (
              <>
                <Label>{t('auth.firstName')}</Label>
                <Input
                  value={form.first_name}
                  onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))}
                  placeholder={t('auth.firstName')}
                />
                <Label>{t('auth.lastName')}</Label>
                <Input
                  value={form.last_name}
                  onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))}
                  placeholder={t('auth.lastName')}
                />
                <Label>{t('auth.gender')}</Label>
                <View className="flex-row gap-2.5 mt-1.5 mb-1.5">
                  {['male', 'female', 'other'].map((g) => {
                    const active = form.gender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        className={`flex-1 border-2 rounded-lg py-3 items-center flex-row justify-center gap-1 ${
                          active ? 'border-brand-red bg-red-50' : 'border-gray-200 bg-gray-50'
                        }`}
                        onPress={() => setForm((f) => ({ ...f, gender: g }))}
                      >
                        {active && <Check size={13} color="#e53935" strokeWidth={2.5} />}
                        <Text
                          className={`text-sm font-medium ${active ? 'text-brand-red font-bold' : 'text-gray-700'}`}
                        >
                          {t(`auth.gender_${g}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Label>{t('profile.units')}</Label>
            <View className="flex-row gap-2.5 mt-1.5 mb-1.5">
              {['km', 'miles'].map((units) => {
                const active = form.units === units;
                return (
                  <TouchableOpacity
                    key={units}
                    className={`flex-1 border-2 rounded-lg py-3 items-center ${
                      active ? 'border-brand-red bg-red-50' : 'border-gray-200 bg-gray-50'
                    }`}
                    onPress={() => setForm((f) => ({ ...f, units }))}
                  >
                    <Text className={`text-sm font-medium ${active ? 'text-brand-red font-bold' : 'text-gray-700'}`}>
                      {t(`profile.${units}`)}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Label>{t('profile.country')}</Label>
            <TouchableOpacity
              onPress={() => setShowCountryPicker(true)}
              className="flex-row items-center bg-gray-50 border border-gray-200 rounded-lg p-3 mb-1"
            >
              <MapPin size={16} color="#6b7280" />
              <Text className={`ml-2 flex-1 text-[15px] ${form.country ? 'text-brand-navy' : 'text-gray-400'}`}>
                {form.country || t('creator.selectCountry')}
              </Text>
              <ChevronRight size={18} color="#9ca3af" />
            </TouchableOpacity>

            <Label>{t('profile.city')}</Label>
            <TouchableOpacity
              onPress={form.countryCode ? () => setShowCityPicker(true) : undefined}
              disabled={!form.countryCode}
              className={`flex-row items-center bg-gray-50 border rounded-lg p-3 mb-1 ${
                form.countryCode ? 'border-gray-200' : 'border-gray-200 opacity-60'
              }`}
            >
              <Text className={`flex-1 text-[15px] ${form.city ? 'text-brand-navy' : 'text-gray-400'}`}>
                {form.city || (form.countryCode ? t('creator.selectCity') : t('creator.selectCountryFirst'))}
              </Text>
              {form.city ? (
                <TouchableOpacity
                  onPress={() => setForm((f) => ({ ...f, city: '' }))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text className="text-brand-red font-bold">×</Text>
                </TouchableOpacity>
              ) : (
                <ChevronRight size={18} color="#9ca3af" />
              )}
            </TouchableOpacity>

            <LanguageSelector t={t} i18n={i18n} />

            <View className="flex-row gap-2.5 mt-4">
              <TouchableOpacity
                className="flex-1 py-3 rounded-lg border border-gray-300 items-center bg-white"
                onPress={cancelEdit}
              >
                <Text className="text-gray-700 font-semibold">{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-1 py-3 rounded-lg bg-brand-navy items-center" onPress={handleSave}>
                <Text className="text-white font-bold">{t('profile.save')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* Sign out */}
      <TouchableOpacity className="rounded-lg p-3 items-center mb-6" onPress={confirmLogout}>
        <Text className="text-brand-red font-semibold">{t('profile.signOut')}</Text>
      </TouchableOpacity>

      {/* Bottom tabs: Activities / My tournaments */}
      <View className="flex-row bg-white border border-gray-200 rounded-xl overflow-hidden mb-3">
        {['activities', 'tournaments'].map((tab) => (
          <TouchableOpacity
            key={tab}
            className={`flex-1 py-3 items-center ${bottomTab === tab ? 'bg-brand-navy' : ''}`}
            onPress={() => setBottomTab(tab)}
          >
            <Text className={`text-sm font-bold ${bottomTab === tab ? 'text-white' : 'text-gray-600'}`}>
              {tab === 'activities' ? t('creator.activitiesTab') : t('creator.myTournamentsTab')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {bottomTab === 'tournaments' && (
        <MyTournamentsTab
          myTournaments={myTournaments}
          hasNext={myTournamentsList.hasNext}
          loadingMore={myTournamentsList.loadingMore}
          onLoadMore={myTournamentsList.onEndReached}
          navigation={navigation}
          t={t}
        />
      )}

      {bottomTab === 'activities' && activities === null && (
        <Text className="text-gray-500 text-center mt-5">{t('common.loading')}</Text>
      )}
      {bottomTab === 'activities' && activities?.length === 0 && (
        <Text className="text-gray-500 text-center mt-5">{t('profile.noRuns')}</Text>
      )}
      {bottomTab === 'activities' &&
        activities?.map((a) => (
          <View key={a.id} className="bg-white rounded-xl p-3.5 mb-2 border border-gray-200">
            <View className="flex-row justify-between items-center mb-1.5">
              <Text className="font-semibold text-sm">{fmtDate(a.started_at)}</Text>
              {a.segment_efforts_count > 0 && (
                <View className="bg-amber-100 rounded px-1.5 py-0.5">
                  <Text className="text-amber-900 text-xs">{a.segment_efforts_count} seg</Text>
                </View>
              )}
            </View>
            <View className="flex-row gap-4">
              <Text className="text-gray-700 text-[13px]">{fmtDist(a.distance_meters)}</Text>
              <Text className="text-gray-700 text-[13px]">{fmtTime(a.elapsed_time_seconds)}</Text>
              {a.distance_meters > 0 && a.elapsed_time_seconds > 0 && (
                <Text className="text-gray-700 text-[13px]">
                  {fmtPace(a.elapsed_time_seconds, a.distance_meters)} /km
                </Text>
              )}
            </View>
            <RunSegmentSummary activity={a} t={t} />
            <TouchableOpacity
              onPress={() => setShareActivity(a)}
              className="self-start mt-2.5 flex-row items-center gap-1.5 bg-brand-red rounded-lg px-3 py-2"
            >
              <Share2 size={14} color="#fff" />
              <Text className="text-white font-bold text-[13px]">{t('run.shareResult')}</Text>
            </TouchableOpacity>
            {a.gps_points?.length > 1 && (
              <TouchableOpacity
                onPress={() => setExpandedId(expandedId === a.id ? null : a.id)}
                className="mt-2 self-start border border-gray-300 rounded-md px-2.5 py-1"
              >
                <Text className="text-gray-700 text-xs">
                  {expandedId === a.id ? t('profile.hideRoute') : t('profile.showRoute')}
                </Text>
              </TouchableOpacity>
            )}
            {expandedId === a.id && a.gps_points?.length > 1 && (
              <View className="h-[200px] mt-2 rounded-lg overflow-hidden">
                <LeafletMap points={a.gps_points} />
              </View>
            )}
          </View>
        ))}
      {bottomTab === 'activities' && (
        <LoadMoreButton
          hasNext={activitiesList.hasNext}
          loading={activitiesList.loadingMore}
          onPress={activitiesList.onEndReached}
          t={t}
        />
      )}
      <ShareFormatModal
        visible={Boolean(shareActivity)}
        onClose={() => setShareActivity(null)}
        onSelect={(format) => {
          const activity = shareActivity;
          setShareActivity(null);
          if (activity) {
            setPendingShare({ activity, format });
          }
        }}
      />
      <SearchableListModal
        visible={showCountryPicker}
        onClose={() => setShowCountryPicker(false)}
        onSelect={(country) => {
          setForm((f) => ({ ...f, country: country.name, countryCode: country.isoCode, city: '' }));
          setShowCountryPicker(false);
        }}
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
        onSelect={(city) => {
          setForm((f) => ({ ...f, city: city.name }));
          setShowCityPicker(false);
        }}
        title={t('creator.selectCity')}
        searchPlaceholder={t('creator.searchCity')}
        emptyText={t('creator.noResults')}
        items={cities}
        keyFor={(c) => `${c.stateCode}-${c.name}`}
        labelFor={(c) => c.name}
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
          <RunShareCard activity={pendingShare.activity} format={pendingShare.format} />
        </ViewShot>
      )}
    </ScrollView>
  );
}

function MyTournamentsTab({ myTournaments, hasNext, loadingMore, onLoadMore, navigation, t }) {
  if (myTournaments === null) {
    return <Text className="text-gray-500 text-center mt-5">{t('common.loading')}</Text>;
  }
  if (myTournaments.length === 0) {
    return <Text className="text-gray-500 text-center mt-5">{t('creator.noTournaments')}</Text>;
  }
  return (
    <>
      {myTournaments.map((tournament) => {
        const editable = tournament.status === 'draft' || tournament.status === 'rejected';
        const sortedSegments = [...(tournament.segments || [])].sort((a, b) => a.order_number - b.order_number);
        return (
          <TouchableOpacity
            key={tournament.id}
            activeOpacity={editable ? 0.7 : 1}
            disabled={!editable}
            onPress={() =>
              navigation.navigate('Tournaments', { screen: 'EditTournament', params: { slug: tournament.slug } })
            }
            className="bg-white rounded-xl p-3.5 mb-2.5 border border-gray-200"
          >
            <View className="flex-row items-start mb-1.5">
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
              {editable && <ChevronRight size={18} color="#9ca3af" />}
            </View>
            {tournament.review_note ? (
              <Text className="text-red-700 text-[13px] mb-2 leading-[18px]">{tournament.review_note}</Text>
            ) : null}
            <Text className="text-gray-500 text-xs">
              {sortedSegments.length}/{tournament.total_segments_count} {t('creator.segments')}
            </Text>
            {editable && <Text className="text-gray-400 text-[11px] mt-1">{t('creator.tapToEdit')}</Text>}
          </TouchableOpacity>
        );
      })}
      <LoadMoreButton hasNext={hasNext} loading={loadingMore} onPress={onLoadMore} t={t} />
    </>
  );
}

function LoadMoreButton({ hasNext, loading, onPress, t }) {
  if (!hasNext) {
    return null;
  }
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={loading}
      className="bg-white rounded-xl py-3 items-center border border-gray-200 mt-1 mb-2"
    >
      {loading ? (
        <ActivityIndicator color="#1a1a2e" />
      ) : (
        <Text className="text-brand-navy font-bold text-sm">{t('common.loadMore')}</Text>
      )}
    </TouchableOpacity>
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

function RunSegmentSummary({ activity, t }) {
  const efforts = activity.segment_efforts || [];
  const count = activity.segment_efforts_count || efforts.length || 0;

  return (
    <View className="bg-gray-50 rounded-lg p-2.5 mt-2.5">
      <Text className="text-brand-navy font-extrabold mb-1.5">{t('run.segmentsCompleted', { count })}</Text>
      {efforts.length > 0 ? (
        efforts.map((effort) => (
          <View key={effort.id} className="flex-row justify-between gap-2.5 py-1 border-t border-gray-200">
            <Text className="text-gray-700 font-semibold flex-1">{effort.segment?.name}</Text>
            <Text className="text-brand-red font-extrabold">{effort.formatted_time}</Text>
          </View>
        ))
      ) : (
        <Text className="text-gray-500 text-[13px]">{t('run.noSegmentsCompleted')}</Text>
      )}
    </View>
  );
}

function Label({ children }) {
  return <Text className="text-[13px] text-gray-700 mb-1.5 mt-1.5">{children}</Text>;
}

function Input(props) {
  return (
    <TextInput
      className="bg-gray-50 rounded-lg p-3 mb-1 text-[15px] border border-gray-200"
      placeholderTextColor="#9ca3af"
      {...props}
    />
  );
}

function LanguageSelector({ t, i18n }) {
  return (
    <View className="mt-2 mb-1">
      <Text className="text-xs text-gray-500 uppercase tracking-wider font-bold mb-2.5">{t('profile.language')}</Text>
      <View className="rounded-lg border border-gray-200 overflow-hidden">
        {SUPPORTED_LANGS.map((l) => {
          const active = i18n.language === l.code;
          return (
            <TouchableOpacity
              key={l.code}
              className="flex-row justify-between items-center py-3 px-3 border-b border-gray-100 bg-white"
              onPress={() => i18n.changeLanguage(l.code)}
            >
              <Text className={`text-[15px] ${active ? 'text-brand-red font-bold' : 'text-gray-700'}`}>{l.label}</Text>
              {active && <Check size={18} color="#e53935" strokeWidth={2.5} />}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

function InfoRow({ label, value }) {
  return (
    <View className="flex-row justify-between items-center py-2.5 border-b border-gray-100">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className="text-[15px] font-semibold text-brand-navy">{value}</Text>
    </View>
  );
}

async function shareActivityImage(cardRef, activity, t) {
  try {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable || !cardRef.current) {
      shareActivityText(activity, t);
      return;
    }
    const uri = await cardRef.current.capture();
    await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('run.shareResult') });
  } catch {
    shareActivityText(activity, t);
  }
}

function shareActivityText(activity, t) {
  Share.share({ message: buildShareText(activity, t) }).catch(() => {
    // Native share can be cancelled or unavailable.
  });
}

function profileFormFromUser(user) {
  const countryName = user?.country || '';
  const matched = countryName ? Country.getAllCountries().find((c) => c.name === countryName) : null;
  return {
    club_name: user?.club_name || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    gender: user?.gender || '',
    units: user?.units || 'km',
    country: countryName,
    countryCode: matched?.isoCode || '',
    city: user?.city || ''
  };
}

function profilePayload(form, isClub) {
  if (isClub) {
    return {
      club_name: form.club_name,
      units: form.units,
      country: form.country,
      city: form.city
    };
  }

  const { countryCode: _ignored, ...rest } = form;
  return rest;
}

function fmtDate(iso) {
  if (!iso) {
    return '—';
  }
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}
function fmtDist(m) {
  return m ? `${(m / 1000).toFixed(2)} km` : '0.00 km';
}
function fmtTime(s) {
  if (!s) {
    return '0:00';
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function fmtPace(secs, meters) {
  const spk = (secs / meters) * 1000;
  const m = Math.floor(spk / 60);
  const s = Math.round(spk % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default ProfileScreen;
