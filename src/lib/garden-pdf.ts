import { Platform, Alert } from 'react-native';
import type { Garden, Plant } from './types';
import type { GardenLayout } from './garden-layout';
import { TILE_COLORS } from './garden-layout';
import { PLANT_CATALOG, findPlantKey, SUN_LABELS } from './plant-catalog';
import { getPlantIcon } from './plant-icons';

const GREEN    = '#1b4332';
const SAGE     = '#52b788';
const FERN     = '#40916c';
const MIST     = '#b7e4c7';
const FOAM     = '#f0f7ee';
const STONE    = '#52796f';
const CLOUD    = '#ffffff';
const DANGER   = '#e03131';
const WARN     = '#e67700';

// Tile background colors for the grid (matches app's TILE_COLORS hex approx)
const TILE_CSS: Record<string, string> = {
  full_sun:    '#fff9db',
  partial_sun: '#ffec99',
  shade:       '#e9ecef',
  inactive:    '#f1f3f5',
};

const HEALTH_CSS: Record<string, string> = {
  healthy:     '#52b788',
  needs_water: '#339af0',
  sick:        '#f03e3e',
  harvested:   '#a9e34b',
  dead:        '#adb5bd',
};

function keyToName(key: string): string {
  return PLANT_CATALOG[key]?.name ?? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function fmt(date: string | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

function sowingGuide(key: string | null): string {
  if (!key) return '—';
  const e = PLANT_CATALOG[key];
  if (!e?.daysToMaturity) return '—';
  const { min, max } = e.daysToMaturity;
  const coolSeason = ['lettuce','spinach','kale','broccoli','cabbage','cauliflower','pea','carrot','radish','beet','chard','arugula','bok_choy','collard_greens'].includes(key);
  if (coolSeason) {
    return `Start 4–6 weeks before last spring frost · Direct sow ${min}–${max} days to harvest`;
  }
  if (min >= 60) {
    return `Start indoors 6–8 weeks before last frost · Transplant after frost · ${min}–${max} days to harvest`;
  }
  return `Direct sow after last frost · ${min}–${max} days to harvest`;
}

function buildGridPage(garden: Garden, allPlants: Plant[], layout: GardenLayout | null): string {
  // Only render plants that are actually placed in the grid
  const plants = allPlants.filter(p => p.row != null && p.col != null);
  const cellSize = Math.min(80, Math.floor(680 / garden.cols));

  const rows = Array.from({ length: garden.rows }, (_, r) =>
    `<tr>${Array.from({ length: garden.cols }, (_, c) => {
      const plant = plants.find(p => p.row === r && p.col === c);
      const tileState = layout?.[r]?.[c] ?? 'inactive';
      const isInactive = tileState === 'inactive';
      const bg = plant ? HEALTH_CSS[plant.health_status] ?? SAGE
                       : isInactive ? TILE_CSS.inactive : (TILE_CSS[tileState] ?? TILE_CSS.full_sun);
      const textColor = plant ? CLOUD : (isInactive ? '#adb5bd' : GREEN);
      const icon = plant ? getPlantIcon(plant.name).emoji : '';
      const name = plant ? (plant.name.length > 10 ? plant.name.slice(0, 9) + '…' : plant.name) : '';
      const sunDot = plant && tileState !== 'inactive' ? `<div style="font-size:9px;opacity:0.8;margin-top:2px">${tileState === 'full_sun' ? '☀️' : tileState === 'partial_sun' ? '⛅' : '🌑'}</div>` : '';
      return `<td style="
        width:${cellSize}px;height:${cellSize}px;
        background:${bg};
        border:1px solid ${isInactive ? '#dee2e6' : MIST};
        text-align:center;vertical-align:middle;
        font-size:${Math.max(7, cellSize * 0.14)}px;
        font-weight:${plant ? '700' : '400'};
        color:${textColor};
        padding:2px;
        line-height:1.2;
        opacity:${isInactive ? '0.4' : '1'};
      ">${icon ? `<div style="font-size:${cellSize * 0.35}px;line-height:1">${icon}</div>` : ''}<div>${name}</div>${sunDot}</td>`;
    }).join('')}</tr>`
  ).join('');

  const legend = Object.entries(HEALTH_CSS).map(([s, c]) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:11px;color:${STONE}">
      <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${c}"></span>
      ${s.replace('_', ' ')}
    </span>`
  ).join('');

  const sunLegend = Object.entries({ full_sun: '☀️ Full sun', partial_sun: '⛅ Partial sun', shade: '🌑 Shade' }).map(([k, label]) =>
    `<span style="display:inline-flex;align-items:center;gap:5px;margin-right:14px;font-size:11px;color:${STONE}">
      <span style="display:inline-block;width:12px;height:12px;border-radius:3px;background:${TILE_CSS[k]}"></span>
      ${label}
    </span>`
  ).join('');

  return `
  <div style="page-break-after:always;padding:32px 40px;">
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:6px;">
      <div>
        <h1 style="margin:0;font-size:30px;color:${GREEN};letter-spacing:-0.5px">${garden.name}</h1>
        <p style="margin:4px 0 0;font-size:13px;color:${STONE}">
          Garden Plan &nbsp;·&nbsp; ${garden.rows} × ${garden.cols} tiles &nbsp;·&nbsp; ${plants.length} plant${plants.length !== 1 ? 's' : ''} placed &nbsp;·&nbsp; Printed ${new Date().toLocaleDateString()}
        </p>
      </div>
      <div style="font-size:36px;line-height:1">🌱</div>
    </div>

    <div style="height:1px;background:${MIST};margin:16px 0 24px"></div>

    <div style="display:flex;justify-content:center;overflow-x:auto">
      <table style="border-collapse:collapse;border-spacing:0;">${rows}</table>
    </div>

    <div style="margin-top:20px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${STONE};margin-bottom:8px">Cell color — plant health</div>
      <div>${legend}</div>
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${STONE};margin:12px 0 8px">Cell background — tile sunlight</div>
      <div>${sunLegend}</div>
    </div>

    <div style="margin-top:20px;padding:12px 16px;background:${FOAM};border-radius:8px;border-left:4px solid ${SAGE}">
      <span style="font-size:12px;color:${STONE}">📋 Plant details on the following pages</span>
    </div>
  </div>`;
}

function buildPlantPage(plant: Plant, index: number, total: number): string {
  const key = findPlantKey(plant.name);
  const info = key ? PLANT_CATALOG[key] : null;
  const icon = getPlantIcon(plant.name).emoji;

  const goodNames = (info?.goodCompanions ?? []).map(keyToName);
  const badNames  = (info?.badCompanions  ?? []).map(keyToName);

  const infoCard = (label: string, value: string, accent = GREEN) => `
    <div style="background:${FOAM};border-radius:10px;padding:14px 16px;border-left:3px solid ${accent}">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${STONE};margin-bottom:5px">${label}</div>
      <div style="font-size:15px;font-weight:600;color:${GREEN}">${value}</div>
    </div>`;

  const companionChip = (name: string, good: boolean) =>
    `<span style="display:inline-block;padding:4px 10px;border-radius:20px;font-size:12px;font-weight:600;margin:3px;
      background:${good ? '#d8f3dc' : '#ffe3e3'};color:${good ? FERN : DANGER}">${name}</span>`;

  const healthColor = HEALTH_CSS[plant.health_status] ?? SAGE;

  // Sowing guide from catalog
  const sowText = sowingGuide(key);
  const maturity = info?.daysToMaturity ? `${info.daysToMaturity.min}–${info.daysToMaturity.max} days` : '—';
  const spacing  = info?.spacingCm ? `${info.spacingCm} cm (${Math.round(info.spacingCm / 30.5)} ft) apart` : '—';

  // Varieties
  const varietiesHtml = info?.varieties?.length
    ? `<div style="margin-top:10px;font-size:12px;color:${STONE}">
        <strong>Varieties:</strong> ${info.varieties.map(v => `${v.name}${v.notes ? ` <span style="color:${STONE}">(${v.notes})</span>` : ''}`).join(' &nbsp;·&nbsp; ')}
       </div>`
    : '';

  return `
  <div style="page-break-after:always;padding:36px 40px;min-height:900px;position:relative">
    <!-- Header -->
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
      <div style="font-size:11px;color:${STONE}">Plant ${index + 1} of ${total}</div>
      <div style="font-size:11px;color:${STONE};font-style:italic">${plant.garden_id ? 'Plant card' : ''}</div>
    </div>

    <div style="display:flex;align-items:center;gap:16px;margin-bottom:12px">
      <div style="font-size:54px;line-height:1">${icon}</div>
      <div style="flex:1">
        <h2 style="margin:0;font-size:28px;color:${GREEN};letter-spacing:-0.3px">${plant.name}</h2>
        ${plant.variety ? `<div style="font-size:14px;color:${STONE};margin-top:2px">Variety: ${plant.variety}</div>` : ''}
        ${info?.scientificName ? `<div style="font-size:12px;color:#74c69d;font-style:italic;margin-top:2px">${info.scientificName}</div>` : ''}
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
        <div style="width:56px;height:56px;border-radius:12px;background:${healthColor};display:flex;align-items:center;justify-content:center">
          <span style="font-size:11px;color:white;font-weight:700;text-align:center;padding:2px">${plant.health_status.replace('_',' ')}</span>
        </div>
        <div style="font-size:10px;color:${STONE}">Status</div>
      </div>
    </div>

    <div style="height:1px;background:${MIST};margin-bottom:20px"></div>

    <!-- Quick stats grid -->
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      ${infoCard('Sun Requirements', SUN_LABELS[info?.sunRequirement ?? plant.sun_requirement ?? 'full_sun'], FERN)}
      ${infoCard('Water Every', `${plant.water_interval_days ?? info?.waterIntervalDays ?? '—'} days`, '#339af0')}
      ${infoCard('Days to Maturity', maturity, '#e67700')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px">
      ${infoCard('Last Watered', fmt(plant.last_watered), '#339af0')}
      ${infoCard('Expected Harvest', fmt(plant.expected_harvest_date), SAGE)}
      ${infoCard('Total Yield', plant.total_yield_grams > 0 ? `${plant.total_yield_grams}g` : '—', '#a9e34b')}
    </div>

    <!-- Sowing guide -->
    <div style="background:#fff9db;border-radius:10px;padding:14px 16px;border-left:3px solid #e67700;margin-bottom:20px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${WARN};margin-bottom:6px">🌱 Sowing Guide</div>
      <div style="font-size:14px;color:${GREEN}">${sowText}</div>
      ${spacing !== '—' ? `<div style="font-size:12px;color:${STONE};margin-top:6px">📏 Spacing: ${spacing}</div>` : ''}
      ${info?.category ? `<div style="font-size:12px;color:${STONE};margin-top:4px">Category: ${info.category}</div>` : ''}
      ${varietiesHtml}
    </div>

    <!-- Companion planting -->
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
      <div style="background:#d8f3dc;border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${FERN};margin-bottom:8px">✅ Beneficial Companions</div>
        ${goodNames.length
          ? goodNames.map(n => companionChip(n, true)).join('')
          : `<span style="font-size:12px;color:${STONE}">No data available</span>`}
      </div>
      <div style="background:#ffe3e3;border-radius:10px;padding:14px 16px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${DANGER};margin-bottom:8px">❌ Keep Away From</div>
        ${badNames.length
          ? badNames.map(n => companionChip(n, false)).join('')
          : `<span style="font-size:12px;color:${STONE}">No known conflicts</span>`}
      </div>
    </div>

    <!-- Notes / tips -->
    ${info?.notes || plant.notes ? `
    <div style="background:#f0f7ee;border-radius:10px;padding:14px 16px;border-left:3px solid ${SAGE};margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:${STONE};margin-bottom:6px">💡 Growing Tips</div>
      ${info?.notes ? `<div style="font-size:13px;color:${GREEN};line-height:1.6;margin-bottom:6px">${info.notes}</div>` : ''}
      ${plant.notes ? `<div style="font-size:12px;color:${STONE};font-style:italic">${plant.notes}</div>` : ''}
    </div>` : ''}

    <!-- Footer -->
    <div style="position:absolute;bottom:24px;left:40px;right:40px;display:flex;justify-content:space-between;border-top:1px solid ${MIST};padding-top:10px">
      <span style="font-size:10px;color:${STONE}">GardenGrid</span>
      <span style="font-size:10px;color:${STONE}">${new Date().toLocaleDateString()}</span>
    </div>
  </div>`;
}

function buildSummaryPage(garden: Garden, plants: Plant[]): string {
  const placed = plants.filter(p => p.row != null && p.col != null);
  const healthy = plants.filter(p => p.health_status === 'healthy').length;
  const thirsty = plants.filter(p => p.health_status === 'needs_water').length;
  const harvested = plants.filter(p => p.health_status === 'harvested').length;

  const tableRows = placed.map(p => {
    const key = findPlantKey(p.name);
    const info = PLANT_CATALOG[key ?? ''];
    const icon = getPlantIcon(p.name).emoji;
    return `<tr style="border-bottom:1px solid ${MIST}">
      <td style="padding:8px 10px;font-size:20px">${icon}</td>
      <td style="padding:8px 10px;font-size:13px;font-weight:600;color:${GREEN}">${p.name}${p.variety ? `<br><span style="font-size:11px;color:${STONE};font-weight:400">${p.variety}</span>` : ''}</td>
      <td style="padding:8px 10px;font-size:12px;color:${STONE}">Row ${(p.row ?? 0) + 1}, Col ${(p.col ?? 0) + 1}</td>
      <td style="padding:8px 10px">
        <span style="display:inline-block;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;background:${HEALTH_CSS[p.health_status] ?? SAGE};color:white">
          ${p.health_status.replace('_', ' ')}
        </span>
      </td>
      <td style="padding:8px 10px;font-size:12px;color:${STONE}">${p.water_interval_days ?? info?.waterIntervalDays ?? '—'}d</td>
      <td style="padding:8px 10px;font-size:12px;color:${STONE}">${SUN_LABELS[info?.sunRequirement ?? p.sun_requirement ?? 'full_sun']}</td>
      <td style="padding:8px 10px;font-size:12px;color:${STONE}">${p.expected_harvest_date ? new Date(p.expected_harvest_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—'}</td>
    </tr>`;
  }).join('');

  return `
  <div style="page-break-after:always;padding:36px 40px">
    <h2 style="margin:0 0 4px;font-size:24px;color:${GREEN}">📋 Plant Summary</h2>
    <p style="margin:0 0 20px;font-size:13px;color:${STONE}">${garden.name} &nbsp;·&nbsp; ${placed.length} plants placed</p>

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px">
      ${[
        ['🌱', 'Total', plants.length, GREEN],
        ['🟢', 'Healthy', healthy, SAGE],
        ['💧', 'Thirsty', thirsty, '#339af0'],
        ['🧺', 'Harvested', harvested, '#a9e34b'],
      ].map(([emoji, label, val, color]) => `
        <div style="background:${FOAM};border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:24px">${emoji}</div>
          <div style="font-size:26px;font-weight:800;color:${color}">${val}</div>
          <div style="font-size:11px;color:${STONE};margin-top:2px">${label}</div>
        </div>`).join('')}
    </div>

    <table style="width:100%;border-collapse:collapse">
      <thead>
        <tr style="background:${FOAM}">
          <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${STONE}"></th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${STONE}">Plant</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${STONE}">Position</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${STONE}">Health</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${STONE}">Water</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${STONE}">Sun</th>
          <th style="padding:8px 10px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.8px;color:${STONE}">Harvest</th>
        </tr>
      </thead>
      <tbody>${tableRows}</tbody>
    </table>
  </div>`;
}

export function buildGardenReportHtml(garden: Garden, plants: Plant[], layout: GardenLayout | null): string {
  const placed = plants.filter(p => p.row != null && p.col != null);
  const plantPages = placed.map((p, i) => buildPlantPage(p, i, placed.length)).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${garden.name} — GardenGrid Garden Plan</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; background: white; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @page { margin: 0; size: A4 portrait; }
  </style>
</head>
<body>
  ${buildGridPage(garden, plants, layout)}
  ${buildSummaryPage(garden, plants)}
  ${plantPages}
</body>
</html>`;
}

export function buildSinglePageHtml(garden: Garden, plants: Plant[], layout: GardenLayout | null): string {
  const placed = plants.filter(p => p.row != null && p.col != null);

  // ── Grid (compact, fits left column ~340px) ────────────────────────────────
  const cellSize = Math.max(18, Math.min(36, Math.floor(340 / garden.cols)));
  const gridRows = Array.from({ length: garden.rows }, (_, r) =>
    `<tr>${Array.from({ length: garden.cols }, (_, c) => {
      const plant = placed.find(p => p.row === r && p.col === c);
      const tileState = layout?.[r]?.[c] ?? 'inactive';
      const isInactive = tileState === 'inactive';
      const bg = plant ? HEALTH_CSS[plant.health_status] ?? SAGE
                       : isInactive ? '#e9ecef' : (TILE_CSS[tileState] ?? TILE_CSS.full_sun);
      const icon = plant ? getPlantIcon(plant.name).emoji : '';
      return `<td style="
        width:${cellSize}px;height:${cellSize}px;background:${bg};
        border:1px solid ${isInactive ? 'transparent' : 'rgba(183,228,199,0.5)'};
        text-align:center;vertical-align:middle;
        font-size:${Math.max(9, cellSize * 0.48)}px;line-height:1;
        opacity:${isInactive ? '0.2' : '1'};border-radius:2px;
      ">${icon}</td>`;
    }).join('')}</tr>`
  ).join('');

  // ── Quick plant list (right of grid) ──────────────────────────────────────
  const quickList = placed.length
    ? placed.map(p => {
        const hc = HEALTH_CSS[p.health_status] ?? SAGE;
        return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid ${MIST}">
          <span style="font-size:14px;width:18px;text-align:center;flex-shrink:0">${getPlantIcon(p.name).emoji}</span>
          <div style="flex:1;min-width:0;font-size:11px;font-weight:600;color:${GREEN};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.name}${p.variety ? ` <span style="font-weight:400;color:${STONE}">${p.variety}</span>` : ''}</div>
          <span style="font-size:8px;font-weight:700;color:white;background:${hc};border-radius:6px;padding:1px 6px;flex-shrink:0">${p.health_status.replace('_',' ')}</span>
          <span style="font-size:9px;color:${STONE};flex-shrink:0">R${(p.row ?? 0)+1}C${(p.col ?? 0)+1}</span>
        </div>`;
      }).join('')
    : `<p style="font-size:11px;color:${STONE};font-style:italic">No plants placed yet.</p>`;

  // ── Detailed reference table rows ─────────────────────────────────────────
  const SUN_ICON: Record<string, string> = { full_sun: '☀️', partial_sun: '⛅', shade: '🌑' };
  const SUN_SHORT: Record<string, string> = { full_sun: 'Full', partial_sun: 'Partial', shade: 'Shade' };

  const truncate = (names: string[], max = 4) =>
    names.length <= max
      ? names.join(', ')
      : names.slice(0, max).join(', ') + ` +${names.length - max}`;

  const tableRows = placed.map((p, idx) => {
    const key = findPlantKey(p.name);
    const info = key ? PLANT_CATALOG[key] : null;
    const waterDays = p.water_interval_days ?? info?.waterIntervalDays ?? '—';
    const sunReq = info?.sunRequirement ?? p.sun_requirement ?? 'full_sun';
    const maturity = info?.daysToMaturity ? `${info.daysToMaturity.min}–${info.daysToMaturity.max}d` : '—';
    const spacingCm = info?.spacingCm ?? null;
    const spacingIn = spacingCm ? Math.round(spacingCm / 2.54) : null;
    const spacing = spacingCm ? `${spacingCm}cm / ${spacingIn}"` : '—';
    const goodNames = (info?.goodCompanions ?? []).map(keyToName);
    const badNames  = (info?.badCompanions  ?? []).map(keyToName);
    const notes = info?.notes ? (info.notes.length > 90 ? info.notes.slice(0, 88) + '…' : info.notes) : '—';
    const hc = HEALTH_CSS[p.health_status] ?? SAGE;
    const rowBg = idx % 2 === 0 ? FOAM : CLOUD;
    const sowText = (() => {
      if (!info?.daysToMaturity) return '—';
      const cool = ['lettuce','spinach','kale','broccoli','cabbage','cauliflower','pea','carrot','radish','beet','chard','arugula','bok_choy','collard_greens'].includes(key ?? '');
      if (cool) return 'Direct sow 4–6 wks before last frost';
      if ((info.daysToMaturity.min ?? 0) >= 60) return 'Start indoors 6–8 wks before frost; transplant after';
      return 'Direct sow after last frost';
    })();
    const category = info?.category ? `<span style="display:inline-block;padding:1px 5px;border-radius:4px;background:#e9ecef;font-size:7px;text-transform:uppercase;letter-spacing:0.4px;color:${STONE}">${info.category}</span>` : '';

    return `<tr style="background:${rowBg}">
      <td style="padding:5px 6px;font-size:9px;color:${STONE};text-align:center;font-weight:600;vertical-align:top">${idx + 1}</td>
      <td style="padding:5px 6px;vertical-align:top">
        <div style="display:flex;align-items:center;gap:4px">
          <span style="font-size:14px;line-height:1">${getPlantIcon(p.name).emoji}</span>
          <div>
            <div style="font-size:10px;font-weight:700;color:${GREEN}">${p.name}</div>
            ${p.variety ? `<div style="font-size:8px;color:${STONE}">${p.variety}</div>` : ''}
            ${category}
          </div>
        </div>
      </td>
      <td style="padding:5px 6px;text-align:center;vertical-align:top">
        <span style="font-size:8px;font-weight:700;color:white;background:${hc};border-radius:6px;padding:2px 6px;white-space:nowrap">${p.health_status.replace('_',' ')}</span>
      </td>
      <td style="padding:5px 6px;text-align:center;vertical-align:top;font-size:9px;color:${GREEN};font-weight:600">
        ${SUN_ICON[sunReq] ?? '☀️'} ${SUN_SHORT[sunReq] ?? sunReq}
      </td>
      <td style="padding:5px 6px;text-align:center;vertical-align:top;font-size:9px;color:#1971c2;font-weight:600">
        💧 every ${waterDays}d
      </td>
      <td style="padding:5px 6px;text-align:center;vertical-align:top;font-size:9px;color:${STONE}">
        ${maturity}
      </td>
      <td style="padding:5px 6px;text-align:center;vertical-align:top;font-size:9px;color:${STONE}">
        ${spacing}
      </td>
      <td style="padding:5px 6px;vertical-align:top;font-size:8px;color:${STONE}">
        <div style="font-size:7px;font-weight:700;text-transform:uppercase;color:${STONE};margin-bottom:2px">Sowing</div>
        ${sowText}
      </td>
      <td style="padding:5px 6px;vertical-align:top;font-size:8px;color:#2b8a3e">
        ${goodNames.length ? truncate(goodNames) : '<span style="color:#adb5bd">—</span>'}
      </td>
      <td style="padding:5px 6px;vertical-align:top;font-size:8px;color:#c92a2a">
        ${badNames.length ? truncate(badNames) : '<span style="color:#adb5bd">—</span>'}
      </td>
      <td style="padding:5px 6px;vertical-align:top;font-size:8px;color:${STONE};font-style:italic">
        ${notes}
      </td>
    </tr>`;
  }).join('');

  // ── Legend ─────────────────────────────────────────────────────────────────
  const healthLegend = Object.entries(HEALTH_CSS).map(([s, c]) =>
    `<span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;font-size:8px;color:${STONE}">
      <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c}"></span>${s.replace('_',' ')}
    </span>`
  ).join('');
  const sunLegend = (['full_sun','partial_sun','shade'] as const).map(k =>
    `<span style="display:inline-flex;align-items:center;gap:3px;margin-right:8px;font-size:8px;color:${STONE}">
      <span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${TILE_CSS[k]}"></span>${SUN_SHORT[k]}
    </span>`
  ).join('');

  // ── Stats ──────────────────────────────────────────────────────────────────
  const healthy   = placed.filter(p => p.health_status === 'healthy').length;
  const thirsty   = placed.filter(p => p.health_status === 'needs_water').length;
  const harvested = placed.filter(p => p.health_status === 'harvested').length;

  const th = (label: string) =>
    `<th style="padding:5px 6px;text-align:left;font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${STONE};background:${GREEN};color:white;white-space:nowrap">${label}</th>`;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${garden.name} — GardenGrid Overview</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 20px 28px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: white; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    @page { margin: 0; size: A4 landscape; }
  </style>
</head>
<body>

  <!-- Header -->
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
    <span style="font-size:22px;line-height:1">🌱</span>
    <div>
      <div style="display:flex;align-items:baseline;gap:8px">
        <h1 style="margin:0;font-size:20px;font-weight:800;color:${GREEN};letter-spacing:-0.3px">${garden.name}</h1>
        <span style="font-size:11px;font-weight:700;color:${FERN};background:${FOAM};border:1.5px solid ${MIST};border-radius:16px;padding:2px 10px">${garden.year ?? new Date().getFullYear()}</span>
      </div>
      <p style="margin:0;font-size:10px;color:${STONE}">${garden.rows}×${garden.cols} grid &nbsp;·&nbsp; ${placed.length} plants placed &nbsp;·&nbsp; 🟢 ${healthy} healthy &nbsp;·&nbsp; 💧 ${thirsty} thirsty &nbsp;·&nbsp; 🧺 ${harvested} harvested &nbsp;·&nbsp; Printed ${new Date().toLocaleDateString()}</p>
    </div>
    <div style="margin-left:auto;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${STONE}">GardenGrid</div>
  </div>

  <!-- Gradient divider -->
  <div style="height:2px;background:linear-gradient(to right,${SAGE},${MIST},transparent);margin-bottom:12px;border-radius:1px"></div>

  <!-- Top section: grid + quick list -->
  <div style="display:flex;gap:16px;margin-bottom:12px;align-items:flex-start">

    <!-- Garden grid -->
    <div style="flex:0 0 auto">
      <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:${STONE};margin-bottom:5px">Garden Map</div>
      <table style="border-collapse:separate;border-spacing:2px">${gridRows}</table>
    </div>

    <!-- Divider -->
    <div style="width:1px;background:${MIST};align-self:stretch;flex-shrink:0"></div>

    <!-- Quick plant list -->
    <div style="flex:1;min-width:0">
      <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:${STONE};margin-bottom:5px">Placed Plants (${placed.length})</div>
      <div style="columns:2;column-gap:16px">${quickList}</div>
    </div>

    <!-- Legend block -->
    <div style="flex:0 0 auto;background:${FOAM};border-radius:8px;padding:10px 12px;border:1px solid ${MIST}">
      <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${STONE};margin-bottom:5px">Health</div>
      <div style="margin-bottom:8px">${healthLegend}</div>
      <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:${STONE};margin-bottom:5px">Sun</div>
      <div>${sunLegend}</div>
    </div>
  </div>

  <!-- Plant reference table -->
  ${placed.length > 0 ? `
  <div style="font-size:8px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:${STONE};margin-bottom:5px">Plant Reference Chart</div>
  <table style="width:100%;border-collapse:collapse;border-radius:8px;overflow:hidden">
    <thead>
      <tr>
        ${th('#')}
        ${th('Plant')}
        ${th('Health')}
        ${th('☀️ Sun')}
        ${th('💧 Water')}
        ${th('⏱ Maturity')}
        ${th('📏 Spacing')}
        ${th('🌱 Sowing Guide')}
        ${th('✅ Plant Near')}
        ${th('❌ Keep Away')}
        ${th('💡 Growing Notes')}
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>` : `<p style="font-size:11px;color:${STONE};font-style:italic;text-align:center;padding:16px">No plants placed — tap tiles in the app to start planting.</p>`}

</body>
</html>`;
}

function buildSinglePlantHtml(plant: Plant): string {
  const page = buildPlantPage(plant, 0, 1);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${plant.name} — GardenGrid Plant Card</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; background: white; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
    @page { margin: 0; size: A4 portrait; }
  </style>
</head>
<body>${page}</body>
</html>`;
}

export async function generateSinglePlantPdf(plant: Plant): Promise<void> {
  const html = buildSinglePlantHtml(plant);

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) { Alert.alert('Blocked', 'Allow popups to print the plant card.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
    return;
  }

  try {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
    } else {
      await Print.printAsync({ uri });
    }
  } catch (e: any) {
    Alert.alert('Print Error', e?.message ?? 'Could not print plant card.');
  }
}

// ─── Planner report (no PocketBase records required) ─────────────────────────

interface PlannerReportOpts {
  gardenName: string;
  year: number;
  sun: 'full_sun' | 'partial_sun' | 'shade';
  rows: number;
  cols: number;
  placements: Record<string, string>; // `${row}_${col}` → plantKey
  lastFrost: string;
  firstFrost: string;
  planEntries: {
    key: string;
    seedStartDate: Date | null;
    transplantDate: Date | null;
    directSowDate: Date;
    harvestStart: Date;
    harvestEnd: Date;
  }[];
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function buildPlannerHtml(opts: PlannerReportOpts): string {
  const { gardenName, year, sun, rows, cols, placements, lastFrost, firstFrost, planEntries } = opts;

  const SUN_LABEL: Record<string, string> = { full_sun: '☀️ Full Sun', partial_sun: '⛅ Partial Sun', shade: '🌑 Shade' };
  const SUN_BG:    Record<string, string> = { full_sun: '#fff9db', partial_sun: '#ffec99', shade: '#e9ecef' };

  // ── Grid ────────────────────────────────────────────────────────────────────
  const cellPx = Math.min(56, Math.floor(520 / cols));
  const gridRows = Array.from({ length: rows }, (_, r) =>
    `<tr>${Array.from({ length: cols }, (_, c) => {
      const pk = placements[`${r}_${c}`];
      const pe = pk ? PLANT_CATALOG[pk] : null;
      const bg = pe ? '#d8f3dc' : SUN_BG[sun] ?? SUN_BG.full_sun;
      const icon = pe ? getPlantIcon(pe.name).emoji : '';
      const name = pe ? (pe.name.length > 9 ? pe.name.slice(0, 8) + '…' : pe.name) : '';
      return `<td style="
        width:${cellPx}px;height:${cellPx}px;background:${bg};
        border:1px solid ${pe ? '#b7e4c7' : '#dee2e6'};
        text-align:center;vertical-align:middle;padding:2px;line-height:1.1;
      ">${icon ? `<div style="font-size:${cellPx * 0.38}px;line-height:1.1">${icon}</div><div style="font-size:${Math.max(6, cellPx * 0.14)}px;color:#1b4332;font-weight:600">${name}</div>` : ''}</td>`;
    }).join('')}</tr>`
  ).join('');

  // ── Unique placed plants legend ──────────────────────────────────────────────
  const placedKeys = [...new Set(Object.values(placements))];
  const legendItems = placedKeys.map(k => {
    const e = PLANT_CATALOG[k];
    if (!e) return '';
    const count = Object.values(placements).filter(v => v === k).length;
    return `<div style="display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #e9ecef">
      <span style="font-size:16px;width:20px;text-align:center">${getPlantIcon(e.name).emoji}</span>
      <span style="font-size:11px;font-weight:600;color:#1b4332;flex:1">${e.name}</span>
      <span style="font-size:10px;color:#52796f">×${count}</span>
    </div>`;
  }).join('');

  // ── Planting schedule table ────────────────────────────────────────────────
  const scheduleRows = planEntries.map((p, i) => {
    const entry = PLANT_CATALOG[p.key];
    if (!entry) return '';
    const cells = Object.entries(placements)
      .filter(([, v]) => v === p.key)
      .map(([ck]) => { const [r, c] = ck.split('_'); return `R${+r+1}C${+c+1}`; })
      .join(', ');
    const rowBg = i % 2 === 0 ? '#f0f7ee' : '#ffffff';
    return `<tr style="background:${rowBg}">
      <td style="padding:7px 8px;font-size:16px;text-align:center">${getPlantIcon(entry.name).emoji}</td>
      <td style="padding:7px 8px">
        <div style="font-size:12px;font-weight:700;color:#1b4332">${entry.name}</div>
        <div style="font-size:9px;color:#52796f">${cells}</div>
      </td>
      <td style="padding:7px 8px;font-size:11px;color:#1971c2;text-align:center">${p.seedStartDate ? fmtDate(p.seedStartDate) : '—'}</td>
      <td style="padding:7px 8px;font-size:11px;color:#2b8a3e;text-align:center">${p.transplantDate ? fmtDate(p.transplantDate) : fmtDate(p.directSowDate)}</td>
      <td style="padding:7px 8px;font-size:11px;color:#e67700;text-align:center">${p.seedStartDate ? 'Transplant' : 'Direct Sow'}</td>
      <td style="padding:7px 8px;font-size:11px;color:#2b8a3e;font-weight:600;text-align:center">${fmtDate(p.harvestStart)} – ${fmtDate(p.harvestEnd)}</td>
    </tr>`;
  }).join('');

  // ── Plant detail cards ─────────────────────────────────────────────────────
  const detailCards = planEntries.map(p => {
    const e = PLANT_CATALOG[p.key];
    if (!e) return '';
    const good = (e.goodCompanions ?? []).map(k => PLANT_CATALOG[k]?.name ?? k);
    const bad  = (e.badCompanions  ?? []).map(k => PLANT_CATALOG[k]?.name ?? k);
    const maturity = e.daysToMaturity ? `${e.daysToMaturity.min}–${e.daysToMaturity.max} days` : '—';
    const spacing  = e.spacingCm ? `${e.spacingCm} cm / ${Math.round(e.spacingCm / 2.54)}"` : '—';
    const waterStr = e.waterIntervalDays ? `Every ${e.waterIntervalDays} days` : '—';
    return `<div style="break-inside:avoid;background:#f0f7ee;border-radius:10px;padding:14px 16px;border-left:4px solid #52b788;margin-bottom:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        <span style="font-size:28px">${getPlantIcon(e.name).emoji}</span>
        <div>
          <div style="font-size:15px;font-weight:700;color:#1b4332">${e.name}</div>
          ${e.scientificName ? `<div style="font-size:10px;color:#74c69d;font-style:italic">${e.scientificName}</div>` : ''}
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:8px">
        <div style="background:white;border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#52796f;margin-bottom:3px">Maturity</div>
          <div style="font-size:12px;font-weight:700;color:#e67700">${maturity}</div>
        </div>
        <div style="background:white;border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#52796f;margin-bottom:3px">Water</div>
          <div style="font-size:12px;font-weight:700;color:#339af0">${waterStr}</div>
        </div>
        <div style="background:white;border-radius:6px;padding:8px;text-align:center">
          <div style="font-size:9px;text-transform:uppercase;letter-spacing:0.5px;color:#52796f;margin-bottom:3px">Spacing</div>
          <div style="font-size:12px;font-weight:700;color:#1b4332">${spacing}</div>
        </div>
      </div>
      ${good.length || bad.length ? `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        ${good.length ? `<div style="background:#d8f3dc;border-radius:6px;padding:8px">
          <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#2b8a3e;margin-bottom:4px">✅ Plant Near</div>
          <div style="font-size:10px;color:#1b4332">${good.slice(0, 5).join(', ')}${good.length > 5 ? ` +${good.length - 5}` : ''}</div>
        </div>` : ''}
        ${bad.length ? `<div style="background:#ffe3e3;border-radius:6px;padding:8px">
          <div style="font-size:8px;font-weight:700;text-transform:uppercase;color:#c92a2a;margin-bottom:4px">❌ Keep Away</div>
          <div style="font-size:10px;color:#c92a2a">${bad.slice(0, 5).join(', ')}${bad.length > 5 ? ` +${bad.length - 5}` : ''}</div>
        </div>` : ''}
      </div>` : ''}
      ${e.notes ? `<div style="font-size:11px;color:#52796f;font-style:italic;line-height:1.5">💡 ${e.notes}</div>` : ''}
    </div>`;
  }).join('');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${gardenName} — Garden Plan ${year}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; padding: 28px 32px; font-family: -apple-system, 'Helvetica Neue', Arial, sans-serif; background: white; color: #1b4332; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    @page { margin: 12mm; size: A4 portrait; }
    h2 { margin: 0 0 4px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #52796f; }
    table { border-collapse: collapse; }
  </style>
</head>
<body>

  <!-- Header -->
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
    <div>
      <h1 style="margin:0;font-size:26px;font-weight:800;color:#1b4332;letter-spacing:-0.5px">${gardenName}</h1>
      <p style="margin:3px 0 0;font-size:12px;color:#52796f">
        ${year} Garden Plan &nbsp;·&nbsp; ${SUN_LABEL[sun]} &nbsp;·&nbsp; ${rows}×${cols} grid &nbsp;·&nbsp;
        Last frost: ${lastFrost} &nbsp;·&nbsp; First frost: ${firstFrost} &nbsp;·&nbsp;
        Printed ${new Date().toLocaleDateString()}
      </p>
    </div>
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#52796f">GardenGrid</div>
  </div>
  <div style="height:2px;background:linear-gradient(to right,#52b788,#b7e4c7,transparent);margin-bottom:20px;border-radius:1px"></div>

  <!-- Grid + legend side by side -->
  <div style="display:flex;gap:20px;align-items:flex-start;margin-bottom:24px">
    <div>
      <h2 style="margin-bottom:8px">Garden Layout</h2>
      <table style="border-collapse:separate;border-spacing:2px">${gridRows}</table>
    </div>
    <div style="flex:1;min-width:0">
      <h2 style="margin-bottom:8px">Plants (${placedKeys.length} varieties, ${Object.keys(placements).length} total)</h2>
      <div>${legendItems}</div>
    </div>
  </div>

  <!-- Planting schedule table -->
  <h2 style="margin-bottom:8px">📅 Planting Schedule</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead>
      <tr style="background:#1b4332">
        <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:white"></th>
        <th style="padding:7px 8px;text-align:left;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:white">Plant · Position</th>
        <th style="padding:7px 8px;text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:white">Start Indoors</th>
        <th style="padding:7px 8px;text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:white">Sow / Transplant</th>
        <th style="padding:7px 8px;text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:white">Method</th>
        <th style="padding:7px 8px;text-align:center;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:white">Harvest Window</th>
      </tr>
    </thead>
    <tbody>${scheduleRows}</tbody>
  </table>

  <!-- Plant detail cards -->
  <h2 style="margin-bottom:12px">🌿 Plant Details</h2>
  <div style="columns:2;column-gap:16px">${detailCards}</div>

  <!-- Footer -->
  <div style="margin-top:24px;padding-top:10px;border-top:1px solid #b7e4c7;display:flex;justify-content:space-between;font-size:9px;color:#52796f">
    <span>GardenGrid · ${gardenName} · ${year}</span>
    <span>Generated ${new Date().toLocaleDateString()}</span>
  </div>

</body>
</html>`;
}

export async function printPlannerReport(opts: PlannerReportOpts): Promise<void> {
  const html = buildPlannerHtml(opts);

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) { Alert.alert('Blocked', 'Allow popups to open the plan.'); return; }
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
    return;
  }

  try {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
    } else {
      await Print.printAsync({ uri });
    }
  } catch (e: any) {
    Alert.alert('Print Error', e?.message ?? 'Could not print plan.');
  }
}

export async function generateGardenPdf(
  garden: Garden,
  plants: Plant[],
  layout: GardenLayout | null,
  mode: 'single' | 'full' = 'full',
): Promise<void> {
  const html = mode === 'single'
    ? buildSinglePageHtml(garden, plants, layout)
    : buildGardenReportHtml(garden, plants, layout);

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) { Alert.alert('Blocked', 'Allow popups to print the garden plan.'); return; }
    win.document.write(html);
    win.document.close();
    // Small delay so styles render before print dialog
    setTimeout(() => win.print(), 400);
    return;
  }

  try {
    const Print = await import('expo-print');
    const Sharing = await import('expo-sharing');
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { UTI: 'com.adobe.pdf', mimeType: 'application/pdf' });
    } else {
      await Print.printAsync({ uri });
    }
  } catch (e: any) {
    Alert.alert('Print Error', e?.message ?? 'Could not print garden plan.');
  }
}
