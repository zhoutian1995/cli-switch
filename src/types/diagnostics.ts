import type { DiagnosticLevel } from './common.js';

/** Structured diagnostic message emitted during resolution or doctor checks. */
export interface Diagnostic {
  /** Severity level of the diagnostic. */
  level: DiagnosticLevel;
  /** Stable machine-readable diagnostic code. */
  code: string;
  /** Human-readable diagnostic message. */
  message: string;
  /** Optional remediation hint. */
  hint?: string;
  /** Additional structured diagnostic details. */
  details?: Record<string, unknown>;
}
