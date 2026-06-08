import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { pb } from '../lib/pb';

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
}

function modelToUser(model: any): AuthUser | null {
  if (!model) return null;
  return { id: model.id, email: model.email, name: model.name ?? undefined };
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(
    pb.authStore.isValid ? modelToUser(pb.authStore.model) : null
  );
  // Web uses synchronous LocalAuthStore so isValid is correct immediately.
  // Native uses AsyncAuthStore which processes `initial` through an async queue —
  // keep loading=true until onChange fires to prevent a premature redirect to login.
  const [loading, setLoading] = useState(Platform.OS !== 'web');

  useEffect(() => {
    if (pb.authStore.isValid) {
      setUser(modelToUser(pb.authStore.model));
      setLoading(false);
    }

    const unsub = pb.authStore.onChange((_, model) => {
      setUser(modelToUser(model));
      setLoading(false);
    });

    // Fallback: resolve loading after 2s in case onChange never fires
    const timeout = setTimeout(() => setLoading(false), 2000);

    return () => {
      unsub();
      clearTimeout(timeout);
    };
  }, []);

  const signOut = () => pb.authStore.clear();

  return { user, session: pb.authStore.isValid ? pb.authStore : null, loading, signOut };
}
