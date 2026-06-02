import { useState, useEffect } from 'react';
import { pb } from '../lib/pb';

export interface AuthUser {
  id: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(
    pb.authStore.isValid && pb.authStore.model
      ? { id: pb.authStore.model.id, email: pb.authStore.model.email }
      : null
  );
  const [loading, setLoading] = useState(!pb.authStore.isValid);

  useEffect(() => {
    if (pb.authStore.isValid && pb.authStore.model) {
      setUser({ id: pb.authStore.model.id, email: pb.authStore.model.email });
    }
    setLoading(false);

    const unsub = pb.authStore.onChange((_, model) => {
      setUser(model ? { id: model.id, email: model.email } : null);
    });

    return () => unsub();
  }, []);

  const signOut = () => pb.authStore.clear();

  return { user, session: pb.authStore.isValid ? pb.authStore : null, loading, signOut };
}
