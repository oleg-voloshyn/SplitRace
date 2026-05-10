import { useState, useEffect, useCallback } from 'react'
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, ActivityIndicator } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { api } from '../api/client'
import { useAuth } from '../contexts/AuthContext'

export default function TournamentsScreen() {
  const { user } = useAuth()
  const navigation = useNavigation()
  const [tournaments, setTournaments] = useState(null)
  const [refreshing, setRefreshing]   = useState(false)

  const load = useCallback(async () => {
    try { setTournaments(await api.tournaments()) } catch {}
  }, [])

  useEffect(() => { load() }, [load])

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (!tournaments) return <View style={s.center}><ActivityIndicator color="#e53935" /></View>

  return (
    <FlatList
      style={s.list}
      data={tournaments}
      keyExtractor={t => t.id.toString()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e53935" />}
      ListEmptyComponent={<Text style={s.empty}>No tournaments yet</Text>}
      renderItem={({ item: t }) => (
        <TouchableOpacity style={s.card} onPress={() => navigation.navigate('Tournament', { slug: t.slug })}>
          <View style={s.cardHeader}>
            <Text style={s.name}>{t.name}</Text>
            <View style={[s.badge, { backgroundColor: badgeColor(t.status) }]}>
              <Text style={s.badgeText}>{t.status.toUpperCase()}</Text>
            </View>
          </View>
          {t.city && <Text style={s.meta}>{t.city}{t.country ? ` · ${t.country}` : ''}</Text>}
          <Text style={s.meta}>{t.participants_count ?? 0} participants</Text>
        </TouchableOpacity>
      )}
    />
  )
}

function badgeColor(status) {
  return status === 'active' ? '#4caf50' : status === 'completed' ? '#9e9e9e' : '#ff9800'
}

const s = StyleSheet.create({
  list:        { flex: 1, backgroundColor: '#f5f5f5', padding: 12 },
  center:      { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty:       { textAlign: 'center', color: '#888', marginTop: 60 },
  card:        { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, elevation: 1 },
  cardHeader:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  name:        { fontSize: 16, fontWeight: '700', flex: 1, marginRight: 8 },
  meta:        { color: '#888', fontSize: 13, marginTop: 2 },
  badge:       { borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2 },
  badgeText:   { color: '#fff', fontSize: 11, fontWeight: '700' },
})
