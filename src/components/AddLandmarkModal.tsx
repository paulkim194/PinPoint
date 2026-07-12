import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { CATEGORY_COLORS, CATEGORY_LABELS, CATEGORY_ORDER } from '../constants/categories';
import type { LandmarkCategory } from '../types';

interface AddLandmarkModalProps {
  visible: boolean;
  title: string;
  initialName?: string;
  initialCategory?: LandmarkCategory;
  onCancel: () => void;
  onSubmit: (name: string, category: LandmarkCategory) => void;
}

export default function AddLandmarkModal({
  visible,
  title,
  initialName = '',
  initialCategory = 'other',
  onCancel,
  onSubmit,
}: AddLandmarkModalProps) {
  const [name, setName] = useState(initialName);
  const [category, setCategory] = useState<LandmarkCategory>(initialCategory);

  // Reset local form state each time the modal is (re)opened.
  useEffect(() => {
    if (visible) {
      setName(initialName);
      setCategory(initialCategory);
    }
  }, [visible, initialName, initialCategory]);

  const canSubmit = name.trim().length > 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>

          <TextInput
            style={styles.input}
            placeholder="Landmark name"
            placeholderTextColor="#5b6472"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <View style={styles.chipRow}>
            {CATEGORY_ORDER.map((cat) => {
              const active = category === cat;
              return (
                <Pressable
                  key={cat}
                  style={[
                    styles.chip,
                    { borderColor: CATEGORY_COLORS[cat] },
                    active && { backgroundColor: CATEGORY_COLORS[cat] },
                  ]}
                  onPress={() => setCategory(cat)}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>
                    {CATEGORY_LABELS[cat]}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.buttonRow}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.saveButton, !canSubmit && styles.disabled]}
              disabled={!canSubmit}
              onPress={() => onSubmit(name.trim(), category)}
            >
              <Text style={styles.saveButtonText}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: '#171a21',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#262a35',
  },
  title: { color: '#e5e7eb', fontSize: 17, fontWeight: '700', marginBottom: 14 },
  input: {
    backgroundColor: '#0f1115',
    borderWidth: 1,
    borderColor: '#262a35',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e5e7eb',
    fontSize: 16,
    marginBottom: 14,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 18 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  chipText: { color: '#e5e7eb', fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#0f1115' },
  buttonRow: { flexDirection: 'row', gap: 10 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  cancelButton: { backgroundColor: '#0f1115', borderWidth: 1, borderColor: '#262a35' },
  cancelButtonText: { color: '#e5e7eb', fontSize: 15, fontWeight: '600' },
  saveButton: { backgroundColor: '#3b82f6' },
  saveButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});
