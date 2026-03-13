# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.1.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **DO NOT** open a public GitHub issue
2. Email: **willezhou2015@gmail.com**
3. Include a description, steps to reproduce, and potential impact

We will respond within 48 hours.

## Security Considerations

### API Key Handling

cli-switch reads API keys exclusively from environment variables at runtime. No keys are stored in source code or configuration files committed to version control.

Environment variables used:
- `BAILIAN_API_KEY` - Bailian/DashScope API
- `ZHIPU_AUTH_TOKEN` - Zhipu GLM API
- `ANTHROPIC_API_KEY` - Fucheers/Anthropic API
- `GEMINI_API_KEY` - Google Gemini API
- `OPENAI_API_KEY` - OpenAI API

### Hook Execution

The hook system (`cli-switch hook`) executes user-configured shell commands using `shell=True`. This is by design to allow flexible automation, but users should:

- Only configure hooks from trusted sources
- Review hook commands before adding them
- Be aware that hooks run with the same privileges as the user

A 30-second timeout is enforced on all hook executions to prevent runaway processes.

### SSL Verification

The model connectivity test (`cli-switch test`) may disable SSL verification for testing purposes. This only affects the test command and does not impact actual model API calls made by the CLI tools.

### Atomic File Writes

Configuration and session state files are written using a temp-file + atomic rename pattern to prevent corruption from crashes or concurrent access.
