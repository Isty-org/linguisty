/** @spec spec://modules/platform/INFRA-001-extension#build */
import { defineConfig } from 'wxt';
import { resolve } from 'node:path';
import { reactDomGuard } from './scripts/react-dom-guard';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  imports: false,
  hooks: {
    // @spec spec://modules/platform/INFRA-001-extension#build
    'build:publicAssets': (wxt, files) => {
      for (const name of ['LICENSE', 'THIRD_PARTY_NOTICES.txt']) {
        files.push({ absoluteSrc: resolve(wxt.config.root, name), relativeDest: name });
      }
    },
  },
  vite: ({ mode }) => ({ plugins: mode === 'production' ? [reactDomGuard()] : [] }),
  zip: {
    excludeSources: ['test-results/**', 'playwright-report/**', 'coverage/**', 'output/**', '.cache/**'],
  },
  manifest: ({ browser }) => ({
    name: 'Linguisty',
    author: 'Nikita Tsyzhman (@tsyzhman)',
    homepage_url: 'https://github.com/Isty-org/linguisty',
    description: 'Перевод страниц через ваш API или подписку ChatGPT. Оригинал в один клик.',
    version: '0.4.10',
    permissions: ['activeTab', 'scripting', 'storage', 'declarativeNetRequestWithHostAccess'],
    optional_permissions: ['nativeMessaging'],
    optional_host_permissions: ['https://*/*', 'http://localhost/*', 'http://127.0.0.1/*', 'http://[::1]/*'],
    icons: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' },
    action: { default_title: 'Linguisty' },
    content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
    // @spec spec://modules/platform/INFRA-004-codex-connection#auth
    // Firefox checks the OpenAI page initiating the callback, not only its loopback destination.
    web_accessible_resources: [{ resources: ['codex-callback.html'], matches: ['http://127.0.0.1/*', 'https://auth.openai.com/*'] }],
    ...(browser === 'firefox'
      ? { browser_specific_settings: { gecko: { id: 'linguisty@isty.local', strict_min_version: '142.0', data_collection_permissions: { required: ['websiteContent', 'browsingActivity', 'authenticationInfo'] } } } }
      : { minimum_chrome_version: '120' }),
  }),
});

