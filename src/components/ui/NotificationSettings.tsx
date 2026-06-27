import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, Platform } from 'react-native';
import { G, R } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import {
  loadNotificationSettings, saveNotificationSettings,
  DEFAULT_SETTINGS, type NotificationSettings,
} from '@/lib/notification-settings';
import { requestNotificationPermission, rescheduleAllNotifications, cancelAllNotifications } from '@/lib/notifications';
import { TouchableOpacity } from 'react-native';

interface Props {
  plants?: any[];
}

function TimePicker({ hour, minute, onChange, textSec, textPrim, border, inputBg }: {
  hour: number; minute: number;
  onChange: (h: number, m: number) => void;
  textSec: string; textPrim: string; border: string; inputBg: string;
}) {
  const pad = (n: number) => String(n).padStart(2, '0');
  const isAm = hour < 12;
  const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

  function h12ToH24(h12: number, am: boolean): number {
    if (am) return h12 === 12 ? 0 : h12;
    return h12 === 12 ? 12 : h12 + 12;
  }

  return (
    <View style={[tp.block, { marginTop: 8 }]}>
      <Text style={[tp.blockLabel, { color: textSec }]}>Remind me at</Text>
      <View style={tp.timeRow}>
        <View style={tp.spinnerCol}>
          <Text style={[tp.spinnerLabel, { color: textSec }]}>HR</Text>
          <View style={tp.spinnerControls}>
            <TouchableOpacity style={[tp.btn, { borderColor: border, backgroundColor: inputBg }]}
              onPress={() => onChange(h12ToH24(((hour12 - 2 + 12) % 12) + 1, isAm), minute)}>
              <Text style={[tp.arrow, { color: textPrim }]}>−</Text>
            </TouchableOpacity>
            <Text style={[tp.value, { color: textPrim }]}>{pad(hour12)}</Text>
            <TouchableOpacity style={[tp.btn, { borderColor: border, backgroundColor: inputBg }]}
              onPress={() => onChange(h12ToH24((hour12 % 12) + 1, isAm), minute)}>
              <Text style={[tp.arrow, { color: textPrim }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[tp.timeSep, { color: textPrim }]}>:</Text>
        <View style={tp.spinnerCol}>
          <Text style={[tp.spinnerLabel, { color: textSec }]}>MIN</Text>
          <View style={tp.spinnerControls}>
            <TouchableOpacity style={[tp.btn, { borderColor: border, backgroundColor: inputBg }]}
              onPress={() => onChange(hour, (minute + 45) % 60)}>
              <Text style={[tp.arrow, { color: textPrim }]}>−</Text>
            </TouchableOpacity>
            <Text style={[tp.value, { color: textPrim }]}>{pad(minute)}</Text>
            <TouchableOpacity style={[tp.btn, { borderColor: border, backgroundColor: inputBg }]}
              onPress={() => onChange(hour, (minute + 15) % 60)}>
              <Text style={[tp.arrow, { color: textPrim }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={[tp.spinnerCol, { marginTop: 14 }]}>
          <TouchableOpacity
            style={[tp.ampmBtn, { borderColor: border, backgroundColor: inputBg }]}
            onPress={() => onChange(h12ToH24(hour12, !isAm), minute)}
          >
            <Text style={[tp.ampmText, { color: textPrim }]}>{isAm ? 'AM' : 'PM'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

export default function NotificationSettingsUI({ plants = [] }: Props) {
  const { isDark, colors } = useAppTheme();
  const textPrim = isDark ? colors.text      : G.forest;
  const textSec  = isDark ? colors.textSec   : G.stone;
  const border   = isDark ? colors.border    : G.mist;
  const cardBg   = isDark ? colors.bgCard    : G.cloud;
  const inputBg  = isDark ? colors.bgElement : G.foam;

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotificationSettings().then(setSettings);
  }, []);

  async function update(patch: Partial<NotificationSettings>, andReschedule = false) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    await saveNotificationSettings(next);
    if ('masterEnabled' in patch || andReschedule) {
      if (next.masterEnabled) {
        const granted = await requestNotificationPermission();
        if (granted) await rescheduleAllNotifications(plants, true);
      } else {
        await cancelAllNotifications();
      }
    }
    setSaving(false);
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[s.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={[s.cardTitle, { color: textPrim }]}>🔔 Notifications</Text>
        <Text style={[s.cardSub, { color: textSec }]}>Notifications require the iOS or Android app.</Text>
      </View>
    );
  }

  const enabled = settings.masterEnabled && settings.dailyCheckIn.enabled;

  return (
    <View style={[s.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={s.masterRow}>
        <View style={{ flex: 1 }}>
          <Text style={[s.cardTitle, { color: textPrim }]}>🔔 Daily Reminder</Text>
          <Text style={[s.cardSub, { color: textSec }]}>
            {saving ? 'Saving…' : enabled ? 'One notification per day' : 'Off'}
          </Text>
        </View>
        <Switch
          value={enabled}
          onValueChange={v => update({
            masterEnabled: v,
            dailyCheckIn: { ...settings.dailyCheckIn, enabled: v },
          })}
          trackColor={{ false: border, true: G.sage }}
          thumbColor={G.cloud}
          ios_backgroundColor={border}
        />
      </View>

      {enabled && (
        <View style={[s.detail, { borderTopColor: border, backgroundColor: inputBg }]}>
          <TimePicker
            hour={settings.dailyCheckIn.hour}
            minute={settings.dailyCheckIn.minute}
            onChange={(h, m) => update({
              dailyCheckIn: { ...settings.dailyCheckIn, hour: h, minute: m },
            }, true)}
            textSec={textSec} textPrim={textPrim} border={border} inputBg={inputBg}
          />
          <Text style={[s.hint, { color: textSec }]}>
            We'll remind you about watering, upcoming harvests, and anything else that needs attention.
          </Text>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card:      { borderRadius: R.lg, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  masterRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub:   { fontSize: 12, marginTop: 2 },
  detail:    { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
  hint:      { fontSize: 12, marginTop: 12, lineHeight: 17 },
});

const tp = StyleSheet.create({
  block:           { marginBottom: 6 },
  blockLabel:      { fontSize: 11, marginBottom: 6 },
  timeRow:         { flexDirection: 'row', alignItems: 'center', gap: 8 },
  spinnerCol:      { alignItems: 'center', gap: 4 },
  spinnerLabel:    { fontSize: 10, letterSpacing: 0.5 },
  spinnerControls: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  timeSep:         { fontSize: 20, fontWeight: '700', marginTop: 14 },
  btn:             { borderRadius: R.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, minWidth: 34, alignItems: 'center' },
  arrow:           { fontSize: 14, fontWeight: '700' },
  value:           { fontSize: 16, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  ampmBtn:         { borderRadius: R.sm, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 8, minWidth: 44, alignItems: 'center' },
  ampmText:        { fontSize: 13, fontWeight: '700' },
});
