# PinPoint

Photograph any festival map, pin the stages/gates/meetup spots you care about
by long-pressing on the photo, then fuzzy-search to jump straight to a pin.
Runs entirely offline, entirely inside the standard **Expo Go** app — no
custom native build, no backend, no accounts, no API keys.

> **Status:** Phase 1 is complete — map capture, pinch-zoom canvas, manual
> landmark pinning, fuzzy search, two-point GPS calibration, and the live
> "blue dot" + compass navigation banner are all built. One piece hasn't
> been field-verified on a device: the compass heading math (raw
> magnetometer → degrees) in `src/services/location.ts` assumes the phone
> is held roughly flat/facing-forward. If the navigation arrow points a
> consistent fixed amount off (not jittering, just rotated), it's a
> one-line fix in `magnetometerToHeadingDeg`.

## Setup

Requires [Node.js](https://nodejs.org/) (LTS) and the **Expo Go** app on your
phone ([iOS](https://apps.apple.com/app/expo-go/id982107779) /
[Android](https://play.google.com/store/apps/details?id=host.exp.exponent)).

```bash
git clone https://github.com/paulkim194/PinPoint.git
cd PinPoint
npm install
```

## Running on a physical phone (Expo Go)

```bash
npx expo start
```

This starts Metro and prints a QR code in your terminal.

- **iPhone:** open the Camera app and point it at the QR code — it'll prompt
  you to open the link in Expo Go.
- **Android:** open Expo Go and use its built-in QR scanner.

Both your phone and computer need to be on the **same Wi-Fi network**. If
they aren't (e.g. you're on a laptop hotspot, campus Wi-Fi with client
isolation, or a VPN), use tunnel mode instead:

```bash
npx expo start --tunnel
```

(First run of `--tunnel` may ask to install `@expo/ngrok` — let it.)

### Why you need a physical device

- **Camera capture / photo import** rely on real device camera and photo
  library access — an iOS Simulator has no real camera, and Expo Go's
  camera/photo permissions behave inconsistently there.
- **GPS calibration and the live blue dot** need an actual GPS radio and a
  real compass (magnetometer). Simulators can *fake* a location, but that
  defeats the entire point of testing whether calibration and live tracking
  actually work in the real world.
- **Pinch-zoom/pan gestures** are far more representative of real usage when
  tested with actual fingers on actual glass than with a mouse in a
  simulator.

## Using the app

1. **Home** → **+ New Map** → take a photo of a printed map (or import one
   from your photo library) → give it a name.
2. On the map view: **pinch to zoom, drag to pan.**
3. **Long-press** anywhere on the map to drop a pin — name it and pick a
   category (Stage / Gate / Meetup / Other).
4. **Tap a pin** to rename it, drag-reposition it ("Move"), delete it, or
   choose **Navigate here**.
5. Use the **search bar** at the top to fuzzy-find a landmark by name — it
   animates the view to center on it and pulses it so you can spot it.
6. Tap **Calibrate** (top right) once you've pinned at least 2 landmarks:
   walk to one, tap its pin, capture GPS; repeat for a second, ideally
   50m+ away. The map now shows **Calibrated ✓**.
7. Tap the circular locate button (bottom right) to toggle your live blue
   dot on/off. Choosing **Navigate here** on a pin turns tracking on
   automatically and shows a distance + compass-arrow banner toward it.

Everything is saved locally (`AsyncStorage` + the app's own document
directory for photos) and survives force-quitting the app or losing signal
entirely — there is no network dependency anywhere in this flow.

## Field-test script

You don't need an actual festival to test GPS calibration — a local park
works just as well:

1. Print (or just photograph on your phone) any park map with at least two
   identifiable features (a fountain, a specific bench, a trailhead sign).
2. In the app, photograph that map and pin those two features.
3. Turn on **Airplane Mode**, then re-enable only **Location Services** (GPS
   still works in airplane mode; only radios like cellular/Wi-Fi are off —
   this is exactly how you'd use it at a festival with spotty signal).
4. Walk to the first pinned feature, stand on it, and calibrate against that
   pin. Walk to the second feature and repeat.
5. Walk around the park and confirm the blue dot on your screen tracks your
   real position, with a visible accuracy halo around it.
6. Tap **Navigate here** on one of the two pins, then walk toward it and
   confirm the distance counts down and the arrow keeps pointing the right
   way as you turn.

## Project structure

```
src/
  types/            Data model (FestivalMap, Landmark, Calibration, ...)
  services/
    storage.ts       Typed AsyncStorage repository for maps/landmarks
    imageStorage.ts   Persists captured/imported photos to permanent storage
    search.ts         fuse.js fuzzy search wrapper
    geo.ts            GPS <-> pixel coordinate math (unit tested)
    location.ts        expo-location + expo-sensors wrapper (permissions, averaged
                        capture, live watch, compass heading)
  navigation/        React Navigation stack (Home / Capture / MapView)
  screens/           HomeScreen, CaptureScreen, MapViewScreen
  components/        MapCanvas, PinMarker, AddLandmarkModal, PinActionSheet,
                      SearchBar, CalibrationWizard, NavigationBanner
```

## Tech stack

Expo (managed) · TypeScript · React Navigation · `react-native-gesture-handler`
+ `react-native-reanimated` (pinch-zoom/pan) · `@react-native-async-storage/async-storage`
· `fuse.js` · `expo-image-picker` · `expo-location` + `expo-sensors` (GPS
calibration and live tracking)
