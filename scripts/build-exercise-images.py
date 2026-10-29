#!/usr/bin/env python3
"""Prepara le foto degli esercizi (illustrazioni Everkinetic, licenza CC BY-SA) per l'app.

Uso:  EVERKINETIC_DIR=/percorso/everkinetic/data python3 scripts/build-exercise-images.py

Legge supabase/seed/exercises.json, prende gli esercizi con «library_image» (codice a 4 cifre di Everkinetic) e per
ciascuno crea due immagini quadrate in assets/exercises/ (<id>-1.webp = posizione di partenza, <id>-2.webp = arrivo):
  - ritaglio dei margini bianchi, stessa scala per le due immagini (il movimento resta leggibile)
  - centrate su fondo bianco 480×480, WebP qualità 70, scala di grigi
Poi genera src/exerciseImages.ts (mappa codice -> immagini; richiede Pillow).
Le immagini sono opere derivate (ridimensionate e ricentrate): restano sotto CC BY-SA, vedi assets/exercises/LICENSE.md.
"""
import json, os, sys
from PIL import Image, ImageChops

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EK = os.environ.get('EVERKINETIC_DIR')
if not EK or not os.path.isdir(EK):
    sys.exit('Imposta EVERKINETIC_DIR sulla cartella «data» del progetto Everkinetic.')
N, PAD = 480, 0.06

seed = json.load(open(os.path.join(ROOT, 'supabase/seed/exercises.json'), encoding='utf8'))
ids = sorted({e['library_image'] for e in seed if e.get('library_image')})
site = {r['id_num']: r for r in json.load(open(os.path.join(EK, 'exercises.json'), encoding='utf8'))}

def sources(i):
    a = os.path.join(EK, 'src/exercises', i, f'{i}-relaxation.png')
    b = os.path.join(EK, 'src/exercises', i, f'{i}-tension.png')
    if os.path.exists(a) and os.path.exists(b):
        return a, b
    r = site.get(i)
    if r:
        p = [os.path.join(EK, 'src/images-web', os.path.basename(x)) for x in r.get('img', [])]
        if len(p) >= 2 and all(os.path.exists(x) for x in p[:2]):
            return p[0], p[1]
    return None

def load(p):
    im = Image.open(p)
    if im.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGBA', im.size, (255, 255, 255, 255))
        bg.alpha_composite(im.convert('RGBA'))
        im = bg
    return im.convert('L')

out = os.path.join(ROOT, 'assets/exercises')
os.makedirs(out, exist_ok=True)
for f in os.listdir(out):
    if f.endswith('.webp'):
        os.remove(os.path.join(out, f))
entries = []
for i in ids:
    s = sources(i)
    if not s:
        sys.exit(f'Immagini mancanti per {i}')
    ims = [load(p) for p in s]
    crops, areas = [], []
    for im in ims:
        bbox = ImageChops.invert(im).point(lambda v: 255 if v > 40 else 0).getbbox() or (0, 0) + im.size
        c = im.crop(bbox)
        crops.append(c)
        areas.append(c.size[0] * c.size[1])
    sc = (N * (1 - 2 * PAD)) / max(max(c.size[0] for c in crops), max(c.size[1] for c in crops))
    for k, c in enumerate(crops):
        w, h = max(1, round(c.size[0] * sc)), max(1, round(c.size[1] * sc))
        can = Image.new('L', (N, N), 255)
        can.paste(c.resize((w, h), Image.LANCZOS), ((N - w) // 2, (N - h) // 2))
        can.save(os.path.join(out, f'{i}-{k + 1}.webp'), 'WEBP', quality=70, method=6)
    # miniatura: la posa in cui la figura è intera (nei squat la prima è spesso tagliata)
    entries.append((i, 2 if areas[1] > 1.35 * areas[0] else 1))

lines = [
    '// FILE GENERATO da scripts/build-exercise-images.py: non modificare a mano.',
    '// Illustrazioni degli esercizi © Everkinetic (everkinetic.com), licenza CC BY-SA: vedi assets/exercises/LICENSE.md.',
    '',
    'export type ExerciseImage = number | { uri: string }; // require() di un file locale',
    'export type ExerciseImages = { start: ExerciseImage; end: ExerciseImage; thumb: 1 | 2 };',
    '',
    'export const EXERCISE_IMAGES: Record<string, ExerciseImages> = {',
]
for i, t in entries:
    lines.append(f"  '{i}': {{ start: require('../assets/exercises/{i}-1.webp'), end: require('../assets/exercises/{i}-2.webp'), thumb: {t} }},")
lines.append('};')
open(os.path.join(ROOT, 'src/exerciseImages.ts'), 'w', encoding='utf8').write('\n'.join(lines) + '\n')
size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out) if f.endswith('.webp'))
print(f'{len(entries)} esercizi con foto, {len(entries) * 2} immagini, {size // 1024} KB')
