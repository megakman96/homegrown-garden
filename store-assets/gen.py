#!/usr/bin/env python3
"""
GreenPlot – App Store screenshot composer
Canvas: 1290 × 2796 (iPhone 6.9" / 16 Pro Max)
Uses real app screenshots placed inside a phone frame.
"""
from PIL import Image, ImageDraw, ImageFont
import os

W, H = 1290, 2796
OUT   = os.path.dirname(os.path.abspath(__file__))
SHOTS = '/home/kaleb/Downloads/screenshots'

BOLD = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
REG  = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'

# App palette
FOREST   = (26,  46,  34)
HUNTER   = (45, 106,  79)
FERN     = (64, 145, 108)
SAGE     = (82, 183, 136)
FOAM     = (240,247, 238)
DEW      = (216,243, 220)
MIST     = (183,228, 199)
STONE    = (82, 121, 111)
CLOUD    = (255,255, 255)
DARK_BG  = (13,  32,  24)
CHARCOAL = (28,  28,  30)   # phone body

def fnt(path, size):
    try: return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

def text_cx(draw, y, txt, font, fill):
    bb = draw.textbbox((0, 0), txt, font=font)
    x  = (W - (bb[2] - bb[0])) // 2
    draw.text((x, y), txt, fill=fill, font=font)
    return bb[3] - bb[1]

def rr(draw, x0, y0, x1, y1, r, fill=None, outline=None, width=2):
    draw.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=fill, outline=outline, width=width)


# ── Phone frame geometry ────────────────────────────────────────────────────
# The phone sits centred horizontally, with room for text above and below.
PHONE_W  = 1050
PHONE_H  = 2020
PHONE_X  = (W - PHONE_W) // 2   # 120
PHONE_Y  = 570                   # leaves ~570 px for headline text above

SCREEN_PAD = 22                  # bezel thickness
SCREEN_X = PHONE_X + SCREEN_PAD
SCREEN_Y = PHONE_Y + SCREEN_PAD
SCREEN_W = PHONE_W - SCREEN_PAD * 2
SCREEN_H = PHONE_H - SCREEN_PAD * 2

CORNER_PHONE  = 88
CORNER_SCREEN = 68


def draw_phone_frame(img, screenshot: Image.Image):
    """Draw phone shell + paste screenshot inside; return img."""
    draw = ImageDraw.Draw(img)

    # Phone body
    rr(draw, PHONE_X, PHONE_Y, PHONE_X + PHONE_W, PHONE_Y + PHONE_H,
       CORNER_PHONE, fill=CHARCOAL)

    # Screen area (dark base in case screenshot has gaps)
    rr(draw, SCREEN_X, SCREEN_Y, SCREEN_X + SCREEN_W, SCREEN_Y + SCREEN_H,
       CORNER_SCREEN, fill=DARK_BG)

    # Paste scaled screenshot
    sc = screenshot.resize((SCREEN_W, SCREEN_H), Image.LANCZOS)
    # Mask to rounded rect so corners don't poke out
    mask = Image.new('L', (SCREEN_W, SCREEN_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        [0, 0, SCREEN_W - 1, SCREEN_H - 1], radius=CORNER_SCREEN, fill=255)
    img.paste(sc, (SCREEN_X, SCREEN_Y), mask)

    # Phone border on top (to sharpen edges)
    draw2 = ImageDraw.Draw(img)
    rr(draw2, PHONE_X, PHONE_Y, PHONE_X + PHONE_W, PHONE_Y + PHONE_H,
       CORNER_PHONE, fill=None, outline=(55, 57, 60), width=5)

    # Dynamic Island
    di_w, di_h = 160, 38
    di_x = SCREEN_X + (SCREEN_W - di_w) // 2
    di_y = SCREEN_Y + 18
    rr(draw2, di_x, di_y, di_x + di_w, di_y + di_h, 19, fill=(0, 0, 0))

    # Side buttons
    btn = CHARCOAL
    shade = (50, 52, 54)
    for by in [PHONE_Y + 200, PHONE_Y + 310]:
        rr(draw2, PHONE_X - 10, by, PHONE_X - 2, by + 80, 4, shade)
    rr(draw2, PHONE_X + PHONE_W + 2, PHONE_Y + 250,
       PHONE_X + PHONE_W + 10, PHONE_Y + 390, 4, shade)

    return img


# ── Text block ──────────────────────────────────────────────────────────────
def draw_text_block(draw, headline_lines, subline_lines,
                    headline_col, subline_col):
    """Render stacked headline + subline centred above phone, return next y."""
    f_h = fnt(BOLD, 88)
    f_s = fnt(REG,  44)

    # Measure total block height to vertically centre in the ~570 px above phone
    line_heights_h = []
    for line in headline_lines:
        bb = draw.textbbox((0, 0), line, font=f_h)
        line_heights_h.append(bb[3] - bb[1])

    line_heights_s = []
    for line in subline_lines:
        bb = draw.textbbox((0, 0), line, font=f_s)
        line_heights_s.append(bb[3] - bb[1])

    gap_h = 10    # between headline lines
    gap_hs = 28   # between headline block and subline
    gap_s = 8     # between subline lines

    total = (sum(line_heights_h) + gap_h * (len(headline_lines) - 1)
             + gap_hs
             + sum(line_heights_s) + gap_s * (len(subline_lines) - 1))

    y = (PHONE_Y - total) // 2

    for i, line in enumerate(headline_lines):
        text_cx(draw, y, line, f_h, headline_col)
        y += line_heights_h[i] + gap_h
    y += gap_hs - gap_h

    for i, line in enumerate(subline_lines):
        text_cx(draw, y, line, f_s, subline_col)
        y += line_heights_s[i] + gap_s


def draw_badge(draw, dark=False):
    """Small wordmark at the very bottom."""
    f = fnt(BOLD, 34)
    col = STONE if not dark else (82, 121, 111)
    text_cx(draw, H - 64, 'GreenPlot – Garden Planner', f, col)


# ── Build a single screenshot ───────────────────────────────────────────────
def build(out_name, shot_path, bg_col,
          headline_lines, subline_lines,
          dark=False):

    img  = Image.new('RGB', (W, H), bg_col)
    draw = ImageDraw.Draw(img)

    headline_col = FOAM   if dark else FOREST
    subline_col  = (130, 170, 150) if dark else STONE

    draw_text_block(draw, headline_lines, subline_lines,
                    headline_col, subline_col)
    draw_badge(draw, dark)

    shot = Image.open(shot_path).convert('RGB')
    draw_phone_frame(img, shot)

    img.save(os.path.join(OUT, out_name), quality=96)
    print(f'  ✓  {out_name}')


# ── Privacy screen (full-bleed, no phone) ───────────────────────────────────
def build_privacy():
    img  = Image.new('RGB', (W, H), FOREST)
    draw = ImageDraw.Draw(img)

    # Gradient
    for y in range(H):
        t = y / H
        r = int(FOREST[0] * (1 - t) + DARK_BG[0] * t)
        g = int(FOREST[1] * (1 - t) + DARK_BG[1] * t)
        b = int(FOREST[2] * (1 - t) + DARK_BG[2] * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    f_big  = fnt(BOLD, 118)
    f_hero = fnt(BOLD,  90)
    f_sub  = fnt(BOLD,  54)
    f_body = fnt(REG,   42)
    f_tag  = fnt(BOLD,  38)

    # App icon pill
    rr(draw, W // 2 - 90, 200, W // 2 + 90, 370, 40, FERN)
    draw.text((W // 2 - 42, 216), '🌱',
              fill=CLOUD, font=fnt(REG, 130))

    text_cx(draw, 404, 'GreenPlot', fnt(BOLD, 54), SAGE)
    text_cx(draw, 472, 'Garden Planner', fnt(REG, 38), STONE)

    # Main statement
    text_cx(draw, 600,  'No AI.',        f_big, FOAM)
    text_cx(draw, 740,  'No tracking.',  f_big, FOAM)
    text_cx(draw, 880,  'No data sold.', f_big, FOAM)
    text_cx(draw, 1030, 'Ever.',         fnt(BOLD, 82), SAGE)

    draw.line([(W // 2 - 250, 1120), (W // 2 + 250, 1120)], fill=FERN, width=2)

    # Three pillars
    for i, (em, lbl) in enumerate([('🔒', 'Private\nby design'),
                                    ('🌿', 'Real\nknowledge'),
                                    ('✨', 'Simple &\nelegant')]):
        px = W // 4 + i * W // 4
        py = 1160
        rr(draw, px - 78, py - 8, px + 78, py + 76, 22, DARK_BG)
        draw.text((px - 26, py + 6), em,
                  fill=SAGE, font=fnt(REG, 52))
        for j, line in enumerate(lbl.split('\n')):
            bb = draw.textbbox((0, 0), line, font=fnt(BOLD, 34))
            draw.text((px - (bb[2] - bb[0]) // 2, py + 100 + j * 42),
                      line, fill=FOAM, font=fnt(BOLD, 34))

    # Body copy
    for i, line in enumerate([
        'Your location is used only for local weather',
        '& growing zones. Never stored. Never sold.',
    ]):
        text_cx(draw, 1420 + i * 54, line, f_body, STONE)

    draw.line([(W // 2 - 250, 1570), (W // 2 + 250, 1570)], fill=FERN, width=2)

    # Feature tags
    tags = ['266 Plants', 'All Zones', 'Weather-Aware', 'Harvest Tracking']
    f_tag = fnt(BOLD, 36)
    widths = [draw.textbbox((0, 0), t, font=f_tag)[2] for t in tags]
    total_w = sum(widths) + len(tags) * 28 + (len(tags) - 1) * 16
    tx = (W - total_w) // 2
    ty = 1616
    for tag, tw in zip(tags, widths):
        rr(draw, tx - 14, ty - 8, tx + tw + 14, ty + 46, 20, DARK_BG)
        draw.text((tx, ty), tag, fill=SAGE, font=f_tag)
        tx += tw + 28 + 16

    text_cx(draw, 1730, 'Free to start. Pro for power growers.',
            fnt(REG, 40), STONE)

    # Bottom wordmark
    rr(draw, W // 2 - 200, H - 176, W // 2 + 200, H - 56, 30, DARK_BG)
    text_cx(draw, H - 162, 'GreenPlot',       fnt(BOLD, 52), SAGE)
    text_cx(draw, H - 108, 'Garden Planner',  fnt(REG,  34), STONE)

    img.save(os.path.join(OUT, '06_privacy.jpg'), quality=96)
    print('  ✓  06_privacy.jpg')


# ── Run ─────────────────────────────────────────────────────────────────────
print('Compositing App Store screenshots…')

build('01_garden_grid.jpg',
      f'{SHOTS}/gardengrid.PNG',
      bg_col=(232, 245, 235),
      headline_lines=['Your garden,', 'beautifully planned.'],
      subline_lines=['Design your beds before', 'you dig a single hole.'],
      dark=False)

build('02_plant_catalog.jpg',
      f'{SHOTS}/catalogue.PNG',
      bg_col=(216, 243, 220),
      headline_lines=['266 plants.', 'Every climate on earth.'],
      subline_lines=['From tomatoes to taro.', 'Basil to breadfruit.'],
      dark=False)

build('03_plant_details.jpg',
      f'{SHOTS}/plantdetails.PNG',
      bg_col=(232, 245, 233),
      headline_lines=['Grown for', 'your exact zone.'],
      subline_lines=['Frost dates, planting windows,', 'and zone viability — personalized.'],
      dark=False)

build('04_schedule.jpg',
      f'{SHOTS}/schedule.PNG',
      bg_col=(227, 242, 253),
      headline_lines=['Watering on', 'autopilot.'],
      subline_lines=['Rain in the forecast?', 'Your schedule adjusts automatically.'],
      dark=False)

build('05_harvest.jpg',
      f'{SHOTS}/harvest history.PNG',
      bg_col=(241, 248, 233),
      headline_lines=['Track every', 'harvest.'],
      subline_lines=['Log your yield. Watch your', 'garden improve every season.'],
      dark=False)

build_privacy()

print(f'\nAll 6 saved to {OUT}/')
print('Dimensions: 1290 × 2796 px  (iPhone 6.9" / 16 Pro Max)')
