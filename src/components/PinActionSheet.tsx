import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Landmark } from '../types';

interface PinActionSheetProps {
  landmark: Landmark | null;
  onRename: () => void;
  onMove: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export default function PinActionSheet({ landmark, onRename, onMove, onDelete, onClose }: PinActionSheetProps) {
  return (
    <Modal visible={!!landmark} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title} numberOfLines={1}>
            {landmark?.name}
          </Text>

          <Pressable style={styles.row} onPress={onRename}>
            <Text style={styles.rowText}>Rename</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={onMove}>
            <Text style={styles.rowText}>Move</Text>
          </Pressable>
          <Pressable style={styles.row} onPress={onDelete}>
            <Text style={[styles.rowText, styles.destructive]}>Delete</Text>
          </Pressable>

          <Pressable style={[styles.row, styles.cancelRow]} onPress={onClose}>
            <Text style={styles.rowText}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#171a21',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 32,
    paddingHorizontal: 20,
  },
  title: { color: '#8b92a3', fontSize: 13, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  row: { paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#262a35' },
  rowText: { color: '#e5e7eb', fontSize: 16, fontWeight: '600', textAlign: 'center' },
  destructive: { color: '#f87171' },
  cancelRow: { marginTop: 8, borderTopWidth: 0, backgroundColor: '#0f1115', borderRadius: 10 },
});
