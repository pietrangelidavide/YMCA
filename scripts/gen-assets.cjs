// Genera logo, icone e immagine di avvio dell'app a partire da assets/logo.svg (logo YMCA Prime Sport Club vettorializzato).
// Uso: npm i --no-save sharp && node scripts/gen-assets.cjs
// Con il file vettoriale originale del logo: sostituisci assets/logo.svg (stesse proporzioni) e rilancia lo script.
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const out = (f) => path.join(__dirname, '..', 'assets', f);

const RED = '#E21D23';
const BG = '#0A0A0B';
// Triangolo del marchio (rosso con triangolo interno vuoto), nelle coordinate del logo: 89.5 × 78.3
const MARK_W = 89.5, MARK_H = 78.3;
const markPath = 'M0 0 L89.5 0 L44.75 78.3 Z M22.8 12 L66.7 12 L44.75 50.9 Z';

function markSvg(size, width, bg) {
  const k = width / MARK_W;
  const x = (size - MARK_W * k) / 2, y = (size - MARK_H * k) / 2 + size * 0.01;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}<path transform="translate(${x} ${y}) scale(${k})" fill="${RED}" fill-rule="evenodd" d="${markPath}"/></svg>`;
}

(async () => {
  const svg = fs.readFileSync(out('logo.svg'));
  await sharp(svg, { density: 72 * 4 }).png().toFile(out('logo.png'));                       // 1464 × 316, sfondo trasparente
  await sharp(Buffer.from(markSvg(1024, 600, BG))).flatten({ background: BG }).png().toFile(out('icon.png'));
  await sharp(Buffer.from(markSvg(1024, 440, null))).png().toFile(out('adaptive-icon.png'));  // marchio nella zona sicura, fondo in app.json
  await sharp(svg, { density: 72 * 4 }).png().toFile(out('splash-icon.png'));
  await sharp(Buffer.from(markSvg(48, 36, BG))).png().toFile(out('favicon.png'));
  console.log('Immagini aggiornate in assets/');
})();
