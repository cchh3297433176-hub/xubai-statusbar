import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const names = (await readdir(path.join(root, 'src'))).filter(n => n.endsWith('.part.js')).sort();
const parts = await Promise.all(names.map(n => readFile(path.join(root, 'src', n), 'utf8')));
await writeFile(path.join(root, 'index.js'), parts.join(''));
console.log(`Built ${names.length} parts`);
