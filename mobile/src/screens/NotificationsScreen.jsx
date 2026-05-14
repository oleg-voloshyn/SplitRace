import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';

function NotificationsScreen() {
  const { t } = useTranslation();
  const [data, setData] = useState({ notifications: [], unread_count: 0 });

  useEffect(() => {
    api.notifications().then(setData);
  }, []);

  async function markAllRead() {
    await api.readAllNotifications();
    setData(await api.notifications());
  }

  return (
    <View style={s.screen}>
      <View style={s.header}>
        <Text style={s.title}>{t('notifications.title')}</Text>
        {data.unread_count > 0 && (
          <TouchableOpacity onPress={markAllRead} style={s.markBtn}>
            <Text style={s.markBtnText}>{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        )}
      </View>
      <FlatList
        data={data.notifications}
        keyExtractor={(item) => String(item.id)}
        ListEmptyComponent={<Text style={s.empty}>{t('notifications.empty')}</Text>}
        renderItem={({ item }) => (
          <View style={[s.card, !item.read_at && s.unread]}>
            <Text style={s.cardTitle}>{item.title}</Text>
            {item.body && <Text style={s.body}>{item.body}</Text>}
            <Text style={s.meta}>{new Date(item.created_at).toLocaleString()}</Text>
          </View>
        )}
      />
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f5f5' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  title: { fontSize: 18, fontWeight: '700' },
  markBtn: { borderRadius: 8, borderWidth: 1, borderColor: '#1a1a2e', paddingHorizontal: 10, paddingVertical: 6 },
  markBtnText: { color: '#1a1a2e', fontWeight: '700', fontSize: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginHorizontal: 12,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#eee'
  },
  unread: { borderColor: '#e53935', backgroundColor: '#fffafa' },
  cardTitle: { fontWeight: '700', fontSize: 15, marginBottom: 4 },
  body: { color: '#555', fontSize: 13, marginBottom: 6 },
  meta: { color: '#888', fontSize: 12 },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 }
});

export default NotificationsScreen;
