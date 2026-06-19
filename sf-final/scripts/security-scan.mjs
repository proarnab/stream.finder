#!/usr/bin/env node
// scripts/security-scan.mjs — Automated security scanner + auto-fix
// Usage: node scripts/security-scan.mjs [--fix] [--watch]
// Add to package.json: "security:scan": "node scripts/security-scan.mjs", "security:fix": "node scripts/security-scan.mjs --fix"

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const REPORT = path.join(ROOT, 'security-report.json');
const AUTO_FIX = process.argv.includes('--fix');
const WATCH = process.argv.includes('--watch');

const CHECKS = [
  { id:'XSS-001', severity:'critical', message:'dangerouslySetInnerHTML used without HTML escaping. Use escapeHtml() from lib/sanitize.ts.',
    pattern:/dangerouslySetInnerHTML\s*=\s*\{\s*\{\s*__html:\s*(?!escapeHtml|DOMPurify)/, autoFix:null },
  { id:'JWT-001', severity:'critical', message:'jwt.decode() does NOT verify signature. Use jwt.verify() instead.',
    pattern:/(?<![a-zA-Z_$])jwt\.decode\s*\(/, autoFix:(c) => c.replace(/jwt\.decode\s*\(/g,'jwt.verify(') },
  { id:'SECRET-001', severity:'critical', message:'Hardcoded secret detected. Move to environment variables.',
    pattern:/(?:api[_-]?key|secret|password|token)\s*[:=]\s*['"][a-zA-Z0-9_\-]{16,}['"]/i, autoFix:null },
  { id:'CODE-001', severity:'critical', message:'eval() is dangerous. Use JSON.parse() or a safe alternative.',
    pattern:/(?<![a-zA-Z_$])eval\s*\(/, autoFix:null },
  { id:'CORS-001', severity:'high', message:'Wildcard CORS allows any origin. Restrict to your domain.',
    pattern:/Access-Control-Allow-Origin['":\s]*\*/, autoFix:null },
  { id:'REDIR-001', severity:'high', message:'Redirect destination from user input — validate before redirecting.',
    pattern:/redirect\s*\(\s*(?:req|request|body|params|query|searchParams)/, autoFix:null },
  { id:'PROTO-001', severity:'high', message:'Object.assign from user-supplied data can cause prototype pollution.',
    pattern:/Object\.assign\s*\(\s*(?:req|request|body|params)/, autoFix:null },
  { id:'INFO-001', severity:'high', message:'Sensitive data may be logged. Remove or redact.',
    pattern:/console\.(log|info|debug)\s*\([^)]*(?:password|secret|token|key|hash)/i, autoFix:null },
  { id:'AUTH-001', severity:'high', message:'Mutable API route may be missing authentication.',
    pattern:/export async function (POST|PUT|DELETE|PATCH)\s*\(/,
    contextCheck:(content) => !content.includes('getSession') && !content.includes('getToken'), autoFix:null },
  { id:'VALID-001', severity:'medium', message:'Mutable API route without Zod schema validation.',
    pattern:/export async function (POST|PUT|PATCH)\s*\(/,
    contextCheck:(content) => !content.includes('z.object') && !content.includes('z.string'), autoFix:null },
  { id:'TLS-001', severity:'medium', message:'HTTP URL detected (non-localhost). Use HTTPS in production.',
    pattern:/http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)[a-zA-Z0-9]/, autoFix:null },
];

function getSourceFiles(dir) {
  const results = [];
  const skip = ['node_modules','.next','.git','dist','build','.turbo'];
  function walk(d) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.includes(entry.name)) continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) results.push(full);
    }
  }
  walk(dir);
  return results;
}

function runNpmAudit() {
  try {
    const out = execSync('npm audit --json 2>/dev/null', { cwd: ROOT }).toString();
    return JSON.parse(out);
  } catch (e) {
    try { return JSON.parse(e.stdout?.toString() ?? '{}'); } catch { return { vulnerabilities: {} }; }
  }
}

function scan() {
  const files = getSourceFiles(ROOT);
  const findings = [];

  for (const file of files) {
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');
    let modified = false;
    let newContent = content;

    for (const check of CHECKS) {
      if (!check.pattern) continue;
      if (check.contextCheck && !check.contextCheck(content)) continue;

      for (let i = 0; i < lines.length; i++) {
        if (check.pattern.test(lines[i])) {
          let autoFixed = false;
          if (AUTO_FIX && check.autoFix) {
            const fixed = check.autoFix(newContent);
            if (fixed !== newContent) { newContent = fixed; modified = true; autoFixed = true; }
          }
          findings.push({ checkId: check.id, severity: check.severity, file: path.relative(ROOT, file),
            line: i + 1, message: check.message, snippet: lines[i].trim().slice(0, 120), autoFixed });
        }
      }
    }
    if (modified) { fs.writeFileSync(file, newContent, 'utf8'); console.log(`  ✓ Auto-fixed: ${path.relative(ROOT, file)}`); }
  }

  console.log('\n📦 Running npm audit...');
  const audit = runNpmAudit();
  const vulns = audit.vulnerabilities ?? {};
  const vulnCount = Object.keys(vulns).length;
  if (vulnCount > 0) {
    findings.push({ checkId:'DEP-001', severity:'high', file:'package.json', line:0,
      message:`npm audit found ${vulnCount} vulnerable package(s). Run \`npm audit\` for details.`,
      snippet: Object.keys(vulns).slice(0,5).join(', '), autoFixed: false });
    if (AUTO_FIX) {
      try { execSync('npm audit fix', { cwd: ROOT, stdio:'pipe' }); console.log('  ✓ npm audit fix completed'); }
      catch { try { execSync('npm audit fix --force', { cwd: ROOT, stdio:'pipe' }); } catch {} }
    }
  }
  return findings;
}

function report(findings) {
  const bySeverity = { critical:0, high:0, medium:0, low:0 };
  for (const f of findings) { if (f.severity in bySeverity) bySeverity[f.severity]++; }
  const C = { critical:'\x1b[31m', high:'\x1b[33m', medium:'\x1b[36m', low:'\x1b[37m', reset:'\x1b[0m' };
  console.log('\n══════════════════════════════════════');
  console.log('  StreamFinder Security Scan Report');
  console.log(`  ${new Date().toISOString()}`);
  console.log('══════════════════════════════════════');
  console.log(`\n  Total: ${findings.length}  Critical:${bySeverity.critical}  High:${bySeverity.high}  Medium:${bySeverity.medium}  Low:${bySeverity.low}\n`);
  for (const f of findings) {
    const c = C[f.severity] ?? C.reset;
    console.log(`${c}[${f.severity.toUpperCase()}]${C.reset} ${f.checkId}${f.autoFixed?' ✓ AUTO-FIXED':''}`);
    console.log(`  File: ${f.file}:${f.line||''}`);
    console.log(`  Issue: ${f.message}`);
    if (f.snippet) console.log(`  Code: ${f.snippet}`);
    console.log('');
  }
  if (findings.length === 0) console.log('  ✅ No issues found!\n');
  fs.writeFileSync(REPORT, JSON.stringify({ generatedAt: new Date().toISOString(), totalFindings: findings.length, bySeverity, findings }, null, 2));
  console.log(`  Report saved to: security-report.json`);
  if (bySeverity.critical > 0 || bySeverity.high > 0) process.exitCode = 1;
}

function runOnce() {
  console.log('\n🔍 Scanning for security vulnerabilities...');
  const findings = scan();
  report(findings);
}

if (WATCH) {
  console.log('👁  Watch mode active. Ctrl-C to stop.\n');
  runOnce();
  fs.watch(ROOT, { recursive: true }, (_, filename) => {
    if (filename && /\.(ts|tsx|js|jsx)$/.test(filename) && !filename.includes('node_modules')) {
      console.log(`\n  File changed: ${filename}`);
      runOnce();
    }
  });
} else { runOnce(); }
