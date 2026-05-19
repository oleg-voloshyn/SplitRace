import { Text, View } from 'react-native';
import FormTextInput from '../../components/form/FormTextInput';

function NameStep({ control, t }) {
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">{t('creator.tournamentName')}</Text>
      <View className="mt-3">
        <FormTextInput
          control={control}
          name="name"
          placeholder={t('creator.tournamentNamePlaceholder')}
          autoFocus
          maxLength={120}
          className="bg-white border border-gray-300 rounded-lg p-3.5 text-base"
        />
      </View>
    </View>
  );
}

export default NameStep;
