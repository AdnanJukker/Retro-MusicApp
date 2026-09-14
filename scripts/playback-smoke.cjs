// Run against local FastAPI or Render. Uses the actual frontend provider and
// reads at most 128 KiB per song, plus a 4 KiB seek. Never saves audio or URLs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const base = (process.argv[2] || 'http://127.0.0.1:8765').replace(/\/+$/, '');
process.env.EXPO_PUBLIC_STREAM_RESOLVER_URL = base;
const modules = new Map();
function load(name) {
  if (!name.startsWith('@/')) return require(name);
  if (modules.has(name)) return modules.get(name).exports;
  const filename = path.join(__dirname, '../src', name.slice(2) + '.ts');
  const output = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  modules.set(name, module);
  new Function('require', 'module', 'exports', '__DEV__', output)(load, module, module.exports, false);
  return module.exports;
}

async function range(url, start, end) {
  const response = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}`, Origin: 'http://localhost:8081' },
    signal: AbortSignal.timeout(55000),
  });
  if (response.status !== 206) {
    await response.body.cancel();
    throw new Error(`Media request failed: HTTP ${response.status}`);
  }
  assert.match(response.headers.get('content-type'), /audio\/(mp4|mpeg|aac)/);
  assert.match(response.headers.get('content-range'), new RegExp(`^bytes ${start}-${end}/`));
  assert.equal(response.headers.get('access-control-allow-origin'), '*');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (size <= end - start) {
      const part = await reader.read();
      if (part.done) break;
      chunks.push(part.value);
      size += part.value.length;
    }
  } finally { await reader.cancel(); }
  assert.equal(size, end - start + 1);
  return Buffer.concat(chunks);
}

async function main() {
  const health = await fetch(`${base}/health`, { signal: AbortSignal.timeout(90000) });
  const readiness = await health.json();
  console.log('health', health.status, 'musicApiVersion', readiness.musicApiVersion, 'providerAvailable', readiness.providerAvailable);
  assert.equal(readiness.musicApiVersion, 1, 'Deploy the updated server before testing this client.');
  const service = load('@/services/musicService');
  for (const query of ['Besharam Rang', 'Tum Hi Ho', 'Kesariya']) {
    const tracks = await service.searchTracks(query);
    assert.ok(tracks.length, `No results for ${query}`);
    const track = tracks.find((item) => item.title.toLowerCase() === query.toLowerCase());
    assert.ok(track, `Exact song title missing for ${query}`);
    const url = await service.getStreamUrlCached(track.id);
    assert.ok(url.startsWith(`${base}/music/stream/`));
    const bytes = await range(url, 0, 131071);
    assert.equal(bytes.toString('ascii', 4, 8), 'ftyp');
    assert.ok(bytes.includes(Buffer.from('mp4a')), 'AAC sample description missing');
    await range(url, 262144, 266239);
    console.log(`PASS ${track.title} id=${track.id} duration=${track.duration}s resolve=200 media=206 codec=AAC seek=206`);
  }
  for (const [id, expected] of [['invalid', 400], ['ZZZZZZZZ', 404]]) {
    const response = await fetch(`${base}/music/resolve/${id}`, { signal: AbortSignal.timeout(55000) });
    assert.equal(response.status, expected);
    console.log(`PASS ${id} status=${response.status}`);
  }
}
main().catch((error) => { console.error('FAIL', error.message); process.exitCode = 1; });
