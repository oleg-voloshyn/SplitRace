import { useEffect, useRef, useState } from 'react';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import Constants from 'expo-constants';
import * as WebBrowser from 'expo-web-browser';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import FormTextInput from '../components/form/FormTextInput';
import { useAuth } from '../contexts/AuthContext';
import { SUPPORTED_LANGS } from '../i18n';

WebBrowser.maybeCompleteAuthSession();

function googleOAuthConfig() {
  return Constants.expoConfig?.extra?.googleOAuth || {};
}

// Returns true only if there is a clientId usable for the current platform.
// Calling `Google.useIdTokenAuthRequest` without the right platform-specific
// clientId throws at render time (e.g. "androidClientId must be defined").
function googleConfiguredForPlatform() {
  const cfg = googleOAuthConfig();
  if (Platform.OS === 'android') {
    return Boolean(cfg.androidClientId || cfg.expoClientId);
  }
  if (Platform.OS === 'ios') {
    return Boolean(cfg.iosClientId || cfg.expoClientId);
  }
  return Boolean(cfg.webClientId || cfg.expoClientId);
}

const DEFAULT_VALUES = {
  email: '',
  password: '',
  first_name: '',
  last_name: '',
  gender: '',
  account_type: 'user',
  club_name: ''
};

function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { login, loginWithApple, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const googleAvailable = googleConfiguredForPlatform();

  const { control, handleSubmit, setValue } = useForm({ defaultValues: DEFAULT_VALUES });
  const accountType = useWatch({ control, name: 'account_type' });
  const isClubRegistration = mode === 'register' && accountType === 'club';

  function setAccountType(nextType) {
    setValue('account_type', nextType);
    if (nextType === 'club') {
      setValue('first_name', '');
      setValue('last_name', '');
      setValue('gender', '');
    } else {
      setValue('club_name', '');
    }
  }

  function registrationPayload(values) {
    if (values.account_type === 'club') {
      return {
        account_type: 'club',
        club_name: values.club_name.trim(),
        email: values.email.trim(),
        password: values.password
      };
    }

    return {
      account_type: 'user',
      email: values.email.trim(),
      password: values.password,
      first_name: values.first_name,
      last_name: values.last_name,
      gender: values.gender
    };
  }

  const submit = handleSubmit(async (values) => {
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(values.email.trim(), values.password);
      } else {
        if (values.account_type !== 'club' && !values.gender) {
          setError(t('auth.selectGender'));
          setLoading(false);
          return;
        }
        await register(registrationPayload(values));
      }
    } catch (e) {
      setError(e?.errors?.join(', ') || e?.error || t('auth.somethingWrong'));
    } finally {
      setLoading(false);
    }
  });

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
                      accountType === type ? 'border-brand-navy bg-brand-navy' : 'border-gray-300'
                    }`}
                    onPress={() => setAccountType(type)}
                  >
                    <Text className={`text-sm ${accountType === type ? 'text-white font-semibold' : 'text-gray-700'}`}>
                      {t(`auth.account_${type}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {accountType === 'club' && (
                <View className="mb-3">
                  <FormTextInput control={control} name="club_name" placeholder={t('auth.clubName')} />
                </View>
              )}
              {!isClubRegistration && (
                <>
                  <View className="mb-3">
                    <FormTextInput control={control} name="first_name" placeholder={t('auth.firstName')} />
                  </View>
                  <View className="mb-3">
                    <FormTextInput control={control} name="last_name" placeholder={t('auth.lastName')} />
                  </View>
                  <Text className="text-[13px] text-gray-700 mb-1.5">{t('auth.gender')}</Text>
                  <Controller
                    control={control}
                    name="gender"
                    render={({ field: { value, onChange } }) => (
                      <View className="flex-row gap-2.5 mb-4">
                        {['male', 'female', 'other'].map((g) => (
                          <TouchableOpacity
                            key={g}
                            className={`flex-1 border rounded-lg py-2.5 items-center ${
                              value === g ? 'border-brand-navy bg-brand-navy' : 'border-gray-300'
                            }`}
                            onPress={() => onChange(g)}
                          >
                            <Text className={`text-sm ${value === g ? 'text-white font-semibold' : 'text-gray-700'}`}>
                              {t(`auth.gender_${g}`)}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  />
                </>
              )}
            </>
          )}

          <View className="mb-3">
            <FormTextInput
              control={control}
              name="email"
              placeholder={t('auth.email')}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>
          <View className="mb-3">
            <FormTextInput control={control} name="password" placeholder={t('auth.password')} secureTextEntry />
          </View>

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

          {!isClubRegistration && (googleAvailable || Platform.OS === 'ios') && (
            <>
              <View className="flex-row items-center gap-2.5 my-4">
                <View className="flex-1 h-px bg-gray-200" />
                <Text className="text-gray-500 text-xs">{t('auth.orContinueWith')}</Text>
                <View className="flex-1 h-px bg-gray-200" />
              </View>
              {googleAvailable && <GoogleSignInButton onError={setError} />}
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

// Google hook (`useIdTokenAuthRequest`) throws when the platform-specific
// clientId is missing — keep it inside a separate component that's only
// mounted when we know we have config. That way LoginScreen still renders
// fine on devices without any Google credentials.
function GoogleSignInButton({ onError }) {
  const { t } = useTranslation();
  const { loginWithGoogle } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const handledTokenRef = useRef(null);
  const cfg = googleOAuthConfig();
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId: cfg.expoClientId || cfg.webClientId || undefined,
    iosClientId: cfg.iosClientId || undefined,
    androidClientId: cfg.androidClientId || undefined,
    webClientId: cfg.webClientId || undefined
  });

  useEffect(() => {
    if (response?.type !== 'success') {
      return;
    }
    const idToken = response.params?.id_token;
    if (!idToken) {
      queueMicrotask(() => {
        onError(t('auth.googleFailed'));
        setGoogleLoading(false);
      });
      return;
    }
    if (handledTokenRef.current === idToken) {
      return;
    }
    handledTokenRef.current = idToken;
    loginWithGoogle(idToken)
      .catch((e) => onError(e?.errors?.join(', ') || e?.error || t('auth.googleFailed')))
      .finally(() => setGoogleLoading(false));
  }, [response, loginWithGoogle, onError, t]);

  async function submitGoogle() {
    onError(null);
    setGoogleLoading(true);
    const result = await promptAsync().catch(() => ({ type: 'error' }));
    if (result?.type !== 'success') {
      setGoogleLoading(false);
    }
  }

  return (
    <TouchableOpacity
      className={`border border-gray-300 rounded-lg p-3.5 items-center bg-white ${
        !request || googleLoading ? 'opacity-60' : ''
      }`}
      onPress={submitGoogle}
      disabled={!request || googleLoading}
    >
      <Text className="text-brand-navy font-bold text-[15px]">
        {googleLoading ? '...' : t('auth.continueWithGoogle')}
      </Text>
    </TouchableOpacity>
  );
}

export default LoginScreen;
