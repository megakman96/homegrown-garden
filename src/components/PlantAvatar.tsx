import { useEffect, useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
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

export default function PlantAvatar({ name, category, size = 48 }: Props) {
  const { emoji, bg } = getPlantIcon(name, category);
  const plantKey = name.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^a-z_]/g, '');

  const [imageUrl, setImageUrl] = useState<string | null>(() => getCustomIconUrl(plantKey));

  useEffect(() => {
    ensureOverridesLoaded().then(() => {
      const url = getCustomIconUrl(plantKey);
      setImageUrl(url);
    });
  }, [plantKey]);

  const fontSize = size * 0.5;

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: 'transparent' }]}>
      {imageUrl ? (
        <Image
          source={{ uri: imageUrl }}
          style={styles.image}
          onError={() => setImageUrl(null)}
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
