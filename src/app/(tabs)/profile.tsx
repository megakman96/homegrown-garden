import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  TextInput, Modal, Alert,
} from 'react-native';
import { pb } from '@/lib/pb';
import { useAuth } from '@/hooks/use-auth';
import type { Garden, GardenShare } from '@/lib/types';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [gardens, setGardens] = useState<Garden[]>([]);
  const [shares, setShares] = useState<GardenShare[]>([]);
  const [showShare, setShowShare] = useState(false);
  const [shareGardenId, setShareGardenId] = useState('');
  const [shareEmail, setShareEmail] = useState('');

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
        permission: 'view',
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

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.profileCard}>
        <Text style={styles.avatar}>👤</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Shared Gardens</Text>
          <TouchableOpacity onPress={() => setShowShare(true)}>
            <Text style={styles.shareLink}>+ Share</Text>
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
                  <Text style={styles.shareEmail}>{share.shared_with_email}</Text>
                </View>
                <TouchableOpacity onPress={() => removeShare(share.id)}>
                  <Text style={styles.removeText}>Remove</Text>
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </View>

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>

      <Modal visible={showShare} transparent animationType="slide">
        <View style={styles.modalBackdrop}>
          <View style={styles.modal}>
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
              <TouchableOpacity onPress={() => setShowShare(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.button} onPress={shareGarden}>
                <Text style={styles.buttonText}>Share</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f7ee' },
  content: { padding: 20 },
  profileCard: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 16, padding: 24, marginBottom: 24 },
  avatar: { fontSize: 48, marginBottom: 8 },
  email: { fontSize: 15, color: '#52796f' },
  section: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 24 },
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
  shareEmail: { fontSize: 12, color: '#52796f' },
  removeText: { color: '#ff6b6b', fontSize: 13 },
  signOutButton: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ff6b6b',
  },
  signOutText: { color: '#ff6b6b', fontWeight: '600', fontSize: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#fff', borderRadius: 20, padding: 24, margin: 16 },
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
  cancelText: { color: '#52796f', fontSize: 16 },
  button: { backgroundColor: '#2d6a4f', borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  buttonText: { color: '#fff', fontWeight: '600' },
});
