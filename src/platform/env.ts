const SENSITIVE_KEY_PATTERN = /(KEY|TOKEN|SECRET|PASSWORD)/;

export function readEnv(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined ? undefined : value;
}

export function maskValue(value: string): string {
  if (value === '') {
    return '';
  }

  if (value.length < 8) {
    return `${value.slice(0, 2)}****${value.slice(-2)}`;
  }

  const prefixLength = value.startsWith('sk-') ? 3 : 4;
  const rawSuffixLength = Math.min(4, Math.max(0, value.length - prefixLength));
  const suffix = value.startsWith('sk-') && value.length - prefixLength >= 6
    ? `${value.slice(-6, -5)}${value.slice(-3)}`
    : value.slice(-rawSuffixLength);

  return `${value.slice(0, prefixLength)}****${suffix}`;
}

export function isSensitiveKey(name: string): boolean {
  return SENSITIVE_KEY_PATTERN.test(name);
}
