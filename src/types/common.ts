/** Tool identifier, such as claude-code or codex. */
export type ToolId = string;

/** Profile name within a tool, such as default or router. */
export type ProfileName = string;

/** Vendor identifier, such as anthropic or openai. */
export type VendorId = string;

/** Provider identifier for a concrete backend provider. */
export type ProviderId = string;

/** Transport identifier for the connection mode used by a provider. */
export type TransportId = string;

/** User-facing model alias, such as sonnet. */
export type ModelAlias = string;

/** Supported authentication modes. */
export type AuthMode = 'login' | 'api_key' | 'oauth' | 'none';

/** Normalized authentication status. */
export type AuthStatus =
  | 'ready'
  | 'missing'
  | 'expired'
  | 'conflict'
  | 'unsupported'
  | 'unknown';

/** Status used by doctor checks. */
export type CheckStatus = 'pass' | 'warn' | 'fail';

/** Severity level used by diagnostics. */
export type DiagnosticLevel = 'info' | 'warn' | 'error';

/** Supported runtime platforms in the MVP scope. */
export type SupportedPlatform = 'darwin' | 'linux';
