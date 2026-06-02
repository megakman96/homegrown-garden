import { View, Text, StyleSheet } from 'react-native';
import { getPlantIcon } from '@/lib/plant-icons';

interface Props {
  name: string;
  category?: string;
  size?: number;
}

export default function PlantAvatar({ name, category, size = 48 }: Props) {
  const { emoji, bg } = getPlantIcon(name, category);
  const fontSize = size * 0.5;

  return (
    <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={{ fontSize, lineHeight: size }}>{emoji}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
});
