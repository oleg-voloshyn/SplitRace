import { useState, useEffect } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert } from 'react-native'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../api/client'
import LeafletMap from '../components/LeafletMap'

export default function ProfileScreen() {
  const { user, setUser, logout } = useAuth()
  const [form, setForm]     = useState({ first_name: user?.first_name || '', last_name: user?.last_name || '', gender: user?.gender || '' })
  const [saved, setSaved]   = useState(false)
  const [activities, setActivities] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  useEffect(() => {
    api.activities().then(setActivities).catch(() => setActivities([]))
  }, [])

  async function handleSave() {
    try {
      const updated = await api.updateMe(form)
      setUser(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      Alert.alert('Error', 'Could not save profile')
    }
  }

  function confirmLogout() {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: logout },
    ])
  }

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <Text style={s.email}>{user?.email}</Text>

      {!user?.gender && (
        <View style={s.warning}>
          <Text style={s.warningText}>⚠ Set your gender — required for tournament scoring</Text>
        </View>
      )}

      <TextInput style={s.input} placeholder="First name" value={form.first_name} onChangeText={v => setForm(f => ({ ...f, first_name: v }))} />
      <TextInput style={s.input} placeholder="Last name"  value={form.last_name}  onChangeText={v => setForm(f => ({ ...f, last_name: v }))} />

      <Text style={s.label}>Gender</Text>
      <View style={s.genderRow}>
        {['male', 'female'].map(g => (
          <TouchableOpacity key={g} style={[s.genderBtn, form.gender === g && s.genderBtnActive]} onPress={() => setForm(f => ({ ...f, gender: g }))}>
            <Text style={[s.genderText, form.gender === g && s.genderTextActive]}>{g.charAt(0).toUpperCase() + g.slice(1)}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
        <Text style={s.saveBtnText}>{saved ? '✓ Saved!' : 'Save'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.logoutBtn} onPress={confirmLogout}>
        <Text style={s.logoutText}>Sign out</Text>
      </TouchableOpacity>

      {/* Recent runs */}
      <Text style={s.section}>Recent runs</Text>
      {activities === null && <Text style={s.muted}>Loading...</Text>}
      {activities?.length === 0 && <Text style={s.muted}>No runs yet</Text>}
      {activities?.map(a => (
        <View key={a.id} style={s.runCard}>
          <View style={s.runHeader}>
            <Text style={s.runDate}>{fmtDate(a.started_at)}</Text>
            {a.segment_efforts_count > 0 && (
              <View style={s.segBadge}><Text style={s.segBadgeText}>{a.segment_efforts_count} seg</Text></View>
            )}
          </View>
          <View style={s.runStats}>
            <Text style={s.stat}>{fmtDist(a.distance_meters)}</Text>
            <Text style={s.stat}>{fmtTime(a.elapsed_time_seconds)}</Text>
            {a.distance_meters > 0 && a.elapsed_time_seconds > 0 && (
              <Text style={s.stat}>{fmtPace(a.elapsed_time_seconds, a.distance_meters)} /km</Text>
            )}
          </View>
          {a.gps_points?.length > 1 && (
            <TouchableOpacity onPress={() => setExpandedId(expandedId === a.id ? null : a.id)} style={s.routeBtn}>
              <Text style={s.routeBtnText}>{expandedId === a.id ? 'Hide route' : 'Show route'}</Text>
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
  )
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function fmtDist(m) { return m ? `${(m / 1000).toFixed(2)} km` : '0.00 km' }
function fmtTime(s) {
  if (!s) return '0:00'
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
  const pad = n => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}
function fmtPace(secs, meters) {
  const spk = (secs / meters) * 1000
  const m = Math.floor(spk / 60), s = Math.round(spk % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const s = StyleSheet.create({
  scroll:         { flex: 1, backgroundColor: '#f5f5f5' },
  container:      { padding: 16, paddingBottom: 40 },
  email:          { color: '#888', fontSize: 13, marginBottom: 12 },
  warning:        { backgroundColor: '#fff3cd', borderRadius: 8, padding: 10, marginBottom: 12 },
  warningText:    { color: '#856404', fontSize: 13 },
  label:          { fontSize: 13, color: '#555', marginBottom: 6, marginTop: 4 },
  input:          { backgroundColor: '#fff', borderRadius: 8, padding: 12, marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: '#e0e0e0' },
  genderRow:      { flexDirection: 'row', gap: 10, marginBottom: 16 },
  genderBtn:      { flex: 1, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingVertical: 10, alignItems: 'center', backgroundColor: '#fff' },
  genderBtnActive:{ borderColor: '#1a1a2e', backgroundColor: '#1a1a2e' },
  genderText:     { color: '#555' },
  genderTextActive:{ color: '#fff', fontWeight: '600' },
  saveBtn:        { backgroundColor: '#1a1a2e', borderRadius: 8, padding: 14, alignItems: 'center', marginBottom: 10 },
  saveBtnText:    { color: '#fff', fontWeight: '700', fontSize: 15 },
  logoutBtn:      { borderRadius: 8, padding: 12, alignItems: 'center', marginBottom: 24 },
  logoutText:     { color: '#e53935', fontWeight: '600' },
  section:        { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  muted:          { color: '#888', textAlign: 'center', marginTop: 20 },
  runCard:        { backgroundColor: '#fff', borderRadius: 10, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  runHeader:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  runDate:        { fontWeight: '600', fontSize: 14 },
  segBadge:       { backgroundColor: '#fff3cd', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  segBadgeText:   { color: '#856404', fontSize: 12 },
  runStats:       { flexDirection: 'row', gap: 16 },
  stat:           { color: '#555', fontSize: 13 },
  routeBtn:       { marginTop: 8, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#ddd', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  routeBtnText:   { color: '#555', fontSize: 12 },
  mapBox:         { height: 200, marginTop: 8, borderRadius: 8, overflow: 'hidden' },
})
