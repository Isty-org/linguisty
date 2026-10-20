/** @spec spec://modules/platform/INFRA-003-local-cli#settings */
const keys = ['setup', 'model', 'status', 'saved', 'batch', 'extensionId',
  'CLI_HOST_MISSING', 'CLI_NOT_FOUND', 'CLI_LOGIN_REQUIRED', 'CLI_EXECUTION_FAILED'] as const;
export type CliErrorCode = Extract<typeof keys[number], 'CLI_HOST_MISSING' | 'CLI_NOT_FOUND' | 'CLI_LOGIN_REQUIRED' | 'CLI_EXECUTION_FAILED'>;
export type CliTexts = Record<typeof keys[number], string>;
/** @spec spec://modules/interface/FEAT-003-controls#languages */
export function makeCliText(values: readonly string[]): CliTexts {
  if (values.length !== keys.length) throw new Error('Incomplete CLI dictionary');
  return Object.fromEntries(keys.map((key, index) => [key, values[index]!])) as CliTexts;
}
