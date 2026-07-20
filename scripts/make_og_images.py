from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OG = ROOT / "public" / "og"
ICONS = ROOT / "public" / "icons"
OG.mkdir(parents=True, exist_ok=True)
ICONS.mkdir(parents=True, exist_ok=True)

BG = "#f3efe4"
INK = "#17211f"
BRAND = "#1e6274"
GOLD = "#b2812d"
LINE = "#d4ccbc"

try:
    DISPLAY = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 64)
    DISPLAY_SMALL = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", 47)
    BODY = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 27)
    MONO = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 21)
except OSError:
    DISPLAY = DISPLAY_SMALL = BODY = MONO = ImageFont.load_default()


def wrap(draw, text, font, width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if draw.textbbox((0, 0), candidate, font=font)[2] <= width:
            current = candidate
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines


def lens(draw, center, radius):
    x, y = center
    draw.ellipse((x-radius, y-radius, x+radius, y+radius), outline=BRAND, width=5)
    draw.ellipse((x-radius*0.45, y-radius*0.45, x+radius*0.45, y+radius*0.45), outline=BRAND, width=4)
    for dx, dy in [(0,-1),(0,1),(-1,0),(1,0),(-.7,-.7),(.7,.7),(.7,-.7),(-.7,.7)]:
        x1, y1 = x + dx*radius*.63, y + dy*radius*.63
        x2, y2 = x + dx*radius*.94, y + dy*radius*.94
        draw.line((x1,y1,x2,y2), fill=GOLD, width=4)


def og(filename, title, subtitle, label="QAZAQ LENS"):
    im = Image.new("RGB", (1200, 630), BG)
    d = ImageDraw.Draw(im)
    d.rectangle((0,0,1200,14), fill=BRAND)
    d.text((70,60), label, font=MONO, fill=BRAND)
    lens(d, (1015, 148), 82)
    font = DISPLAY if len(title) < 42 else DISPLAY_SMALL
    y = 150
    for line in wrap(d, title, font, 840):
        d.text((70,y), line, font=font, fill=INK)
        y += font.size + 8
    y += 16
    for line in wrap(d, subtitle, BODY, 900):
        d.text((70,y), line, font=BODY, fill="#5f6e68")
        y += 38
    d.line((70,545,1130,545), fill=LINE, width=2)
    d.text((70,570), "SOURCED · TRANSPARENT · CORRECTABLE", font=MONO, fill=GOLD)
    im.save(OG / filename, quality=95)


def icon(size):
    im = Image.new("RGB", (size,size), BRAND)
    d = ImageDraw.Draw(im)
    pad = int(size*.17)
    d.ellipse((pad,pad,size-pad,size-pad), outline="#ffffff", width=max(4,size//35))
    inner = int(size*.34)
    d.ellipse((inner,inner,size-inner,size-inner), outline="#ffffff", width=max(4,size//40))
    c=size/2; r=size*.33
    for dx,dy in [(0,-1),(0,1),(-1,0),(1,0),(-.7,-.7),(.7,.7),(.7,-.7),(-.7,.7)]:
        d.line((c+dx*r*.65,c+dy*r*.65,c+dx*r,c+dy*r),fill=GOLD,width=max(3,size//48))
    im.save(ICONS / f"icon-{size}.png")

og("default.png", "See Kazakhstan beyond the shortcut.", "Independent, sourced cultural context for international readers.")
og("borat.png", "Borat Is Fiction, Not Kazakhstan", "Why a British satirical character is not evidence about Kazakh culture.")
og("part-of-russia.png", "Kazakhstan Is Not Part of Russia", "Sovereignty, independence and the history behind a common confusion.")
og("kazakh-and-russian.png", "Kazakh and Russian Are Different Languages", "Different language families, different legal roles, one multilingual country.")
og("yurts.png", "Most Kazakhstanis Do Not Live in Yurts", "Living heritage is not the same as everyday housing.")
og("only-steppe.png", "Kazakhstan Is More Than Steppe and Desert", "Mountains, lakes, wetlands, forests, cities—and vast open land.")
icon(192)
icon(512)
print("Generated OG images and PWA icons")
