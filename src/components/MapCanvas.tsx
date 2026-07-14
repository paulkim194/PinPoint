import { forwardRef, useImperativeHandle, useState } from 'react';
import { Image, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import PinMarker from './PinMarker';
import type { Landmark } from '../types';

const MIN_SCALE = 1;
const MAX_SCALE = 6;
const SEARCH_FOCUS_SCALE = 2.5;
const MIN_HALO_RADIUS_PX = 10;
const MAX_HALO_RADIUS_PX = 150;

export interface MapCanvasHandle {
  /** Animates zoom/pan so the given intrinsic pixel position is centered in the viewport. */
  centerOnPixel: (pixelX: number, pixelY: number) => void;
}

export interface UserLocationPixel {
  /** Intrinsic image coordinates, same convention as Landmark.pixelX/pixelY. */
  pixelX: number;
  pixelY: number;
  /** GPS accuracy converted to intrinsic image pixels (accuracyM / metersPerPixel). */
  accuracyPixels: number;
}

interface MapCanvasProps {
  imageUri: string;
  imageWidth: number;
  imageHeight: number;
  landmarks: Landmark[];
  highlightedLandmarkId: string | null;
  pulseNonce: number;
  movingLandmarkId: string | null;
  userLocation: UserLocationPixel | null;
  navigationTargetLandmarkId: string | null;
  onLongPress: (pixelX: number, pixelY: number) => void;
  onPinPress: (landmark: Landmark) => void;
  onPinMoved: (landmarkId: string, pixelX: number, pixelY: number) => void;
}

function MapCanvas(
  {
    imageUri,
    imageWidth,
    imageHeight,
    landmarks,
    highlightedLandmarkId,
    pulseNonce,
    movingLandmarkId,
    userLocation,
    navigationTargetLandmarkId,
    onLongPress,
    onPinPress,
    onPinMoved,
  }: MapCanvasProps,
  ref: React.Ref<MapCanvasHandle>
) {
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedScale = useSharedValue(1);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width === viewport.width && height === viewport.height) return;
    setViewport({ width, height });
  };

  const baseScale = viewport.width > 0 ? viewport.width / imageWidth : 0;
  const baseWidth = viewport.width;
  const baseHeight = baseScale > 0 ? imageHeight * baseScale : 0;
  const ready = baseWidth > 0 && baseHeight > 0 && viewport.height > 0;

  // Re-center whenever a new image/viewport size is known (first load, or an
  // orientation change). Only meaningful once we've actually measured layout.
  const [centeredKey, setCenteredKey] = useState('');
  const layoutKey = `${imageUri}:${viewport.width}:${viewport.height}`;
  if (ready && centeredKey !== layoutKey) {
    scale.value = 1;
    translateX.value = 0;
    translateY.value = baseHeight <= viewport.height ? (viewport.height - baseHeight) / 2 : 0;
    savedScale.value = 1;
    savedTranslateX.value = translateX.value;
    savedTranslateY.value = translateY.value;
    setCenteredKey(layoutKey);
  }

  const pan = Gesture.Pan()
    .onStart(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const s = scale.value;
      const scaledWidth = baseWidth * s;
      const scaledHeight = baseHeight * s;
      const minX = Math.min(0, viewport.width - scaledWidth);
      const minY = Math.min(0, viewport.height - scaledHeight);
      const rawX = savedTranslateX.value + e.translationX;
      const rawY = savedTranslateY.value + e.translationY;
      translateX.value = Math.min(Math.max(rawX, minX), 0);
      translateY.value =
        scaledHeight <= viewport.height ? (viewport.height - scaledHeight) / 2 : Math.min(Math.max(rawY, minY), 0);
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((e) => {
      const newScale = Math.min(Math.max(savedScale.value * e.scale, MIN_SCALE), MAX_SCALE);
      const rawX = e.focalX - (e.focalX - savedTranslateX.value) * (newScale / savedScale.value);
      const rawY = e.focalY - (e.focalY - savedTranslateY.value) * (newScale / savedScale.value);

      const scaledWidth = baseWidth * newScale;
      const scaledHeight = baseHeight * newScale;
      const minX = Math.min(0, viewport.width - scaledWidth);
      const minY = Math.min(0, viewport.height - scaledHeight);

      scale.value = newScale;
      translateX.value = Math.min(Math.max(rawX, minX), 0);
      translateY.value =
        scaledHeight <= viewport.height ? (viewport.height - scaledHeight) / 2 : Math.min(Math.max(rawY, minY), 0);
    });

  const handleLongPressJs = (pixelX: number, pixelY: number) => {
    onLongPress(pixelX, pixelY);
  };

  const longPress = Gesture.LongPress()
    .minDuration(450)
    .maxDistance(12)
    .onStart((e) => {
      'worklet';
      const baseX = (e.x - translateX.value) / scale.value;
      const baseY = (e.y - translateY.value) / scale.value;
      const pixelX = baseX / baseScale;
      const pixelY = baseY / baseScale;
      runOnJS(handleLongPressJs)(pixelX, pixelY);
    });

  const composedGesture = Gesture.Exclusive(longPress, Gesture.Simultaneous(pan, pinch));

  const transformStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  useImperativeHandle(
    ref,
    () => ({
      centerOnPixel: (pixelX: number, pixelY: number) => {
        if (!ready) return;
        const targetScale = Math.max(scale.value, SEARCH_FOCUS_SCALE);
        const bx = pixelX * baseScale;
        const by = pixelY * baseScale;
        const scaledWidth = baseWidth * targetScale;
        const scaledHeight = baseHeight * targetScale;
        const minX = Math.min(0, viewport.width - scaledWidth);
        const minY = Math.min(0, viewport.height - scaledHeight);

        const rawX = viewport.width / 2 - bx * targetScale;
        const rawY = viewport.height / 2 - by * targetScale;

        const targetX = Math.min(Math.max(rawX, minX), 0);
        const targetY =
          scaledHeight <= viewport.height ? (viewport.height - scaledHeight) / 2 : Math.min(Math.max(rawY, minY), 0);

        scale.value = withTiming(targetScale, { duration: 450 });
        translateX.value = withTiming(targetX, { duration: 450 });
        translateY.value = withTiming(targetY, { duration: 450 });
      },
    }),
    [ready, baseScale, baseWidth, baseHeight, viewport.width, viewport.height]
  );

  const navigationTarget = navigationTargetLandmarkId
    ? landmarks.find((l) => l.id === navigationTargetLandmarkId) ?? null
    : null;

  return (
    <View style={styles.fill} onLayout={handleLayout}>
      {ready && (
        <GestureDetector gesture={composedGesture}>
          <View style={styles.fill}>
            <Animated.View style={[styles.transformer, transformStyle]}>
              <Image
                source={{ uri: imageUri }}
                style={{ width: baseWidth, height: baseHeight }}
                resizeMode="stretch"
              />

              {userLocation && navigationTarget && (
                <GuidanceLine
                  fromX={userLocation.pixelX * baseScale}
                  fromY={userLocation.pixelY * baseScale}
                  toX={navigationTarget.pixelX * baseScale}
                  toY={navigationTarget.pixelY * baseScale}
                />
              )}

              {landmarks.map((landmark) => (
                <PinMarker
                  key={landmark.id}
                  landmark={landmark}
                  baseScale={baseScale}
                  highlighted={highlightedLandmarkId === landmark.id}
                  pulseNonce={pulseNonce}
                  isMoving={movingLandmarkId === landmark.id}
                  mapScale={scale}
                  onPress={() => onPinPress(landmark)}
                  onMoveEnd={(pixelX, pixelY) => onPinMoved(landmark.id, pixelX, pixelY)}
                />
              ))}

              {userLocation && (
                <BlueDot
                  x={userLocation.pixelX * baseScale}
                  y={userLocation.pixelY * baseScale}
                  haloRadius={Math.min(
                    Math.max(userLocation.accuracyPixels * baseScale, MIN_HALO_RADIUS_PX),
                    MAX_HALO_RADIUS_PX
                  )}
                />
              )}
            </Animated.View>
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

/** Straight line between two base-display points, drawn as a rotated 2px-thick View. */
function GuidanceLine({ fromX, fromY, toX, toY }: { fromX: number; fromY: number; toX: number; toY: number }) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const length = Math.hypot(dx, dy);
  const angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const midX = (fromX + toX) / 2;
  const midY = (fromY + toY) / 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.guidanceLine,
        {
          left: midX - length / 2,
          top: midY - 1,
          width: length,
          // Rotating around the default (center) transform origin is what
          // makes positioning by midpoint + half-length correct -- no
          // dependency on transformOrigin support.
          transform: [{ rotate: `${angleDeg}deg` }],
        },
      ]}
    />
  );
}

function BlueDot({ x, y, haloRadius }: { x: number; y: number; haloRadius: number }) {
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: x, top: y }}>
      <View
        style={[
          styles.halo,
          { width: haloRadius * 2, height: haloRadius * 2, borderRadius: haloRadius, left: -haloRadius, top: -haloRadius },
        ]}
      />
      <View style={styles.dot} />
    </View>
  );
}

export default forwardRef(MapCanvas);

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden', backgroundColor: '#000' },
  transformer: { position: 'absolute', left: 0, top: 0 },
  guidanceLine: { position: 'absolute', height: 2, backgroundColor: 'rgba(59,130,246,0.55)' },
  halo: { position: 'absolute', backgroundColor: 'rgba(59,130,246,0.18)', borderWidth: 1, borderColor: 'rgba(59,130,246,0.4)' },
  dot: {
    position: 'absolute',
    width: 16,
    height: 16,
    borderRadius: 8,
    left: -8,
    top: -8,
    backgroundColor: '#3b82f6',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
});
