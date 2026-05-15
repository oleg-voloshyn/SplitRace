import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Image, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import LeafletMap from '../components/LeafletMap';
import { useAuth } from '../contexts/AuthContext';
import { SUPPORTED_LANGS } from '../i18n';

function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, setUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(() => profileFormFromUser(user));
  const [activities, setActivities] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const isClub = user?.account_type === 'club';

  useEffect(() => {
    api
      .activities()
      .then(setActivities)
      .catch(() => setActivities([]));
  }, []);

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
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      {/* ── User card ─────────────────────────────────────────── */}
      <View style={s.userCard}>
        {user?.avatar_url ? (
          <Image source={{ uri: user.avatar_url }} style={s.avatarImage} />
        ) : (
          <View style={s.avatar}>
            <Text style={s.avatarText}>{initials}</Text>
          </View>
        )}
        <Text style={s.userName}>{fullName}</Text>
        <Text style={s.userEmail}>{user?.email}</Text>
      </View>

      {!isClub && !user?.gender && !editing && (
        <View style={s.warning}>
          <Text style={s.warningText}>{t('profile.genderWarning')}</Text>
        </View>
      )}

      {/* ── Info view / edit ─────────────────────────────────── */}
      <View style={s.section}>
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
            <TouchableOpacity style={s.editBtn} onPress={startEdit}>
              <Text style={s.editBtnText}>✎ {t('profile.editInfo')}</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            {isClub ? (
              <>
                <Text style={s.label}>{t('auth.clubName')}</Text>
                <TextInput
                  style={s.input}
                  value={form.club_name}
                  onChangeText={(v) => setForm((f) => ({ ...f, club_name: v }))}
                  placeholder={t('auth.clubName')}
                />
              </>
            ) : (
              <>
                <Text style={s.label}>{t('auth.firstName')}</Text>
                <TextInput
                  style={s.input}
                  value={form.first_name}
                  onChangeText={(v) => setForm((f) => ({ ...f, first_name: v }))}
                  placeholder={t('auth.firstName')}
                />

                <Text style={s.label}>{t('auth.lastName')}</Text>
                <TextInput
                  style={s.input}
                  value={form.last_name}
                  onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))}
                  placeholder={t('auth.lastName')}
                />

                <Text style={s.label}>{t('auth.gender')}</Text>
                <View style={s.genderRow}>
                  {['male', 'female', 'other'].map((g) => {
                    const active = form.gender === g;
                    return (
                      <TouchableOpacity
                        key={g}
                        style={[s.genderBtn, active && s.genderBtnActive]}
                        onPress={() => setForm((f) => ({ ...f, gender: g }))}
                      >
                        <Text style={[s.genderText, active && s.genderTextActive]}>
                          {active ? '✓ ' : ''}
                          {t(`auth.gender_${g}`)}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            <Text style={s.label}>{t('profile.units')}</Text>
            <View style={s.genderRow}>
              {['km', 'miles'].map((units) => {
                const active = form.units === units;
                return (
                  <TouchableOpacity
                    key={units}
                    style={[s.genderBtn, active && s.genderBtnActive]}
                    onPress={() => setForm((f) => ({ ...f, units }))}
                  >
                    <Text style={[s.genderText, active && s.genderTextActive]}>{t(`profile.${units}`)}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={s.label}>{t('profile.country')}</Text>
            <TextInput
              style={s.input}
              value={form.country}
              onChangeText={(v) => setForm((f) => ({ ...f, country: v }))}
              placeholder={t('profile.country')}
            />

            <Text style={s.label}>{t('profile.city')}</Text>
            <TextInput
              style={s.input}
              value={form.city}
              onChangeText={(v) => setForm((f) => ({ ...f, city: v }))}
              placeholder={t('profile.city')}
            />

            <View style={s.editActions}>
              <TouchableOpacity style={s.cancelBtn} onPress={cancelEdit}>
                <Text style={s.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
                <Text style={s.saveBtnText}>{t('profile.save')}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      {/* ── Language ─────────────────────────────────────────── */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>{t('profile.language')}</Text>
        {SUPPORTED_LANGS.map((l) => {
          const active = i18n.language === l.code;
          return (
            <TouchableOpacity
              key={l.code}
              style={[s.langRow, active && s.langRowActive]}
              onPress={() => i18n.changeLanguage(l.code)}
            >
              <Text style={[s.langLabel, active && s.langLabelActive]}>{l.label}</Text>
              {active && <Text style={s.langCheck}>✓</Text>}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* ── Sign out ─────────────────────────────────────────── */}
      <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout}>
        <Text style={s.logoutText}>{t('profile.signOut')}</Text>
      </TouchableOpacity>

      {/* ── Recent runs ──────────────────────────────────────── */}
      <Text style={s.sectionHeader}>{t('profile.recentRuns')}</Text>
      {activities === null && <Text style={s.muted}>{t('common.loading')}</Text>}
      {activities?.length === 0 && <Text style={s.muted}>{t('profile.noRuns')}</Text>}
      {activities?.map((a) => (
        <View key={a.id} style={s.runCard}>
          <View style={s.runHeader}>
            <Text style={s.runDate}>{fmtDate(a.started_at)}</Text>
            {a.segment_efforts_count > 0 && (
              <View style={s.segBadge}>
                <Text style={s.segBadgeText}>{a.segment_efforts_count} seg</Text>
              </View>
            )}
          </View>
          <View style={s.runStats}>
            <Text style={s.stat}>{fmtDist(a.distance_meters)}</Text>
            <Text style={s.stat}>{fmtTime(a.elapsed_time_seconds)}</Text>
            {a.distance_meters > 0 && a.elapsed_time_seconds > 0 && (
              <Text style={s.stat}>{fmtPace(a.elapsed_time_seconds, a.distance_meters)} /km</Text>
            )}
          </View>
          <RunSegmentSummary activity={a} t={t} />
          <TouchableOpacity style={s.shareRunBtn} onPress={() => shareActivity(a, t)}>
            <Text style={s.shareRunText}>{t('run.shareResult')}</Text>
          </TouchableOpacity>
          {a.gps_points?.length > 1 && (
            <TouchableOpacity onPress={() => setExpandedId(expandedId === a.id ? null : a.id)} style={s.routeBtn}>
              <Text style={s.routeBtnText}>
                {expandedId === a.id ? t('profile.hideRoute') : t('profile.showRoute')}
              </Text>
            </TouchableOpacity>
          )}
          {expandedId === a.id && a.gps_points?.length > 1 && (
            <View style={s.mapBox}>
              <LeafletMap points={a.gps_points} />
            </View>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

function RunSegmentSummary({ activity, t }) {
  const efforts = activity.segment_efforts || [];
  const count = activity.segment_efforts_count || efforts.length || 0;

  return (
    <View style={s.runSegmentBox}>
      <Text style={s.runSegmentTitle}>{t('run.segmentsCompleted', { count })}</Text>
      {efforts.length > 0 ? (
        efforts.map((effort) => (
          <View key={effort.id} style={s.runSegmentRow}>
            <Text style={s.runSegmentName}>{effort.segment?.name}</Text>
            <Text style={s.runSegmentTime}>{effort.formatted_time}</Text>
          </View>
        ))
      ) : (
        <Text style={s.runSegmentEmpty}>{t('run.noSegmentsCompleted')}</Text>
      )}
    </View>
  );
}

function shareActivity(activity, t) {
  Share.share({ message: buildActivityShareText(activity, t) }).catch(() => {
    // Native share can be cancelled or unavailable.
  });
}

function buildActivityShareText(activity, t) {
  const segmentCount = activity.segment_efforts_count || activity.segment_efforts?.length || 0;
  const segments = activity.segment_efforts || [];
  const segmentLines = segments.length
    ? segments.map((effort) => `• ${effort.segment?.name} — ${effort.formatted_time}`).join('\n')
    : t('run.noSegmentsCompleted');

  return [
    t('run.shareTitle'),
    `${t('run.distance')}: ${fmtDist(activity.distance_meters)}`,
    `${t('run.time')}: ${fmtTime(activity.elapsed_time_seconds)}`,
    `${t('run.pace')}: ${fmtPace(activity.elapsed_time_seconds, activity.distance_meters)} /km`,
    `${t('run.segmentsCompleted', { count: segmentCount })}`,
    segmentLines,
    'SplitRace'
  ].join('\n');
}

function profileFormFromUser(user) {
  return {
    club_name: user?.club_name || '',
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    gender: user?.gender || '',
    units: user?.units || 'km',
    country: user?.country || '',
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

  return form;
}

function InfoRow({ label, value }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
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
  const h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
function fmtPace(secs, meters) {
  const spk = (secs / meters) * 1000;
  const m = Math.floor(spk / 60),
    s = Math.round(spk % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 16, paddingBottom: 40 },

  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    alignItems: 'center',
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee'
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1a1a2e',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  avatarImage: { width: 72, height: 72, borderRadius: 36, marginBottom: 12, backgroundColor: '#f0f0f0' },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  userName: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  userEmail: { color: '#888', fontSize: 13 },

  warning: { backgroundColor: '#fff3cd', borderRadius: 8, padding: 12, marginBottom: 16 },
  warningText: { color: '#856404', fontSize: 13 },

  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee'
  },
  sectionTitle: {
    fontSize: 12,
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '700',
    marginBottom: 10
  },
  sectionHeader: { fontSize: 16, fontWeight: '700', marginTop: 8, marginBottom: 10 },

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  infoLabel: { color: '#888', fontSize: 14 },
  infoValue: { fontSize: 15, fontWeight: '600', color: '#1a1a2e' },

  editBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#1a1a2e',
    alignItems: 'center'
  },
  editBtnText: { color: '#1a1a2e', fontWeight: '700' },

  label: { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 6 },
  input: {
    backgroundColor: '#fafafa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 4,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0'
  },

  genderRow: { flexDirection: 'row', gap: 10, marginTop: 6, marginBottom: 6 },
  genderBtn: {
    flex: 1,
    borderWidth: 2,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    backgroundColor: '#fafafa'
  },
  genderBtnActive: { borderColor: '#e53935', backgroundColor: '#fff1f0' },
  genderText: { color: '#555', fontSize: 14, fontWeight: '500' },
  genderTextActive: { color: '#e53935', fontWeight: '700' },

  editActions: { flexDirection: 'row', gap: 10, marginTop: 16 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
    backgroundColor: '#fff'
  },
  cancelBtnText: { color: '#555', fontWeight: '600' },
  saveBtn: { flex: 1, paddingVertical: 12, borderRadius: 8, backgroundColor: '#1a1a2e', alignItems: 'center' },
  saveBtnText: { color: '#fff', fontWeight: '700' },

  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0'
  },
  langRowActive: {},
  langLabel: { color: '#555', fontSize: 15 },
  langLabelActive: { color: '#e53935', fontWeight: '700' },
  langCheck: { color: '#e53935', fontSize: 18, fontWeight: '800' },

  logoutBtn: { borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 24 },
  logoutText: { color: '#e53935', fontWeight: '600' },

  muted: { color: '#888', textAlign: 'center', marginTop: 20 },

  runCard: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee'
  },
  runHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  runDate: { fontWeight: '600', fontSize: 14 },
  segBadge: { backgroundColor: '#fff3cd', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  segBadgeText: { color: '#856404', fontSize: 12 },
  runStats: { flexDirection: 'row', gap: 16 },
  stat: { color: '#555', fontSize: 13 },
  runSegmentBox: { backgroundColor: '#fafafa', borderRadius: 8, padding: 10, marginTop: 10 },
  runSegmentTitle: { color: '#1a1a2e', fontWeight: '800', marginBottom: 6 },
  runSegmentRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: '#eee'
  },
  runSegmentName: { color: '#444', fontWeight: '600', flex: 1 },
  runSegmentTime: { color: '#e53935', fontWeight: '800' },
  runSegmentEmpty: { color: '#888', fontSize: 13 },
  shareRunBtn: {
    marginTop: 10,
    alignSelf: 'flex-start',
    backgroundColor: '#e53935',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7
  },
  shareRunText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  routeBtn: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4
  },
  routeBtnText: { color: '#555', fontSize: 12 },
  mapBox: { height: 200, marginTop: 8, borderRadius: 8, overflow: 'hidden' }
});

export default ProfileScreen;
