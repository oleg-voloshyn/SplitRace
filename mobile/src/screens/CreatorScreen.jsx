import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

function CreatorScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.container}>
      <Text style={s.intro}>{t('creator.hubIntro')}</Text>

      <TouchableOpacity style={s.card} onPress={() => navigation.navigate('NewSegment')} activeOpacity={0.8}>
        <View style={[s.iconWrap, { backgroundColor: '#fff3f3' }]}>
          <Text style={s.icon}>🗺️</Text>
        </View>
        <View style={s.body}>
          <Text style={s.badge}>{t('creator.segments')}</Text>
          <Text style={s.title}>{t('creator.newSegment')}</Text>
          <Text style={s.subtitle}>{t('creator.newSegmentSubtitle')}</Text>
          <Text style={s.cta}>{t('creator.createSegment')} →</Text>
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={s.card} onPress={() => navigation.navigate('NewTournament')} activeOpacity={0.8}>
        <View style={[s.iconWrap, { backgroundColor: '#fff8e1' }]}>
          <Text style={s.icon}>🏆</Text>
        </View>
        <View style={s.body}>
          <Text style={s.badge}>{t('nav.tournaments')}</Text>
          <Text style={s.title}>{t('creator.newTournament')}</Text>
          <Text style={s.subtitle}>{t('creator.newTournamentSubtitle')}</Text>
          <Text style={s.cta}>{t('creator.createTournament')} →</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: '#f5f5f5' },
  container: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 13, color: '#666', marginBottom: 16, lineHeight: 18 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#eee',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }
  },
  iconWrap: {
    width: 60,
    height: 60,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12
  },
  icon: { fontSize: 32 },
  body: { gap: 4 },
  badge: { fontSize: 11, fontWeight: '700', color: '#e53935', letterSpacing: 0.5, textTransform: 'uppercase' },
  title: { fontSize: 18, fontWeight: '700', color: '#1a1a2e' },
  subtitle: { fontSize: 13, color: '#666', lineHeight: 18, marginBottom: 8 },
  cta: { fontSize: 14, color: '#1a1a2e', fontWeight: '600' }
});

export default CreatorScreen;
