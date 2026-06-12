/**
 * Subscription management via RevenueCat (react-native-purchases).
 *
 * SETUP CHECKLIST (one-time, before shipping):
 * 1. Create a RevenueCat account at revenuecat.com
 * 2. Create a project → add iOS app (bundle: com.homegrown.garden) + Android
 * 3. In App Store Connect: create a subscription product "gardengrid_premium_monthly"
 *    with a 14-day free trial ($2.99/month) and "gardengrid_premium_annual" ($19.99/year)
 * 4. In RevenueCat dashboard: create an Entitlement "premium", an Offering "default",
 *    and add both packages to it
 * 5. Create an iOS Offer Code "GROWFREE" (free for 12 months) in App Store Connect →
 *    link it as a promotional offer in RevenueCat
 * 6. Replace REVENUECAT_API_KEY_IOS and REVENUECAT_API_KEY_ANDROID below
 *
 * NOTE: react-native-purchases is a native module — it requires an EAS build,
 * not Expo Go. The UI renders in Expo Go but purchases won't fire.
 */

import { Platform } from 'react-native';
import { pb } from './pb';

export const REVENUECAT_API_KEY_IOS     = 'appl_REPLACE_WITH_YOUR_KEY';
export const REVENUECAT_API_KEY_ANDROID = 'goog_REPLACE_WITH_YOUR_KEY';
export const ENTITLEMENT_ID = 'premium';

// Test coupon codes — validated server-side (stored in PocketBase users.promo_expires).
// In production, RevenueCat Offer Codes handle IAP promos via Apple/Google.
export const TEST_PROMO_CODES: Record<string, string> = {
  'GROWFREE':    'Beta tester — free premium access',
  'GARDENTEST':  'Internal tester',
  'FRIEND2024':  'Friend & family access',
};

let initialized = false;

export async function initPurchases(userId: string) {
  if (Platform.OS === 'web') return;
  const apiKey = Platform.OS === 'ios' ? REVENUECAT_API_KEY_IOS : REVENUECAT_API_KEY_ANDROID;
  if (apiKey.startsWith('appl_REPLACE') || apiKey.startsWith('goog_REPLACE')) return;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    Purchases.configure({ apiKey, appUserID: userId });
    initialized = true;
  } catch {
    // Native module not available (Expo Go) — silent fail
  }
}

export async function checkPremium(): Promise<boolean> {
  if (hasServerPromoGrant()) return true;
  if (Platform.OS === 'web' || !initialized) return false;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch { return false; }
}

export async function getOfferings() {
  if (Platform.OS === 'web' || !initialized) return null;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    return await Purchases.getOfferings();
  } catch { return null; }
}

export async function purchasePackage(pkg: any): Promise<boolean> {
  if (Platform.OS === 'web' || !initialized) return false;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  if (Platform.OS === 'web' || !initialized) return false;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch { return false; }
}

// iOS Offer Code redemption sheet (opens App Store's promo code UI)
export async function presentOfferCodeSheet() {
  if (Platform.OS !== 'ios' || !initialized) return;
  try {
    const Purchases = (await import('react-native-purchases')).default;
    await (Purchases as any).presentCodeRedemptionSheet();
  } catch {}
}

// ── Server-side promo code grant (stored in PocketBase users.promo_expires) ──
// Requires PocketBase users collection to have:
//   promo_expires  DateTime (optional)
//   promo_code     Text (optional)

export function hasServerPromoGrant(): boolean {
  try {
    const user = (pb.authStore.record ?? pb.authStore.model) as any;
    if (!user?.promo_expires) return false;
    return new Date(user.promo_expires) > new Date();
  } catch { return false; }
}

export async function redeemPromoCode(code: string): Promise<{ success: boolean; message: string }> {
  const upper = code.trim().toUpperCase();

  // Known test codes — try server redemption
  if (TEST_PROMO_CODES[upper]) {
    try {
      // Server validates the code and writes promo_expires — client cannot forge this
      await pb.send('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: upper }),
      });
      // Refresh auth store so hasServerPromoGrant reads the updated record immediately
      await pb.collection('users').authRefresh();
      return { success: true, message: `✅ Code applied! ${TEST_PROMO_CODES[upper]}` };
    } catch {
      return { success: false, message: 'Could not save code. Try again.' };
    }
  }

  // On iOS, try RevenueCat / App Store offer code flow
  if (Platform.OS === 'ios' && initialized) {
    await presentOfferCodeSheet();
    return { success: true, message: 'Apple redemption sheet opened.' };
  }

  return { success: false, message: 'Invalid code. Check and try again.' };
}
