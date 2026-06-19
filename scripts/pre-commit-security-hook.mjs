#!/usr/bin/env node

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PRE-COMMIT HOOK: Detect secrets before commit
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * Installation:
 * 1. Save this file as .git/hooks/pre-commit
 * 2. Make executable: chmod +x .git/hooks/pre-commit
 * 3. Or use husky: npx husky add .husky/pre-commit \"npm run security:hook\"
 * 
 * What it detects:
 * - API keys, JWT tokens, passwords
 * - AWS credentials, GCP keys
 * - Database URLs with embedded passwords
 * - Private cryptographic keys
 * - Email credentials
 * - Stripe/payment API keys
 * - OAuth secrets
 * 
 * Bypass (use with caution):
 * git commit --no-verify
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';
const BOLD = '\x1b[1m';

/**
 * Secret patterns to detect
 */
const SECRET_PATTERNS = [
  {
    name: 'AWS Access Key',
    pattern: /AKIA[0-9A-Z]{16}/,
    severity: 'CRITICAL',
  },
  {
    name: 'AWS Secret Key',
    pattern: /aws_secret_access_key\s*=\s*[A-Za-z0-9/+=]{40}/,
    severity: 'CRITICAL',
  },
  {
    name: 'Private SSH Key',
    pattern: /-----BEGIN (?:RSA|EC|OPENSSH|PGP)[\s\S]*?KEY-----/,
    severity: 'CRITICAL',
  },
  {
    name: 'GitHub Token',
    pattern: /ghp_[a-zA-Z0-9]{36,255}/,
    severity: 'CRITICAL',
  },
  {
    name: 'GitHub OAuth Token',
    pattern: /gho_[a-zA-Z0-9]{36,255}/,
    severity: 'CRITICAL',
  },
  {
    name: 'Stripe Secret Key',
    pattern: /sk_(?:live|test)_[a-zA-Z0-9]{20,}/,
    severity: 'CRITICAL',
  },
  {
    name: 'Google API Key',
    pattern: /AIza[0-9A-Za-z\\-_]{35}/,
    severity: 'CRITICAL',
  },
  {
    name: 'Firebase Database URL',
    pattern: /https:\/\/[\w-]+\.firebaseio\.com/,
    severity: 'HIGH',
  },
  {
    name: 'Twilio API Key',
    pattern: /AC[0-9a-f]{32}/,
    severity: 'CRITICAL',
  },
  {
    name: 'SendGrid API Key',
    pattern: /SG\.[a-zA-Z0-9_-]{66}/,
    severity: 'CRITICAL',
  },
  {
    name: 'Slack Token',
    pattern: /xox[pba]-[\d]{12}-[\d]{12}-[a-zA-Z0-9]{24,32}/,
    severity: 'CRITICAL',
  },
  {
    name: 'JWT Token',
    pattern: /eyJ[A-Za-z0-9_-]{10,}\\.eyJ[A-Za-z0-9_-]{10,}\\.[\w-]{10,}/,
    severity: 'HIGH',
  },
  {
    name: 'Database URL with credentials',
    pattern: /(?:postgres|mysql|mongodb)(?:\\+\\w+)?:\\/\\/[\\w]+:[\\w]+@/,
    severity: 'CRITICAL',
  },
  {
    name: 'Password in URL',
    pattern: /(?:password|passwd|pwd)\\s*[:=]\\s*[\"']?[^\\s\"']+[\"']?/i,
    severity: 'HIGH',
  },
  {
    name: 'API Key assignment',
    pattern: /(?:api_?key|apikey|API_KEY)\\s*[:=]\\s*[\"']([\\w]{20,})[\"']/i,
    severity: 'HIGH',
  },
  {
    name: 'OAuth Secret',
    pattern: /(?:oauth|client_secret|secret)\\s*[:=]\\s*[\"']([\\w]{20,})[\"']/i,
    severity: 'HIGH',
  },
  {
    name: 'Generic Long Secret',
    pattern: /(?:secret|token|key|password)\\s*=\\s*[\"'](.{32,})[\"']/i,
    severity: 'MEDIUM',
  },
];

/**
 * Whitelisted patterns (false positives)
 * These won't trigger alerts
 */
const WHITELIST_PATTERNS = [
  /example\.com/, // Example domains
  /test/, // Test/example values
  /placeholder/, // Placeholder text
  /your-.*-here/i, // Your-xxx-here patterns
  /replace-this/i, // Replace-this patterns
  /demo/, // Demo values
];

/**
 * Files/paths to always ignore
 */
const IGNORE_PATHS = [
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  '.env.example',
  '.env.template',
  '*.lock',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

/**
 * Get staged files from git
 */
function getStagedFiles(): string[] {
  try {
    const output = execSync('git diff --cached --name-only --diff-filter=ACM', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    return output.trim().split('\n').filter(Boolean);
  } catch {
    console.error(`${RED}Error getting staged files${RESET}`);
    process.exit(1);
  }
}

/**
 * Check if file should be ignored
 */
function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATHS.some(pattern => {
    const regex = new RegExp(pattern.replace(/\\*/g, '.*'));
    return regex.test(filePath);
  });
}

/**
 * Check if line is whitelisted
 */
function isWhitelisted(line: string): boolean {
  return WHITELIST_PATTERNS.some(pattern => pattern.test(line));
}

/**
 * Scan file for secrets
 */
function scanFile(filePath: string): Array<{
  lineNumber: number;
  line: string;
  pattern: string;
  name: string;
  severity: string;
}> {
  const findings: Array<{
    lineNumber: number;
    line: string;
    pattern: string;
    name: string;
    severity: string;
  }> = [];

  if (!fs.existsSync(filePath)) {
    return findings;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\\n');

    lines.forEach((line, index) => {
      // Skip whitelisted lines
      if (isWhitelisted(line)) {
        return;
      }

      // Skip comments and common exclusions
      if (line.trim().startsWith('//') || line.trim().startsWith('#')) {
        return;
      }

      SECRET_PATTERNS.forEach(({ name, pattern, severity }) => {
        if (pattern.test(line)) {
          findings.push({
            lineNumber: index + 1,
            line: line.substring(0, 80), // Truncate for safety
            pattern: pattern.source,
            name,
            severity,
          });
        }
      });
    });
  } catch (err) {
    // Skip binary files and unreadable files
  }

  return findings;
}

/**
 * Main hook execution
 */
function main() {
  console.log(`\\n${BOLD}🔐 Security Hook: Scanning for secrets...${RESET}\\n`);

  const stagedFiles = getStagedFiles();
  let totalFindings = 0;
  const criticalFindings: Array<any> = [];

  for (const file of stagedFiles) {
    if (shouldIgnore(file)) {
      continue;
    }

    const findings = scanFile(file);

    if (findings.length > 0) {
      console.log(`${YELLOW}⚠️  ${file}${RESET}`);

      findings.forEach(({ lineNumber, line, name, severity }) => {
        totalFindings++;

        const severityColor = severity === 'CRITICAL' ? RED : severity === 'HIGH' ? YELLOW : '';
        console.log(
          `  ${severityColor}[${severity}]${RESET} Line ${lineNumber}: ${name}`
        );
        console.log(`  >> ${line.substring(0, 60)}...`);

        if (severity === 'CRITICAL') {
          criticalFindings.push({ file, lineNumber, name });
        }
      });

      console.log();
    }
  }

  if (totalFindings === 0) {
    console.log(`${GREEN}✅ No secrets detected${RESET}\\n`);
    process.exit(0);
  }

  console.log(`\\n${RED}${BOLD}⛔ Security Check Failed${RESET}`);
  console.log(`${RED}${totalFindings} potential secret(s) found${RESET}\\n`);

  if (criticalFindings.length > 0) {
    console.log(`${RED}${BOLD}CRITICAL FINDINGS:${RESET}`);
    criticalFindings.forEach(({ file, lineNumber, name }) => {
      console.log(`  - ${file}:${lineNumber} (${name})`);
    });
    console.log();
  }

  console.log('${YELLOW}Actions to take:${RESET}');
  console.log('1. Review flagged lines and remove any real secrets');
  console.log('2. Use environment variables instead (.env.local)');
  console.log('3. If false positive, add to WHITELIST_PATTERNS in this hook');
  console.log('\\nTo bypass (${RED}use with extreme caution${RESET}):');
  console.log('  git commit --no-verify\\n');

  process.exit(1);
}

// Run the hook
main();
