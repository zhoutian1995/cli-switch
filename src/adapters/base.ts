import type { AdapterDoctorInput, CliAdapter, DoctorCheck } from './types.js';

/**
 * Shared doctor implementation: checks binary existence and auth status.
 * Adapters that have the same doctor pattern can reuse this.
 */
export function createDoctor(
  checkAuth: (input: AdapterDoctorInput) => { status: string; hint: string },
): CliAdapter['doctor'] {
  return (input: AdapterDoctorInput): DoctorCheck[] => {
    const checks: DoctorCheck[] = [];

    const binaryPath = input.platform.findExecutable(input.tool.binaryNames);
    checks.push({
      name: 'binary',
      status: binaryPath ? 'pass' : 'fail',
      message: binaryPath
        ? `Found at ${binaryPath}`
        : `Binary not found. Searched: ${input.tool.binaryNames.join(', ')}`,
      ...(binaryPath ? { details: { path: binaryPath } } : {}),
    });

    const authResult = checkAuth(input);
    const authStatus: 'pass' | 'warn' | 'fail' =
      authResult.status === 'ready' ? 'pass' : authResult.status === 'missing' ? 'fail' : 'warn';
    checks.push({
      name: 'auth',
      status: authStatus,
      message: authResult.hint,
    });

    return checks;
  };
}
