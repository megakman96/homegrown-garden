import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet, Platform } from 'react-native';
import { getPlantIcon } from '@/lib/plant-icons';
import { loadPlantIconOverrides, getCustomIconUrl, isIconCacheStale } from '@/lib/plant-icon-overrides';

interface Props {
  name: string;
  category?: string;
  size?: number;
}

// Singleton load promise — reset whenever the cache is declared stale
let overrideLoadPromise: Promise<void> | null = null;

function ensureOverridesLoaded() {
  if (!overrideLoadPromise || isIconCacheStale()) {
    overrideLoadPromise = loadPlantIconOverrides().then(() => {});
  }
  return overrideLoadPromise;
}

function localIconUrl(key: string): string {
  // On web: absolute path served from public/plant-icons/
  // On native: bundled as a static asset under the same path
  return `/plant-icons/${key}.png`;
}

export default function PlantAvatar({ name, category, size = 48 }: Props) {
  const { emoji } = getPlantIcon(name, category);
  const plantKey = name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');

  const [imageUrl, setImageUrl] = useState<string | null>(() => getCustomIconUrl(plantKey));
  // Try the bundled local PNG if no PocketBase override exists
  const [localFailed, setLocalFailed] = useState(false);

  useEffect(() => {
    ensureOverridesLoaded().then(() => {
      const url = getCustomIconUrl(plantKey);
      setImageUrl(url);
    });
  }, [plantKey]);

  const fontSize = size * 0.5;
  const showLocal = !imageUrl && !localFailed && Platform.OS === 'web';
  const displayUrl = imageUrl ?? (showLocal ? localIconUrl(plantKey) : null);

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: 'transparent' }]}>
      {displayUrl ? (
        <Image
          source={{ uri: displayUrl }}
          style={styles.image}
          onError={() => {
            if (displayUrl === imageUrl) setImageUrl(null);
            else setLocalFailed(true);
          }}
        />
      ) : (
        <Text style={{ fontSize, lineHeight: size }}>{emoji}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
});
