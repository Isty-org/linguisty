/** @spec spec://modules/platform/INFRA-001-extension#build */
import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const destination = fileURLToPath(new URL('../public/icon/', import.meta.url));
// The user's Linguisty geometry and colors are preserved; a dark tile keeps toolbar contrast.
const logo = await readFile(new URL('../public/brand/linguisty-color.svg', import.meta.url), 'utf8');
const viewBox = '176 169 940 940';
if (!logo.includes(`viewBox="${viewBox}"`) || /<(?:script|image|foreignObject)\b|\bon\w+\s*=|(?:href|src)\s*=/i.test(logo)) throw new Error('Unexpected or active logo source.');
const paths = [...logo.matchAll(/<path\b[^>]*\/>/g)].map(match => match[0]);
if (paths.length !== 9) throw new Error('Unexpected Linguisty logo geometry.');
const mark = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect x="1" y="1" width="126" height="126" rx="14" fill="#121018"/><svg width="128" height="128" viewBox="${viewBox}">${paths.join('')}</svg></svg>`);
await mkdir(destination, { recursive: true });
for (const size of [16, 32, 48, 128]) {
  const output = new URL(`../public/icon/${size}.png`, import.meta.url);
  await sharp(mark, { density: 384 }).resize(size, size).png({ compressionLevel: 9 }).toFile(fileURLToPath(output));
  const metadata = await sharp(fileURLToPath(output)).metadata();
  if (metadata.width !== size || metadata.height !== size || metadata.format !== 'png') throw new Error(`Invalid ${size}px icon.`);
  console.log(`icon/${size}.png: ${size} x ${size} PNG`);
}
