import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TouchableOpacity, Platform, Alert } from 'react-native';
import { G, R } from '@/constants/theme';
import { useAppTheme } from '@/contexts/theme-context';
import {
  loadNotificationSettings, saveNotificationSettings,
  DEFAULT_SETTINGS, type NotificationSettings,
} from '@/lib/notification-settings';
import { requestNotificationPermission, rescheduleAllNotifications, cancelAllNotifications } from '@/lib/notifications';

interface Props {
  plants?: any[];
}

function TimePicker({ label, hour, minute, onChange, textSec, textPrim, border, inputBg }: {
  label: string; hour: number; minute: number;
  onChange: (h: number, m: number) => void;
  textSec: string; textPrim: string; border: string; inputBg: string;
}) {
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <View style={[tp.block, { marginTop: 8 }]}>
      <Text style={[tp.blockLabel, { color: textSec }]}>{label}</Text>
      <View style={tp.timeRow}>
        {/* Hour */}
        <View style={tp.spinnerCol}>
          <Text style={[tp.spinnerLabel, { color: textSec }]}>HH</Text>
          <View style={tp.spinnerControls}>
            <TouchableOpacity style={[tp.btn, { borderColor: border, backgroundColor: inputBg }]}
              onPress={() => onChange((hour + 23) % 24, minute)}>
              <Text style={[tp.arrow, { color: textPrim }]}>−</Text>
            </TouchableOpacity>
            <Text style={[tp.value, { color: textPrim }]}>{pad(hour)}</Text>
            <TouchableOpacity style={[tp.btn, { borderColor: border, backgroundColor: inputBg }]}
              onPress={() => onChange((hour + 1) % 24, minute)}>
              <Text style={[tp.arrow, { color: textPrim }]}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={[tp.timeSep, { color: textPrim }]}>:</Text>
        {/* Minute */}
        <View style={tp.spinnerCol}>
          <Text style={[tp.spinnerLabel, { color: textSec }]}>MM</Text>
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
      </View>
    </View>
  );
}

function Stepper({ label, value, min, max, unit, onChange, textSec, textPrim, inputBg, border }: {
  label: string; value: number; min: number; max: number; unit: string;
  onChange: (v: number) => void;
  textSec: string; textPrim: string; inputBg: string; border: string;
}) {
  return (
    <View style={[tp.block, { marginTop: 8 }]}>
      <Text style={[tp.blockLabel, { color: textSec }]}>{label}</Text>
      <View style={tp.spinnerControls}>
        <TouchableOpacity style={[tp.btn, { borderColor: border, backgroundColor: inputBg }]}
          onPress={() => onChange(Math.max(min, value - 1))}>
          <Text style={[tp.arrow, { color: textPrim }]}>−</Text>
        </TouchableOpacity>
        <Text style={[tp.value, { color: textPrim }]}>{value}</Text>
        <TouchableOpacity style={[tp.btn, { borderColor: border, backgroundColor: inputBg }]}
          onPress={() => onChange(Math.min(max, value + 1))}>
          <Text style={[tp.arrow, { color: textPrim }]}>+</Text>
        </TouchableOpacity>
        <Text style={[tp.unitText, { color: textSec }]}>{unit}</Text>
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
  const tint     = isDark ? colors.tint      : G.hunter;

  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotificationSettings().then(setSettings);
  }, []);

  async function update(patch: Partial<NotificationSettings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setSaving(true);
    await saveNotificationSettings(next);
    if (next.masterEnabled) {
      const granted = await requestNotificationPermission();
      if (granted) await rescheduleAllNotifications(plants);
    } else {
      await cancelAllNotifications();
    }
    setSaving(false);
  }

  function Row({ emoji, title, sub, checked, onToggle, children }: {
    emoji: string; title: string; sub?: string;
    checked: boolean; onToggle: (v: boolean) => void;
    children?: React.ReactNode;
  }) {
    return (
      <View style={[s.row, { borderBottomColor: border }]}>
        <View style={s.rowMain}>
          <Text style={s.rowEmoji}>{emoji}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[s.rowTitle, { color: textPrim }]}>{title}</Text>
            {sub && <Text style={[s.rowSub, { color: textSec }]}>{sub}</Text>}
          </View>
          <Switch
            value={checked && settings.masterEnabled}
            onValueChange={v => onToggle(v)}
            disabled={!settings.masterEnabled}
            trackColor={{ false: border, true: G.sage }}
            thumbColor={G.cloud}
            ios_backgroundColor={border}
          />
        </View>
        {checked && settings.masterEnabled && children && (
          <View style={[s.rowDetail, { borderTopColor: border, backgroundColor: inputBg }]}>
            {children}
          </View>
        )}
      </View>
    );
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[s.card, { backgroundColor: cardBg, borderColor: border }]}>
        <Text style={[s.cardTitle, { color: textPrim }]}>🔔 Notifications</Text>
        <Text style={[s.cardSub, { color: textSec }]}>Notifications require the iOS or Android app.</Text>
      </View>
    );
  }

  return (
    <View style={[s.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={s.masterRow}>
        <View style={{ flex: 1 }}>
          <Text style={[s.cardTitle, { color: textPrim }]}>🔔 Notifications</Text>
          <Text style={[s.cardSub, { color: textSec }]}>
            {saving ? 'Saving…' : settings.masterEnabled ? 'Active' : 'All notifications off'}
          </Text>
        </View>
        <Switch
          value={settings.masterEnabled}
          onValueChange={v => update({ masterEnabled: v })}
          trackColor={{ false: border, true: G.sage }}
          thumbColor={G.cloud}
          ios_backgroundColor={border}
        />
      </View>

      <Row
        emoji="💧" title="Watering Reminders"
        sub="Get reminded before a plant needs water"
        checked={settings.watering.enabled}
        onToggle={v => update({ watering: { ...settings.watering, enabled: v } })}
      >
        <Stepper label="Remind" value={settings.watering.hoursBefore} min={0} max={24} unit="hrs before due"
          onChange={v => update({ watering: { ...settings.watering, hoursBefore: v } })}
          textSec={textSec} textPrim={textPrim} inputBg={inputBg} border={border} />
        <TimePicker label="Fallback time (if reminder would land overnight)" hour={settings.watering.hour} minute={settings.watering.minute}
          onChange={(h, m) => update({ watering: { ...settings.watering, hour: h, minute: m } })}
          textSec={textSec} textPrim={textPrim} border={border} inputBg={inputBg} />
      </Row>

      <Row
        emoji="🧺" title="Harvest Alerts"
        sub="Know when harvest time is coming up"
        checked={settings.harvest.enabled}
        onToggle={v => update({ harvest: { ...settings.harvest, enabled: v } })}
      >
        <Stepper label="Alert" value={settings.harvest.daysBefore} min={1} max={14} unit="days before harvest"
          onChange={v => update({ harvest: { ...settings.harvest, daysBefore: v } })}
          textSec={textSec} textPrim={textPrim} inputBg={inputBg} border={border} />
        <TimePicker label="Alert time" hour={settings.harvest.hour} minute={settings.harvest.minute}
          onChange={(h, m) => update({ harvest: { ...settings.harvest, hour: h, minute: m } })}
          textSec={textSec} textPrim={textPrim} border={border} inputBg={inputBg} />
      </Row>

      <Row
        emoji="🌱" title="Daily Garden Check-in"
        sub="Morning nudge to log your garden activity"
        checked={settings.dailyCheckIn.enabled}
        onToggle={v => update({ dailyCheckIn: { ...settings.dailyCheckIn, enabled: v } })}
      >
        <TimePicker label="Each day at" hour={settings.dailyCheckIn.hour} minute={settings.dailyCheckIn.minute}
          onChange={(h, m) => update({ dailyCheckIn: { ...settings.dailyCheckIn, hour: h, minute: m } })}
          textSec={textSec} textPrim={textPrim} border={border} inputBg={inputBg} />
      </Row>

      <Row
        emoji="📅" title="Sowing Reminders"
        sub="Heads-up before your planned sow dates"
        checked={settings.sowing.enabled}
        onToggle={v => update({ sowing: { ...settings.sowing, enabled: v } })}
      >
        <Stepper label="Remind" value={settings.sowing.weeksBefore} min={1} max={8} unit="weeks before sow date"
          onChange={v => update({ sowing: { ...settings.sowing, weeksBefore: v } })}
          textSec={textSec} textPrim={textPrim} inputBg={inputBg} border={border} />
      </Row>

      <Row
        emoji="🌦️" title="Weather Alerts"
        sub="Skip watering when rain is forecast"
        checked={settings.weather.enabled}
        onToggle={v => update({ weather: { enabled: v } })}
      />
    </View>
  );
}

const s = StyleSheet.create({
  card:      { borderRadius: R.lg, borderWidth: 1, marginBottom: 16, overflow: 'hidden' },
  masterRow: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardTitle: { fontSize: 16, fontWeight: '700' },
  cardSub:   { fontSize: 12, marginTop: 2 },
  row:       { borderBottomWidth: 1 },
  rowMain:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 10 },
  rowEmoji:  { fontSize: 18, width: 28, textAlign: 'center' },
  rowTitle:  { fontSize: 14, fontWeight: '600' },
  rowSub:    { fontSize: 11, marginTop: 2 },
  rowDetail: { paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1 },
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
  unitText:        { fontSize: 12, marginLeft: 4 },
});
