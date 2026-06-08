import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert, Platform, Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { pb } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import { useBreakpoint } from '@/hooks/useBreakpoint';
import { useAppTheme, saveBirthday, loadBirthday, type ThemeMode, type TempUnit, type WaterTime } from '@/contexts/theme-context';
import { clearActivityLogAsync } from '@/lib/activity-log';
import { usePremium } from '@/hooks/use-premium';
import NotificationSettingsUI from '@/components/ui/NotificationSettings';
import UpgradePrompt from '@/components/ui/UpgradePrompt';
import type { Garden, GardenShare } from '@/lib/types';

const ADMIN_EMAIL = 'kwardthyfault@gmail.com';
const VENMO_USER  = 'kaleb-ward-8';

function openVenmo() {
  const deepLink = `venmo://paycharge?txn=pay&recipients=${VENMO_USER}&note=GardenGrid%20Support`;
  const webUrl   = `https://venmo.com/u/${VENMO_USER}`;
  Linking.canOpenURL(deepLink)
    .then(can => Linking.openURL(can ? deepLink : webUrl))
    .catch(() => Linking.openURL(webUrl));
}

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { isDesktop } = useBreakpoint();
  const router = useRouter();
  const { mode, setMode, isDark, colors, tempUnit, setTempUnit, waterTime, setWaterTime } = useAppTheme();
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [shares, setShares] = useState<GardenShare[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [shareGardenId, setShareGardenId] = useState('');
  const [shareEmail, setShareEmail] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [wipingData, setWipingData] = useState(false);
  const { isPremium } = usePremium();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const isAdmin = user?.email === ADMIN_EMAIL && Platform.OS === 'web';

  // Settings edit state
  const displayName = (pb.authStore.model as any)?.name ?? user?.email?.split('@')[0] ?? '';
  const displayBday = user ? loadBirthday(user.id) ?? '' : '';
  const [editingName, setEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [editingBday, setEditingBday] = useState(false);
  const [editBday, setEditBday] = useState('');
  const [showChangePw, setShowChangePw] = useState(false);
  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [changingPw, setChangingPw] = useState(false);

  async function saveName() {
    if (!user || !editName.trim()) return;
    try {
      const updated = await pb.collection('users').update(user.id, { name: editName.trim() });
      pb.authStore.save(pb.authStore.token, updated);
      setEditingName(false);
    } catch (e: any) { Alert.alert('Error', e?.message ?? 'Could not update name'); }
  }

  function saveBdayFn() {
    if (!user) return;
    saveBirthday(user.id, editBday.trim());
    setEditingBday(false);
  }

  async function changePassword() {
    if (!user) return;
    if (!oldPw || !newPw || !confirmPw) {
      Alert.alert('Missing fields', 'Please fill in all three fields.');
      return;
    }
    if (newPw !== confirmPw) {
      Alert.alert('Passwords do not match', 'New password and confirm password must match.');
      return;
    }
    if (newPw.length < 8) {
      Alert.alert('Too short', 'New password must be at least 8 characters.');
      return;
    }
    setChangingPw(true);
    try {
      await pb.collection('users').update(user.id, {
        oldPassword: oldPw,
        password: newPw,
        passwordConfirm: confirmPw,
      });
      Alert.alert('Success', 'Your password has been updated. Please sign in again.');
      setShowChangePw(false);
      setOldPw(''); setNewPw(''); setConfirmPw('');
      signOut();
    } catch (e: any) {
      Alert.alert('Error', e?.data?.oldPassword?.message ?? e?.message ?? 'Could not change password.');
    } finally {
      setChangingPw(false);
    }
  }

  const bg = isDark ? colors.bg : '#f0f7ee';
  const cardBg = isDark ? colors.bgCard : '#fff';
  const textPrimary = isDark ? colors.text : '#1b4332';
  const textSecondary = isDark ? colors.textSec : '#52796f';
  const borderCol = isDark ? colors.border : '#e8f5e9';

  useEffect(() => {
    if (!user) return;
    Promise.all([
      pb.collection('gardens').getFullList({ filter: `user_id = "${user.id}"` }),
      pb.collection('garden_shares').getFullList({ filter: `owner_id = "${user.id}"` }),
    ]).then(([gardenList, shareList]) => {
      setGardens(gardenList as any);
      setShares(shareList as any);
      if (gardenList.length) setShareGardenId(gardenList[0].id);
    });
  }, [user]);

  async function shareGarden() {
    if (!user || !shareEmail.trim() || !shareGardenId) return;
    try {
      const record = await pb.collection('garden_shares').create({
        garden_id: shareGardenId,
        owner_id: user.id,
        shared_with_email: shareEmail.trim(),
        permission: 'edit',
      });
      Alert.alert('Shared!', `Garden shared with ${shareEmail}`);
      setShares((s) => [...s, record as any]);
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not share garden');
    }
    setShowShare(false);
    setShareEmail('');
  }

  async function removeShare(id: string) {
    await pb.collection('garden_shares').delete(id);
    setShares((s) => s.filter((sh) => sh.id !== id));
  }

  function confirmDeleteAccount() {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, all gardens, and all plants. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete Everything', style: 'destructive', onPress: deleteAccount },
      ],
    );
  }

  async function deleteAccount() {
    if (!user) return;
    setDeletingAccount(true);
    try {
      const plants = await pb.collection('plants').getFullList({ filter: `user_id = "${user.id}"` });
      await Promise.all(plants.map(p => pb.collection('plants').delete(p.id).catch(() => {})));

      const gardenList = await pb.collection('gardens').getFullList({ filter: `user_id = "${user.id}"` });
      await Promise.all(gardenList.map(g => pb.collection('gardens').delete(g.id).catch(() => {})));

      const shareList = await pb.collection('garden_shares').getFullList({ filter: `owner_id = "${user.id}"` });
      await Promise.all(shareList.map(s => pb.collection('garden_shares').delete(s.id).catch(() => {})));

      // Try to delete the auth record; if it fails (permissions), sign out anyway — data is already gone
      await pb.collection('users').delete(user.id).catch(() => {});
      signOut();
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not delete account data. Please try again.');
      setDeletingAccount(false);
    }
  }

  function confirmWipeData() {
    Alert.alert(
      'Reset All Garden Data',
      'This will delete all your gardens, plants, harvests, and history. Your profile (name, email, settings) will be kept. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset Everything', style: 'destructive', onPress: wipeAllData },
      ],
    );
  }

  async function wipeAllData() {
    if (!user) return;
    setWipingData(true);
    try {
      const plants = await pb.collection('plants').getFullList({ filter: `user_id = "${user.id}"` });

      // Delete plant photos before plants (foreign key)
      const photos = await pb.collection('plant_photos').getFullList({ filter: `user_id = "${user.id}"` }).catch(() => [] as any[]);
      await Promise.all((photos as any[]).map((ph: any) => pb.collection('plant_photos').delete(ph.id).catch(() => {})));

      await Promise.all(plants.map(p => pb.collection('plants').delete(p.id).catch(() => {})));

      const harvests = await pb.collection('harvests').getFullList({ filter: `user_id = "${user.id}"` }).catch(() => [] as any[]);
      await Promise.all((harvests as any[]).map((h: any) => pb.collection('harvests').delete(h.id).catch(() => {})));

      const gardenList = await pb.collection('gardens').getFullList({ filter: `user_id = "${user.id}"` });
      await Promise.all(gardenList.map(g => pb.collection('gardens').delete(g.id).catch(() => {})));

      const shareList = await pb.collection('garden_shares').getFullList({ filter: `owner_id = "${user.id}"` }).catch(() => [] as any[]);
      await Promise.all((shareList as any[]).map((s: any) => pb.collection('garden_shares').delete(s.id).catch(() => {})));

      // Also remove gardens that were shared WITH this user
      const sharedWithMe = await pb.collection('garden_shares').getFullList({ filter: `shared_with_email = "${user.email}"` }).catch(() => [] as any[]);
      await Promise.all((sharedWithMe as any[]).map((s: any) => pb.collection('garden_shares').delete(s.id).catch(() => {})));

      await clearActivityLogAsync(user.id);

      setGardens([]);
      setShares([]);
      // Navigate to home so all tabs refresh with empty state
      router.replace('/(tabs)');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Could not wipe data. Please try again.');
    } finally {
      setWipingData(false);
    }
  }

  const changePwModal = (
    <Modal visible={showChangePw} transparent animationType="fade">
      <View style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}>
        <View style={[styles.modal, isDesktop && styles.modalCenter]}>
          <Text style={[styles.modalTitle, { color: textPrimary }]}>Change Password</Text>

          <Text style={[styles.pwLabel, { color: textSecondary }]}>Current Password</Text>
          <TextInput
            style={[styles.input, { color: textPrimary, borderColor: borderCol, backgroundColor: isDark ? colors.bgElement : '#f0f7ee' }]}
            value={oldPw}
            onChangeText={setOldPw}
            secureTextEntry
            placeholder="Current password"
            placeholderTextColor={textSecondary}
            autoFocus
          />

          <Text style={[styles.pwLabel, { color: textSecondary }]}>New Password</Text>
          <TextInput
            style={[styles.input, { color: textPrimary, borderColor: borderCol, backgroundColor: isDark ? colors.bgElement : '#f0f7ee' }]}
            value={newPw}
            onChangeText={setNewPw}
            secureTextEntry
            placeholder="At least 8 characters"
            placeholderTextColor={textSecondary}
          />

          <Text style={[styles.pwLabel, { color: textSecondary }]}>Confirm New Password</Text>
          <TextInput
            style={[styles.input, { color: textPrimary, borderColor: borderCol, backgroundColor: isDark ? colors.bgElement : '#f0f7ee' }]}
            value={confirmPw}
            onChangeText={setConfirmPw}
            secureTextEntry
            placeholder="Repeat new password"
            placeholderTextColor={textSecondary}
          />

          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowChangePw(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, changingPw && { opacity: 0.6 }]}
              onPress={changePassword}
              disabled={changingPw}
            >
              <Text style={styles.buttonText}>{changingPw ? 'Saving…' : 'Update Password'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const shareModal = (
    <Modal visible={showShare} transparent animationType="slide">
      <View style={[styles.modalBackdrop, isDesktop && styles.modalBackdropCenter]}>
        <View style={[styles.modal, isDesktop && styles.modalCenter]}>
          <Text style={styles.modalTitle}>Share Garden</Text>
          {gardens.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gardenPicker}>
              {gardens.map((g) => (
                <TouchableOpacity
                  key={g.id}
                  style={[styles.gardenChip, shareGardenId === g.id && styles.gardenChipActive]}
                  onPress={() => setShareGardenId(g.id)}
                >
                  <Text style={[styles.gardenChipText, shareGardenId === g.id && styles.gardenChipTextActive]}>
                    {g.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          <TextInput
            style={styles.input}
            placeholder="Friend's email"
            value={shareEmail}
            onChangeText={setShareEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoFocus
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowShare(false)}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.button} onPress={shareGarden}>
              <Text style={styles.buttonText}>Share</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const sharesSection = (
    <View style={isDesktop ? styles.desktopCard : styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>🌿 Shared Gardens</Text>
        <TouchableOpacity onPress={() => {
          if (!isPremium) { router.push('/subscription' as any); return; }
          setShowShare(true);
        }}>
          <Text style={styles.shareLink}>{isPremium ? '+ Share' : '🔒 Share'}</Text>
        </TouchableOpacity>
      </View>
      {shares.length === 0 ? (
        <Text style={styles.noShares}>No gardens shared yet</Text>
      ) : (
        shares.map((share) => {
          const garden = gardens.find((g) => g.id === share.garden_id);
          return (
            <View key={share.id} style={styles.shareRow}>
              <View>
                <Text style={styles.shareName}>{garden?.name ?? 'Garden'}</Text>
                <Text style={styles.shareEmailText}>{share.shared_with_email}</Text>
              </View>
              <TouchableOpacity onPress={() => removeShare(share.id)}>
                <Text style={styles.removeText}>Remove</Text>
              </TouchableOpacity>
            </View>
          );
        })
      )}
    </View>
  );

  const settingsSection = (
    <View style={[styles.section, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <Text style={[styles.sectionTitle, { color: textPrimary }]}>⚙️ Settings</Text>

      {/* Dark mode */}
      <Text style={[styles.settingLabel, { color: textSecondary }]}>APPEARANCE</Text>
      <View style={styles.modeRow}>
        {(['system', 'light', 'dark'] as ThemeMode[]).map(m => (
          <TouchableOpacity
            key={m}
            style={[styles.modeBtn, { borderColor: borderCol }, mode === m && styles.modeBtnActive]}
            onPress={() => setMode(m)}
          >
            <Text style={styles.modeEmoji}>{m === 'system' ? '⚙️' : m === 'light' ? '☀️' : '🌙'}</Text>
            <Text style={[styles.modeBtnText, { color: textSecondary }, mode === m && styles.modeBtnTextActive]}>
              {m === 'system' ? 'System' : m === 'light' ? 'Light' : 'Dark'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Name */}
      <Text style={[styles.settingLabel, { color: textSecondary, marginTop: 14 }]}>ACCOUNT</Text>
      <View style={[styles.settingRow, { borderBottomColor: borderCol }]}>
        <Text style={[styles.settingKey, { color: textSecondary }]}>First Name</Text>
        {editingName ? (
          <View style={styles.settingEditRow}>
            <TextInput
              style={[styles.settingInput, { color: textPrimary, borderColor: borderCol, backgroundColor: isDark ? colors.bgElement : '#f0f7ee' }]}
              value={editName} onChangeText={setEditName} autoFocus
            />
            <TouchableOpacity onPress={saveName} style={styles.settingSaveBtn}>
              <Text style={styles.settingSave}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingName(false)} style={{ marginLeft: 6 }}>
              <Text style={[styles.settingSave, { color: textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.settingValueRow}>
            <Text style={[styles.settingValue, { color: textPrimary }]}>{displayName || '—'}</Text>
            <TouchableOpacity onPress={() => { setEditingName(true); setEditName(displayName); }}>
              <Text style={styles.settingEdit}>{displayName ? 'Edit' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Birthday */}
      <View style={[styles.settingRow, { borderBottomColor: borderCol }]}>
        <Text style={[styles.settingKey, { color: textSecondary }]}>Birthday</Text>
        {editingBday ? (
          <View style={styles.settingEditRow}>
            <TextInput
              style={[styles.settingInput, { color: textPrimary, borderColor: borderCol, backgroundColor: isDark ? colors.bgElement : '#f0f7ee' }]}
              value={editBday} onChangeText={setEditBday}
              placeholder="MM/DD" keyboardType="numbers-and-punctuation" maxLength={5} autoFocus
            />
            <TouchableOpacity onPress={saveBdayFn} style={styles.settingSaveBtn}>
              <Text style={styles.settingSave}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setEditingBday(false)} style={{ marginLeft: 6 }}>
              <Text style={[styles.settingSave, { color: textSecondary }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.settingValueRow}>
            <Text style={[styles.settingValue, { color: textPrimary }]}>{displayBday || '—'}</Text>
            <TouchableOpacity onPress={() => { setEditingBday(true); setEditBday(displayBday); }}>
              <Text style={styles.settingEdit}>{displayBday ? 'Edit' : 'Add'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Change Password */}
      <View style={[styles.settingRow, { borderBottomWidth: 0 }]}>
        <Text style={[styles.settingKey, { color: textSecondary }]}>Password</Text>
        <View style={styles.settingValueRow}>
          <Text style={[styles.settingValue, { color: textPrimary }]}>••••••••</Text>
          <TouchableOpacity onPress={() => { setShowChangePw(true); setOldPw(''); setNewPw(''); setConfirmPw(''); }}>
            <Text style={styles.settingEdit}>Change</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );

  const tempSection = (
    <View style={[styles.section, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <Text style={[styles.sectionTitle, { color: textPrimary }]}>🌡️ Temperature Units</Text>
      <View style={styles.modeRow}>
        {(['C', 'F'] as TempUnit[]).map(u => (
          <TouchableOpacity
            key={u}
            style={[styles.modeBtn, { borderColor: borderCol }, tempUnit === u && styles.modeBtnActive]}
            onPress={() => setTempUnit(u)}
          >
            <Text style={styles.modeEmoji}>{u === 'C' ? '°C' : '°F'}</Text>
            <Text style={[styles.modeBtnText, { color: textSecondary }, tempUnit === u && styles.modeBtnTextActive]}>
              {u === 'C' ? 'Celsius' : 'Fahrenheit'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  const waterTimeSection = (
    <View style={[styles.section, { backgroundColor: cardBg, borderColor: borderCol }]}>
      <Text style={[styles.sectionTitle, { color: textPrimary }]}>💧 Preferred Watering Time</Text>
      <View style={styles.modeRow}>
        {([
          { key: 'morning',   label: 'Morning',   emoji: '🌅' },
          { key: 'afternoon', label: 'Afternoon', emoji: '☀️' },
          { key: 'evening',   label: 'Evening',   emoji: '🌙' },
        ] as { key: WaterTime; label: string; emoji: string }[]).map(({ key, label, emoji }) => (
          <TouchableOpacity
            key={key}
            style={[styles.modeBtn, { borderColor: borderCol }, waterTime === key && styles.modeBtnActive]}
            onPress={() => setWaterTime(key)}
          >
            <Text style={styles.modeEmoji}>{emoji}</Text>
            <Text style={[styles.modeBtnText, { color: textSecondary }, waterTime === key && styles.modeBtnTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );

  if (isDesktop) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.desktopContent}>
        {shareModal}
        {changePwModal}
        <View style={styles.desktopPageHeader}>
          <Text style={[styles.desktopPageTitle, { color: textPrimary }]}>👤 Profile</Text>
          <Text style={[styles.desktopPageSub, { color: textSecondary }]}>Account, sharing & settings</Text>
        </View>
        <View style={styles.desktopBody}>
          {/* Left: user card */}
          <View style={styles.desktopLeft}>
            <View style={styles.desktopCard}>
              <View style={styles.desktopAvatar}>
                <Text style={styles.desktopAvatarText}>
                  {user?.email?.[0]?.toUpperCase() ?? '?'}
                </Text>
              </View>
              <Text style={styles.desktopEmail}>{user?.email}</Text>
              <Text style={styles.desktopRole}>Gardener</Text>
              <View style={styles.desktopDivider} />
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{gardens.length}</Text>
                  <Text style={styles.statLab}>Gardens</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statNum}>{shares.length}</Text>
                  <Text style={styles.statLab}>Shared</Text>
                </View>
              </View>
              <TouchableOpacity style={styles.desktopWipeBtn} onPress={confirmWipeData} disabled={wipingData}>
                <Text style={styles.desktopWipeText}>{wipingData ? 'Resetting…' : '🔄 Reset All Data'}</Text>
              </TouchableOpacity>
              {isAdmin && (
                <TouchableOpacity style={styles.desktopAdminBtn} onPress={() => router.push('/admin' as any)}>
                  <Text style={styles.desktopAdminText}>⚙️ Admin Panel</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity style={styles.desktopVenmoBtn} onPress={openVenmo}>
                <Text style={styles.desktopVenmoText}>💚 Support on Venmo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.desktopSignOut} onPress={signOut}>
                <Text style={styles.desktopSignOutText}>Sign out</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.desktopDeleteBtn} onPress={confirmDeleteAccount} disabled={deletingAccount}>
                <Text style={styles.desktopDeleteText}>{deletingAccount ? 'Deleting…' : 'Delete Account'}</Text>
              </TouchableOpacity>
            </View>
          </View>
          {/* Right: shares + settings */}
          <View style={styles.desktopRight}>
            {sharesSection}
            {settingsSection}
            {tempSection}
            {waterTimeSection}
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: bg }]} contentContainerStyle={styles.content}>
      <View style={[styles.profileCard, { backgroundColor: cardBg }]}>
        <Text style={styles.avatar}>👤</Text>
        <Text style={[styles.email, { color: textSecondary }]}>{user?.email}</Text>
        {displayName && displayName !== user?.email?.split('@')[0] && (
          <Text style={[styles.email, { color: textPrimary, fontWeight: '700', marginTop: 2 }]}>{displayName}</Text>
        )}
      </View>
      {/* Subscription card */}
      <TouchableOpacity
        style={[styles.subCard, { backgroundColor: isPremium ? '#e8f5e9' : '#fff9db', borderColor: isPremium ? '#a5d6a7' : '#ffe066' }]}
        onPress={() => router.push('/subscription' as any)}
      >
        <Text style={styles.subCardEmoji}>{isPremium ? '🌟' : '🌱'}</Text>
        <View style={{ flex: 1 }}>
          <Text style={[styles.subCardTitle, { color: isPremium ? '#2d6a4f' : '#7d5a00' }]}>
            {isPremium ? 'GardenGrid Pro — Active' : 'Upgrade to Pro'}
          </Text>
          <Text style={[styles.subCardSub, { color: isPremium ? '#52796f' : '#9c6f00' }]}>
            {isPremium ? 'All features unlocked. Thank you! 🙏' : '14-day free trial · Unlimited gardens & more'}
          </Text>
        </View>
        <Text style={{ fontSize: 18, color: isPremium ? '#52b788' : '#e67700' }}>›</Text>
      </TouchableOpacity>

      {/* Notifications — collapsed behind a button */}
      <TouchableOpacity
        style={[styles.collapsibleBtn, { backgroundColor: cardBg, borderColor: borderCol }]}
        onPress={() => {
          if (!isPremium) { router.push('/subscription' as any); return; }
          setShowNotifications(v => !v);
        }}
      >
        <Text style={styles.collapsibleEmoji}>{isPremium ? '🔔' : '🔒'}</Text>
        <Text style={[styles.collapsibleLabel, { color: textPrimary }]}>Notification Settings</Text>
        <Text style={[styles.collapsibleChevron, { color: textSecondary }]}>
          {isPremium ? (showNotifications ? '▲' : '▼') : 'Pro'}
        </Text>
      </TouchableOpacity>
      {showNotifications && isPremium && <NotificationSettingsUI />}

      {sharesSection}

      {/* Profile & Settings — collapsed behind a button */}
      <TouchableOpacity
        style={[styles.collapsibleBtn, { backgroundColor: cardBg, borderColor: borderCol }]}
        onPress={() => setShowSettings(v => !v)}
      >
        <Text style={styles.collapsibleEmoji}>⚙️</Text>
        <Text style={[styles.collapsibleLabel, { color: textPrimary }]}>Profile & Settings</Text>
        <Text style={[styles.collapsibleChevron, { color: textSecondary }]}>
          {showSettings ? '▲' : '▼'}
        </Text>
      </TouchableOpacity>
      {showSettings && (
        <>
          {settingsSection}
          {tempSection}
          {waterTimeSection}
        </>
      )}
      <TouchableOpacity style={styles.wipeButton} onPress={confirmWipeData} disabled={wipingData}>
        <Text style={styles.wipeButtonText}>{wipingData ? 'Resetting…' : '🔄 Reset All Garden Data'}</Text>
      </TouchableOpacity>
      {isAdmin && (
        <TouchableOpacity style={styles.adminButton} onPress={() => router.push('/admin' as any)}>
          <Text style={styles.adminButtonText}>⚙️ Admin: Plant Catalogue</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={styles.venmoButton} onPress={openVenmo}>
        <Text style={styles.venmoText}>💚 Support GardenGrid on Venmo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.deleteButton} onPress={confirmDeleteAccount} disabled={deletingAccount}>
        <Text style={styles.deleteButtonText}>{deletingAccount ? 'Deleting…' : 'Delete Account'}</Text>
      </TouchableOpacity>
      {shareModal}
      {changePwModal}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 20, paddingBottom: 40 },

  // Desktop
  desktopContent: { maxWidth: 1100, width: '100%', alignSelf: 'center', paddingBottom: 48 },
  desktopPageHeader: { paddingHorizontal: 32, paddingTop: 32, paddingBottom: 24 },
  desktopPageTitle: { fontSize: 28, fontWeight: '800', color: '#1b4332', letterSpacing: -0.5 },
  desktopPageSub: { fontSize: 14, color: '#52796f', marginTop: 4 },
  desktopBody: { flexDirection: 'row', gap: 24, paddingHorizontal: 32, alignItems: 'flex-start' },
  desktopLeft: { width: 280, flexShrink: 0 },
  desktopRight: { flex: 1 },
  desktopCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#1b4332',
    shadowOpacity: 0.07,
    shadowRadius: 12,
    elevation: 3,
  },
  desktopAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#40916c',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    alignSelf: 'center',
  },
  desktopAvatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  desktopEmail: { fontSize: 14, color: '#1b4332', fontWeight: '600', textAlign: 'center' },
  desktopRole: { fontSize: 12, color: '#52796f', textAlign: 'center', marginTop: 4 },
  desktopDivider: { height: 1, backgroundColor: '#f0f7ee', marginVertical: 20 },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  statItem: { alignItems: 'center' },
  statNum: { fontSize: 24, fontWeight: '800', color: '#2d6a4f' },
  statLab: { fontSize: 11, color: '#52796f', marginTop: 2 },
  desktopSignOut: {
    backgroundColor: '#fff5f5',
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffc9c9',
  },
  desktopSignOutText: { color: '#e03131', fontWeight: '600', fontSize: 14 },

  // Settings
  settingLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2, marginBottom: 8, textTransform: 'uppercase' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 4 },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, gap: 4 },
  modeBtnActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  modeEmoji: { fontSize: 16 },
  modeBtnText: { fontSize: 12, fontWeight: '500' },
  modeBtnTextActive: { color: '#fff', fontWeight: '700' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1 },
  settingKey: { fontSize: 14 },
  settingValueRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  settingValue: { fontSize: 14, fontWeight: '600' },
  settingEdit: { fontSize: 13, color: '#2d6a4f', fontWeight: '600' },
  settingEditRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1, justifyContent: 'flex-end' },
  settingInput: { borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, minWidth: 80 },
  settingSaveBtn: {},
  settingSave: { fontSize: 13, color: '#2d6a4f', fontWeight: '700' },

  // Mobile
  profileCard: { alignItems: 'center', borderRadius: 16, padding: 24, marginBottom: 24 },
  avatar: { fontSize: 48, marginBottom: 8 },
  email: { fontSize: 15, color: '#52796f' },
  section: { borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#2d6a4f' },
  shareLink: { color: '#52b788', fontWeight: '600' },
  noShares: { color: '#74c69d', fontSize: 14 },
  shareRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f0f7ee',
  },
  shareName: { fontSize: 14, fontWeight: '600', color: '#1b4332' },
  shareEmailText: { fontSize: 12, color: '#52796f' },
  removeText: { color: '#ff6b6b', fontSize: 13 },
  signOutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff6b6b',
    marginBottom: 10,
  },
  signOutText: { color: '#ff6b6b', fontWeight: '600', fontSize: 16 },
  deleteButton: {
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  deleteButtonText: { color: '#adb5bd', fontSize: 13 },
  desktopDeleteBtn:  { marginTop: 6, alignItems: 'center', paddingVertical: 6 },
  desktopDeleteText: { color: '#adb5bd', fontSize: 12 },
  desktopVenmoBtn:   { marginTop: 12, backgroundColor: '#e8f5e9', borderRadius: 10, paddingVertical: 11, alignItems: 'center', borderWidth: 1, borderColor: '#a5d6a7' },
  desktopVenmoText:  { color: '#2d6a4f', fontWeight: '700', fontSize: 13 },
  venmoButton: {
    borderRadius: 12, padding: 15, alignItems: 'center', marginBottom: 10,
    backgroundColor: '#e8f5e9', borderWidth: 1.5, borderColor: '#a5d6a7',
  },
  venmoText:    { color: '#2d6a4f', fontWeight: '700', fontSize: 15 },
  collapsibleBtn:     { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1, padding: 14, marginBottom: 8 },
  collapsibleEmoji:   { fontSize: 18 },
  collapsibleLabel:   { flex: 1, fontSize: 15, fontWeight: '600' },
  collapsibleChevron: { fontSize: 12, fontWeight: '600' },
  subCard:      { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 16 },
  subCardEmoji: { fontSize: 26 },
  subCardTitle: { fontSize: 15, fontWeight: '700' },
  subCardSub:   { fontSize: 12, marginTop: 2 },
  desktopWipeBtn: { marginTop: 12, backgroundColor: '#fff3e0', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#ffcc80' },
  desktopWipeText: { color: '#e65100', fontWeight: '600', fontSize: 13 },
  desktopAdminBtn: { marginTop: 8, backgroundColor: '#e8f5e9', borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#a5d6a7' },
  desktopAdminText: { color: '#2d6a4f', fontWeight: '600', fontSize: 13 },
  wipeButton: { backgroundColor: '#fff3e0', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#ffcc80', marginBottom: 10 },
  wipeButtonText: { color: '#e65100', fontWeight: '600', fontSize: 14 },
  adminButton: { backgroundColor: '#e8f5e9', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#a5d6a7', marginBottom: 10 },
  adminButtonText: { color: '#2d6a4f', fontWeight: '700', fontSize: 14 },

  // Modal
  modalBackdrop:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalBackdropCenter: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 32 },
  modal:               { backgroundColor: '#fff', borderRadius: 20, padding: 24, margin: 16 },
  modalCenter:         { width: '100%', maxWidth: 480, margin: 0 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#2d6a4f', marginBottom: 16 },
  input: {
    backgroundColor: '#f0f7ee',
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#b7e4c7',
    marginBottom: 16,
  },
  gardenPicker: { flexGrow: 0, marginBottom: 12 },
  gardenChip: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    backgroundColor: '#f0f7ee',
    borderWidth: 1,
    borderColor: '#b7e4c7',
  },
  gardenChipActive: { backgroundColor: '#2d6a4f', borderColor: '#2d6a4f' },
  gardenChipText: { color: '#2d6a4f', fontWeight: '500' },
  gardenChipTextActive: { color: '#fff' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cancelBtn: { borderRadius: 10, paddingVertical: 10, paddingHorizontal: 20, backgroundColor: '#fff5f5', borderWidth: 1.5, borderColor: '#ffc9c9' },
  cancelText: { color: '#e03131', fontSize: 15, fontWeight: '700' },
  button: { backgroundColor: '#2d6a4f', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
  pwLabel: { fontSize: 12, fontWeight: '600', marginTop: 12, marginBottom: 4 },
});
