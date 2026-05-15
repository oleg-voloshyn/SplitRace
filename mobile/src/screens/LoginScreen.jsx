import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { SUPPORTED_LANGS } from '../i18n';

function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    gender: '',
    account_type: 'user',
    club_name: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const isClubRegistration = mode === 'register' && form.account_type === 'club';

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const setAccountType = (accountType) =>
    setForm((current) => ({
      ...current,
      account_type: accountType,
      club_name: accountType === 'club' ? current.club_name : '',
      first_name: accountType === 'user' ? current.first_name : '',
      last_name: accountType === 'user' ? current.last_name : '',
      gender: accountType === 'user' ? current.gender : ''
    }));

  function registrationPayload() {
    if (form.account_type === 'club') {
      return {
        account_type: 'club',
        club_name: form.club_name.trim(),
        email: form.email.trim(),
        password: form.password
      };
    }

    return {
      account_type: 'user',
      email: form.email.trim(),
      password: form.password,
      first_name: form.first_name,
      last_name: form.last_name,
      gender: form.gender
    };
  }

  async function submit() {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(form.email.trim(), form.password);
      } else {
        if (!isClubRegistration && !form.gender) {
          setError(t('auth.selectGender'));
          setLoading(false);
          return;
        }
        await register(registrationPayload());
      }
    } catch (e) {
      setError(e?.errors?.join(', ') || e?.error || t('auth.somethingWrong'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        {/* Language switcher in the top-right */}
        <View style={s.langRow}>
          {SUPPORTED_LANGS.map((l) => (
            <TouchableOpacity key={l.code} onPress={() => i18n.changeLanguage(l.code)} style={s.langPill}>
              <Text style={[s.langPillText, i18n.language === l.code && s.langPillActive]}>{l.code.toUpperCase()}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={s.logo}>SplitRace</Text>
        <Text style={s.subtitle}>{t('auth.subtitle')}</Text>

        <View style={s.card}>
          <View style={s.tabs}>
            {['login', 'register'].map((m) => (
              <TouchableOpacity
                key={m}
                style={[s.tab, mode === m && s.tabActive]}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
              >
                <Text style={[s.tabText, mode === m && s.tabTextActive]}>
                  {m === 'login' ? t('auth.signIn') : t('auth.register')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'register' && (
            <>
              <Text style={s.label}>{t('auth.accountType')}</Text>
              <View style={s.genderRow}>
                {['user', 'club'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[s.genderBtn, form.account_type === type && s.genderBtnActive]}
                    onPress={() => setAccountType(type)}
                  >
                    <Text style={[s.genderText, form.account_type === type && s.genderTextActive]}>
                      {t(`auth.account_${type}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {form.account_type === 'club' && (
                <TextInput
                  style={s.input}
                  placeholder={t('auth.clubName')}
                  value={form.club_name}
                  onChangeText={set('club_name')}
                />
              )}
              {!isClubRegistration && (
                <>
                  <TextInput
                    style={s.input}
                    placeholder={t('auth.firstName')}
                    value={form.first_name}
                    onChangeText={set('first_name')}
                  />
                  <TextInput
                    style={s.input}
                    placeholder={t('auth.lastName')}
                    value={form.last_name}
                    onChangeText={set('last_name')}
                  />
                  <Text style={s.label}>{t('auth.gender')}</Text>
                  <View style={s.genderRow}>
                    {['male', 'female', 'other'].map((g) => (
                      <TouchableOpacity
                        key={g}
                        style={[s.genderBtn, form.gender === g && s.genderBtnActive]}
                        onPress={() => set('gender')(g)}
                      >
                        <Text style={[s.genderText, form.gender === g && s.genderTextActive]}>
                          {t(`auth.gender_${g}`)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          <TextInput
            style={s.input}
            placeholder={t('auth.email')}
            value={form.email}
            onChangeText={set('email')}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            style={s.input}
            placeholder={t('auth.password')}
            value={form.password}
            onChangeText={set('password')}
            secureTextEntry
          />

          {error && <Text style={s.error}>{error}</Text>}

          <TouchableOpacity style={s.btn} onPress={submit} disabled={loading}>
            <Text style={s.btnText}>
              {loading ? '...' : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#1a1a2e' },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  langRow: { flexDirection: 'row', gap: 8, justifyContent: 'flex-end', marginBottom: 12 },
  langPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  langPillText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, fontWeight: '700' },
  langPillActive: { color: '#e53935' },
  logo: { fontSize: 32, fontWeight: '800', color: '#fff', textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', textAlign: 'center', marginBottom: 32 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 20 },
  tabs: { flexDirection: 'row', marginBottom: 20, borderRadius: 8, overflow: 'hidden', backgroundColor: '#f0f0f0' },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#1a1a2e' },
  tabText: { fontSize: 14, color: '#555' },
  tabTextActive: { color: '#fff', fontWeight: '600' },
  label: { fontSize: 13, color: '#555', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 15 },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  genderBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center'
  },
  genderBtnActive: { borderColor: '#1a1a2e', backgroundColor: '#1a1a2e' },
  genderText: { color: '#555', fontSize: 14 },
  genderTextActive: { color: '#fff', fontWeight: '600' },
  error: { color: '#e53935', fontSize: 13, marginBottom: 10, textAlign: 'center' },
  btn: { backgroundColor: '#e53935', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 }
});

export default LoginScreen;
