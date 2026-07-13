import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Landmark } from '../types';

interface CalibrationWizardProps {
  step: 1 | 2;
  selectedLandmark: Landmark | null;
  capturing: boolean;
  onCapture: () => void;
  onCancel: () => void;
}

export default function CalibrationWizard({ step, selectedLandmark, capturing, onCapture, onCancel }: CalibrationWizardProps) {
  return (
    <View style={styles.banner}>
      <View style={styles.header}>
        <Text style={styles.stepLabel}>Calibrating — step {step} of 2</Text>
        <Pressable onPress={onCancel} hitSlop={10}>
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
      </View>

      {!selectedLandmark ? (
        <Text style={styles.instruction}>
          Walk to a landmark you&apos;ve pinned{step === 2 ? ' — a different one, and as far from your first point as you can' : ''}, then tap its pin on the map.
        </Text>
      ) : (
        <>
          <Text style={styles.instruction}>
            Standing at <Text style={styles.landmarkName}>{selectedLandmark.name}</Text>?
          </Text>
          <Pressable style={[styles.captureButton, capturing && styles.disabled]} onPress={onCapture} disabled={capturing}>
            {capturing ? <ActivityIndicator color="#fff" /> : <Text style={styles.captureButtonText}>Capture GPS here</Text>}
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    backgroundColor: 'rgba(23,26,33,0.97)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262a35',
    padding: 14,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  stepLabel: { color: '#8b92a3', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.04 },
  cancel: { color: '#f87171', fontSize: 13, fontWeight: '600' },
  instruction: { color: '#e5e7eb', fontSize: 14, lineHeight: 20 },
  landmarkName: { fontWeight: '700' },
  captureButton: {
    marginTop: 12,
    backgroundColor: '#3b82f6',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  captureButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
