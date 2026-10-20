/** @spec spec://common/PROP-002-quality#checks */
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';

/** This helper creates and removes only its own temporary browser profile. */
export async function launchIsolatedChromium(extensionPath) {
  const profilePrefix = path.join(os.tmpdir(), 'linguisty-qa-chromium-');
  const profile = await mkdtemp(profilePrefix);
  const executablePath = process.env.LINGUISTY_CHROMIUM_EXECUTABLE || chromium.executablePath();
  let context;
  async function cleanup() {
    try { await context?.close(); }
    finally {
      const resolved = path.resolve(profile);
      assert.ok(path.dirname(resolved) === path.resolve(os.tmpdir()) && path.basename(resolved).startsWith('linguisty-qa-chromium-'), 'Refusing to remove an unowned browser profile.');
      await rm(resolved, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    }
  }
  try {
    assert.ok(existsSync(executablePath), 'Playwright bundled Chromium is absent. Coordinator must install the matching browser or explicitly set LINGUISTY_CHROMIUM_EXECUTABLE to an available isolated test runtime.');
    const args = extensionPath ? [`--disable-extensions-except=${path.resolve(extensionPath)}`, `--load-extension=${path.resolve(extensionPath)}`] : [];
    context = await chromium.launchPersistentContext(profile, {
      executablePath, channel: 'chromium', headless: true, viewport: { width: 1280, height: 800 },
      args, timeout: 20_000,
    });
    return { context, cleanup, metadata: { executablePath, version: context.browser().version(), isolatedProfile: true, headless: true } };
  } catch (error) { await cleanup(); throw error; }
}
