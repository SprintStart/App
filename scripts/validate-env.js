#!/usr/bin/env node
/**
 * Environment Variables Validation Script
 *
 * This script validates that all required environment variables are present
 * and have valid values before building the application.
 *
 * Usage: node scripts/validate-env.js
 *
 * Exit codes:
 *   0 - All validations passed
 *   1 - One or more validations failed
 */

import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function loadEnvFile() {
  const envPath = join(__dirname, '..', '.env');

  if (!existsSync(envPath)) {
    return null;
  }

  const envContent = readFileSync(envPath, 'utf8');
  const env = {};

  envContent.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) {
      return;
    }

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const [, key, value] = match;
      env[key.trim()] = value.trim();
    }
  });

  return env;
}

function validateSupabaseUrl(url) {
  const errors = [];

  if (!url) {
    errors.push('Variable is not defined or is empty');
  } else if (url === 'YOUR_SUPABASE_PROJECT_URL' || url.includes('placeholder')) {
    errors.push('Contains placeholder value - must be replaced with real URL');
  } else if (url.startsWith('http://')) {
    errors.push('Must use HTTPS, not HTTP - Supabase requires secure connections');
  } else if (!url.startsWith('https://')) {
    errors.push('Must start with https://');
  } else if (!url.includes('.supabase.co')) {
    errors.push('Must be a valid Supabase URL (*.supabase.co)');
  } else if (url.match(/^https:\/\/[a-zA-Z0-9]+\.supabase\.co$/)) {
    // Valid format - alphanumeric subdomain
    return { valid: true, errors: [] };
  } else {
    errors.push('Invalid format - expected: https://xxxxx.supabase.co');
  }

  return { valid: errors.length === 0, errors };
}

function validateSupabaseKey(key) {
  const errors = [];

  if (!key) {
    errors.push('Variable is not defined or is empty');
  } else if (key === 'YOUR_SUPABASE_ANON_KEY' || key.includes('placeholder')) {
    errors.push('Contains placeholder value - must be replaced with real key');
  } else if (!key.startsWith('eyJ') && !key.startsWith('sb_publishable_')) {
    errors.push('Invalid format - Supabase keys start with "eyJ" (JWT) or "sb_publishable_" (new format)');
  } else if (key.startsWith('eyJ') && key.length < 100) {
    errors.push('Too short - valid Supabase JWT keys are longer');
  } else if (key.startsWith('sb_publishable_') && key.length < 30) {
    errors.push('Too short - valid Supabase publishable keys are longer');
  } else {
    // Looks valid
    return { valid: true, errors: [] };
  }

  return { valid: errors.length === 0, errors };
}

function main() {
  log('\n🔍 Validating Environment Variables\n', 'cyan');

  // Load .env file (optional - may not exist in CI/CD)
  const envFile = loadEnvFile();

  // Prioritize process.env (from Netlify/CI) over .env file
  // This is crucial for production builds
  const env = {
    VITE_SUPABASE_URL: process.env.VITE_SUPABASE_URL || (envFile?.VITE_SUPABASE_URL),
    VITE_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY || (envFile?.VITE_SUPABASE_ANON_KEY),
  };

  log(`Environment source: ${process.env.VITE_SUPABASE_URL ? 'process.env (Netlify/CI)' : envFile ? '.env file' : 'none'}`, 'cyan');

  if (!env.VITE_SUPABASE_URL && !env.VITE_SUPABASE_ANON_KEY) {
    log('\n❌ FATAL: No environment variables found', 'red');
    log('\nOptions:', 'yellow');
    log('  1. Set environment variables in Netlify (Settings → Environment Variables)', 'yellow');
    log('  2. Or create a .env file with:', 'yellow');
    log('     VITE_SUPABASE_URL=https://your-project.supabase.co');
    log('     VITE_SUPABASE_ANON_KEY=eyJ...\n');
    process.exit(1);
  }

  // Track validation results
  let hasErrors = false;
  const results = [];

  // Validate VITE_SUPABASE_URL
  const urlValue = env.VITE_SUPABASE_URL;
  const urlValidation = validateSupabaseUrl(urlValue);

  results.push({
    name: 'VITE_SUPABASE_URL',
    value: urlValue ? urlValue.substring(0, 50) : '(not set)',
    valid: urlValidation.valid,
    errors: urlValidation.errors,
  });

  // Validate VITE_SUPABASE_ANON_KEY
  const keyValue = env.VITE_SUPABASE_ANON_KEY;
  const keyValidation = validateSupabaseKey(keyValue);

  results.push({
    name: 'VITE_SUPABASE_ANON_KEY',
    value: keyValue ? `${keyValue.substring(0, 50)}...` : '(not set)',
    valid: keyValidation.valid,
    errors: keyValidation.errors,
  });

  // Print results
  log('Validation Results:', 'cyan');
  log('─'.repeat(70));

  results.forEach(result => {
    const status = result.valid ? '✓' : '✗';
    const color = result.valid ? 'green' : 'red';

    log(`\n${status} ${result.name}`, color);
    log(`  Current value: ${result.value}`, 'yellow');

    if (!result.valid) {
      hasErrors = true;
      log('  Issues:', 'red');
      result.errors.forEach(error => {
        log(`    • ${error}`, 'red');
      });
    }
  });

  log('\n' + '─'.repeat(70));

  // Final summary
  if (hasErrors) {
    log('\n❌ Validation Failed\n', 'red');
    log('How to fix:', 'yellow');
    log('  1. Go to https://app.netlify.com → Your Site → Environment Variables', 'yellow');
    log('  2. Or go to https://supabase.com/dashboard → Settings → API', 'yellow');
    log('  3. Copy your real Supabase credentials', 'yellow');
    log('  4. Update .env file with the real values', 'yellow');
    log('  5. Run this script again to verify\n', 'yellow');
    process.exit(1);
  } else {
    log('\n✅ All Validations Passed!\n', 'green');
    log('Environment is properly configured.\n', 'green');
    process.exit(0);
  }
}

// Run validation
main();
