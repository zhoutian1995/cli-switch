export function createResolverError(code: string, message: string, details?: Record<string, unknown>): Error & { code: string; details?: Record<string, unknown> } {
  const error = new Error(message) as Error & { code: string; details?: Record<string, unknown> };
  error.code = code;
  if (details) {
    error.details = details;
  }
  return error;
}
