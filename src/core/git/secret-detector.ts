export interface SecretFinding {
  file: string;
  line: number;
  type: string; // 'api_key' | 'token' | 'password' | 'private_key'
  severity: 'high' | 'medium' | 'low';
}

interface Pattern {
  regex: RegExp;
  type: string;
  severity: 'high' | 'medium' | 'low';
}

const PATTERNS: Pattern[] = [
  // Private keys — highest severity
  {
    regex: /-----BEGIN\s+(RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    type: 'private_key',
    severity: 'high',
  },
  // OpenAI / Anthropic / OpenRouter API keys
  {
    regex: /\bsk-[a-zA-Z0-9]{20,}\b/g,
    type: 'api_key',
    severity: 'high',
  },
  {
    regex: /\bsk-or-[a-zA-Z0-9-]{10,}\b/g,
    type: 'api_key',
    severity: 'high',
  },
  {
    regex: /\bsk-ant-[a-zA-Z0-9-]{10,}\b/g,
    type: 'api_key',
    severity: 'high',
  },
  {
    regex: /\bkey_[a-zA-Z0-9]{20,}\b/g,
    type: 'api_key',
    severity: 'high',
  },
  // Generic token patterns
  {
    regex: /\b(token|bearer|auth_token|access_token)\s*[:=]\s*['"][a-zA-Z0-9._-]{16,}['"]/gi,
    type: 'token',
    severity: 'medium',
  },
  // Password patterns
  {
    regex: /\b(password|passwd|pwd|secret)\s*[:=]\s*['"][^'"]{4,}['"]/gi,
    type: 'password',
    severity: 'medium',
  },
  // Generic long random strings assigned to key-like variable names
  {
    regex: /\b(API_KEY|SECRET|TOKEN|PASSWORD|CREDENTIAL)\s*[:=]\s*['"][a-zA-Z0-9+/=]{32,}['"]/g,
    type: 'api_key',
    severity: 'medium',
  },
];

export function detectSecrets(diff: string): SecretFinding[] {
  const findings: SecretFinding[] = [];

  // Split diff into file sections
  const fileSections = diff.split(/^diff --git a\//m).slice(1);

  for (const section of fileSections) {
    const headerMatch = section.match(/^[^\n]+/);
    const fileName = headerMatch ? headerMatch[0].split(/\s/)[0].trim() : 'unknown';

    // Only look at added lines
    const lines = section.split('\n');
    let lineNumber = 0;

    for (const line of lines) {
      lineNumber++;
      if (!line.startsWith('+') || line.startsWith('+++')) continue;

      const content = line.slice(1);

      for (const pattern of PATTERNS) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(content)) {
          findings.push({
            file: fileName,
            line: lineNumber,
            type: pattern.type,
            severity: pattern.severity,
          });
          break; // one finding per line
        }
      }
    }
  }

  // Also handle flat diff (no file headers)
  if (fileSections.length === 0 && diff.length > 0) {
    const lines = diff.split('\n');
    let lineNumber = 0;
    for (const line of lines) {
      lineNumber++;
      if (!line.startsWith('+') || line.startsWith('+++')) continue;
      const content = line.slice(1);

      for (const pattern of PATTERNS) {
        pattern.regex.lastIndex = 0;
        if (pattern.regex.test(content)) {
          findings.push({
            file: 'unknown',
            line: lineNumber,
            type: pattern.type,
            severity: pattern.severity,
          });
          break;
        }
      }
    }
  }

  return findings;
}
