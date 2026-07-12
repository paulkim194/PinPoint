import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { CATEGORY_COLORS } from '../constants/categories';
import type { Landmark } from '../types';

const PIN_SIZE = 16;
// Pin labels fade in once the user has zoomed past this scale, so a
// fully-zoomed-out map isn't cluttered with overlapping text.
const LABEL_FADE_START = 1.4;
const LABEL_FADE_END = 2.2;

interface PinMarkerProps {
  landmark: Landmark;
  /** Intrinsic image pixels -> base (unzoomed) display pixels. */
  baseScale: number;
  highlighted: boolean;
  /** Bump this to retrigger the pulse animation, even for the same landmark. */
  pulseNonce: number;
  isMoving: boolean;
  /** The map's live pinch/pan zoom level, shared down so drag math + label fade stay in sync. */
  mapScale: SharedValue<number>;
  onPress: () => void;
  onMoveEnd: (pixelX: number, pixelY: number) => void;
}

export default function PinMarker({
  landmark,
  baseScale,
  highlighted,
  pulseNonce,
  isMoving,
  mapScale,
  onPress,
  onMoveEnd,
}: PinMarkerProps) {
  const pulse = useSharedValue(1);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (!highlighted) return;
    pulse.value = withSequence(
      withTiming(2, { duration: 260 }),
      withTiming(1, { duration: 260 }),
      withTiming(2, { duration: 260 }),
      withTiming(1, { duration: 260 })
    );
    // Only the nonce should retrigger this -- `highlighted` flips true/false
    // around it, but a fresh nonce is what means "pulse again".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseNonce]);

  // While in "move" mode, dragging the pin translates it in *base display*
  // pixels (e.translationX/Y are screen pixels, divided by the current map
  // zoom to undo the outer transform). On release we convert that back into
  // intrinsic image pixels and hand it to the parent to persist.
  const dragGesture = Gesture.Pan()
    .enabled(isMoving)
    .onUpdate((e) => {
      dragX.value = e.translationX / mapScale.value;
      dragY.value = e.translationY / mapScale.value;
    })
    .onEnd(() => {
      const newPixelX = landmark.pixelX + dragX.value / baseScale;
      const newPixelY = landmark.pixelY + dragY.value / baseScale;
      dragX.value = 0;
      dragY.value = 0;
      runOnJS(onMoveEnd)(newPixelX, newPixelY);
    });

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }, { scale: pulse.value }],
  }));

  const labelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(mapScale.value, [LABEL_FADE_START, LABEL_FADE_END], [0, 1], Extrapolation.CLAMP),
    transform: [{ translateX: dragX.value }, { translateY: dragY.value }],
  }));

  const left = landmark.pixelX * baseScale - PIN_SIZE / 2;
  const top = landmark.pixelY * baseScale - PIN_SIZE / 2;
  const color = CATEGORY_COLORS[landmark.category];

  return (
    <GestureDetector gesture={dragGesture}>
      <Animated.View style={[styles.wrapper, { left, top, zIndex: isMoving || highlighted ? 10 : 1 }]}>
        <Pressable
          onPress={isMoving ? undefined : onPress}
          onLongPress={() => {}}
          hitSlop={12}
          pointerEvents={isMoving ? 'none' : 'auto'}
        >
          <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
        </Pressable>
        <Animated.View style={[styles.labelWrap, labelStyle]} pointerEvents="none">
          <Text style={styles.label} numberOfLines={1}>
            {landmark.name}
          </Text>
        </Animated.View>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  wrapper: { position: 'absolute', width: PIN_SIZE, height: PIN_SIZE, alignItems: 'center' },
  dot: {
    width: PIN_SIZE,
    height: PIN_SIZE,
    borderRadius: PIN_SIZE / 2,
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  labelWrap: {
    position: 'absolute',
    top: PIN_SIZE + 4,
    left: -60,
    width: 140,
    alignItems: 'center',
    backgroundColor: 'rgba(15,17,21,0.85)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  label: { color: '#e5e7eb', fontSize: 11, fontWeight: '600' },
});
