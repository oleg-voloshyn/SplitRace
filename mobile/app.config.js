const env = (...keys) => keys.map((key) => process.env[key]).find(Boolean) || '';

module.exports = ({ config }) => ({
  ...config,
  scheme: 'splitrace',
  extra: {
    ...config.extra,
    googleOAuth: {
      expoClientId: env('EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID', 'GOOGLE_EXPO_CLIENT_ID'),
      iosClientId: env('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID', 'GOOGLE_IOS_CLIENT_ID'),
      androidClientId: env('EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID', 'GOOGLE_ANDROID_CLIENT_ID'),
      webClientId: env('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'GOOGLE_WEB_CLIENT_ID', 'GOOGLE_CLIENT_ID')
    }
  }
});
