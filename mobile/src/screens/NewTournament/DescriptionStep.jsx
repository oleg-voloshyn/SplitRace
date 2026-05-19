import { Text, View } from 'react-native';
import FormTextInput from '../../components/form/FormTextInput';

function DescriptionStep({ control, t }) {
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">{t('creator.description')}</Text>
      <View className="mt-3">
        <FormTextInput
          control={control}
          name="description"
          placeholder={t('creator.descriptionPlaceholder')}
          multiline
          textAlignVertical="top"
          maxLength={10000}
          className="bg-white border border-gray-300 rounded-lg p-3.5 text-base min-h-[140px]"
        />
      </View>
    </View>
  );
}

export default DescriptionStep;
