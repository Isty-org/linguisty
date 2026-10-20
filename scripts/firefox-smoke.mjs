/** @spec spec://common/PROP-002-quality#checks */
import { runFirefoxSmoke } from '../tests/e2e/firefox-smoke.mjs';

const report = await runFirefoxSmoke();
process.exitCode = report.results.some(result => result.ok === false) || report.fatal ? 1 : 0;
