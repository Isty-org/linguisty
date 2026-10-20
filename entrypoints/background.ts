/** @spec spec://modules/platform/INFRA-001-extension#runtime */
import { defineBackground } from 'wxt/utils/define-background';
import { registerBackgroundController } from '../src/background/controller';

export default defineBackground(() => {
  registerBackgroundController();
});

