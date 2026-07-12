import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddLandmarkModal from '../components/AddLandmarkModal';
import MapCanvas, { type MapCanvasHandle } from '../components/MapCanvas';
import PinActionSheet from '../components/PinActionSheet';
import SearchBar from '../components/SearchBar';
import { createLandmarkIndex, searchLandmarks } from '../services/search';
import { storage } from '../services/storage';
import { generateId } from '../utils/id';
import type { FestivalMap, Landmark, LandmarkCategory } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MapView'>;
type Rt = RouteProp<RootStackParamList, 'MapView'>;

type ModalState = { kind: 'add'; pixelX: number; pixelY: number } | { kind: 'edit'; landmark: Landmark } | null;

export default function MapViewScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const insets = useSafeAreaInsets();
  const canvasRef = useRef<MapCanvasHandle>(null);

  const [map, setMap] = useState<FestivalMap | null>(null);
  const [loading, setLoading] = useState(true);

  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedLandmarkId, setHighlightedLandmarkId] = useState<string | null>(null);
  const [pulseNonce, setPulseNonce] = useState(0);

  const [modalState, setModalState] = useState<ModalState>(null);
  const [actionSheetLandmark, setActionSheetLandmark] = useState<Landmark | null>(null);
  const [movingLandmarkId, setMovingLandmarkId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await storage.getMap(route.params.mapId);
      if (!cancelled) {
        setMap(loaded ?? null);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route.params.mapId]);

  const fuseIndex = useMemo(() => createLandmarkIndex(map?.landmarks ?? []), [map?.landmarks]);
  const searchResults = useMemo(() => searchLandmarks(fuseIndex, searchQuery), [fuseIndex, searchQuery]);

  const handleLongPress = (pixelX: number, pixelY: number) => {
    setModalState({ kind: 'add', pixelX, pixelY });
  };

  const handleModalSubmit = async (name: string, category: LandmarkCategory) => {
    if (!map || !modalState) return;
    if (modalState.kind === 'add') {
      const landmark: Landmark = { id: generateId(), name, category, pixelX: modalState.pixelX, pixelY: modalState.pixelY };
      const updated = await storage.addLandmark(map.id, landmark);
      setMap(updated);
    } else {
      const updated = await storage.updateLandmark(map.id, modalState.landmark.id, { name, category });
      setMap(updated);
    }
    setModalState(null);
  };

  const handleRename = () => {
    if (!actionSheetLandmark) return;
    setModalState({ kind: 'edit', landmark: actionSheetLandmark });
    setActionSheetLandmark(null);
  };

  const handleMove = () => {
    if (!actionSheetLandmark) return;
    setMovingLandmarkId(actionSheetLandmark.id);
    setActionSheetLandmark(null);
  };

  const handleDelete = () => {
    if (!actionSheetLandmark) return;
    const target = actionSheetLandmark;
    setActionSheetLandmark(null);
    Alert.alert('Delete landmark?', `"${target.name}" will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (!map) return;
          const updated = await storage.deleteLandmark(map.id, target.id);
          setMap(updated);
        },
      },
    ]);
  };

  const handlePinMoved = async (landmarkId: string, pixelX: number, pixelY: number) => {
    if (!map) return;
    const updated = await storage.updateLandmark(map.id, landmarkId, { pixelX, pixelY });
    setMap(updated);
  };

  const handleSearchSelect = (landmark: Landmark) => {
    Keyboard.dismiss();
    setSearchQuery('');
    setHighlightedLandmarkId(landmark.id);
    setPulseNonce((n) => n + 1);
    canvasRef.current?.centerOnPixel(landmark.pixelX, landmark.pixelY);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backButton}>
          <Text style={styles.backText}>‹ Maps</Text>
        </Pressable>
        <Text style={styles.mapName} numberOfLines={1}>
          {map?.name ?? ''}
        </Text>
        <View style={styles.backButton} />
      </View>

      {loading || !map ? (
        <View style={styles.centered}>
          <ActivityIndicator color="#3b82f6" />
        </View>
      ) : (
        <View style={styles.canvasArea}>
          <MapCanvas
            ref={canvasRef}
            imageUri={map.imageUri}
            imageWidth={map.imageWidth}
            imageHeight={map.imageHeight}
            landmarks={map.landmarks}
            highlightedLandmarkId={highlightedLandmarkId}
            pulseNonce={pulseNonce}
            movingLandmarkId={movingLandmarkId}
            onLongPress={handleLongPress}
            onPinPress={setActionSheetLandmark}
            onPinMoved={handlePinMoved}
          />

          <SearchBar query={searchQuery} onChangeQuery={setSearchQuery} results={searchResults} onSelect={handleSearchSelect} />

          {movingLandmarkId && (
            <View style={styles.moveBanner}>
              <Text style={styles.moveBannerText}>Drag the pin to reposition it</Text>
              <Pressable style={styles.doneButton} onPress={() => setMovingLandmarkId(null)}>
                <Text style={styles.doneButtonText}>Done</Text>
              </Pressable>
            </View>
          )}

          {map.landmarks.length === 0 && !movingLandmarkId && (
            <View style={styles.hintBanner} pointerEvents="none">
              <Text style={styles.hintText}>Long-press anywhere on the map to add a landmark</Text>
            </View>
          )}
        </View>
      )}

      <AddLandmarkModal
        visible={modalState !== null}
        title={modalState?.kind === 'edit' ? 'Rename Landmark' : 'Add Landmark'}
        initialName={modalState?.kind === 'edit' ? modalState.landmark.name : ''}
        initialCategory={modalState?.kind === 'edit' ? modalState.landmark.category : 'other'}
        onCancel={() => setModalState(null)}
        onSubmit={handleModalSubmit}
      />

      <PinActionSheet
        landmark={actionSheetLandmark}
        onRename={handleRename}
        onMove={handleMove}
        onDelete={handleDelete}
        onClose={() => setActionSheetLandmark(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f1115' },
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
  mapName: { flex: 1, color: '#e5e7eb', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  canvasArea: { flex: 1 },
  moveBanner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(23,26,33,0.97)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#262a35',
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  moveBannerText: { color: '#e5e7eb', fontSize: 14, fontWeight: '500', flex: 1, marginRight: 12 },
  doneButton: { backgroundColor: '#3b82f6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
  doneButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  hintBanner: {
    position: 'absolute',
    bottom: 24,
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  hintText: {
    color: '#8b92a3',
    fontSize: 12,
    backgroundColor: 'rgba(23,26,33,0.9)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
});
