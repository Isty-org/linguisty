/** @spec spec://modules/interface/FEAT-003-controls#languages */
import { en, type Dictionary } from './en';

/** Russian source text is the canonical key; every key is its own translation. */
export const ru = Object.fromEntries(Object.keys(en).map(key => [key, key])) as Dictionary;
