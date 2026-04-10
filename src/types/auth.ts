import type { AuthMode, AuthStatus } from './common.js';

/** Normalized authentication result returned by auth checks. */
export interface AuthResult {
  /** Authentication mode that was evaluated. */
  mode: AuthMode;
  /** Final normalized authentication status. */
  status: AuthStatus;
  /** Required credentials or artifacts for this auth mode. */
  required: string[];
  /** Credentials or artifacts actually detected on the machine. */
  detected: string[];
  /** Source of the detected credentials, if any. */
  source: string | null;
  /** Expiration timestamp when known. */
  expiresAt?: string | null;
  /** Human-readable remediation hint. */
  hint: string;
  /** Additional provider-specific details. */
  details?: Record<string, unknown>;
}
