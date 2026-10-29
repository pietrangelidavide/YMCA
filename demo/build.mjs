// Costruisce la demo web di YMCA Prime Training in demo/dist (solo file statici, con dati finti al posto di Supabase).
// Uso: cd demo && npm install && node build.mjs
import { build } from 'esbuild';
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const R = (f) => path.join(here, f);
const dist = R('dist');
rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// L'app vera usa react-native, Expo e Supabase: nella demo sono sostituiti da versioni leggere per il browser.
const shim = {
  'react-native': R('shim/rn.tsx'),
  'react-native-safe-area-context': R('shim/misc.tsx'),
  'expo-status-bar': R('shim/misc.tsx'),
  '@expo/vector-icons': R('shim/misc.tsx'),
  'expo-linear-gradient': R('shim/misc.tsx'),
  'expo-blur': R('shim/misc.tsx'),
  'expo-image-picker': R('shim/misc.tsx'),
  'expo-document-picker': R('shim/misc.tsx'),
  'expo-font': R('shim/misc.tsx'),
  '@react-native-async-storage/async-storage': R('shim/storage.ts'),
};
const plugin = {
  name: 'shim',
  setup(b) {
    b.onResolve({ filter: /.*/ }, (a) => {
      if (shim[a.path]) return { path: shim[a.path] };
      if (/^@expo-google-fonts\//.test(a.path)) return { path: R('shim/fonts.js') };
      if (/lib\/supabase$/.test(a.path)) return { path: R('mock/supabase.ts') };
      if (/lib\/push$/.test(a.path)) return { path: R('mock/push.ts') };
      if (a.path === 'expo-glass-effect' || a.path === 'expo-system-ui') return { path: R('shim/absent.js') };
      return null;
    });
  },
};

await build({
  entryPoints: [R('entry.tsx')],
  bundle: true,
  outfile: path.join(dist, 'app.js'),
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  jsx: 'automatic',
  loader: { '.png': 'dataurl', '.jpg': 'dataurl', '.webp': 'file' },
  assetNames: 'img/[name]-[hash]',
  publicPath: '.',
  plugins: [plugin],
  nodePaths: [R('node_modules')],
  define: { 'process.env.NODE_ENV': '"production"' },
  minify: process.env.DEMO_DEBUG ? false : true,
  logLevel: 'warning',
});

writeFileSync(
  path.join(dist, 'index.html'),
  `<!doctype html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<meta name="theme-color" content="#0A0A0B">
<title>YMCA Prime Training · demo</title>
<link rel="icon" href="favicon.png">
<link rel="apple-touch-icon" href="icon.png">
</head>
<body>
<div id="root"></div>
<script src="app.js"></script>
</body>
</html>
`,
);
copyFileSync(R('../assets/favicon.png'), path.join(dist, 'favicon.png'));
copyFileSync(R('../assets/icon.png'), path.join(dist, 'icon.png'));
// La demo non deve comparire su Google.
writeFileSync(path.join(dist, '_headers'), '/*\n  X-Robots-Tag: noindex, nofollow\n');
writeFileSync(path.join(dist, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
console.log('Demo pronta in demo/dist');
