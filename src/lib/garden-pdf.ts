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
          Garden Grid Report &nbsp;·&nbsp; ${garden.rows} × ${garden.cols} tiles &nbsp;·&nbsp; ${plants.length} plant${plants.length !== 1 ? 's' : ''} placed &nbsp;·&nbsp; Generated ${new Date().toLocaleDateString()}
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
      <div style="font-size:11px;color:${STONE};font-style:italic">${plant.garden_id ? 'Garden report' : ''}</div>
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
  <title>${garden.name} — GardenGrid Report</title>
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

function buildSinglePlantHtml(plant: Plant): string {
  const page = buildPlantPage(plant, 0, 1);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${plant.name} — GardenGrid Plant Report</title>
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
    if (!win) { Alert.alert('Blocked', 'Allow popups to open the plant report.'); return; }
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
    Alert.alert('PDF Error', e?.message ?? 'Could not generate plant report.');
  }
}

export async function generateGardenPdf(
  garden: Garden,
  plants: Plant[],
  layout: GardenLayout | null,
): Promise<void> {
  const html = buildGardenReportHtml(garden, plants, layout);

  if (Platform.OS === 'web') {
    const win = window.open('', '_blank');
    if (!win) { Alert.alert('Blocked', 'Allow popups to open the PDF report.'); return; }
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
    Alert.alert('PDF Error', e?.message ?? 'Could not generate report.');
  }
}
