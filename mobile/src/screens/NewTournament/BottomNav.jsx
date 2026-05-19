import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { Text, TouchableOpacity, View } from 'react-native';

function BottomNav({ step, totalSteps, canGoNext, canSubmit, submitting, onBack, onNext, onSubmit, t }) {
  const isFirst = step === 1;
  const isLast = step === totalSteps;
  return (
    <View className="flex-row gap-3 bg-white border-t border-gray-200 px-4 py-3">
      <TouchableOpacity
        onPress={onBack}
        disabled={isFirst}
        className={`flex-row items-center justify-center px-4 py-3 rounded-lg border ${
          isFirst ? 'border-gray-200 opacity-40' : 'border-gray-300'
        }`}
      >
        <ChevronLeft size={18} color="#1a1a2e" />
        <Text className="text-brand-navy font-bold ml-1">{t('creator.back')}</Text>
      </TouchableOpacity>

      {isLast ? (
        <TouchableOpacity
          onPress={onSubmit}
          disabled={!canSubmit || submitting}
          className={`flex-1 items-center justify-center py-3 rounded-lg bg-brand-red ${
            !canSubmit || submitting ? 'opacity-60' : ''
          }`}
        >
          <Text className="text-white font-bold text-base">{submitting ? '...' : t('creator.createTournament')}</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={onNext}
          disabled={!canGoNext}
          className={`flex-1 flex-row items-center justify-center py-3 rounded-lg bg-brand-red ${
            !canGoNext ? 'opacity-60' : ''
          }`}
        >
          <Text className="text-white font-bold text-base">{t('creator.next')}</Text>
          <ChevronRight size={18} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default BottomNav;
