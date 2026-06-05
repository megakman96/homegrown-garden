import { useState, useEffect } from 'react';
import { checkPremium } from '@/lib/subscription';

export const FREE_LIMITS = {
  gardens: 1,
  plants: 15,
};

let cached: boolean | null = null;

export function usePremium() {
  const [isPremium, setIsPremium] = useState<boolean>(cached ?? false);
  const [loading, setLoading] = useState(cached === null);

  useEffect(() => {
    if (cached !== null) { setIsPremium(cached); setLoading(false); return; }
    checkPremium().then(p => {
      cached = p;
      setIsPremium(p);
      setLoading(false);
    });
  }, []);

  // Call after a successful purchase to bust the cache
  function refresh() {
    cached = null;
    checkPremium().then(p => { cached = p; setIsPremium(p); });
  }

  return { isPremium, loading, refresh };
}
