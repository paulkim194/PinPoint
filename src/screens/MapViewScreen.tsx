import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import AddLandmarkModal from '../components/AddLandmarkModal';
import CalibrationWizard from '../components/CalibrationWizard';
import MapCanvas, { type MapCanvasHandle } from '../components/MapCanvas';
import NavigationBanner from '../components/NavigationBanner';
import PinActionSheet from '../components/PinActionSheet';
import SearchBar from '../components/SearchBar';
import { bearingAndDistance, bearingAndDistanceToPixel, computeTransform, gpsToPixel } from '../services/geo';
import {
  captureAveragedPosition,
  requestForegroundPermission,
  watchHeading,
  watchPosition,
} from '../services/location';
import { createLandmarkIndex, searchLandmarks } from '../services/search';
import { storage } from '../services/storage';
import { generateId } from '../utils/id';
import type { Calibration, CalibrationAnchor, FestivalMap, Landmark, LandmarkCategory } from '../types';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList, 'MapView'>;
type Rt = RouteProp<RootStackParamList, 'MapView'>;
type Subscription = { remove: () => void };

type ModalState = { kind: 'add'; pixelX: number; pixelY: number } | { kind: 'edit'; landmark: Landmark } | null;

const MIN_ANCHOR_DISTANCE_M = 50;

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

  const [calibrating, setCalibrating] = useState(false);
  const [calibrationStep, setCalibrationStep] = useState<1 | 2>(1);
  const [stepLandmark, setStepLandmark] = useState<Landmark | null>(null);
  const [anchor1, setAnchor1] = useState<CalibrationAnchor | null>(null);
  const [anchor1LandmarkId, setAnchor1LandmarkId] = useState<string | null>(null);
  const [capturingGps, setCapturingGps] = useState(false);

  const [tracking, setTracking] = useState(false);
  const [userFix, setUserFix] = useState<{ lat: number; lng: number; accuracyM: number } | null>(null);
  const [headingDeg, setHeadingDeg] = useState<number | null>(null);
  const [navigationTargetId, setNavigationTargetId] = useState<string | null>(null);
  const locationSubRef = useRef<Subscription | null>(null);
  const headingSubRef = useRef<Subscription | null>(null);

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

  // Starts/stops the GPS + compass watchers whenever `tracking` flips.
  // Cleanup (on toggle-off or unmount) removes both subscriptions -- this is
  // the only place that owns their lifecycle.
  useEffect(() => {
    if (!tracking) return;
    let cancelled = false;

    (async () => {
      const granted = await requestForegroundPermission();
      if (cancelled) return;
      if (!granted) {
        Alert.alert('Location permission needed', 'Enable location access to show your position on the map.');
        setTracking(false);
        return;
      }
      locationSubRef.current = await watchPosition((fix) => setUserFix(fix));
      if (cancelled) {
        locationSubRef.current.remove();
        locationSubRef.current = null;
        return;
      }
      headingSubRef.current = watchHeading((deg) => setHeadingDeg(deg));
    })();

    return () => {
      cancelled = true;
      locationSubRef.current?.remove();
      locationSubRef.current = null;
      headingSubRef.current?.remove();
      headingSubRef.current = null;
    };
  }, [tracking]);

  const fuseIndex = useMemo(() => createLandmarkIndex(map?.landmarks ?? []), [map?.landmarks]);
  const searchResults = useMemo(() => searchLandmarks(fuseIndex, searchQuery), [fuseIndex, searchQuery]);

  const transform = useMemo(() => (map?.calibration ? computeTransform(map.calibration) : null), [map?.calibration]);

  const userLocationPixel = useMemo(() => {
    if (!transform || !userFix) return null;
    const { x, y } = gpsToPixel(transform, userFix.lat, userFix.lng);
    return { pixelX: x, pixelY: y, accuracyPixels: userFix.accuracyM / transform.metersPerPixel };
  }, [transform, userFix]);

  const navigationTarget = useMemo(
    () => (navigationTargetId ? map?.landmarks.find((l) => l.id === navigationTargetId) ?? null : null),
    [navigationTargetId, map?.landmarks]
  );

  const navInfo = useMemo(() => {
    if (!transform || !userFix || !navigationTarget) return null;
    return bearingAndDistanceToPixel(transform, userFix.lat, userFix.lng, navigationTarget.pixelX, navigationTarget.pixelY);
  }, [transform, userFix, navigationTarget]);

  const handleLongPress = (pixelX: number, pixelY: number) => {
    if (calibrating) return;
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

  // ---- Calibration ----

  const startCalibration = () => {
    if (!map || map.landmarks.length < 2) {
      Alert.alert('Pin more landmarks first', 'You need at least 2 landmarks pinned on this map before you can calibrate it.');
      return;
    }
    setCalibrating(true);
    setCalibrationStep(1);
    setStepLandmark(null);
    setAnchor1(null);
    setAnchor1LandmarkId(null);
    setHighlightedLandmarkId(null);
  };

  const handleCalibrateButtonPress = () => {
    if (map?.calibration) {
      Alert.alert('Re-calibrate this map?', 'This replaces the existing calibration.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Re-calibrate', onPress: startCalibration },
      ]);
    } else {
      startCalibration();
    }
  };

  const exitCalibration = () => {
    setCalibrating(false);
    setCalibrationStep(1);
    setStepLandmark(null);
    setAnchor1(null);
    setAnchor1LandmarkId(null);
    setHighlightedLandmarkId(null);
  };

  const handleCalibrationPinSelect = (landmark: Landmark) => {
    if (calibrationStep === 2 && landmark.id === anchor1LandmarkId) {
      Alert.alert('Pick a different landmark', "That's the one you already used for point 1 — choose a different, ideally farther-away landmark.");
      return;
    }
    setStepLandmark(landmark);
    setHighlightedLandmarkId(landmark.id);
    setPulseNonce((n) => n + 1);
  };

  const saveCalibration = async (a1: CalibrationAnchor, a2: CalibrationAnchor) => {
    if (!map) return;
    const calibration: Calibration = { anchors: [a1, a2] };
    const updated = await storage.setCalibration(map.id, calibration);
    setMap(updated);
    exitCalibration();
  };

  const finishCalibration = (a1: CalibrationAnchor, a2: CalibrationAnchor) => {
    const { distanceM } = bearingAndDistance({ lat: a1.lat, lng: a1.lng }, { lat: a2.lat, lng: a2.lng });
    if (distanceM < MIN_ANCHOR_DISTANCE_M) {
      Alert.alert(
        'Points are close together',
        `Your two calibration points are only about ${Math.round(distanceM)}m apart. For accurate results, pick landmarks at least ${MIN_ANCHOR_DISTANCE_M}m apart if you can.`,
        [
          {
            text: 'Redo point 2',
            style: 'cancel',
            onPress: () => {
              setStepLandmark(null);
              setHighlightedLandmarkId(null);
            },
          },
          { text: 'Use anyway', onPress: () => saveCalibration(a1, a2) },
        ]
      );
      return;
    }
    saveCalibration(a1, a2);
  };

  const handleCapture = async () => {
    if (!stepLandmark || capturingGps) return;
    setCapturingGps(true);
    try {
      const granted = await requestForegroundPermission();
      if (!granted) {
        Alert.alert(
          'Location permission needed',
          "PinPoint needs location access to calibrate this map. Everything else works fine without it -- you can enable it later in Settings if you change your mind."
        );
        return;
      }

      const fix = await captureAveragedPosition();
      const anchor: CalibrationAnchor = {
        lat: fix.lat,
        lng: fix.lng,
        accuracyM: fix.accuracyM,
        pixelX: stepLandmark.pixelX,
        pixelY: stepLandmark.pixelY,
      };

      if (calibrationStep === 1) {
        setAnchor1(anchor);
        setAnchor1LandmarkId(stepLandmark.id);
        setCalibrationStep(2);
        setStepLandmark(null);
        setHighlightedLandmarkId(null);
      } else if (anchor1) {
        finishCalibration(anchor1, anchor);
      }
    } catch {
      Alert.alert("Couldn't get a GPS fix", 'Make sure Location Services are enabled for PinPoint and try again.');
    } finally {
      setCapturingGps(false);
    }
  };

  const handlePinPress = (landmark: Landmark) => {
    if (calibrating) {
      handleCalibrationPinSelect(landmark);
    } else {
      setActionSheetLandmark(landmark);
    }
  };

  // ---- Live tracking ----

  const handleToggleTracking = () => {
    if (!map?.calibration) {
      Alert.alert('Calibrate this map first', 'Showing your live position requires calibrating this map with two GPS anchor points.');
      return;
    }
    if (tracking) {
      setTracking(false);
      setUserFix(null);
      setHeadingDeg(null);
      setNavigationTargetId(null);
    } else {
      setTracking(true);
    }
  };

  const handleNavigate = () => {
    if (!actionSheetLandmark) return;
    if (!map?.calibration) {
      Alert.alert('Calibrate this map first', 'Navigation requires calibrating this map with two GPS anchor points.');
      setActionSheetLandmark(null);
      return;
    }
    setNavigationTargetId(actionSheetLandmark.id);
    setActionSheetLandmark(null);
    if (!tracking) setTracking(true);
  };

  const handleStopNavigating = () => setNavigationTargetId(null);

  return (
    <View style={styles.container}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.sideSlot}>
          <Text style={styles.backText}>‹ Maps</Text>
        </Pressable>
        <Text style={styles.mapName} numberOfLines={1}>
          {map?.name ?? ''}
        </Text>
        <Pressable onPress={handleCalibrateButtonPress} hitSlop={10} style={[styles.sideSlot, styles.calibrateSlot]} disabled={calibrating}>
          <Text style={[styles.calibrateText, map?.calibration && styles.calibratedText]}>
            {map?.calibration ? 'Calibrated ✓' : 'Calibrate'}
          </Text>
        </Pressable>
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
            userLocation={userLocationPixel}
            navigationTargetLandmarkId={navigationTargetId}
            onLongPress={handleLongPress}
            onPinPress={handlePinPress}
            onPinMoved={handlePinMoved}
          />

          {calibrating ? (
            <CalibrationWizard
              step={calibrationStep}
              selectedLandmark={stepLandmark}
              capturing={capturingGps}
              onCapture={handleCapture}
              onCancel={exitCalibration}
            />
          ) : (
            <>
              <SearchBar query={searchQuery} onChangeQuery={setSearchQuery} results={searchResults} onSelect={handleSearchSelect} />

              <Pressable
                style={[
                  styles.locateButton,
                  tracking && styles.locateButtonActive,
                  (movingLandmarkId || navigationTarget) && styles.locateButtonRaised,
                ]}
                onPress={handleToggleTracking}
                hitSlop={8}
              >
                <View style={[styles.locateRing, tracking && styles.locateRingActive]}>
                  <View style={[styles.locateDot, tracking && styles.locateDotActive]} />
                </View>
              </Pressable>

              {movingLandmarkId ? (
                <View style={styles.moveBanner}>
                  <Text style={styles.moveBannerText}>Drag the pin to reposition it</Text>
                  <Pressable style={styles.doneButton} onPress={() => setMovingLandmarkId(null)}>
                    <Text style={styles.doneButtonText}>Done</Text>
                  </Pressable>
                </View>
              ) : navigationTarget ? (
                <NavigationBanner
                  landmarkName={navigationTarget.name}
                  distanceM={navInfo?.distanceM ?? null}
                  bearingDeg={navInfo?.bearingDeg ?? null}
                  headingDeg={headingDeg}
                  accuracyM={userFix?.accuracyM ?? null}
                  onStop={handleStopNavigating}
                />
              ) : (
                map.landmarks.length === 0 && (
                  <View style={styles.hintBanner} pointerEvents="none">
                    <Text style={styles.hintText}>Long-press anywhere on the map to add a landmark</Text>
                  </View>
                )
              )}
            </>
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
        onNavigate={handleNavigate}
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
  sideSlot: { minWidth: 64 },
  backText: { color: '#3b82f6', fontSize: 16, fontWeight: '600' },
  mapName: { flex: 1, color: '#e5e7eb', fontSize: 16, fontWeight: '700', textAlign: 'center' },
  calibrateSlot: { alignItems: 'flex-end' },
  calibrateText: { color: '#3b82f6', fontSize: 14, fontWeight: '600' },
  calibratedText: { color: '#4ade80' },
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
  locateButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(23,26,33,0.97)',
    borderWidth: 1,
    borderColor: '#262a35',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locateButtonActive: { borderColor: '#3b82f6' },
  locateButtonRaised: { bottom: 100 },
  locateRing: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#8b92a3', alignItems: 'center', justifyContent: 'center' },
  locateRingActive: { borderColor: '#3b82f6' },
  locateDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#8b92a3' },
  locateDotActive: { backgroundColor: '#3b82f6' },
});
