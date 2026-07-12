// Copies a picked/captured photo out of the OS-managed cache directory (which
// can be evicted at any time) into this app's permanent document directory,
// so a FestivalMap's imageUri keeps working across app restarts and OS
// cache cleanups. Uses the SDK 57 class-based expo-file-system API.
import { Directory, File, Paths } from 'expo-file-system';

const MAPS_DIR_NAME = 'maps';

function getMapsDirectory(): Directory {
  const dir = new Directory(Paths.document, MAPS_DIR_NAME);
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  return dir;
}

function extensionFromUri(uri: string): string {
  const match = uri.match(/\.([a-zA-Z0-9]+)(?:\?.*)?$/);
  return match ? match[1].toLowerCase() : 'jpg';
}

/**
 * Copies the image at `sourceUri` into permanent app storage and returns the
 * new, stable URI. `mapId` is used as the filename so each map owns exactly
 * one persisted image file.
 */
export async function persistMapImage(sourceUri: string, mapId: string): Promise<string> {
  const mapsDir = getMapsDirectory();
  const ext = extensionFromUri(sourceUri);
  const destFile = new File(mapsDir, `${mapId}.${ext}`);
  const sourceFile = new File(sourceUri);
  await sourceFile.copy(destFile);
  return destFile.uri;
}

/** Deletes a map's persisted image file, if present. Safe to call even if it's already gone. */
export function deleteMapImage(imageUri: string): void {
  try {
    const file = new File(imageUri);
    if (file.exists) {
      file.delete();
    }
  } catch {
    // Best-effort cleanup; a missing/locked file should never block deleting the map record.
  }
}
