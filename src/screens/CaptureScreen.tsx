import { memo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { persistMapImage } from '../services/imageStorage';
import { storage } from '../services/storage';
import { generateId } from '../utils/id';
import type { FestivalMap } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'Capture'>;

interface PickedAsset {
  uri: string;
  width: number;
  height: number;
}

export default function CaptureScreen() {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const [asset, setAsset] = useState<PickedAsset | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera permission needed', 'Enable camera access in Settings to photograph a map.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setAsset({ uri: a.uri, width: a.width, height: a.height });
    }
  };

  const pickFromGallery = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Photos permission needed', 'Enable photo access in Settings to import a map.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.85 });
    if (!result.canceled && result.assets[0]) {
      const a = result.assets[0];
      setAsset({ uri: a.uri, width: a.width, height: a.height });
    }
  };

  const handleSave = async () => {
    if (!asset || !name.trim() || saving) return;
    setSaving(true);
    try {
      const id = generateId();
      const persistedUri = await persistMapImage(asset.uri, id);
      const map: FestivalMap = {
        id,
        name: name.trim(),
        imageUri: persistedUri,
        imageWidth: asset.width,
        imageHeight: asset.height,
        landmarks: [],
        calibration: null,
        createdAt: Date.now(),
      };
      await storage.saveMap(map);
      navigation.replace('MapView', { mapId: id });
    } catch {
      Alert.alert("Couldn't save map", 'Something went wrong saving that photo. Please try again.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <Text style={styles.backText}>‹ Maps</Text>
        </Pressable>
        <Text style={styles.topBarTitle}>New Map</Text>
        <View style={styles.backButton} />
      </View>

      {!asset ? (
        <View style={styles.centered}>
          <Text style={styles.title}>Add a festival map</Text>
          <Text style={styles.subtitle}>Photograph a printed map or import one from your gallery.</Text>

          <Pressable style={styles.primaryButton} onPress={takePhoto}>
            <Text style={styles.primaryButtonText}>Take Photo</Text>
          </Pressable>
          <Pressable style={styles.secondaryButton} onPress={pickFromGallery}>
            <Text style={styles.secondaryButtonText}>Choose from Gallery</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flexFill}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ImagePreview uri={asset.uri} />
          <View style={styles.form}>
            <Text style={styles.label}>Map name</Text>
            <TextInput
              style={styles.input}
              placeholder="EDC Las Vegas 2026"
              placeholderTextColor="#5b6472"
              value={name}
              onChangeText={setName}
              autoFocus
            />
            <View style={styles.formRow}>
              <Pressable
                style={[styles.secondaryButton, styles.formButton]}
                onPress={() => setAsset(null)}
                disabled={saving}
              >
                <Text style={styles.secondaryButtonText}>Retake</Text>
              </Pressable>
              <Pressable
                style={[styles.primaryButton, styles.formButton, (!name.trim() || saving) && styles.disabled]}
                onPress={handleSave}
                disabled={!name.trim() || saving}
              >
                {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryButtonText}>Save</Text>}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  );
}

// Isolated so typing the map name (which only changes CaptureScreen's own
// `name` state) never forces this large, unresized photo to re-reconcile.
// Also capped to a fixed proportion of the screen (rather than flex: 1)
// so the name field always sits well above where the keyboard reaches,
// instead of hugging the bottom edge and depending entirely on
// KeyboardAvoidingView's runtime padding to stay visible.
const ImagePreview = memo(function ImagePreview({ uri }: { uri: string }) {
  return <Image source={{ uri }} style={styles.preview} resizeMode="contain" />;
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115' },
  flexFill: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#262a35',
    backgroundColor: '#171a21',
  },
  backButton: { width: 64 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  topBarTitle: { flex: 1, color: '#e5e7eb', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  title: { color: '#e5e7eb', fontSize: 20, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#8b92a3', fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 20 },
  primaryButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  secondaryButton: {
    backgroundColor: '#171a21',
    borderWidth: 1,
    borderColor: '#262a35',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 10,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#e5e7eb', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  preview: { height: '38%', width: '100%', backgroundColor: '#000' },
  form: { padding: 20, backgroundColor: '#0f1115' },
  label: { color: '#8b92a3', fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: '#171a21',
    borderWidth: 1,
    borderColor: '#262a35',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#e5e7eb',
    fontSize: 16,
    marginBottom: 14,
  },
  formRow: { flexDirection: 'row', gap: 10 },
  formButton: { flex: 1, marginBottom: 0 },
});
