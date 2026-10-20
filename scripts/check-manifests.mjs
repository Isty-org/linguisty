/** @spec spec://modules/platform/INFRA-001-extension#acceptance */
import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const requiredPermissions = ['activeTab', 'scripting', 'storage', 'declarativeNetRequestWithHostAccess'];
const optionalOrigins = ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*', 'http://[::1]/*'];
const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const maxFiles = 10_000;
const maxFileBytes = 16 * 1024 * 1024;
const maxTextBytes = 64 * 1024 * 1024;

async function collectFiles(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      const stat = await lstat(absolute);
      if (stat.isSymbolicLink()) throw new Error('Package contains a symbolic link.');
      if (stat.isDirectory()) await visit(absolute);
      else if (stat.isFile()) {
        if (files.length >= maxFiles) throw new Error('Package exceeded the 10,000-file inspection bound.');
        if (stat.size > maxFileBytes) throw new Error('Package exceeded the 16 MiB per-file inspection bound.');
        files.push({ absolute, relative: path.relative(root, absolute).split(path.sep).join('/'), bytes: stat.size });
      }
    }
  }
  await visit(root);
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

function validateCsp(csp, fail) {
  if (typeof csp !== 'string') return fail('CSP: extension_pages must be an explicit policy.');
  const directives = new Map();
  for (const part of csp.split(';').map(value => value.trim()).filter(Boolean)) {
    const [name, ...values] = part.split(/\s+/);
    if (directives.has(name)) fail(`CSP: duplicate ${name} directive.`);
    directives.set(name, values);
  }
  for (const name of ['script-src', 'object-src']) {
    const values = directives.get(name);
    if (!values || values.length !== 1 || values[0] !== "'self'") fail(`CSP: ${name} must allow only 'self'.`);
  }
  for (const name of ['script-src-elem', 'script-src-attr', 'default-src']) {
    const values = directives.get(name);
    if (values && values.some(value => !["'self'", "'none'"].includes(value))) fail(`CSP: ${name} contains an unsafe source.`);
  }
}

function attributes(tag) {
  return new Map([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)]
    .map(match => [match[1].toLowerCase(), match[2] ?? match[3] ?? match[4]]));
}

/** @spec spec://common/PROP-002-quality#checks */
export async function inspectBuild(buildRoot, browserName) {
  const errors = [];
  const fail = message => errors.push(message);
  let files;
  let manifest;
  try {
    files = await collectFiles(buildRoot);
    manifest = JSON.parse(await readFile(path.join(buildRoot, 'manifest.json'), 'utf8'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) throw new Error('Invalid manifest object.');
  } catch (error) {
    return { browser: browserName, ok: false, files: 0, bytes: 0, errors: [error.code === 'ENOENT' ? 'Build/manifest is missing; run the production build first.' : 'Build/manifest cannot be inspected safely.'] };
  }
  const available = new Set(files.map(file => file.relative));
  const referenced = new Set();
  function asset(reference, from = 'manifest.json') {
    if (typeof reference !== 'string' || !reference || /[\\?#\0]/.test(reference) || reference.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(reference)) {
      fail(`${from}: invalid packaged asset reference.`);
      return;
    }
    const relative = path.posix.normalize(reference.startsWith('/') ? reference.slice(1)
      : path.posix.join(path.posix.dirname(from), reference));
    if (relative === '..' || relative.startsWith('../')) {
      fail(`${from}: packaged asset escapes the build.`);
      return;
    }
    if (!available.has(relative)) fail(`${from}: missing asset ${relative}.`);
    else referenced.add(relative);
  }

  if (manifest.manifest_version !== 3) fail('manifest_version must be 3.');
  if (manifest.name !== 'Linguisty') fail('name must be Linguisty.');
  if (manifest.action?.default_title !== 'Linguisty') fail('action.default_title must be Linguisty.');
  if (!/^\d+(?:\.\d+){0,3}$/.test(manifest.version ?? '')) fail('Invalid extension version.');
  const permissions = manifest.permissions;
  if (!Array.isArray(manifest.optional_permissions) || manifest.optional_permissions.length !== 1
    || manifest.optional_permissions[0] !== 'nativeMessaging') fail('Optional permissions must be exactly nativeMessaging.');
  if (!Array.isArray(permissions) || requiredPermissions.some(value => !permissions.includes(value)) || permissions.some(value => !requiredPermissions.includes(value)) || new Set(permissions).size !== permissions.length) fail('Required permissions must be exactly activeTab, scripting, storage, declarativeNetRequestWithHostAccess.');
  if (manifest.host_permissions !== undefined && (!Array.isArray(manifest.host_permissions) || manifest.host_permissions.length)) fail('Mandatory host_permissions are forbidden.');
  const optional = manifest.optional_host_permissions;
  if (!Array.isArray(optional) || optionalOrigins.some(value => !optional.includes(value)) || optional.some(value => !optionalOrigins.includes(value)) || new Set(optional).size !== optional.length) fail('optional_host_permissions must contain HTTPS and loopback HTTP only.');
  if (Array.isArray(manifest.content_scripts) && manifest.content_scripts.length) fail('Persistent content_scripts are forbidden; translate.js must be injected on demand.');
  if (manifest.externally_connectable) fail('externally_connectable is forbidden.');
  if (manifest.content_security_policy?.sandbox || manifest.sandbox) fail('Sandbox execution is outside the v1 package contract.');
  validateCsp(manifest.content_security_policy?.extension_pages, fail);

  const background = manifest.background;
  if (browserName === 'chrome') {
    if (typeof background?.service_worker !== 'string' || background.scripts || background.page || background.persistent !== undefined) fail('Chrome requires a service worker without scripts/page/persistent.');
    else asset(background.service_worker);
    if (!/^\d+(?:\.\d+)*$/.test(manifest.minimum_chrome_version ?? '') || Number.parseInt(manifest.minimum_chrome_version, 10) < 120) fail('Chrome minimum version must be >=120.');
  } else if (browserName === 'firefox') {
    if (!Array.isArray(background?.scripts) || !background.scripts.length || background.service_worker || background.page || background.persistent === true) fail('Firefox requires nonpersistent background scripts without service_worker.');
    else background.scripts.forEach(value => asset(value));
    const gecko = manifest.browser_specific_settings?.gecko;
    if (gecko?.id !== 'linguisty@isty.local' || !/^\d+(?:\.\d+)*$/.test(gecko?.strict_min_version ?? '') || Number.parseInt(gecko?.strict_min_version, 10) < 142) fail('Firefox requires the Linguisty gecko ID and minimum version >=142.');
    if (manifest.browser_specific_settings?.gecko_android !== undefined) fail('Firefox Android compatibility is outside the desktop-only v1 contract.');
    const requiredData = gecko?.data_collection_permissions?.required;
    if (!Array.isArray(requiredData) || ['websiteContent', 'browsingActivity', 'authenticationInfo'].some(value => !requiredData.includes(value)) || requiredData.includes('none')) fail('Firefox must declare websiteContent, browsingActivity, authenticationInfo provider data consent.');
  } else fail('Unknown browser package.');
  if (!manifest.action?.default_popup) fail('Popup entrypoint is missing.');
  else asset(manifest.action.default_popup);
  const optionsPage = manifest.options_ui?.page ?? manifest.options_page;
  if (!optionsPage) fail('Options entrypoint is missing.');
  else asset(optionsPage);
  asset('translate.js');
  // @spec spec://modules/platform/INFRA-004-codex-connection#auth
  asset('codex.html'); asset('codex-callback.html');
  const accessible = manifest.web_accessible_resources;
  const callbackOrigins = ['http://127.0.0.1/*', 'https://auth.openai.com/*'];
  if (!Array.isArray(accessible) || accessible.length !== 1 || accessible[0]?.resources?.length !== 1
    || accessible[0].resources[0] !== 'codex-callback.html' || accessible[0]?.matches?.length !== callbackOrigins.length
    || callbackOrigins.some(origin => !accessible[0].matches.includes(origin)) || accessible[0].extension_ids || accessible[0].use_dynamic_url === true) {
    fail('Only codex-callback.html may be web-accessible, from the exact loopback and OpenAI auth origins.');
  }

  for (const size of [16, 32, 48, 128]) {
    const reference = manifest.icons?.[size];
    asset(reference);
    if (typeof reference === 'string' && available.has(reference)) {
      const data = await readFile(path.join(buildRoot, reference));
      if (data.length < 33 || !data.subarray(0, 8).equals(pngSignature) || data.toString('ascii', 12, 16) !== 'IHDR' || data.readUInt32BE(16) !== size || data.readUInt32BE(20) !== size) fail(`icon ${size}: PNG dimensions/signature are invalid.`);
    }
  }

  let inspectedTextBytes = 0;
  for (const file of files) {
    if (/(?:^|\/)(?:\.env(?:\..*)?|id_rsa|.*\.(?:pem|key))$/i.test(file.relative)) fail(`${file.relative}: secret-bearing filename in package.`);
    if (file.relative.endsWith('.map')) fail(`${file.relative}: source map included in production package.`);
    if (!/\.(?:js|mjs|html|css|json|svg|txt)$/i.test(file.relative)) continue;
    inspectedTextBytes += file.bytes;
    if (inspectedTextBytes > maxTextBytes) { fail('Package exceeded the 64 MiB text inspection bound.'); break; }
    const source = await readFile(file.absolute, 'utf8');
    // Report only filenames/pattern labels; never print a suspected credential.
    if (/\bsk-or-v1-[a-z\d]{24,}\b/i.test(source) || /\bsk-[a-z\d_-]{24,}\b/i.test(source) || /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(source) || /(?:apiKey|api_key|Authorization)\s*[:=]\s*["'](?:Bearer\s+)?[^"'\s]{24,}["']/i.test(source)) fail(`${file.relative}: possible hardcoded credential (value withheld).`);
    if (/@vite\/client|vite-hmr|__vite_plugin_react_preamble_installed__|wxt:dev|ws:\/\/(?:localhost|127\.0\.0\.1)/i.test(source)) fail(`${file.relative}: development runtime marker.`);

    if (/\.html$/i.test(file.relative)) {
      for (const match of source.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)) {
        const tag = match[1].toLowerCase();
        const attrs = attributes(match[0]);
        if ([...attrs.keys()].some(name => /^on[a-z]+$/.test(name))) fail(`${file.relative}: inline event handler.`);
        const reference = attrs.get('src') ?? (tag === 'link' ? attrs.get('href') : undefined);
        if (reference && (tag === 'script' || !reference.startsWith('data:'))) asset(reference, file.relative);
      }
      for (const match of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
        const attrs = attributes(match[1]);
        if (!attrs.has('src') && match[2].trim() && !['application/json', 'application/ld+json'].includes(attrs.get('type'))) fail(`${file.relative}: inline executable script.`);
      }
    }
    if (/\.(?:js|mjs)$/i.test(file.relative)) {
      for (const match of source.matchAll(/\b(?:import\s*(?:[^;"']*?\sfrom\s*)?|export\s+[^;"']*?\sfrom\s*|import\s*\()(["'])([^"']+)\1/g)) {
        if (match[2].startsWith('.') || match[2].startsWith('/')) asset(match[2], file.relative);
        else fail(`${file.relative}: nonpackaged module import.`);
      }
    }
    if (/\.css$/i.test(file.relative)) {
      for (const match of source.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) {
        const reference = match[1].trim();
        if (!reference.startsWith('data:') && !reference.startsWith('#')) asset(reference, file.relative);
      }
      if (/@import\s+(?:url\()?\s*["']?(?:https?:)?\/\//i.test(source)) fail(`${file.relative}: remote stylesheet/font import.`);
    }
  }
  return { browser: browserName, ok: errors.length === 0, files: files.length, bytes: files.reduce((sum, file) => sum + file.bytes, 0), assets: referenced.size, largest: [...files].sort((a, b) => b.bytes - a.bytes).slice(0, 6).map(({ relative: file, bytes }) => ({ file, bytes })), errors };
}

export async function checkManifests(outputRoot = path.join(projectRoot, '.output')) {
  const builds = [];
  for (const browserName of ['chrome', 'firefox']) builds.push(await inspectBuild(path.join(outputRoot, `${browserName}-mv3`), browserName));
  return { ok: builds.every(build => build.ok), builds };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const rootIndex = process.argv.indexOf('--output-root');
  const report = await checkManifests(rootIndex < 0 ? undefined : path.resolve(process.argv[rootIndex + 1] ?? '.output'));
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else for (const build of report.builds) {
    console.log(`${build.browser}: ${build.ok ? 'PASS' : 'FAIL'}; ${build.files} files; ${build.bytes} bytes; ${build.assets ?? 0} referenced assets`);
    for (const entry of build.largest ?? []) console.log(`  ${entry.file}: ${entry.bytes} bytes`);
    for (const error of build.errors) console.error(`  ${error}`);
  }
  process.exitCode = report.ok ? 0 : 1;
}
