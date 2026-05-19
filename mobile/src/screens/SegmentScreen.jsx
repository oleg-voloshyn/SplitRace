import { useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { Share2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { WEB_URL } from '../api/client';
import { useSegment } from '../api/queries';
import EntityShareCard from '../components/EntityShareCard';
import RichDescription from '../components/RichDescription';
import SegmentsMap from '../components/SegmentsMap';
import ShareFormatModal from '../components/ShareFormatModal';
import { useShareCard } from '../hooks/useShareCard';
import { shareEntityImage, shareEntityLink } from '../utils/entityShare';

function SegmentScreen() {
  const { t } = useTranslation();
  const { id } = useRoute().params;
  const { data: segment } = useSegment(id);
  const [showFormatModal, setShowFormatModal] = useState(false);
  const { share, HiddenCard } = useShareCard({
    renderCard: (payload) => (
      <EntityShareCard
        entity={payload.entity}
        kind="segment"
        format={payload.format}
        url={payload.url}
        stats={payload.stats}
        polylines={payload.polylines}
      />
    ),
    onCapture: (ref, payload) => shareEntityImage(ref, payload)
  });

  if (!segment) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator color="#e53935" />
      </View>
    );
  }

  const url = `${WEB_URL}/segments/${segment.id}`;
  const stats = [
    {
      label: t('tournaments.distance'),
      value: segment.distance_meters ? `${(segment.distance_meters / 1000).toFixed(2)} km` : '-'
    },
    { label: t('tournaments.location'), value: [segment.city, segment.country].filter(Boolean).join(', ') || '-' }
  ];

  function shareLink() {
    shareEntityLink({
      title: segment.name,
      message: t('tournaments.shareText', { name: segment.name }),
      url
    });
  }

  function shareImage(format) {
    const polylines = Array.isArray(segment.polyline) && segment.polyline.length >= 2 ? [segment.polyline] : [];
    share({
      format,
      entity: segment,
      kind: 'segment',
      title: segment.name,
      message: t('tournaments.shareText', { name: segment.name }),
      url,
      polylines,
      dialogTitle: t('tournaments.shareSegment'),
      stats
    });
  }

  return (
    <ScrollView className="flex-1 bg-gray-100" contentContainerClassName="p-4 pb-8">
      <Text className="text-2xl font-black text-brand-navy mb-2">{segment.name}</Text>
      <RichDescription html={segment.description} className="mb-3" />
      <View className="bg-white rounded-xl p-3 mb-3">
        <View className="flex-row gap-3 mb-3">
          {stats.map((stat) => (
            <View key={stat.label} className="flex-1 bg-gray-50 rounded-lg p-3">
              <Text className="text-gray-500 text-[10px] uppercase font-bold">{stat.label}</Text>
              <Text className="text-brand-navy font-extrabold mt-1">{stat.value}</Text>
            </View>
          ))}
        </View>
        <View className="flex-row gap-2">
          <TouchableOpacity className="border border-gray-300 rounded-lg py-2.5 px-3 bg-white" onPress={shareLink}>
            <Text className="text-brand-navy font-bold text-sm">{t('tournaments.shareLink')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            className="flex-row items-center gap-1.5 bg-brand-red rounded-lg py-2.5 px-3"
            onPress={() => setShowFormatModal(true)}
          >
            <Share2 size={16} color="#fff" />
            <Text className="text-white font-bold text-sm">{t('tournaments.share')}</Text>
          </TouchableOpacity>
        </View>
      </View>
      {segment.polyline?.length > 1 && <SegmentsMap segments={[{ segment }]} style={{ height: 280 }} />}

      <ShareFormatModal
        visible={showFormatModal}
        onClose={() => setShowFormatModal(false)}
        onSelect={(format) => {
          setShowFormatModal(false);
          shareImage(format);
        }}
      />

      <HiddenCard />
    </ScrollView>
  );
}

export default SegmentScreen;
