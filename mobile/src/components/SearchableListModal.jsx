import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react-native';
import { FlatList, Modal, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Reusable bottom-sheet style searchable picker.
 *
 * items     — list of objects to choose from
 * keyFor    — (item) => unique key
 * labelFor  — (item) => primary text rendered in the row
 * leading   — optional (item) => node rendered on the left (eg. emoji flag)
 * subtitleFor — optional (item) => secondary text
 * filterFor — (item, query) => boolean, defaults to substring match on labelFor
 */
function SearchableListModal({
  visible,
  onClose,
  onSelect,
  title,
  searchPlaceholder,
  emptyText,
  items,
  keyFor,
  labelFor,
  leading,
  subtitleFor,
  filterFor
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!normalizedQuery) {
      return items;
    }
    if (filterFor) {
      return items.filter((item) => filterFor(item, normalizedQuery));
    }
    return items.filter((item) => labelFor(item).toLowerCase().includes(normalizedQuery));
  }, [items, normalizedQuery, filterFor, labelFor]);

  function handleSelect(item) {
    setQuery('');
    onSelect(item);
  }

  function handleClose() {
    setQuery('');
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose} presentationStyle="pageSheet">
      <View className="flex-1 bg-white">
        <View
          className="flex-row items-center justify-between px-4 pb-4 border-b border-gray-200"
          style={{ paddingTop: insets.top + 12 }}
        >
          <Text className="text-lg font-bold text-brand-navy">{title}</Text>
          <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <X size={22} color="#1a1a2e" />
          </TouchableOpacity>
        </View>

        <View className="px-4 py-3 border-b border-gray-100">
          <View className="flex-row items-center bg-gray-100 rounded-lg px-3">
            <Search size={16} color="#888" />
            <TextInput
              autoFocus
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor="#9ca3af"
              className="flex-1 py-2.5 px-2 text-[15px] text-brand-navy"
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <X size={16} color="#888" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <FlatList
          data={filtered}
          keyExtractor={(item) => keyFor(item)}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={<Text className="text-center text-gray-500 mt-10">{emptyText}</Text>}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => handleSelect(item)}
              className="flex-row items-center px-4 py-3 border-b border-gray-100"
            >
              {leading ? <View className="mr-3">{leading(item)}</View> : null}
              <View className="flex-1">
                <Text className="text-[15px] text-brand-navy">{labelFor(item)}</Text>
                {subtitleFor ? <Text className="text-xs text-gray-500 mt-0.5">{subtitleFor(item)}</Text> : null}
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
    </Modal>
  );
}

export default SearchableListModal;
