import { Text, TextInput, View } from 'react-native';

function SegmentsCountStep({ form, setField, t }) {
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-3">{t('creator.tournamentSegments')}</Text>

      <View>
        <Text className="text-sm font-semibold text-brand-navy mb-1">{t('creator.totalSegments')}</Text>
        <Text className="text-xs text-gray-500 mb-2 leading-[18px]">{t('creator.totalSegmentsHelp')}</Text>
        <TextInput
          className="bg-white border border-gray-300 rounded-lg p-3.5 text-base w-24"
          value={form.totalSegments}
          onChangeText={(v) => setField('totalSegments', v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          maxLength={3}
        />
      </View>

      <View className="mt-5">
        <Text className="text-sm font-semibold text-brand-navy mb-1">{t('creator.ratedSegments')}</Text>
        <Text className="text-xs text-gray-500 mb-2 leading-[18px]">{t('creator.ratedSegmentsHelp')}</Text>
        <TextInput
          className="bg-white border border-gray-300 rounded-lg p-3.5 text-base w-24"
          value={form.ratedSegments}
          onChangeText={(v) => setField('ratedSegments', v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          maxLength={3}
        />
      </View>
    </View>
  );
}

export default SegmentsCountStep;
