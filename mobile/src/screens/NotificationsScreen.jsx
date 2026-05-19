import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import { usePaginatedList } from '../hooks/usePaginatedList';

function NotificationsScreen() {
  const { t } = useTranslation();
  const fetchPage = useCallback((page) => api.notifications(page), []);
  const { items, meta, loading, loadingMore, refreshing, onEndReached, onRefresh, reload } =
    usePaginatedList(fetchPage);
  const unreadCount = meta.unread_count ?? 0;

  async function markAllRead() {
    await api.readAllNotifications();
    await reload();
  }

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row items-center justify-between p-3.5 bg-white border-b border-gray-200">
        <Text className="text-lg font-bold">{t('notifications.title')}</Text>
        {unreadCount > 0 && (
          <TouchableOpacity onPress={markAllRead} className="rounded-lg border border-brand-navy px-2.5 py-1.5">
            <Text className="text-brand-navy font-bold text-xs">{t('notifications.markAllRead')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#e53935" />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e53935" />}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator color="#e53935" className="py-4" /> : null}
          ListEmptyComponent={<Text className="text-center text-gray-500 mt-10">{t('notifications.empty')}</Text>}
          renderItem={({ item }) => (
            <View
              className={`bg-white rounded-xl p-3.5 mx-3 mt-2.5 border ${
                !item.read_at ? 'border-brand-red bg-red-50/40' : 'border-gray-200'
              }`}
            >
              <Text className="font-bold text-[15px] mb-1">{item.title}</Text>
              {item.body && <Text className="text-gray-700 text-[13px] mb-1.5">{item.body}</Text>}
              <Text className="text-gray-500 text-xs">{new Date(item.created_at).toLocaleString()}</Text>
            </View>
          )}
        />
      )}
    </View>
  );
}

export default NotificationsScreen;
