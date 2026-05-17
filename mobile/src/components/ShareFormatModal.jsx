import { X } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Modal, Text, TouchableOpacity, View } from 'react-native';
import { RUN_SHARE_FORMATS } from './RunShareCard';

/**
 * Bottom-sheet modal that asks the user which aspect ratio they want
 * for the generated share image. Tapping a tile fires onSelect(format).
 */
function ShareFormatModal({ visible, onClose, onSelect, title }) {
  const { t } = useTranslation();
  const formats = Object.values(RUN_SHARE_FORMATS);

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-white rounded-t-3xl p-5 pb-8">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-bold text-brand-navy">{title || t('tournaments.shareFormat')}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <X size={20} color="#1a1a2e" />
            </TouchableOpacity>
          </View>

          <View className="flex-row gap-3">
            {formats.map((format) => (
              <TouchableOpacity
                key={format.key}
                onPress={() => onSelect(format.key)}
                className="flex-1 items-center"
                activeOpacity={0.7}
              >
                <FormatPreview format={format} />
                <Text className="text-brand-navy font-bold text-[13px] mt-2">{format.label}</Text>
                <Text className="text-gray-500 text-[11px]">{format.ratio}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// Simple visual hint of each format's aspect ratio
function FormatPreview({ format }) {
  const ratio = format.height / format.width;
  const w = 70;
  const h = Math.min(w * ratio, 105);
  return (
    <View
      className="bg-brand-navy rounded-lg items-center justify-center border-2 border-gray-200"
      style={{ width: w, height: h }}
    >
      <View className="w-3/4 h-1.5 bg-brand-red rounded-full mb-1" />
      <View className="w-2/3 h-1 bg-white/30 rounded-full" />
    </View>
  );
}

export default ShareFormatModal;
