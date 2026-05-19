import { Text, TextInput, View } from 'react-native';

function DescriptionStep({ form, setField, t }) {
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">{t('creator.description')}</Text>
      <TextInput
        className="bg-white border border-gray-300 rounded-lg p-3.5 text-base mt-3 min-h-[140px]"
        value={form.description}
        onChangeText={(v) => setField('description', v)}
        placeholder={t('creator.descriptionPlaceholder')}
        placeholderTextColor="#9ca3af"
        multiline
        textAlignVertical="top"
        maxLength={10000}
      />
    </View>
  );
}

export default DescriptionStep;
