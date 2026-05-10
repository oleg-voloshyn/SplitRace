import { useState, useEffect } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native'
import { useRoute } from '@react-navigation/native'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function TournamentScreen() {
  const { slug } = useRoute().params
  const { user } = useAuth()
  const [data, setData]       = useState(null)
  const [board, setBoard]     = useState(null)
  const [tab, setTab]         = useState('info')
  const [joining, setJoining] = useState(false)

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
      Alert.alert('Error', e?.error || 'Could not join')
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
        {['info', 'leaderboard'].map(t => (
          <TouchableOpacity key={t} style={[s.tab, tab === t && s.tabActive]} onPress={() => setTab(t)}>
            <Text style={[s.tabText, tab === t && s.tabTextActive]}>{t === 'info' ? 'Info' : 'Leaderboard'}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'info' ? (
        <View style={s.info}>
          <View style={[s.badge, { backgroundColor: badgeColor(data.status), alignSelf: 'flex-start', marginBottom: 12 }]}>
            <Text style={s.badgeText}>{data.status.toUpperCase()}</Text>
          </View>
          {data.description ? <Text style={s.desc}>{data.description}</Text> : null}
          <Text style={s.meta}>{data.participants_count ?? 0} participants</Text>
          {data.starts_at && <Text style={s.meta}>Starts: {new Date(data.starts_at).toLocaleDateString()}</Text>}
          {data.ends_at   && <Text style={s.meta}>Ends: {new Date(data.ends_at).toLocaleDateString()}</Text>}

          {canJoin && (
            <TouchableOpacity style={s.joinBtn} onPress={join} disabled={joining}>
              <Text style={s.joinBtnText}>{joining ? '...' : 'Join Tournament'}</Text>
            </TouchableOpacity>
          )}
          {isParticipant && (
            <View style={s.joinedBadge}>
              <Text style={s.joinedText}>✓ You are participating</Text>
            </View>
          )}
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={board ?? []}
          keyExtractor={r => String(r.user?.id ?? Math.random())}
          ListEmptyComponent={<Text style={s.empty}>No results yet</Text>}
          renderItem={({ item: r, index }) => (
            <View style={[s.row, r.user?.id === user?.id && s.rowMe]}>
              <Text style={s.rank}>#{r.rank ?? index + 1}</Text>
              <Text style={s.rowName}>{r.user?.full_name ?? '—'}</Text>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={s.score}>{r.score != null ? `${r.score.toFixed(1)} pts` : '—'}</Text>
                <Text style={s.segs}>{r.completed_segments ?? 0} segments</Text>
              </View>
            </View>
          )}
        />
      )}
    </View>
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
  desc:         { color: '#444', marginBottom: 12, lineHeight: 20 },
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
})
