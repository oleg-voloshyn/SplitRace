import { Text, TextInput, View } from 'react-native';

function NameStep({ form, setField, t }) {
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">{t('creator.tournamentName')}</Text>
      <TextInput
        className="bg-white border border-gray-300 rounded-lg p-3.5 text-base mt-3"
        value={form.name}
        onChangeText={(v) => setField('name', v)}
        placeholder={t('creator.tournamentNamePlaceholder')}
        placeholderTextColor="#9ca3af"
        autoFocus
        maxLength={120}
      />
    </View>
  );
}

export default NameStep;
