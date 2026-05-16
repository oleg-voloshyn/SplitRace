import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { api } from '../api/client';

const initialTournament = {
  name: '',
  city: '',
  country: '',
  total_segments_count: '2',
  rated_segments_count: '1'
};

function NewTournamentScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [form, setForm] = useState(initialTournament);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await api.createTournament(form);
      Alert.alert(t('creator.title'), t('creator.tournamentCreated'));
      navigation.goBack();
    } catch (error) {
      Alert.alert(t('common.error'), error?.errors?.join(', ') || t('creator.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  function setField(key) {
    return (value) => setForm((current) => ({ ...current, [key]: value }));
  }

  return (
    <ScrollView className="flex-1 bg-gray-100" contentContainerClassName="p-4 pb-10">
      <Field label={t('creator.tournamentName')} value={form.name} onChangeText={setField('name')} />
      <Field label={t('creator.city')} value={form.city} onChangeText={setField('city')} />
      <Field label={t('creator.country')} value={form.country} onChangeText={setField('country')} />
      <View className="flex-row flex-wrap gap-2">
        <Field
          label={t('creator.totalSegments')}
          value={form.total_segments_count}
          onChangeText={setField('total_segments_count')}
          keyboardType="numeric"
          className="flex-grow basis-[47%]"
        />
        <Field
          label={t('creator.ratedSegments')}
          value={form.rated_segments_count}
          onChangeText={setField('rated_segments_count')}
          keyboardType="numeric"
          className="flex-grow basis-[47%]"
        />
      </View>

      <TouchableOpacity
        className={`bg-brand-red rounded-lg p-3.5 items-center mt-2 ${submitting ? 'opacity-60' : ''}`}
        onPress={handleSubmit}
        disabled={submitting}
      >
        <Text className="text-white font-bold text-[15px]">{submitting ? '...' : t('creator.createTournament')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, keyboardType, className = '' }) {
  return (
    <View className={`mb-3 ${className}`}>
      <Text className="text-xs text-gray-600 mb-1">{label}</Text>
      <TextInput
        className="border border-gray-300 rounded-lg p-2.5 text-sm bg-white"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
      />
    </View>
  );
}

export default NewTournamentScreen;
