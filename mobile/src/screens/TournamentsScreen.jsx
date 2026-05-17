import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';

function TournamentsScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [tournaments, setTournaments] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setTournaments(await api.tournaments());
    } catch {
      setTournaments([]);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const all = await api.tournaments();
        if (cancelled) {
          return;
        }
        setTournaments(all);
      } catch {
        if (!cancelled) {
          setTournaments([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (!tournaments) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#e53935" />
      </View>
    );
  }

  return (
    <FlatList
      className="flex-1 bg-gray-100 p-3"
      data={tournaments}
      keyExtractor={(tn) => tn.id.toString()}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#e53935" />}
      ListEmptyComponent={<Text className="text-center text-gray-500 mt-16">{t('tournaments.noTournaments')}</Text>}
      renderItem={({ item: tn }) => (
        <TouchableOpacity
          className="bg-white rounded-xl p-4 mb-2.5"
          onPress={() => navigation.navigate('Tournament', { slug: tn.slug })}
        >
          <View className="flex-row justify-between items-center mb-1.5">
            <Text className="text-base font-bold flex-1 mr-2">{tn.name}</Text>
            <View className="rounded px-1.5 py-0.5" style={{ backgroundColor: badgeColor(tn.status) }}>
              <Text className="text-white text-[11px] font-bold">{t(`tournaments.${tn.status}`).toUpperCase()}</Text>
            </View>
          </View>
          {tn.city && (
            <Text className="text-gray-500 text-[13px] mt-0.5">
              {tn.city}
              {tn.country ? ` · ${tn.country}` : ''}
            </Text>
          )}
          <Text className="text-gray-500 text-[13px] mt-0.5">
            {t('tournaments.participants', { count: tn.participants_count ?? 0 })}
          </Text>
        </TouchableOpacity>
      )}
    />
  );
}

function badgeColor(status) {
  return status === 'active' ? '#4caf50' : status === 'completed' ? '#9e9e9e' : '#ff9800';
}

export default TournamentsScreen;
