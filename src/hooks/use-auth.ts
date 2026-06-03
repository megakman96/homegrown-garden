import { useState, useEffect } from 'react';
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
  const [loading, setLoading] = useState(!pb.authStore.isValid);

  useEffect(() => {
    if (pb.authStore.isValid) {
      setUser(modelToUser(pb.authStore.model));
    }
    setLoading(false);

    const unsub = pb.authStore.onChange((_, model) => {
      setUser(modelToUser(model));
    });

    return () => unsub();
  }, []);

  const signOut = () => pb.authStore.clear();

  return { user, session: pb.authStore.isValid ? pb.authStore : null, loading, signOut };
}
