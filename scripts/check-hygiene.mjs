/** @spec spec://common/PROP-002-quality#hygiene */
import { readdir, lstat, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const maxEntries = 150_000;
const maxHashFileBytes = 1024 * 1024;
const maxHashTotalBytes = 32 * 1024 * 1024;
const generated = ['node_modules', '.wxt', '.output', 'coverage', 'test-results', 'playwright-report', '.cache', 'output/playwright'];

async function inspectTree(root, limit = maxEntries) {
  const result = { exists: true, files: 0, bytes: 0, entries: 0, symlinksSkipped: 0, truncated: false, changedDuringScan: 0 };
  const files = [];
  async function visit(directory) {
    let entries;
    try { entries = await readdir(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') { result.changedDuringScan++; return; } throw error; }
    for (const entry of entries) {
      if (result.entries >= limit) { result.truncated = true; return; }
      result.entries++;
      const absolute = path.join(directory, entry.name);
      let stat;
      try { stat = await lstat(absolute); }
      catch (error) { if (error.code === 'ENOENT') { result.changedDuringScan++; continue; } throw error; }
      if (stat.isSymbolicLink()) result.symlinksSkipped++;
      else if (stat.isDirectory()) await visit(absolute);
      else if (stat.isFile()) {
        result.files++;
        result.bytes += stat.size;
        files.push({ absolute, file: path.relative(root, absolute).split(path.sep).join('/'), bytes: stat.size });
      }
    }
  }
  try {
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) return { ...result, filesList: [], error: 'NOT_A_REGULAR_DIRECTORY' };
    await visit(root);
  }
  catch (error) {
    if (error.code === 'ENOENT') return { ...result, exists: false, filesList: [] };
    return { ...result, filesList: [], error: error.code ?? 'IO_ERROR' };
  }
  return { ...result, filesList: files };
}

/** Reports measurements only; this command never deletes caches or terminates processes. */
export async function checkHygiene(root = projectRoot) {
  const folders = [];
  for (const relative of generated) {
    const { filesList: _files, ...measurement } = await inspectTree(path.join(root, relative));
    folders.push({ path: relative, ...measurement });
  }
  const sourceFiles = [];
  const sourceRoots = ['src', 'entrypoints', 'scripts', 'tests', 'public', 'native-host'];
  for (const relative of sourceRoots) {
    const measurement = await inspectTree(path.join(root, relative), 10_000);
    sourceFiles.push(...measurement.filesList.map(file => ({ ...file, file: `${relative}/${file.file}` })));
    if (measurement.truncated || measurement.error) folders.push({ path: relative, ...measurement, filesList: undefined });
  }
  const groups = new Map();
  const suspicious = [];
  let hashedBytes = 0;
  let hashSkipped = 0;
  for (const file of sourceFiles) {
    if (/(?:^|\/)(?:[^/]*(?:\.bak|\.orig|\.tmp|\.tsbuildinfo)|.*(?:[ -]copy|[ -]копия)(?:\.[^/]+)?|\.DS_Store|Thumbs\.db)$/i.test(file.file)) suspicious.push(file.file);
    if (!/\.(?:[cm]?[jt]sx?|css|html|svg)$/i.test(file.file) || file.bytes < 80) continue;
    if (file.bytes > maxHashFileBytes || hashedBytes + file.bytes > maxHashTotalBytes) { hashSkipped++; continue; }
    let data;
    try { data = await readFile(file.absolute); }
    catch (error) { if (error.code === 'ENOENT') { hashSkipped++; continue; } throw error; }
    hashedBytes += data.length;
    const key = createHash('sha256').update(data).digest('hex');
    const group = groups.get(key) ?? [];
    group.push(file.file);
    groups.set(key, group);
  }
  const duplicates = [...groups.values()].filter(group => group.length > 1);
  const measurementErrors = folders.filter(folder => folder.error || folder.truncated);
  return {
    ok: !measurementErrors.length && !suspicious.length && !duplicates.length && !hashSkipped,
    folders,
    sources: { files: sourceFiles.length, bytes: sourceFiles.reduce((sum, file) => sum + file.bytes, 0), hashedBytes, hashSkipped },
    suspicious,
    duplicates,
    memory: { totalSystemBytes: os.totalmem(), freeSystemBytes: os.freemem(), inspectorRssBytes: process.memoryUsage().rss, inspectorHeapBytes: process.memoryUsage().heapUsed },
    limits: { entriesPerGeneratedTree: maxEntries, maxHashFileBytes, maxHashTotalBytes },
    note: 'Filesystem/RAM snapshot only; process ownership and runtime lifecycle must be checked separately. No files or processes were removed.',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = await checkHygiene();
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else {
    for (const folder of report.folders) console.log(`${folder.path}: ${folder.files} files, ${folder.bytes} bytes${folder.exists ? '' : ' [absent]'}${folder.truncated ? ' [TRUNCATED]' : ''}${folder.error ? ` [${folder.error}]` : ''}${folder.changedDuringScan ? ' [changing during scan]' : ''}`);
    console.log(`Source: ${report.sources.files} files, ${report.sources.bytes} bytes; hash skipped: ${report.sources.hashSkipped}`);
    console.log(`RAM: ${report.memory.freeSystemBytes}/${report.memory.totalSystemBytes} bytes free; inspector RSS: ${report.memory.inspectorRssBytes} bytes`);
    for (const file of report.suspicious) console.log(`Suspicious artifact: ${file}`);
    for (const group of report.duplicates) console.log(`Identical sources (review): ${group.join(', ')}`);
    console.log(report.note);
  }
  process.exitCode = report.ok ? 0 : 1;
}
