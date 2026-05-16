import { useEffect, useRef, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { SUPPORTED_LANGS } from '../i18n';

WebBrowser.maybeCompleteAuthSession();

function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { login, loginWithGoogle, loginWithApple, register } = useAuth();
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const handledGoogleTokenRef = useRef(null);
  const isClubRegistration = mode === 'register' && form.account_type === 'club';
  const googleOAuth = Constants.expoConfig?.extra?.googleOAuth || {};
  const googleConfigured = Boolean(
    googleOAuth.expoClientId || googleOAuth.iosClientId || googleOAuth.androidClientId || googleOAuth.webClientId
  );
  const [googleRequest, googleResponse, promptGoogleAsync] = Google.useIdTokenAuthRequest({
    clientId: googleOAuth.expoClientId || googleOAuth.webClientId || undefined,
    iosClientId: googleOAuth.iosClientId || undefined,
    androidClientId: googleOAuth.androidClientId || undefined,
    webClientId: googleOAuth.webClientId || undefined
  });

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

  useEffect(() => {
    if (googleResponse?.type !== 'success') {
      return;
    }

    const idToken = googleResponse.params?.id_token;
    if (!idToken) {
      queueMicrotask(() => {
        setError(t('auth.googleFailed'));
        setGoogleLoading(false);
      });
      return;
    }
    if (handledGoogleTokenRef.current === idToken) {
      return;
    }

    handledGoogleTokenRef.current = idToken;
    loginWithGoogle(idToken)
      .catch((e) => setError(e?.errors?.join(', ') || e?.error || t('auth.googleFailed')))
      .finally(() => setGoogleLoading(false));
  }, [googleResponse, loginWithGoogle, t]);

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

  async function submitGoogle() {
    setError(null);
    if (!googleConfigured) {
      setError(t('auth.googleNotConfigured'));
      return;
    }

    setGoogleLoading(true);
    const response = await promptGoogleAsync().catch(() => ({ type: 'error' }));
    if (response?.type !== 'success') {
      setGoogleLoading(false);
    }
  }

  async function submitApple() {
    setError(null);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL
        ]
      });
      const firstName = credential.fullName?.givenName || null;
      const lastName = credential.fullName?.familyName || null;
      await loginWithApple(credential.identityToken, firstName, lastName);
    } catch (e) {
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        setError(e?.error || t('auth.appleFailed'));
      }
    }
  }

  return (
    <KeyboardAvoidingView className="flex-1 bg-brand-navy" behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerClassName="grow justify-center p-6" keyboardShouldPersistTaps="handled">
        <View className="flex-row gap-2 justify-end mb-3">
          {SUPPORTED_LANGS.map((l) => (
            <TouchableOpacity
              key={l.code}
              onPress={() => i18n.changeLanguage(l.code)}
              className="px-2.5 py-1 rounded-xl bg-white/10"
            >
              <Text className={`text-xs font-bold ${i18n.language === l.code ? 'text-brand-red' : 'text-white/60'}`}>
                {l.code.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text className="text-3xl font-extrabold text-white text-center mb-1">SplitRace</Text>
        <Text className="text-[13px] text-white/50 text-center mb-8">{t('auth.subtitle')}</Text>

        <View className="bg-white rounded-2xl p-5">
          <View className="flex-row mb-5 rounded-lg overflow-hidden bg-gray-100">
            {['login', 'register'].map((m) => (
              <TouchableOpacity
                key={m}
                className={`flex-1 py-2.5 items-center ${mode === m ? 'bg-brand-navy' : ''}`}
                onPress={() => {
                  setMode(m);
                  setError(null);
                }}
              >
                <Text className={`text-sm ${mode === m ? 'text-white font-semibold' : 'text-gray-700'}`}>
                  {m === 'login' ? t('auth.signIn') : t('auth.register')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'register' && (
            <>
              <Text className="text-[13px] text-gray-700 mb-1.5">{t('auth.accountType')}</Text>
              <View className="flex-row gap-2.5 mb-4">
                {['user', 'club'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    className={`flex-1 border rounded-lg py-2.5 items-center ${
                      form.account_type === type ? 'border-brand-navy bg-brand-navy' : 'border-gray-300'
                    }`}
                    onPress={() => setAccountType(type)}
                  >
                    <Text
                      className={`text-sm ${
                        form.account_type === type ? 'text-white font-semibold' : 'text-gray-700'
                      }`}
                    >
                      {t(`auth.account_${type}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {form.account_type === 'club' && (
                <TextInput
                  className="border border-gray-300 rounded-lg p-3 mb-3 text-[15px]"
                  placeholder={t('auth.clubName')}
                  value={form.club_name}
                  onChangeText={set('club_name')}
                />
              )}
              {!isClubRegistration && (
                <>
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 mb-3 text-[15px]"
                    placeholder={t('auth.firstName')}
                    value={form.first_name}
                    onChangeText={set('first_name')}
                  />
                  <TextInput
                    className="border border-gray-300 rounded-lg p-3 mb-3 text-[15px]"
                    placeholder={t('auth.lastName')}
                    value={form.last_name}
                    onChangeText={set('last_name')}
                  />
                  <Text className="text-[13px] text-gray-700 mb-1.5">{t('auth.gender')}</Text>
                  <View className="flex-row gap-2.5 mb-4">
                    {['male', 'female', 'other'].map((g) => (
                      <TouchableOpacity
                        key={g}
                        className={`flex-1 border rounded-lg py-2.5 items-center ${
                          form.gender === g ? 'border-brand-navy bg-brand-navy' : 'border-gray-300'
                        }`}
                        onPress={() => set('gender')(g)}
                      >
                        <Text
                          className={`text-sm ${
                            form.gender === g ? 'text-white font-semibold' : 'text-gray-700'
                          }`}
                        >
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
            className="border border-gray-300 rounded-lg p-3 mb-3 text-[15px]"
            placeholder={t('auth.email')}
            value={form.email}
            onChangeText={set('email')}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            className="border border-gray-300 rounded-lg p-3 mb-3 text-[15px]"
            placeholder={t('auth.password')}
            value={form.password}
            onChangeText={set('password')}
            secureTextEntry
          />

          {error && <Text className="text-brand-red text-[13px] mb-2.5 text-center">{error}</Text>}

          <TouchableOpacity
            className="bg-brand-red rounded-lg p-3.5 items-center mt-1"
            onPress={submit}
            disabled={loading}
          >
            <Text className="text-white font-bold text-base">
              {loading ? '...' : mode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
            </Text>
          </TouchableOpacity>

          {!isClubRegistration && (
            <>
              <View className="flex-row items-center gap-2.5 my-4">
                <View className="flex-1 h-px bg-gray-200" />
                <Text className="text-gray-500 text-xs">{t('auth.orContinueWith')}</Text>
                <View className="flex-1 h-px bg-gray-200" />
              </View>
              <TouchableOpacity
                className={`border border-gray-300 rounded-lg p-3.5 items-center bg-white ${
                  !googleRequest || googleLoading ? 'opacity-60' : ''
                }`}
                onPress={submitGoogle}
                disabled={!googleRequest || googleLoading}
              >
                <Text className="text-brand-navy font-bold text-[15px]">
                  {googleLoading ? '...' : t('auth.continueWithGoogle')}
                </Text>
              </TouchableOpacity>
              {Platform.OS === 'ios' && (
                <AppleAuthentication.AppleAuthenticationButton
                  buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
                  buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
                  cornerRadius={8}
                  style={{ width: '100%', height: 50, marginTop: 12 }}
                  onPress={submitApple}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export default LoginScreen;
