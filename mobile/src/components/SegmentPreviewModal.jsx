import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Modal, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '../api/client';
import LeafletMap from './LeafletMap';
import RichDescription from './RichDescription';

function SegmentPreviewModal({ segment, visible, onClose }) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [detailed, setDetailed] = useState(null);
  const isLoading = !detailed || (segment && detailed.id !== segment.id);

  useEffect(() => {
    if (!visible || !segment) {
      return undefined;
    }
    let cancelled = false;
    api
      .segment(segment.id)
      .then((data) => {
        if (!cancelled) {
          setDetailed(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setDetailed({ ...segment, polyline: [] });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [segment, visible]);

  if (!segment) {
    return null;
  }

  const points = (detailed?.polyline ?? []).map((p) => ({ lat: p.lat, lng: p.lng }));
  const location = [segment.city, segment.country].filter(Boolean).join(', ');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        <View
          className="flex-row items-center justify-between px-4 pb-4 border-b border-gray-200"
          style={{ paddingTop: insets.top + 12 }}
        >
          <Text className="text-lg font-bold text-brand-navy flex-1 mr-2" numberOfLines={1}>
            {segment.name}
          </Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color="#1a1a2e" />
          </TouchableOpacity>
        </View>

        <View className="h-[260px] bg-brand-navy">
          {isLoading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#fff" />
            </View>
          ) : points.length > 1 ? (
            <LeafletMap points={points} />
          ) : (
            <View className="flex-1 items-center justify-center">
              <Text className="text-white/60 text-[13px]">—</Text>
            </View>
          )}
        </View>

        <ScrollView className="flex-1" contentContainerClassName="p-4">
          <View className="flex-row flex-wrap gap-3 mb-3">
            {segment.distance_meters != null && (
              <View className="bg-gray-100 rounded-lg px-3 py-2">
                <Text className="text-[11px] text-gray-500 font-bold uppercase">{t('creator.distance')}</Text>
                <Text className="text-[15px] font-bold text-brand-navy">
                  {(segment.distance_meters / 1000).toFixed(2)} km
                </Text>
              </View>
            )}
            {location ? (
              <View className="bg-gray-100 rounded-lg px-3 py-2 flex-row items-center gap-1.5">
                <MapPin size={14} color="#1a1a2e" />
                <Text className="text-[15px] font-bold text-brand-navy">{location}</Text>
              </View>
            ) : null}
          </View>
          {detailed?.description ? <RichDescription html={detailed.description} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

export default SegmentPreviewModal;
