/** @spec spec://modules/interface/FEAT-003-controls#errors */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { test } from 'node:test';
import { expect } from '@playwright/test';
import { launchIsolatedChromium } from '../e2e/browser-runtime.mjs';

const projectRoot = fileURLToPath(new URL('../../', import.meta.url));
const artifacts = path.join(projectRoot, 'test-results/linguisty-ui-startup');

test('packaged UI recovers from a missing receiver and an unanswered read; cache does not block the form', { timeout: 30_000 }, async () => {
  let runtime;
  const observations = { checks: [], limitation: 'Transport faults injected in the test page; production package is unchanged.' };
  try {
    runtime = await launchIsolatedChromium(path.join(projectRoot, '.output/chrome-mv3'));
    observations.runtime = runtime.metadata;
    const context = runtime.context;
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker', { timeout: 10_000 });
    const origin = `chrome-extension://${new URL(worker.url()).hostname}`;
    await mkdir(artifacts, { recursive: true });
    const setup = await context.newPage();
    try {
      await setup.goto(`${origin}/options.html`);
      await setup.evaluate(async () => {
        const key = 'linguisty.settings';
        const stored = (await globalThis.chrome.storage.local.get(key))[key] ?? {};
        await globalThis.chrome.storage.local.set({ [key]: { ...stored, uiLanguage: 'ru', targetLanguage: 'ru', targetLanguageMode: 'manual' } });
        localStorage.setItem('linguisty.uiLanguage', 'ru');
      });
    } finally { await setup.close(); }

    for (const fault of ['cache-pending', 'receiver-late', 'settings-pending']) {
      const page = await context.newPage();
      try {
        await page.addInitScript(faultMode => {
          const runtime = globalThis.chrome.runtime;
          const nativeSend = runtime.sendMessage.bind(runtime);
          globalThis.qaFault = faultMode;
          globalThis.qaReads = 0;
          runtime.sendMessage = (message, ...args) => {
            if (message.type === 'GET_SETTINGS') {
              globalThis.qaReads += 1;
              if (globalThis.qaFault === 'settings-pending') return new Promise(() => {});
              if (globalThis.qaFault === 'receiver-late' && globalThis.qaReads === 1) return Promise.reject(new Error('Receiving end does not exist'));
            }
            if (message.type === 'GET_CACHE_STATS' && globalThis.qaFault === 'cache-pending') return new Promise(() => {});
            return nativeSend(message, ...args);
          };
        }, fault);
        await page.goto(`${origin}/options.html`);
        if (fault === 'settings-pending') {
          await expect(page.getByRole('button', { name: 'Повторить загрузку' })).toBeVisible({ timeout: 8_000 });
          await expect(page.getByRole('alert')).toContainText('Расширение не ответило вовремя');
          assert.equal(await page.evaluate(() => globalThis.qaReads), 1);
          await page.evaluate(() => { globalThis.qaFault = 'normal'; });
          await page.getByRole('button', { name: 'Повторить загрузку' }).click();
          await expect(page.locator('#keyMode')).toBeVisible();
          observations.checks.push('An unanswered configuration read stops after 5s, shows an error and restores the form with the retry button.');
        } else {
          await expect(page.locator('#keyMode')).toBeVisible({ timeout: 2_000 });
          if (fault === 'receiver-late') {
            assert.equal(await page.evaluate(() => globalThis.qaReads), 2);
            observations.checks.push('A missing receiver on the first read is retried once; the form loads after background startup.');
          } else {
            await expect(page.getByText('Статистика кэша пока недоступна.')).toBeVisible();
            observations.checks.push('The form opens immediately while cache statistics remain unanswered.');
          }
        }
        await page.screenshot({ path: path.join(artifacts, `${fault}.png`) });
      } finally { await page.close(); }
    }
    observations.ok = true;
  } catch (error) {
    observations.ok = false;
    observations.failure = error instanceof Error ? error.message : 'Unknown failure';
    throw error;
  } finally {
    await runtime?.cleanup();
    observations.profileRemoved = true;
    await mkdir(artifacts, { recursive: true });
    await writeFile(path.join(artifacts, 'observations.json'), JSON.stringify(observations, null, 2));
  }
});
