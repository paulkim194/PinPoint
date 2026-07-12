import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORY_COLORS } from '../constants/categories';
import type { Landmark } from '../types';

interface SearchBarProps {
  query: string;
  onChangeQuery: (query: string) => void;
  results: Landmark[];
  onSelect: (landmark: Landmark) => void;
}

export default function SearchBar({ query, onChangeQuery, results, onSelect }: SearchBarProps) {
  const showResults = query.trim().length > 0;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.inputWrap}>
        <Text style={styles.icon}>Search</Text>
        <TextInput
          style={styles.input}
          placeholder="Find a landmark…"
          placeholderTextColor="#5b6472"
          value={query}
          onChangeText={onChangeQuery}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => onChangeQuery('')} hitSlop={10}>
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        )}
      </View>

      {showResults && (
        <View style={styles.resultsWrap}>
          {results.length === 0 ? (
            <Text style={styles.noResults}>No matches</Text>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              style={styles.resultsList}
              renderItem={({ item }) => (
                <Pressable style={styles.resultRow} onPress={() => onSelect(item)}>
                  <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[item.category] }]} />
                  <Text style={styles.resultText} numberOfLines={1}>
                    {item.name}
                  </Text>
                </Pressable>
              )}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { position: 'absolute', top: 12, left: 12, right: 12 },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(23,26,33,0.95)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262a35',
    paddingHorizontal: 12,
    height: 44,
  },
  icon: { color: '#5b6472', fontSize: 11, fontWeight: '700', marginRight: 8 },
  input: { flex: 1, color: '#e5e7eb', fontSize: 15 },
  clear: { color: '#8b92a3', fontSize: 16, paddingHorizontal: 4 },
  resultsWrap: {
    marginTop: 6,
    backgroundColor: 'rgba(23,26,33,0.97)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262a35',
    maxHeight: 220,
    overflow: 'hidden',
  },
  resultsList: { flexGrow: 0 },
  noResults: { color: '#8b92a3', fontSize: 13, padding: 14, textAlign: 'center' },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#262a35',
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 10 },
  resultText: { color: '#e5e7eb', fontSize: 14, fontWeight: '500' },
});
