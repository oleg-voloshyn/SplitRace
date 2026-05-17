import { useCallback, useEffect, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { MapPin, Trophy, Users } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, FlatList, RefreshControl, Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';
import SegmentsMap from '../components/SegmentsMap';

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
      renderItem={({ item: tn }) => {
        const preview = (tn.segments_preview ?? []).filter((s) => s.segment?.polyline?.length >= 2);
        return (
          <TouchableOpacity
            activeOpacity={0.85}
            className="bg-white rounded-2xl mb-3 overflow-hidden border border-gray-200"
            style={{
              shadowColor: '#0b1024',
              shadowOpacity: 0.06,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 2 },
              elevation: 2
            }}
            onPress={() => navigation.navigate('Tournament', { slug: tn.slug, title: tn.name })}
          >
            {preview.length > 0 ? (
              <View className="relative">
                <SegmentsMap segments={preview} style={{ height: 160 }} />
                <View
                  className="absolute top-2.5 left-2.5 self-start rounded px-2 py-0.5"
                  style={{ backgroundColor: badgeColor(tn.status) }}
                >
                  <Text className="text-white text-[10px] font-bold tracking-wider">
                    {t(`tournaments.${tn.status}`).toUpperCase()}
                  </Text>
                </View>
              </View>
            ) : (
              <View className="h-[120px] bg-red-50 items-center justify-center">
                <Trophy size={40} color="#e53935" strokeWidth={2.2} />
                <View
                  className="absolute top-2.5 left-2.5 self-start rounded px-2 py-0.5"
                  style={{ backgroundColor: badgeColor(tn.status) }}
                >
                  <Text className="text-white text-[10px] font-bold tracking-wider">
                    {t(`tournaments.${tn.status}`).toUpperCase()}
                  </Text>
                </View>
              </View>
            )}
            <View className="p-4">
              <Text className="text-base font-bold text-brand-navy" numberOfLines={2}>
                {tn.name}
              </Text>
              <View className="flex-row flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                {tn.city ? (
                  <View className="flex-row items-center gap-1">
                    <MapPin size={13} color="#6b7280" />
                    <Text className="text-gray-600 text-[13px]">
                      {tn.city}
                      {tn.country ? `, ${tn.country}` : ''}
                    </Text>
                  </View>
                ) : null}
                <View className="flex-row items-center gap-1">
                  <Users size={13} color="#6b7280" />
                  <Text className="text-gray-600 text-[13px]">
                    {t('tournaments.participants', { count: tn.participants_count ?? 0 })}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      }}
    />
  );
}

function badgeColor(status) {
  return status === 'active' ? '#4caf50' : status === 'completed' ? '#9e9e9e' : '#ff9800';
}

export default TournamentsScreen;
