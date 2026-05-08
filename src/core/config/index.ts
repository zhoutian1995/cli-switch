/**
 * Config module barrel — loader, merge, redaction.
 *
 * @see .planning/phases/02-configuration-coverage/02-01-PLAN.md
 */

export { loadConfig, loadConfigRaw } from './loader.js';
export { deepMerge, redactSecrets, isSecretField } from './merge.js';
