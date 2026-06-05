import { useState, useEffect } from 'react';
import { checkPremium } from '@/lib/subscription';
import { subscribe, emit } from '@/lib/events';

export const FREE_LIMITS = {
  gardens: 1,
  plants: 15,
};

// Bust and re-broadcast after any successful purchase/redemption
export function notifyPremiumChanged() {
  emit('premium:changed');
}

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  function recheck() {
    checkPremium().then(p => { setIsPremium(p); setLoading(false); });
  }

  useEffect(() => {
    recheck();
    // Re-run whenever a purchase/redemption succeeds anywhere in the app
    const unsub = subscribe('premium:changed', recheck);
    return unsub;
  }, []);

  return { isPremium, loading };
}
