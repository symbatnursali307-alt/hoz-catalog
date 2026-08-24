import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'public', 'company-logo-original.jpg');

await Promise.all([
  sharp(source).resize(192, 192, { fit: 'contain', background: '#ffffff' }).png().toFile(path.join(root, 'public', 'pwa-icon-192.png')),
  sharp(source).resize(512, 512, { fit: 'contain', background: '#ffffff' }).png().toFile(path.join(root, 'public', 'pwa-icon-512.png')),
  sharp(source).resize(410, 410, { fit: 'contain', background: '#ffffff' }).extend({
    top: 51,
    bottom: 51,
    left: 51,
    right: 51,
    background: '#ffffff',
  }).png().toFile(path.join(root, 'public', 'pwa-icon-maskable-512.png')),
]);

console.log('Generated PWA icons: 192, 512 and maskable 512');
