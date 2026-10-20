/** @spec spec://modules/page/FEAT-002-page-translation#sessions */
import { defineUnlistedScript } from 'wxt/utils/define-unlisted-script';
import { bootstrapPageRuntime } from '../src/content/bootstrap';

export default defineUnlistedScript(() => {
  if (window.top === window && /^https?:$/u.test(location.protocol)) bootstrapPageRuntime();
});

