import { afterEach, describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const { patchCamera, changes } = require('../dcm-mobile/scripts/patch-camera.cjs');
const copies: string[] = [];
const paths: string[] = [...new Set<string>(changes().map(([name]: string[]) => name))];

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'dcm-camera-patch-'));
  copies.push(directory);
  writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '17.0.10' }));
  for (const name of paths) {
    mkdirSync(dirname(join(directory, name)), { recursive: true });
    writeFileSync(join(directory, name), readFileSync(resolve('dcm-mobile/node_modules/expo-camera', name)));
  }
  return directory;
}
// Delete only exact temp directories created by this test, never installed dependencies.
afterEach(() => {
  for (const directory of copies.splice(0)) {
    if (resolve(dirname(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('dcm-camera-patch-')) throw new Error('Unexpected cleanup target');
    rmSync(directory, { recursive: true, force: true });
  }
});

describe('pinned Expo native camera patch', () => {
  it('applies the complete patch and is idempotent', () => {
    const directory = fixture();
    expect(patchCamera(directory)).toEqual(paths);
    const first = paths.map(name => readFileSync(join(directory, name), 'utf8'));
    expect(patchCamera(directory, true)).toEqual(paths);
    patchCamera(directory);
    expect(paths.map(name => readFileSync(join(directory, name), 'utf8'))).toEqual(first);
  });
  it('refuses an upstream version change before writing anything', () => {
    const directory = fixture();
    writeFileSync(join(directory, 'package.json'), JSON.stringify({ version: '17.0.11' }));
    const before = paths.map(name => readFileSync(join(directory, name), 'utf8'));
    expect(() => patchCamera(directory)).toThrow('requires expo-camera 17.0.10');
    expect(paths.map(name => readFileSync(join(directory, name), 'utf8'))).toEqual(before);
  });
  it('validates all anchors before changing any native file', () => {
    const directory = fixture();
    const last = paths.at(-1)!;
    writeFileSync(join(directory, last), 'changed upstream source');
    const before = paths.map(name => readFileSync(join(directory, name), 'utf8'));
    expect(() => patchCamera(directory)).toThrow('refusing partial patch');
    expect(paths.map(name => readFileSync(join(directory, name), 'utf8'))).toEqual(before);
  });
});
