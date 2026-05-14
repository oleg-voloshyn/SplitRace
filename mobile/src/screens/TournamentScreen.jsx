import { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Modal, TextInput } from 'react-native'
import { useRoute } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import RichDescription from '../components/RichDescription'

export default function TournamentScreen() {
  const { t } = useTranslation()
  const { slug } = useRoute().params
  const { user } = useAuth()
  const [data, setData]       = useState(null)
  const [board, setBoard]     = useState(null)
  const [tab, setTab]         = useState('info')
  const [joining, setJoining] = useState(false)
  const [reportTarget, setReportTarget] = useState(null) // { user_id, full_name }

  useEffect(() => {
    api.tournament(slug).then(setData).catch(() => {})
    api.leaderboard(slug).then(setBoard).catch(() => {})
  }, [slug])

  async function join() {
    setJoining(true)
    try {
      await api.joinTournament(slug)
      const updated = await api.tournament(slug)
      setData(updated)
    } catch (e) {
      Alert.alert(t('common.error'), e?.error || t('tournaments.couldNotJoin'))
    } finally {
      setJoining(false)
    }
  }

  if (!data) return <View style={s.center}><ActivityIndicator color="#e53935" /></View>

  const isParticipant = data.is_participating
  const canJoin = data.status === 'active' && !isParticipant

  return (
    <View style={s.screen}>
      {/* Tabs */}
      <View style={s.tabs}>
        {['info', 'leaderboard'].map(key => (
          <TouchableOpacity key={key} style={[s.tab, tab === key && s.tabActive]} onPress={() => setTab(key)}>
            <Text style={[s.tabText, tab === key && s.tabTextActive]}>{key === 'info' ? t('tournaments.info') : t('tournaments.leaderboard')}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'info' ? (
        <View style={s.info}>
          <View style={[s.badge, { backgroundColor: badgeColor(data.status), alignSelf: 'flex-start', marginBottom: 12 }]}>
            <Text style={s.badgeText}>{t(`tournaments.${data.status}`).toUpperCase()}</Text>
          </View>
          <RichDescription html={data.description} style={s.desc} />
          <Text style={s.meta}>{t('tournaments.participants', { count: data.participants_count ?? 0 })}</Text>
          {data.starts_at && <Text style={s.meta}>{t('tournaments.starts')}: {new Date(data.starts_at).toLocaleDateString()}</Text>}
          {data.ends_at   && <Text style={s.meta}>{t('tournaments.ends')}: {new Date(data.ends_at).toLocaleDateString()}</Text>}

          {canJoin && (
            <TouchableOpacity style={s.joinBtn} onPress={join} disabled={joining}>
              <Text style={s.joinBtnText}>{joining ? '...' : t('tournaments.join')}</Text>
            </TouchableOpacity>
          )}
          {isParticipant && (
            <View style={s.joinedBadge}>
              <Text style={s.joinedText}>✓ {t('tournaments.youParticipate')}</Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={board ?? []}
          keyExtractor={r => String(r.user?.id ?? Math.random())}
          ListEmptyComponent={<Text style={s.empty}>{t('tournaments.noResults')}</Text>}
          renderItem={({ item: r, index }) => {
            const isMe = r.user?.id === user?.id
            return (
              <View style={[s.row, isMe && s.rowMe]}>
                <Text style={s.rank}>#{r.rank ?? index + 1}</Text>
                <Text style={s.rowName}>{r.user?.full_name ?? '—'}</Text>
                <View style={{ alignItems: 'flex-end', marginRight: 8 }}>
                  <Text style={s.score}>{r.score != null ? `${r.score.toFixed(1)} pts` : '—'}</Text>
                  <Text style={s.segs}>{r.completed_segments ?? 0} {t('tournaments.segments')}</Text>
                </View>
                {!isMe && r.user?.id && (
                  <TouchableOpacity
                    onPress={() => setReportTarget({ user_id: r.user.id, full_name: r.user.full_name })}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={s.reportBtn}
                  >
                    <Text style={s.reportIcon}>⚐</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }}
        />
      )}

      {reportTarget && (
        <ReportModal
          target={reportTarget}
          tournamentSlug={slug}
          onClose={() => setReportTarget(null)}
        />
      )}
    </View>
  )
}

function ReportModal({ target, tournamentSlug, onClose }) {
  const { t } = useTranslation()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  async function submit() {
    if (reason.trim().length < 10) { setError(t('report.tooShort')); return }
    setSubmitting(true)
    setError(null)
    try {
      await api.reportCheating({
        reported_user_id: target.user_id,
        tournament_slug:  tournamentSlug,
        reason,
      })
      setSuccess(true)
      setTimeout(onClose, 1500)
    } catch (e) {
      setError(e?.errors?.join(', ') || t('report.failed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={m.backdrop}>
        <View style={m.box}>
          {success ? (
            <View style={{ alignItems: 'center', paddingVertical: 16 }}>
              <Text style={{ fontSize: 40, marginBottom: 6 }}>✓</Text>
              <Text style={{ color: '#4caf50', fontWeight: '700', fontSize: 16 }}>{t('report.submitted')}</Text>
              <Text style={{ color: '#888', fontSize: 13, marginTop: 6 }}>{t('report.reviewNote')}</Text>
            </View>
          ) : (
            <>
              <Text style={m.title}>{t('report.title')}</Text>
              <Text style={m.subtitle}>
                {t('report.subtitle', { name: target.full_name })}
              </Text>
              <TextInput
                value={reason}
                onChangeText={setReason}
                placeholder={t('report.placeholder')}
                multiline
                numberOfLines={5}
                style={m.textarea}
                textAlignVertical="top"
              />
              {error && <Text style={m.error}>{error}</Text>}
              <View style={m.actions}>
                <TouchableOpacity onPress={onClose} disabled={submitting} style={m.btnCancel}>
                  <Text style={m.btnCancelText}>{t('report.cancel')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={submit} disabled={submitting} style={m.btnSubmit}>
                  <Text style={m.btnSubmitText}>{submitting ? t('report.submitting') : t('report.submit')}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  )
}

function badgeColor(status) {
  return status === 'active' ? '#4caf50' : status === 'completed' ? '#9e9e9e' : '#ff9800'
}

const s = StyleSheet.create({
  screen:       { flex: 1, backgroundColor: '#f5f5f5' },
  center:       { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tabs:         { flexDirection: 'row', backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab:          { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive:    { borderBottomWidth: 2, borderBottomColor: '#e53935' },
  tabText:      { color: '#888', fontSize: 14 },
  tabTextActive:{ color: '#e53935', fontWeight: '600' },
  info:         { padding: 16 },
  desc:         { marginBottom: 12 },
  meta:         { color: '#888', fontSize: 14, marginBottom: 4 },
  badge:        { borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText:    { color: '#fff', fontSize: 11, fontWeight: '700' },
  joinBtn:      { backgroundColor: '#e53935', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  joinBtnText:  { color: '#fff', fontWeight: '700', fontSize: 16 },
  joinedBadge:  { backgroundColor: '#e8f5e9', borderRadius: 8, padding: 12, marginTop: 20, alignItems: 'center' },
  joinedText:   { color: '#2e7d32', fontWeight: '600' },
  empty:        { textAlign: 'center', color: '#888', marginTop: 60 },
  row:          { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, marginHorizontal: 12, marginTop: 8, borderRadius: 10 },
  rowMe:        { backgroundColor: '#fff8e1', borderWidth: 1, borderColor: '#ffc107' },
  rank:         { width: 36, color: '#888', fontWeight: '700' },
  rowName:      { flex: 1, fontSize: 15 },
  score:        { fontWeight: '700', fontSize: 15 },
  segs:         { color: '#888', fontSize: 12 },
  reportBtn:    { padding: 4, marginLeft: 4 },
  reportIcon:   { fontSize: 18, color: '#bbb' },
})

const m = StyleSheet.create({
  backdrop:     { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  box:          { backgroundColor: '#fff', borderRadius: 12, padding: 20 },
  title:        { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  subtitle:     { color: '#666', fontSize: 13, marginBottom: 14 },
  textarea:     { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, fontSize: 14, minHeight: 100 },
  error:        { color: '#e53935', fontSize: 13, marginTop: 8 },
  actions:      { flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 16 },
  btnCancel:    { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 6, borderWidth: 1, borderColor: '#ccc' },
  btnCancelText:{ color: '#555' },
  btnSubmit:    { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 6, backgroundColor: '#e53935' },
  btnSubmitText:{ color: '#fff', fontWeight: '700' },
})
