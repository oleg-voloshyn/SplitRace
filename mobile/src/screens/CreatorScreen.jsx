import { useNavigation } from '@react-navigation/native';
import { Map, Trophy } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';

function CreatorScreen() {
  const { t } = useTranslation();
  const navigation = useNavigation();

  return (
    <ScrollView className="flex-1 bg-gray-100" contentContainerClassName="p-4 pb-10">
      <Text className="text-sm text-gray-600 mb-4 leading-5">{t('creator.hubIntro')}</Text>

      <HubCard
        Icon={Map}
        iconBg="bg-red-50"
        iconColor="#e53935"
        badge={t('creator.segmentsBadge')}
        title={t('creator.newSegment')}
        subtitle={t('creator.newSegmentSubtitle')}
        cta={t('creator.createSegment')}
        onPress={() => navigation.navigate('NewSegment')}
      />

      <HubCard
        Icon={Trophy}
        iconBg="bg-amber-50"
        iconColor="#d97706"
        badge={t('nav.tournaments')}
        title={t('creator.newTournament')}
        subtitle={t('creator.newTournamentSubtitle')}
        cta={t('creator.createTournament')}
        onPress={() => navigation.navigate('NewTournament')}
      />
    </ScrollView>
  );
}

function HubCard({ Icon, iconBg, iconColor, badge, title, subtitle, cta, onPress }) {
  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className="bg-white rounded-2xl p-4 mb-3.5 border border-gray-200 shadow"
    >
      <View className={`w-[60px] h-[60px] rounded-xl items-center justify-center mb-3 ${iconBg}`}>
        <Icon size={32} color={iconColor} strokeWidth={2} />
      </View>
      <Text className="text-[11px] font-bold text-brand-red uppercase tracking-wider">{badge}</Text>
      <Text className="text-lg font-bold text-brand-navy mt-1">{title}</Text>
      <Text className="text-sm text-gray-600 leading-5 mt-1 mb-2">{subtitle}</Text>
      <Text className="text-sm font-semibold text-brand-navy">{cta} →</Text>
    </TouchableOpacity>
  );
}

export default CreatorScreen;
