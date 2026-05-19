import { Calendar } from 'lucide-react-native';
import { Controller, useWatch } from 'react-hook-form';
import { Text, TextInput, View } from 'react-native';
import { formatDateInput, getTournamentDateValidation } from '../../utils/tournamentDates';

function DatesStep({ control, t }) {
  const startsAt = useWatch({ control, name: 'startsAt' });
  const endsAt = useWatch({ control, name: 'endsAt' });
  const validation = getTournamentDateValidation(startsAt, endsAt);
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">{t('creator.tournamentDates')}</Text>
      <Text className="text-xs text-gray-500 mt-1 leading-[18px]">{t('creator.tournamentDatesHelp')}</Text>

      <DateField
        control={control}
        name="startsAt"
        label={t('creator.startsAt')}
        placeholder={t('creator.datePlaceholder')}
        error={validation.startError ? t(validation.startError) : null}
        t={t}
      />

      <DateField
        control={control}
        name="endsAt"
        label={t('creator.endsAt')}
        placeholder={t('creator.datePlaceholder')}
        error={validation.endError ? t(validation.endError) : null}
        t={t}
      />

      <View className="bg-white rounded-lg border border-gray-200 px-3 py-2.5 mt-4">
        <Text className="text-[12px] text-gray-500 leading-[17px]">
          {t('creator.dateInputHelp', { date: validation.today })}
        </Text>
      </View>
    </View>
  );
}

function DateField({ control, name, label, placeholder, error, t }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { value, onChange } }) => (
        <View className="mt-4">
          <Text className="text-sm font-semibold text-brand-navy mb-1.5">{label}</Text>
          <View
            className={`flex-row items-center bg-white border rounded-lg px-3 ${
              error ? 'border-red-500' : 'border-gray-300'
            }`}
          >
            <Calendar size={16} color={error ? '#dc2626' : '#6b7280'} />
            <TextInput
              className="flex-1 p-3 text-base text-brand-navy"
              value={value}
              onChangeText={(v) => onChange(formatDateInput(v))}
              placeholder={placeholder}
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={10}
            />
          </View>
          {error ? (
            <Text className="text-red-600 text-xs mt-1.5 leading-[16px]">{error}</Text>
          ) : (
            <Text className="text-gray-500 text-xs mt-1.5 leading-[16px]">{t('creator.datePlaceholder')}</Text>
          )}
        </View>
      )}
    />
  );
}

export default DatesStep;
