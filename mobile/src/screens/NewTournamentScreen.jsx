import { useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <Field label={t('creator.tournamentName')} value={form.name} onChangeText={setField('name')} />
      <Field label={t('creator.city')} value={form.city} onChangeText={setField('city')} />
      <Field label={t('creator.country')} value={form.country} onChangeText={setField('country')} />
      <View style={s.grid}>
        <Field
          label={t('creator.totalSegments')}
          value={form.total_segments_count}
          onChangeText={setField('total_segments_count')}
          keyboardType="numeric"
        />
        <Field
          label={t('creator.ratedSegments')}
          value={form.rated_segments_count}
          onChangeText={setField('rated_segments_count')}
          keyboardType="numeric"
        />
      </View>

      <TouchableOpacity style={[s.primaryBtn, submitting && s.disabled]} onPress={handleSubmit} disabled={submitting}>
        <Text style={s.primaryBtnText}>{submitting ? '...' : t('creator.createTournament')}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

function Field({ label, value, onChangeText, keyboardType }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput style={s.input} value={value} onChangeText={onChangeText} keyboardType={keyboardType} />
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 16, paddingBottom: 40 },
  field: { marginBottom: 12, flexGrow: 1, flexBasis: '47%' },
  label: { color: '#666', fontSize: 12, marginBottom: 4 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#fff'
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryBtn: { backgroundColor: '#e53935', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 8 },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  disabled: { opacity: 0.6 }
});

export default NewTournamentScreen;
