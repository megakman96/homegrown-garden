export type HealthIssue =
  | 'pest'
  | 'fungal'
  | 'bacterial'
  | 'nutrient_deficiency'
  | 'overwatering'
  | 'underwatering'
  | 'sun_stress'
  | 'frost_damage'
  | 'root_bound'
  | 'transplant_shock'
  | 'unknown';

export interface HealthIssueInfo {
  label: string;
  emoji: string;
  advice: string[];
}

export const HEALTH_ISSUES: Record<HealthIssue, HealthIssueInfo> = {
  pest: {
    label: 'Pest Damage',
    emoji: '🐛',
    advice: [
      'Inspect leaves — look under them for eggs, larvae, or insects.',
      'Remove pests by hand or use a strong water spray to knock them off.',
      'Apply insecticidal soap or neem oil spray, covering all leaf surfaces.',
      'Introduce beneficial insects like ladybugs or lacewings.',
      'Reapply treatment every 5–7 days until infestation clears.',
    ],
  },
  fungal: {
    label: 'Fungal Disease',
    emoji: '🍄',
    advice: [
      'Remove and dispose of infected leaves — do not compost them.',
      'Improve air circulation by pruning crowded foliage.',
      'Water at soil level; avoid wetting leaves.',
      'Apply a fungicide (copper-based or sulfur-based) per label instructions.',
      'Rotate crops next season to break the disease cycle.',
    ],
  },
  bacterial: {
    label: 'Bacterial Disease',
    emoji: '🦠',
    advice: [
      'Remove infected plant parts with sterile scissors; disinfect tools between cuts.',
      'Avoid overhead watering — water the base only.',
      'Apply copper-based bactericide if available.',
      'Improve drainage; bacterial issues worsen in soggy soil.',
      'Severe infections may require removing the whole plant to protect neighbors.',
    ],
  },
  nutrient_deficiency: {
    label: 'Nutrient Deficiency',
    emoji: '🌿',
    advice: [
      'Yellow leaves → likely nitrogen deficiency. Apply a balanced fertilizer.',
      'Purple-tinged leaves → phosphorus deficiency. Add bone meal or rock phosphate.',
      'Brown leaf edges → potassium deficiency. Apply potassium sulfate or wood ash.',
      'Yellow between veins → iron or magnesium deficiency. Check and adjust soil pH (ideal: 6.0–7.0).',
      'Topdress with compost to improve overall soil nutrition.',
    ],
  },
  overwatering: {
    label: 'Overwatering',
    emoji: '💦',
    advice: [
      'Let soil dry out — do not water until top 1–2 inches are dry.',
      'Check drainage — ensure pots have holes and garden beds drain freely.',
      'Remove any mulch temporarily to help soil dry faster.',
      'Inspect roots: mushy, brown roots indicate root rot. Trim and repot if possible.',
      'Reduce watering frequency for 2–3 weeks and monitor recovery.',
    ],
  },
  underwatering: {
    label: 'Underwatering',
    emoji: '🏜️',
    advice: [
      'Water deeply and slowly until water runs out the bottom (for pots).',
      'Mulch around the base to retain soil moisture.',
      'Check soil moisture daily until plant recovers.',
      'Increase watering frequency; early morning is the best time.',
      'Consider a drip irrigation system or self-watering pot for consistent moisture.',
    ],
  },
  sun_stress: {
    label: 'Sun / Heat Stress',
    emoji: '☀️',
    advice: [
      'Provide shade cloth (30–50%) during peak afternoon sun hours.',
      'Water early in the morning to keep roots cool.',
      'Mulch heavily to insulate soil and retain moisture.',
      'Mist leaves gently in extreme heat (above 100°F/38°C).',
      'Consider relocating container plants to a shadier spot.',
    ],
  },
  frost_damage: {
    label: 'Frost Damage',
    emoji: '❄️',
    advice: [
      'Remove blackened or mushy tissue — it will not recover.',
      'Wait until the plant shows new growth before deciding to remove it entirely.',
      'Avoid fertilizing immediately after frost; wait for signs of recovery.',
      'Cover plants overnight with frost cloth if more frost is expected.',
      'Mulch roots to protect them even if top growth dies back.',
    ],
  },
  root_bound: {
    label: 'Root Bound',
    emoji: '🪴',
    advice: [
      'Gently remove plant from container and check if roots are circling or packed.',
      'If root-bound, transplant to a pot 2–4 inches larger in diameter.',
      'Loosen circling roots gently before replanting.',
      'Use fresh, well-draining potting mix.',
      'Water thoroughly after repotting and keep in shade for a few days.',
    ],
  },
  transplant_shock: {
    label: 'Transplant Shock',
    emoji: '😟',
    advice: [
      'Keep the plant consistently moist but not waterlogged.',
      'Shade the plant for 3–5 days after transplanting.',
      'Avoid fertilizing until the plant shows new growth.',
      'Trim any wilted or yellowed leaves to reduce stress on the plant.',
      'Be patient — most plants recover within 1–2 weeks with proper care.',
    ],
  },
  unknown: {
    label: 'Not Sure',
    emoji: '❓',
    advice: [
      'Inspect closely: check for insects, spots, discoloration, or wilting.',
      'Review recent watering and feeding history.',
      'Check drainage and soil moisture levels.',
      'Look for any environmental changes (temperature, light, air drafts).',
      'Take a photo and research or ask a local extension office for help.',
    ],
  },
};

const ISSUE_TAG = '__si:';
const ISSUE_TAG_END = '__';

export function encodeSickReason(issue: HealthIssue, existingNotes: string | null): string {
  const stripped = stripSickReason(existingNotes ?? '');
  const base = stripped.trim();
  const tag = `${ISSUE_TAG}${issue}${ISSUE_TAG_END}`;
  return base ? `${base}\n${tag}` : tag;
}

export function stripSickReason(notes: string): string {
  return notes.replace(/__si:[a-z_]+__/g, '').trim();
}

export function parseSickReason(notes: string | null): HealthIssue | null {
  if (!notes) return null;
  const match = notes.match(/__si:([a-z_]+)__/);
  if (!match) return null;
  return (HEALTH_ISSUES[match[1] as HealthIssue] ? match[1] : null) as HealthIssue | null;
}
