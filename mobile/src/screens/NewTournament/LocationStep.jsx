import { ChevronRight, MapPin } from 'lucide-react-native';
import { Text, TouchableOpacity, View } from 'react-native';

function LocationStep({ form, cities, onPickCountry, onPickCity, onClearCity, t }) {
  const hasCountry = Boolean(form.country);
  return (
    <View>
      <Text className="text-xl font-bold text-brand-navy mb-1">
        {t('creator.country')} & {t('creator.city')}
      </Text>

      <Text className="text-xs text-gray-500 mt-3 mb-1.5">{t('creator.country')}</Text>
      <TouchableOpacity
        onPress={onPickCountry}
        className="flex-row items-center bg-white border border-gray-300 rounded-lg p-3.5"
      >
        <MapPin size={16} color="#6b7280" />
        <Text className={`ml-2 flex-1 text-base ${hasCountry ? 'text-brand-navy' : 'text-gray-400'}`}>
          {hasCountry ? form.countryLabel : t('creator.selectCountry')}
        </Text>
        <ChevronRight size={18} color="#9ca3af" />
      </TouchableOpacity>

      <Text className="text-xs text-gray-500 mt-4 mb-1.5">{t('creator.city')}</Text>
      <TouchableOpacity
        onPress={hasCountry ? onPickCity : undefined}
        disabled={!hasCountry}
        className={`flex-row items-center bg-white border rounded-lg p-3.5 ${
          hasCountry ? 'border-gray-300' : 'border-gray-200 opacity-60'
        }`}
      >
        <Text className={`flex-1 text-base ${form.city ? 'text-brand-navy' : 'text-gray-400'}`}>
          {form.city || (hasCountry ? t('creator.selectCity') : t('creator.selectCountryFirst'))}
        </Text>
        {form.city ? (
          <TouchableOpacity onPress={onClearCity} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text className="text-brand-red font-bold">×</Text>
          </TouchableOpacity>
        ) : (
          <ChevronRight size={18} color="#9ca3af" />
        )}
      </TouchableOpacity>
      {hasCountry && cities.length === 0 && (
        <Text className="text-xs text-gray-500 mt-2">{t('creator.noResults')}</Text>
      )}
    </View>
  );
}

export default LocationStep;
