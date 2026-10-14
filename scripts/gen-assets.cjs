// Genera icone e immagine di avvio dell'app (il bilanciere con i dischi colorati).
// Uso: npm i --no-save sharp && node scripts/gen-assets.cjs
const sharp = require('sharp');
const path = require('path');
const out = (f) => path.join(__dirname, '..', 'assets', f);

const PLATES = ['#D92D20', '#2F6FED', '#F2B705', '#2FA84F'];
const SIDE = [[10, 62], [10, 50], [9, 38], [8, 30]]; // larghezza, altezza dei dischi (dal più grande, vicino al centro)

function barbell(size, k, bg, bar = '#B8B8C0') {
  const g = 3, collarW = 8, collarH = 18, center = 56;
  const half = SIDE.reduce((a, [w]) => a + w, 0) + g * (SIDE.length - 1) + collarW + center / 2;
  const cx = size / 2, cy = size / 2;
  const parts = [];
  for (const dir of [-1, 1]) {
    let x = center / 2 + collarW;
    parts.push(`<rect x="${cx + (dir < 0 ? -(center / 2 + collarW) * k : center / 2 * k)}" y="${cy - collarH * k / 2}" width="${collarW * k}" height="${collarH * k}" rx="${2 * k}" fill="${bar}"/>`);
    SIDE.forEach(([w, h], i) => {
      const x0 = dir < 0 ? cx - x * k - w * k : cx + x * k;
      parts.push(`<rect x="${x0}" y="${cy - h * k / 2}" width="${w * k}" height="${h * k}" rx="${3 * k}" fill="${PLATES[i]}"/>`);
      x += w + g;
    });
    const end = x - g; // fine dei dischi
    parts.push(`<rect x="${cx + (dir < 0 ? -(end + 6) * k : end * k)}" y="${cy - 3.5 * k}" width="${6 * k}" height="${7 * k}" fill="${bar}"/>`);
  }
  parts.push(`<rect x="${cx - center / 2 * k}" y="${cy - 3.5 * k}" width="${center * k}" height="${7 * k}" fill="${bar}"/>`);
  const bgRect = bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : '';
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bgRect}${parts.join('')}</svg>`);
}

(async () => {
  await sharp(barbell(1024, 4.6, '#0A0A0B')).png().toFile(out('icon.png'));
  await sharp(barbell(1024, 3.3, null)).png().toFile(out('adaptive-icon.png'));   // sfondo #0A0A0B impostato in app.json
  await sharp(barbell(1024, 3.0, null)).png().toFile(out('splash-icon.png'));
  await sharp(barbell(1024, 4.6, '#0A0A0B')).resize(96, 96).png().toFile(out('favicon.png'));
  console.log('Icone create in assets/');
})();
