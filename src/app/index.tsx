import { Redirect } from 'expo-router';
import { pb } from '@/lib/pb';

export default function Index() {
  return <Redirect href={pb.authStore.isValid ? '/(tabs)' : '/(auth)/login'} />;
}
