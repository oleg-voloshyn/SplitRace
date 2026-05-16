import { useEffect, useRef, useState } from 'react';
import { useRoute } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import ViewShot from 'react-native-view-shot';
import { WEB_URL, api } from '../api/client';
import EntityShareCard from '../components/EntityShareCard';
import RichDescription from '../components/RichDescription';
import { RUN_SHARE_FORMATS } from '../components/RunShareCard';
import SegmentsMap from '../components/SegmentsMap';
import ShareFormatButtons from '../components/ShareFormatButtons';
import { shareEntityImage, shareEntityLink } from '../utils/entityShare';

function SegmentScreen() {
  const { t } = useTranslation();
  const { id } = useRoute().params;
  const [segment, setSegment] = useState(null);
  const [pendingShare, setPendingShare] = useState(null);
  const shareCardRef = useRef(null);

  useEffect(() => {
    api
      .segment(id)
      .then(setSegment)
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!pendingShare) {
      return;
    }

    const timeout = setTimeout(() => {
      shareEntityImage(shareCardRef, pendingShare).finally(() => setPendingShare(null));
    }, 60);

    return () => clearTimeout(timeout);
  }, [pendingShare]);

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
      message: t('segments.shareText', {
        name: segment.name,
        defaultValue: `Try this running segment on SplitRace: ${segment.name}`
      }),
      url
    });
  }

  function shareImage(format) {
    setPendingShare({
      format,
      entity: segment,
      kind: 'segment',
      title: segment.name,
      message: t('segments.shareText', {
        name: segment.name,
        defaultValue: `Try this running segment on SplitRace: ${segment.name}`
      }),
      url,
      dialogTitle: t('segments.shareSegment', { defaultValue: 'Share segment' }),
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
        <TouchableOpacity
          className="self-start border border-gray-300 rounded-lg py-2.5 px-3 bg-white"
          onPress={shareLink}
        >
          <Text className="text-brand-navy font-bold text-sm">{t('tournaments.share')}</Text>
        </TouchableOpacity>
        <ShareFormatButtons selected={null} compact onShare={shareImage} />
      </View>
      {segment.polyline?.length > 1 && <SegmentsMap segments={[{ segment }]} style={{ height: 280 }} />}

      {pendingShare && (
        <ViewShot
          ref={shareCardRef}
          options={{ format: 'png', quality: 1 }}
          style={{
            position: 'absolute',
            left: -10000,
            top: 0,
            width: RUN_SHARE_FORMATS[pendingShare.format].width,
            height: RUN_SHARE_FORMATS[pendingShare.format].height
          }}
        >
          <EntityShareCard
            entity={pendingShare.entity}
            kind="segment"
            format={pendingShare.format}
            url={pendingShare.url}
            stats={pendingShare.stats}
          />
        </ViewShot>
      )}
    </ScrollView>
  );
}

export default SegmentScreen;
