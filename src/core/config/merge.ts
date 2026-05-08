/**
 * Deep merge utility for config objects.
 *
 * Rules (D-05, D-06, D-07 from 02-CONTEXT.md):
 * - Nested objects are recursively merged.
 * - Arrays are replaced (not concatenated).
 * - Scalar values from override win.
 * - null/undefined in override are treated as "no override" (not delete).
 *
 * @see .planning/phases/02-configuration-coverage/02-CONTEXT.md D-05, D-06
 */

/**
 * Deep-merge two plain objects. Returns a new object; does not mutate inputs.
 */
export function deepMerge<T extends Record<string, unknown>>(
  base: T,
  override: Partial<T>,
): T {
  const result = { ...base };

  for (const key of Object.keys(override) as Array<keyof T>) {
    const overrideVal = override[key];
    const baseVal = base[key];

    if (
      overrideVal !== null &&
      overrideVal !== undefined &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      baseVal !== null &&
      baseVal !== undefined &&
      typeof baseVal === 'object' &&
      !Array.isArray(baseVal)
    ) {
      // Both are plain objects — recurse
      (result as Record<string, unknown>)[key as string] = deepMerge(
        baseVal as Record<string, unknown>,
        overrideVal as Partial<Record<string, unknown>>,
      );
    } else if (overrideVal !== undefined) {
      // Scalar, array, or override is defined — replace
      (result as Record<string, unknown>)[key as string] = overrideVal;
    }
    // undefined in override → skip (base value preserved)
  }

  return result;
}

/**
 * Check if a field name looks like a secret that should be redacted.
 */
export function isSecretField(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes('key') ||
    lower.includes('token') ||
    lower.includes('secret') ||
    lower.includes('password')
  );
}

/**
 * Recursively redact secret values in a config object.
 * Returns a deep copy with matching values replaced by '***'.
 */
export function redactSecrets<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((v) => redactSecrets(v)) as T;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSecretField(key) && typeof value === 'string' && value.length > 0) {
      result[key] = '***';
    } else if (
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      !Array.isArray(value)
    ) {
      result[key] = redactSecrets(value);
    } else {
      result[key] = value;
    }
  }
  return result as T;
}
