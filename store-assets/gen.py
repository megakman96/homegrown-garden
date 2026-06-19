#!/usr/bin/env python3
"""
GreenPlot – App Store screenshot generator
Canvas: 1290 × 2796 (iPhone 6.9" / 16 Pro Max)
"""
from PIL import Image, ImageDraw, ImageFont
import os, math

W, H   = 1290, 2796
OUT    = os.path.dirname(os.path.abspath(__file__))
BOLD   = '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf'
REG    = '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'

# ── Palette (matches app theme-context.tsx) ───────────────────────────────────
FOREST  = (26,  46,  34)
HUNTER  = (45, 106,  79)
FERN    = (64, 145, 108)
SAGE    = (82, 183, 136)
FOAM    = (240,247, 238)
CLOUD   = (255,255, 255)
DEW     = (216,243, 220)
MIST    = (183,228, 199)
STONE   = (82, 121, 111)
DARK_BG = (13,  32,  24)
DARK_CD = (22,  42,  30)
DARK_EL = (30,  56,  40)
DARK_BR = (42,  69,  53)
CHARCOAL= (26,  26,  28)

# Tile colours (sun slots)
FULL_SUN = (255, 231, 146)   # warm gold
PART_SUN = (173, 216, 190)   # sage-teal
SHADE_TL = (179, 198, 215)   # cool slate

def fnt(path, size):
    try: return ImageFont.truetype(path, size)
    except: return ImageFont.load_default()

def rr(draw, x0,y0,x1,y1, r, fill=None, outline=None, width=2):
    draw.rounded_rectangle([x0,y0,x1,y1], radius=r, fill=fill, outline=outline, width=width)

def text_cx(draw, y, txt, font, fill, canvas_w=W):
    bb = draw.textbbox((0,0), txt, font=font)
    x  = (canvas_w - (bb[2]-bb[0])) // 2
    draw.text((x, y), txt, fill=fill, font=font)
    return bb[3]-bb[1]

def vgrad(img, top_col, bot_col):
    draw = ImageDraw.Draw(img)
    for y in range(img.height):
        t = y / img.height
        r = int(top_col[0]*(1-t) + bot_col[0]*t)
        g = int(top_col[1]*(1-t) + bot_col[1]*t)
        b = int(top_col[2]*(1-t) + bot_col[2]*t)
        draw.line([(0,y),(img.width,y)], fill=(r,g,b))

# ── Phone frame helper ────────────────────────────────────────────────────────
PHONE_X  = 120          # left edge of phone
PHONE_Y  = 720          # top  edge of phone (below text block)
PHONE_W  = 1050
PHONE_H  = 1980
SCREEN_X = PHONE_X + 28
SCREEN_Y = PHONE_Y + 28
SCREEN_W = PHONE_W - 56
SCREEN_H = PHONE_H - 56

def draw_phone(img, screen_img, dark=False):
    """Paste screen_img into a phone mockup drawn on img."""
    draw = ImageDraw.Draw(img)

    # Outer phone body
    rr(draw, PHONE_X, PHONE_Y, PHONE_X+PHONE_W, PHONE_Y+PHONE_H, 92, CHARCOAL)

    # Screen background fill (behind content)
    scr_bg = DARK_BG if dark else FOAM
    rr(draw, SCREEN_X, SCREEN_Y, SCREEN_X+SCREEN_W, SCREEN_Y+SCREEN_H, 68, scr_bg)

    # Paste app content
    sc = screen_img.resize((SCREEN_W, SCREEN_H), Image.LANCZOS)
    img.paste(sc, (SCREEN_X, SCREEN_Y))

    # Redraw phone border on top to clip screen corners visually
    draw2 = ImageDraw.Draw(img)
    rr(draw2, PHONE_X, PHONE_Y, PHONE_X+PHONE_W, PHONE_Y+PHONE_H, 92, None, (60,62,64), 6)

    # Dynamic Island
    di_w, di_h = 162, 40
    di_x = SCREEN_X + (SCREEN_W - di_w)//2
    di_y = SCREEN_Y + 20
    rr(draw2, di_x, di_y, di_x+di_w, di_y+di_h, 20, (0,0,0))

    # Side buttons
    for by in [PHONE_Y+190, PHONE_Y+290]:
        rr(draw2, PHONE_X-11, by, PHONE_X-3, by+76, 4, (50,52,54))
    rr(draw2, PHONE_X+PHONE_W+3, PHONE_Y+230, PHONE_X+PHONE_W+11, PHONE_Y+350, 4, (50,52,54))

# ── Shared layout helpers ────────────────────────────────────────────────────
def make_canvas(bg):
    img = Image.new('RGB', (W,H), bg)
    return img, ImageDraw.Draw(img)

def draw_header_text(draw, headline_lines, subline, dark=False):
    """Render headline + subline in the top text block."""
    f_h  = fnt(BOLD, 80)
    f_s  = fnt(REG,  42)
    tc   = FOREST if not dark else FOAM
    sc   = STONE  if not dark else (143,168,152)
    y = 130
    for line in headline_lines:
        h = text_cx(draw, y, line, f_h, tc)
        y += h + 12
    y += 24
    for line in subline.split('\n'):
        h = text_cx(draw, y, line, f_s, sc)
        y += h + 10

def greenplot_badge(draw, dark=False):
    """Small GreenPlot wordmark at the very bottom."""
    f = fnt(BOLD, 36)
    col = STONE if not dark else (82,121,111)
    text_cx(draw, H-70, 'GreenPlot – Garden Planner', f, col)

# ─────────────────────────────────────────────────────────────────────────────
# Screen content renderers  (return a 994×1924 Image each)
# ─────────────────────────────────────────────────────────────────────────────
SW, SH = SCREEN_W, SCREEN_H   # 994 × 1924

def screen_garden_grid(dark=False):
    bg = DARK_BG if dark else FOAM
    img = Image.new('RGB', (SW, SH), bg)
    d   = ImageDraw.Draw(img)

    # Status bar (empty space for Dynamic Island)
    status_h = 80
    # Nav header
    hdr_bg = DARK_CD if dark else HUNTER
    d.rectangle([0, status_h, SW, status_h+90], fill=hdr_bg)
    f_hdr = fnt(BOLD, 44)
    f_sub = fnt(REG,  30)
    f_sm  = fnt(REG,  26)
    tc    = FOAM if dark else CLOUD
    sc    = MIST if dark else DEW

    text_cx(d, status_h+24, 'My Garden', f_hdr, tc, SW)

    # Garden name sub-label
    d.rectangle([0, status_h+90, SW, status_h+130], fill=(DARK_EL if dark else FERN))
    text_cx(d, status_h+98, 'Backyard Beds · 6 × 8', f_sm, FOAM if dark else CLOUD, SW)

    # Grid
    cols, rows = 6, 8
    grid_margin = 20
    grid_top = status_h + 135
    cell = (SW - grid_margin*2) // cols
    sun_map = [
        [FULL_SUN]*6,
        [FULL_SUN,FULL_SUN,PART_SUN,PART_SUN,FULL_SUN,FULL_SUN],
        [FULL_SUN,PART_SUN,PART_SUN,SHADE_TL,SHADE_TL,PART_SUN],
        [FULL_SUN,FULL_SUN,PART_SUN,PART_SUN,FULL_SUN,FULL_SUN],
        [FULL_SUN]*4+[PART_SUN,SHADE_TL],
        [PART_SUN,FULL_SUN,FULL_SUN,PART_SUN,PART_SUN,FULL_SUN],
        [FULL_SUN]*6,
        [FULL_SUN,FULL_SUN,PART_SUN,FULL_SUN,FULL_SUN,PART_SUN],
    ]
    plants = {
        (0,0):'TOM',(0,1):'TOM',(0,2):'BAS',
        (1,3):'PEP',(1,4):'PEP',
        (2,0):'LET',(2,5):'KAL',
        (3,1):'ZUC',(3,2):'ZUC',
        (4,2):'CUC',(4,3):'CUC',
        (5,0):'STR',(5,5):'MNT',
        (6,1):'CAR',(6,2):'CAR',(6,3):'CAR',
        (7,4):'ONI',(7,5):'GAR',
    }
    plant_colors = {
        'TOM':(220,80,60),'BAS':(80,160,80),'PEP':(230,150,40),
        'LET':(130,200,130),'KAL':(60,140,100),'ZUC':(90,180,90),
        'CUC':(70,160,100),'STR':(210,70,80),'MNT':(100,180,140),
        'CAR':(220,120,40),'ONI':(200,180,220),'GAR':(240,230,180),
    }
    f_pl = fnt(BOLD, 20)
    for r in range(rows):
        for c in range(cols):
            x0 = grid_margin + c*cell
            y0 = grid_top    + r*cell
            cell_bg = sun_map[r][c]
            d.rectangle([x0, y0, x0+cell-2, y0+cell-2], fill=cell_bg)
            d.rectangle([x0, y0, x0+cell-2, y0+cell-2], outline=(200,210,205), width=1)
            if (r,c) in plants:
                label = plants[(r,c)]
                dot_col = plant_colors.get(label, HUNTER)
                cx, cy = x0 + cell//2, y0 + cell//2
                d.ellipse([cx-18, cy-18, cx+18, cy+18], fill=dot_col)
                bb = d.textbbox((0,0), label, font=f_pl)
                tw = bb[2]-bb[0]
                d.text((cx-tw//2, cy-10), label, fill=CLOUD, font=f_pl)

    # Legend
    leg_y = grid_top + rows*cell + 18
    items = [('Full Sun',FULL_SUN),('Partial',PART_SUN),('Shade',SHADE_TL)]
    lx = 20
    f_leg = fnt(REG, 24)
    leg_tc = (143,168,152) if dark else STONE
    for label, col in items:
        d.rounded_rectangle([lx, leg_y, lx+22, leg_y+22], radius=4, fill=col)
        d.text((lx+28, leg_y+1), label, fill=leg_tc, font=f_leg)
        lx += 28 + d.textbbox((0,0),label,font=f_leg)[2] + 24

    # Tab bar
    tab_y = SH - 110
    tab_bg = DARK_CD if dark else CLOUD
    d.rectangle([0, tab_y, SW, SH], fill=tab_bg)
    d.line([(0,tab_y),(SW,tab_y)], fill=DARK_BR if dark else MIST, width=1)
    tabs = ['🏠','🌿','📅','📖','👤']
    labels = ['Garden','Plants','Schedule','History','Profile']
    f_tab = fnt(REG, 22)
    f_tab_e= fnt(REG, 30)
    tab_active = SAGE if dark else HUNTER
    tab_idle   = (82,121,111) if dark else STONE
    tw_each = SW // len(tabs)
    for i,(em,lb) in enumerate(zip(tabs,labels)):
        tx = i*tw_each + tw_each//2
        col = tab_active if i==0 else tab_idle
        bb = d.textbbox((0,0),em,font=f_tab_e)
        d.text((tx-(bb[2]-bb[0])//2, tab_y+12), em, fill=col, font=f_tab_e)
        bb2 = d.textbbox((0,0),lb,font=f_tab)
        d.text((tx-(bb2[2]-bb2[0])//2, tab_y+52), lb, fill=col, font=f_tab)

    return img


def screen_plant_catalog(dark=False):
    bg = DARK_BG if dark else FOAM
    img = Image.new('RGB', (SW, SH), bg)
    d   = ImageDraw.Draw(img)
    status_h = 80

    # Header
    hdr_bg = DARK_CD if dark else HUNTER
    d.rectangle([0, status_h, SW, status_h+90], fill=hdr_bg)
    f_hdr = fnt(BOLD, 44)
    text_cx(d, status_h+24, 'Plant Catalogue', f_hdr, CLOUD, SW)

    # Search bar
    search_y = status_h + 104
    rr(d, 20, search_y, SW-20, search_y+60, 14,
       DARK_EL if dark else CLOUD, DARK_BR if dark else MIST, 1)
    f_ph = fnt(REG, 30)
    d.text((52, search_y+15), '🔍  Search 266 plants…', fill=(82,121,111) if dark else STONE, font=f_ph)

    # Category chips
    chip_y = search_y + 74
    cats = ['All','Vegetable','Fruit','Herb','Flower','Grain']
    cx = 16
    f_chip = fnt(BOLD, 24)
    for i, cat in enumerate(cats):
        bb = d.textbbox((0,0), cat, font=f_chip)
        cw = bb[2]-bb[0]+28
        col_bg = HUNTER if i==0 else (DARK_EL if dark else DEW)
        col_tx = CLOUD  if i==0 else (MIST if dark else STONE)
        rr(d, cx, chip_y, cx+cw, chip_y+38, 19, col_bg)
        d.text((cx+14, chip_y+7), cat, fill=col_tx, font=f_chip)
        cx += cw + 8

    # Plant list
    list_y = chip_y + 54
    card_bg = DARK_CD if dark else CLOUD
    card_br = DARK_BR if dark else MIST
    tc  = FOAM  if dark else FOREST
    sc  = (143,168,152) if dark else STONE
    f_n = fnt(BOLD, 32)
    f_s = fnt(REG,  24)
    f_e = fnt(REG,  36)

    plants_list = [
        ('🍅','Tomato',       'Vegetable · Full sun · Every 2d'),
        ('🌶️','Pepper',        'Vegetable · Full sun · Every 3d'),
        ('🥦','Broccoli',      'Vegetable · Full sun · Every 4d'),
        ('🥕','Carrot',        'Vegetable · Full sun · Every 4d'),
        ('🍌','Banana',        'Fruit · Full sun · Every 2d'),
        ('🥬','Kale',          'Vegetable · Full sun · Every 5d'),
        ('🌿','Basil',         'Herb · Partial · Every 3d'),
        ('🍓','Strawberry',    'Fruit · Full sun · Every 2d'),
        ('🧄','Garlic',        'Vegetable · Full sun · Every 6d'),
        ('🫚','Lemongrass',    'Herb · Full sun · Every 3d'),
        ('🍈','Bitter Melon',  'Vegetable · Full sun · Every 2d'),
        ('🌾','Quinoa',        'Grain · Full sun · Every 7d'),
    ]

    for i,(emoji,name,meta) in enumerate(plants_list):
        iy = list_y + i*110
        if iy + 100 > SH - 120: break
        rr(d, 16, iy, SW-16, iy+100, 12, card_bg, card_br, 1)
        # Color dot
        dot_cols = [HUNTER,FERN,SAGE,STONE,HUNTER,SAGE,FERN,HUNTER,STONE,FERN,SAGE,STONE]
        d.ellipse([20,iy+26,74,iy+80], fill=dot_cols[i%len(dot_cols)])
        d.text((30,iy+35), emoji, fill=CLOUD, font=f_e)
        d.text((92, iy+18), name, fill=tc, font=f_n)
        d.text((92, iy+56), meta, fill=sc, font=f_s)
        # Sun emoji at right
        rr(d, SW-80, iy+28, SW-20, iy+68, 8, DARK_EL if dark else DEW)
        d.text((SW-66, iy+31), '☀️', fill=sc, font=f_s)

    # Tab bar
    tab_y = SH - 110
    d.rectangle([0, tab_y, SW, SH], fill=DARK_CD if dark else CLOUD)
    d.line([(0,tab_y),(SW,tab_y)], fill=DARK_BR if dark else MIST, width=1)
    tabs = ['🏠','🌿','📅','📖','👤']
    labels = ['Garden','Plants','Schedule','History','Profile']
    f_tab = fnt(REG, 22); f_tab_e = fnt(REG, 30)
    tab_active = SAGE if dark else HUNTER; tab_idle = (82,121,111) if dark else STONE
    tw_each = SW//len(tabs)
    for i,(em,lb) in enumerate(zip(tabs,labels)):
        tx = i*tw_each+tw_each//2; col = tab_active if i==1 else tab_idle
        bb = d.textbbox((0,0),em,font=f_tab_e)
        d.text((tx-(bb[2]-bb[0])//2,tab_y+12),em,fill=col,font=f_tab_e)
        bb2 = d.textbbox((0,0),lb,font=f_tab)
        d.text((tx-(bb2[2]-bb2[0])//2,tab_y+52),lb,fill=col,font=f_tab)
    return img


def screen_frost_zone(dark=False):
    bg = DARK_BG if dark else FOAM
    img = Image.new('RGB', (SW, SH), bg)
    d   = ImageDraw.Draw(img)
    status_h = 80

    # Hero gradient
    hero_h = 340
    for y in range(hero_h):
        t = y/hero_h
        r = int(HUNTER[0]*(1-t)+FERN[0]*t)
        g = int(HUNTER[1]*(1-t)+FERN[1]*t)
        b = int(HUNTER[2]*(1-t)+FERN[2]*t)
        d.line([(0,status_h+y),(SW,status_h+y)],fill=(r,g,b))

    # Plant emoji in hero
    f_big = fnt(REG, 130)
    d.text((SW//2-65, status_h+70), '🍅', font=f_big, fill=CLOUD)

    # Plant name overlay at bottom of hero
    f_nm = fnt(BOLD, 52)
    f_va = fnt(REG,  30)
    d.rectangle([0, status_h+hero_h-80, SW, status_h+hero_h], fill=(0,0,0,120))
    text_cx(d, status_h+hero_h-70, 'Tomato', f_nm, CLOUD, SW)

    y = status_h + hero_h + 20
    card_bg = DARK_CD if dark else CLOUD
    card_br = DARK_BR if dark else MIST
    tc  = FOAM  if dark else FOREST
    sc  = (143,168,152) if dark else STONE
    f_h2= fnt(BOLD, 36)
    f_lbl=fnt(REG,  24)
    f_val=fnt(BOLD, 30)
    f_sm = fnt(REG, 26)

    # Growing guide card
    rr(d, 16, y, SW-16, y+520, 16, card_bg, card_br, 1)
    d.text((32, y+18), '🌿  Growing Guide', fill=tc, font=f_h2)

    # Spec chips
    chip_data = [
        ('☀️','Sun','Full Sun',(255,249,219),(255,224,102)),
        ('💧','Water','Every 2d',(231,245,255),(116,192,252)),
        ('🌍','Zone','Pro  🔒',(240,247,238),(183,228,199)),
    ]
    cx = 32; cy = y+70
    chip_w = (SW-64-20)//3
    for em,lbl,val,chip_bg,chip_bd in chip_data:
        if dark: chip_bg,chip_bd = DARK_EL, DARK_BR
        rr(d, cx, cy, cx+chip_w, cy+110, 12, chip_bg, chip_bd, 1)
        d.text((cx+12, cy+12), em, fill=tc, font=fnt(REG,32))
        d.text((cx+12, cy+50), lbl, fill=sc, font=f_lbl)
        d.text((cx+12, cy+76), val, fill=tc, font=f_val)
        cx += chip_w+10

    # Frost & Planting section
    fz = y + 200
    d.text((32, fz), '🌡️  Frost & Planting', fill=tc, font=f_h2)

    # Zone badge
    zbg = (232,245,233) if not dark else DARK_EL
    rr(d, 32, fz+46, 400, fz+90, 22, zbg, (165,214,167) if not dark else DARK_BR, 1)
    d.text((52, fz+52), '📍  Seattle · Zone 8b', fill=(46,125,50) if not dark else SAGE, font=f_sm)

    # Viability badge
    rr(d, 32, fz+100, SW-32, fz+148, 10,
       (232,245,233) if not dark else DARK_EL,
       (165,214,167) if not dark else DARK_BR, 1)
    d.text((52, fz+112), '✓  Ideal for Zone 8b – great growing conditions', fill=HUNTER if not dark else SAGE, font=f_sm)

    # Water adjust badge
    rr(d, 32, fz+160, SW-32, fz+222, 10,
       (231,245,255) if not dark else DARK_EL,
       (116,192,252) if not dark else DARK_BR, 1)
    d.text((52, fz+170), '💧  Zone-adjusted: water every 1d', fill=(25,113,194) if not dark else (116,192,252), font=fnt(BOLD,28))
    d.text((52, fz+204), 'Zone 8b dries out faster · catalog default is 2d', fill=sc, font=fnt(REG,22))

    # Frost date chips
    fd_y = fz+240
    chips_fd = [
        ('❄️  Last frost','Mar 5',(227,242,253),(144,202,249),(21,101,192)),
        ('🍂  First frost','Nov 22',(252,228,236),(244,143,177),(136,14,79)),
        ('🌿  Season','262d',(243,229,245),(206,147,216),(106,27,154)),
    ]
    cw = (SW-64-20)//3; cxf=32
    for em_lbl, val, cbg, cbd, ctc in chips_fd:
        if dark: cbg,cbd,ctc = DARK_EL, DARK_BR, (143,168,152)
        rr(d, cxf, fd_y, cxf+cw, fd_y+90, 10, cbg, cbd, 1)
        d.text((cxf+10, fd_y+8), em_lbl, fill=ctc if not dark else sc, font=fnt(BOLD,22))
        d.text((cxf+10, fd_y+44), val, fill=tc, font=fnt(BOLD,32))
        cxf += cw+10

    # Planting timeline
    tl_y = fd_y+110
    rr(d, 32, tl_y, SW-32, tl_y+250, 12, card_bg if not dark else DARK_EL, card_br, 1)
    d.text((52, tl_y+14), '🌱  Tomato planting timeline', fill=tc, font=fnt(BOLD,28))
    rows_tl = [('🏠','Start indoors','Feb 15'),('☀️','Transplant outdoors','Mar 19'),('🧺','Harvest window','Jun 18 – Aug 2')]
    ry = tl_y+54
    for em,lbl,date in rows_tl:
        d.text((52, ry), em, fill=tc, font=fnt(REG,32))
        d.text((100, ry+4), lbl, fill=sc, font=fnt(REG,24))
        d.text((100, ry+32), date, fill=tc, font=fnt(BOLD,28))
        ry+=70

    # Tab bar
    tab_y = SH-110
    d.rectangle([0,tab_y,SW,SH], fill=DARK_CD if dark else CLOUD)
    d.line([(0,tab_y),(SW,tab_y)],fill=DARK_BR if dark else MIST,width=1)
    tabs=['🏠','🌿','📅','📖','👤']; labels=['Garden','Plants','Schedule','History','Profile']
    f_tab=fnt(REG,22); f_tab_e=fnt(REG,30)
    ta=SAGE if dark else HUNTER; ti=(82,121,111) if dark else STONE
    twe=SW//len(tabs)
    for i,(em,lb) in enumerate(zip(tabs,labels)):
        tx=i*twe+twe//2; col=ta if i==1 else ti
        bb=d.textbbox((0,0),em,font=f_tab_e)
        d.text((tx-(bb[2]-bb[0])//2,tab_y+12),em,fill=col,font=f_tab_e)
        bb2=d.textbbox((0,0),lb,font=f_tab)
        d.text((tx-(bb2[2]-bb2[0])//2,tab_y+52),lb,fill=col,font=f_tab)
    return img


def screen_schedule(dark=False):
    bg = DARK_BG if dark else FOAM
    img = Image.new('RGB', (SW, SH), bg)
    d   = ImageDraw.Draw(img)
    status_h=80

    # Header
    hdr_bg=DARK_CD if dark else HUNTER
    d.rectangle([0,status_h,SW,status_h+90],fill=hdr_bg)
    text_cx(d, status_h+24, 'Watering Schedule', fnt(BOLD,44), CLOUD, SW)

    y=status_h+104
    card_bg=DARK_CD if dark else CLOUD
    card_br=DARK_BR if dark else MIST
    tc=FOAM if dark else FOREST; sc=(143,168,152) if dark else STONE

    # Weather card
    rr(d,16,y,SW-16,y+300,16,card_bg,card_br,1)
    d.text((32,y+16), '68°F / 52°F', fill=tc, font=fnt(BOLD,46))
    d.text((32,y+72), '📍 Seattle, WA', fill=sc, font=fnt(REG,28))
    # Rain badge
    rr(d,SW-200,y+18,SW-20,y+62,18,(231,245,255) if not dark else DARK_EL)
    d.text((SW-192,y+26),'☀️  Dry today',fill=(25,113,194) if not dark else (116,192,252),font=fnt(BOLD,24))

    # 7-day forecast strip
    days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun']
    emojis=['☀️','☀️','🌧️','🌧️','⛅','☀️','☀️']
    precips=['—','—','0.3"','0.5"','—','—','—']
    bar_y=y+100; bw=(SW-64)//7; bx=32
    for i,(day,em,pr) in enumerate(zip(days,emojis,precips)):
        is_rain='🌧' in em
        bar_col=(116,192,252) if is_rain else SAGE
        if dark: bar_col=(74,144,226) if is_rain else FERN
        rr(d,bx,bar_y,bx+bw-4,bar_y+80,8,bar_col)
        d.text((bx+6,bar_y+12),em,fill=CLOUD,font=fnt(REG,28))
        d.text((bx+6,bar_y+48),day,fill=CLOUD,font=fnt(BOLD,20))
        if pr != '—':
            d.text((bx+2,bar_y+84),pr,fill=sc,font=fnt(REG,20))
        bx+=bw

    rr(d,16,bar_y+106,SW-16,bar_y+146,8,(231,245,255) if not dark else DARK_EL)
    d.text((32,bar_y+116),'🌧️  2 rainy days ahead (0.8") – schedule adjusted',
           fill=(25,113,194) if not dark else (116,192,252),font=fnt(REG,26))

    # Schedule cards
    items=[
        ('💧','Tomatoes','Water today','Today','#overdue'),
        ('💧','Basil','Water tomorrow','Tomorrow',''),
        ('💧','Pepper','Adjusted for rain','Thu','rain'),
        ('🧺','Zucchini','Harvest window open','Today','harvest'),
        ('💧','Carrot','Water in 2 days','Fri',''),
        ('💧','Kale','Water in 3 days','Sat',''),
    ]
    card_y=bar_y+160
    f_nm=fnt(BOLD,32); f_dt=fnt(REG,26); f_note=fnt(REG,24)
    for i,(em,name,note,date,flag) in enumerate(items):
        iy=card_y+i*118
        if iy+108 > SH-120: break
        is_ov=flag=='#overdue'; is_rain_=flag=='rain'; is_harv=flag=='harvest'
        card_c = (255,243,243) if (is_ov and not dark) else card_bg
        if dark: card_c=DARK_EL if is_ov else card_bg
        rr(d,16,iy,SW-16,iy+108,14,card_c,card_br,1)
        dot_c=SAGE if not is_harv else (169,227,75)
        d.ellipse([28,iy+30,66,iy+78],fill=dot_c)
        d.text((34,iy+36),em,fill=CLOUD,font=fnt(REG,30))
        d.text((82,iy+14),name,fill=tc,font=f_nm)
        d.text((82,iy+52),note,fill=sc if not is_ov else (220,80,60),font=f_note)
        # Date badge right
        rr(d,SW-120,iy+28,SW-20,iy+72,10,DARK_EL if dark else DEW)
        d.text((SW-112,iy+36),date,fill=SAGE if dark else HUNTER,font=fnt(BOLD,24))
        # Done button on water cards
        if '💧'==em:
            rr(d,SW-180,iy+60,SW-20,iy+96,10,HUNTER if not is_rain_ else (116,192,252))
            d.text((SW-170,iy+66),'Done ✓' if not is_rain_ else '🌧 Skipped',
                   fill=CLOUD,font=fnt(BOLD,22))

    # Tab bar
    tab_y=SH-110
    d.rectangle([0,tab_y,SW,SH],fill=DARK_CD if dark else CLOUD)
    d.line([(0,tab_y),(SW,tab_y)],fill=DARK_BR if dark else MIST,width=1)
    tabs=['🏠','🌿','📅','📖','👤']; labels=['Garden','Plants','Schedule','History','Profile']
    f_tab=fnt(REG,22); f_tab_e=fnt(REG,30)
    ta=SAGE if dark else HUNTER; ti=(82,121,111) if dark else STONE
    twe=SW//len(tabs)
    for i,(em,lb) in enumerate(zip(tabs,labels)):
        tx=i*twe+twe//2; col=ta if i==2 else ti
        bb=d.textbbox((0,0),em,font=f_tab_e)
        d.text((tx-(bb[2]-bb[0])//2,tab_y+12),em,fill=col,font=f_tab_e)
        bb2=d.textbbox((0,0),lb,font=f_tab)
        d.text((tx-(bb2[2]-bb2[0])//2,tab_y+52),lb,fill=col,font=f_tab)
    return img


def screen_harvest(dark=False):
    bg=DARK_BG if dark else FOAM
    img=Image.new('RGB',(SW,SH),bg)
    d=ImageDraw.Draw(img)
    status_h=80

    # Hero gradient
    for y in range(260):
        t=y/260
        r=int(HUNTER[0]*(1-t)+64*t)
        g=int(HUNTER[1]*(1-t)+145*t)
        b=int(HUNTER[2]*(1-t)+108*t)
        d.line([(0,status_h+y),(SW,status_h+y)],fill=(r,g,b))
    d.text((SW//2-55,status_h+60),'🍅',fill=CLOUD,font=fnt(REG,130))
    d.rectangle([0,status_h+200,SW,status_h+260],fill=(0,0,0,100))
    text_cx(d,status_h+210,'Tomato',fnt(BOLD,48),CLOUD,SW)

    y=status_h+280
    card_bg=DARK_CD if dark else CLOUD
    card_br=DARK_BR if dark else MIST
    tc=FOAM if dark else FOREST; sc=(143,168,152) if dark else STONE

    # Stats row
    rr(d,16,y,SW-16,y+130,16,card_bg,card_br,1)
    stats=[('🧺','12','Harvests'),('⚖️','4.2 lbs','Total yield'),('📅','Jun 10','Last harvest')]
    sx_=32; sw_=(SW-64-32)//3
    for em,val,lbl in stats:
        d.text((sx_+8,y+16),em,fill=tc,font=fnt(REG,32))
        d.text((sx_+8,y+52),val,fill=SAGE if dark else HUNTER,font=fnt(BOLD,34))
        d.text((sx_+8,y+94),lbl,fill=sc,font=fnt(REG,24))
        sx_+=sw_+16

    # Harvest log
    y+=148
    d.text((32,y+4),'Harvest Log',fill=tc,font=fnt(BOLD,36))
    d.text((SW-200,y+10),'+ Log Harvest',fill=SAGE if dark else HUNTER,font=fnt(BOLD,26))
    log_y=y+50
    entries=[
        ('Jun 18','3 pieces','Great color and size!'),
        ('Jun 10','4 pieces','Best batch yet'),
        ('Jun 2','2 pieces','Early harvest, slightly small'),
        ('May 28','1 piece','First of the season!'),
        ('May 20','2 pieces','Cherry variety - very sweet'),
    ]
    for date,qty,note in entries:
        if log_y+100>SH-120: break
        rr(d,16,log_y,SW-16,log_y+100,12,card_bg,card_br,1)
        d.text((32,log_y+12),date,fill=sc,font=fnt(REG,26))
        d.text((32,log_y+46),qty,fill=SAGE if dark else HUNTER,font=fnt(BOLD,32))
        d.text((250,log_y+54),note,fill=sc,font=fnt(REG,24))
        # Harvest icon
        rr(d,SW-80,log_y+26,SW-20,log_y+74,8,(169,227,75,100))
        d.text((SW-70,log_y+30),'🧺',fill=FOREST,font=fnt(REG,28))
        log_y+=112

    # Tab bar
    tab_y=SH-110
    d.rectangle([0,tab_y,SW,SH],fill=DARK_CD if dark else CLOUD)
    d.line([(0,tab_y),(SW,tab_y)],fill=DARK_BR if dark else MIST,width=1)
    tabs=['🏠','🌿','📅','📖','👤']; labels=['Garden','Plants','Schedule','History','Profile']
    f_tab=fnt(REG,22); f_tab_e=fnt(REG,30)
    ta=SAGE if dark else HUNTER; ti=(82,121,111) if dark else STONE
    twe=SW//len(tabs)
    for i,(em,lb) in enumerate(zip(tabs,labels)):
        tx=i*twe+twe//2; col=ta if i==3 else ti
        bb=d.textbbox((0,0),em,font=f_tab_e)
        d.text((tx-(bb[2]-bb[0])//2,tab_y+12),em,fill=col,font=f_tab_e)
        bb2=d.textbbox((0,0),lb,font=f_tab)
        d.text((tx-(bb2[2]-bb2[0])//2,tab_y+52),lb,fill=col,font=f_tab)
    return img


# ── Full-screen privacy graphic (no phone) ────────────────────────────────────
def make_privacy_screen():
    img=Image.new('RGB',(W,H),FOREST)
    d=ImageDraw.Draw(img)

    # Subtle gradient overlay
    for y in range(H):
        t=y/H
        r=int(FOREST[0]*(1-t)+DARK_BG[0]*t)
        g=int(FOREST[1]*(1-t)+DARK_BG[1]*t)
        b=int(FOREST[2]*(1-t)+DARK_BG[2]*t)
        d.line([(0,y),(W,y)],fill=(r,g,b))

    # Subtle leaf pattern (circles for organic feel)
    for cx_,cy_,cr in [
        (120,300,200),(1170,500,160),(200,1400,180),(1100,1200,220),
        (650,2400,200),(150,2100,150),(1150,1800,170),
    ]:
        overlay=Image.new('RGBA',(W,H),(0,0,0,0))
        od=ImageDraw.Draw(overlay)
        od.ellipse([cx_-cr,cy_-cr,cx_+cr,cy_+cr],fill=(SAGE[0],SAGE[1],SAGE[2],18))
        img=Image.alpha_composite(img.convert('RGBA'),overlay).convert('RGB')
    d=ImageDraw.Draw(img)

    # Divider lines (decorative)
    d.line([(W//2-200, 900),(W//2+200, 900)],fill=FERN,width=2)
    d.line([(W//2-200,1800),(W//2+200,1800)],fill=FERN,width=2)

    f_big  = fnt(BOLD, 110)
    f_hero = fnt(BOLD,  92)
    f_sub  = fnt(BOLD,  54)
    f_body = fnt(REG,   42)
    f_sm   = fnt(REG,   36)
    f_tag  = fnt(BOLD,  38)

    # App icon area
    rr(d,W//2-100,180,W//2+100,380,40,FERN)
    d.text((W//2-50,210),'🌱',fill=CLOUD,font=fnt(REG,140))

    text_cx(d, 420,'GreenPlot',f_sub,SAGE)
    text_cx(d, 490,'Garden Planner',fnt(REG,42),STONE)

    # Main statement
    text_cx(d, 640, 'No AI.',       f_big, FOAM)
    text_cx(d, 760, 'No tracking.', f_big, FOAM)
    text_cx(d, 880, 'No data sold.', f_big, FOAM)

    # Supporting lines
    text_cx(d, 1000, 'Ever.',       fnt(BOLD,80), SAGE)

    # Divider
    d.line([(W//2-240,1080),(W//2+240,1080)],fill=FERN,width=2)

    # Three pillars
    pillars=[
        (W//4,   1160,'🔒','Private\nby design'),
        (W//2,   1160,'🌿','Real\nknowledge'),
        (3*W//4, 1160,'✨','Simple &\nelegant'),
    ]
    f_pe=fnt(REG,52); f_pl=fnt(BOLD,36); f_ps=fnt(REG,30)
    for px,py,em,lbl in pillars:
        rr(d,px-80,py-10,px+80,py+80,20,DARK_CD)
        d.text((px-26,py+4),em,fill=SAGE,font=f_pe)
        for i,line in enumerate(lbl.split('\n')):
            bb=d.textbbox((0,0),line,font=f_pl)
            d.text((px-(bb[2]-bb[0])//2,py+100+i*42),line,fill=FOAM,font=f_pl)

    # Body copy
    body_lines=[
        'Your location is only used for local',
        'weather & growing zones. Never stored.',
        'Never shared. Never sold.',
    ]
    by=1420
    for line in body_lines:
        text_cx(d,by,line,f_body,STONE)
        by+=56

    # Feature tags
    d.line([(W//2-240,1650),(W//2+240,1650)],fill=FERN,width=2)
    tags=['266 Plants','All Zones','Weather-Aware','Harvest Tracking']
    ty=1690
    tx_=W//2 - (len(tags)*220)//2 + 20
    for tag in tags:
        bb=d.textbbox((0,0),tag,font=f_tag)
        tw_=bb[2]-bb[0]
        rr(d,tx_-16,ty-8,tx_+tw_+16,ty+46,20,DARK_CD)
        d.text((tx_,ty),tag,fill=SAGE,font=f_tag)
        tx_+=tw_+50

    # Free to start
    text_cx(d,1820,'Free to start. Pro for power growers.',fnt(REG,40),STONE)

    # Bottom wordmark
    rr(d,W//2-200,H-180,W//2+200,H-60,30,DARK_CD)
    text_cx(d,H-162,'GreenPlot',fnt(BOLD,52),SAGE)
    text_cx(d,H-108,'Garden Planner',fnt(REG,34),STONE)

    return img


# ── Build all 6 screenshots ───────────────────────────────────────────────────
def build(filename, bg, headline_lines, subline, screen_fn, dark=False):
    img,draw = make_canvas(bg)
    draw_header_text(draw, headline_lines, subline, dark)
    greenplot_badge(draw, dark)
    screen = screen_fn(dark)
    draw_phone(img, screen, dark)
    img.save(os.path.join(OUT, filename), quality=95)
    print(f'  ✓ {filename}')


print('Generating App Store screenshots...')

build('01_garden_grid.jpg',
      FOAM,
      ['Your garden,','beautifully planned.'],
      'Design your beds before\nyou dig a single hole.',
      screen_garden_grid, dark=False)

build('02_plant_catalog.jpg',
      DEW,
      ['266 plants.','Every climate on earth.'],
      'From tomatoes to taro.\nBasil to breadfruit.',
      screen_plant_catalog, dark=False)

build('03_frost_zone.jpg',
      (232,245,233),
      ['Grown for your','exact zone.'],
      'Frost dates, planting windows,\nand zone viability — personalized.',
      screen_frost_zone, dark=False)

build('04_schedule.jpg',
      (227,242,253),
      ['Watering on','autopilot.'],
      'Rain in the forecast?\nYour schedule adjusts automatically.',
      screen_schedule, dark=False)

build('05_harvest.jpg',
      (241,248,233),
      ['Track every','harvest.'],
      'Log your yield. Watch your\ngarden improve every season.',
      screen_harvest, dark=False)

# Screenshot 6 is full-screen, no phone
privacy = make_privacy_screen()
privacy.save(os.path.join(OUT, '06_privacy.jpg'), quality=95)
print('  ✓ 06_privacy.jpg')

print(f'\nAll 6 screenshots saved to {OUT}/')
print('Dimensions: 1290 × 2796 px  (iPhone 6.9" / 16 Pro Max)')
