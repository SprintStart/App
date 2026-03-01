#!/usr/bin/env node
/**
 * Quick test to verify Supabase credentials work
 * Usage: node test-supabase-connection.js
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file manually
const envPath = join(__dirname, '.env');
try {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^#=]+)=(.+)$/);
    if (match) {
      const [, key, value] = match;
      process.env[key.trim()] = value.trim();
    }
  });
} catch (err) {
  console.error('Could not read .env file:', err.message);
  process.exit(1);
}

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

console.log('\n🔍 Testing Supabase Connection...\n');

// Check if credentials exist
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ ERROR: Missing credentials in .env file');
  console.log('\nMake sure your .env file contains:');
  console.log('  VITE_SUPABASE_URL=https://your-project.supabase.co');
  console.log('  VITE_SUPABASE_ANON_KEY=eyJ...');
  process.exit(1);
}

// Check if using placeholders
if (supabaseUrl.includes('placeholder') || supabaseKey.includes('placeholder')) {
  console.error('❌ ERROR: Still using placeholder credentials');
  console.log('\nCurrent .env values:');
  console.log('  VITE_SUPABASE_URL:', supabaseUrl);
  console.log('  VITE_SUPABASE_ANON_KEY:', supabaseKey.substring(0, 50) + '...');
  console.log('\nReplace with your real Supabase credentials!');
  process.exit(1);
}

console.log('📋 Credentials found:');
console.log('  URL:', supabaseUrl);
console.log('  Key:', supabaseKey.substring(0, 50) + '...\n');

// Try to create client
let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('✅ Supabase client created successfully\n');
} catch (err) {
  console.error('❌ ERROR creating Supabase client:', err.message);
  process.exit(1);
}

// Test connection by querying a simple table
console.log('🔌 Testing database connection...');
try {
  const { data, error } = await supabase
    .from('profiles')
    .select('count')
    .limit(1);

  if (error) {
    console.error('❌ Database query failed:', error.message);
    console.log('\nPossible issues:');
    console.log('  - Wrong credentials');
    console.log('  - Table "profiles" does not exist');
    console.log('  - RLS policies blocking access');
    process.exit(1);
  }

  console.log('✅ Database connection successful!');
  console.log('\n🎉 All tests passed! Your Supabase configuration is working.\n');
} catch (err) {
  console.error('❌ Connection test failed:', err.message);
  process.exit(1);
}
