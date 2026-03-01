# Build Scripts

This directory contains utility scripts used during the build process.

## validate-env.js

Environment variable validation script that runs before every build.

### Purpose
- Validates required environment variables exist
- Checks for placeholder values
- Validates format (URL structure, JWT format)
- Prevents builds with invalid configuration

### Usage

**Manual validation:**
```bash
node scripts/validate-env.js
# or
npm run validate-env
```

**Automatic (during build):**
```bash
npm run build
# Automatically runs validate-env.js first
```

### Exit Codes
- `0` - All validations passed
- `1` - One or more validations failed

### Validated Variables

#### VITE_SUPABASE_URL
- Must be defined
- Must not contain "placeholder"
- Must start with `https://`
- Must contain `.supabase.co`
- Format: `https://[20-char-id].supabase.co`

#### VITE_SUPABASE_ANON_KEY
- Must be defined
- Must not contain "placeholder"
- Must start with `eyJ` (JWT format)
- Must be at least 100 characters

### Output

**Success:**
```
✅ All Validations Passed!
Environment is properly configured.
```

**Failure:**
```
❌ Validation Failed

✗ VITE_SUPABASE_URL
  Current value: https://placeholder.supabase.co
  Issues:
    • Contains placeholder value - must be replaced with real URL

How to fix:
  1. Go to https://app.netlify.com → Your Site → Environment Variables
  2. Or go to https://supabase.com/dashboard → Settings → API
  3. Copy your real Supabase credentials
  4. Update .env file with the real values
  5. Run this script again to verify
```

### Integration

This script is automatically run as a **prebuild** step in `package.json`:

```json
{
  "scripts": {
    "prebuild": "node scripts/validate-env.js",
    "build": "vite build"
  }
}
```

When you run `npm run build`, npm automatically runs `prebuild` first.

### Skipping Validation (Not Recommended)

For emergency situations where you need to build without validation:

```bash
npm run build:skip-validation
```

**Warning:** The app will not function without valid credentials.

### CI/CD Usage

In CI/CD pipelines (Netlify, GitHub Actions, etc.):

1. Set environment variables as secrets
2. The validation script runs automatically during build
3. Build fails if validation fails
4. This prevents deploying broken configurations

Example for GitHub Actions:

```yaml
- name: Build
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
  run: npm run build
```

### Extending Validation

To add validation for additional environment variables:

1. Open `scripts/validate-env.js`
2. Create a validation function (see `validateSupabaseUrl` example)
3. Add to the `results` array in `main()`
4. Follow the existing patterns for error reporting

Example:

```javascript
function validateCustomVar(value) {
  const errors = [];

  if (!value) {
    errors.push('Variable is not defined');
  } else if (value.includes('placeholder')) {
    errors.push('Contains placeholder value');
  }

  return { valid: errors.length === 0, errors };
}
```

### Dependencies

This script uses only Node.js built-in modules:
- `fs` - File system operations
- `path` - Path manipulation
- `url` - URL utilities

No external dependencies required.

### Troubleshooting

**Script not found:**
```bash
# Make sure you're in the project root
cd /path/to/project
node scripts/validate-env.js
```

**Permission denied:**
```bash
chmod +x scripts/validate-env.js
```

**.env not found:**
- Ensure `.env` exists in project root (same directory as `package.json`)
- The script looks for `.env` one level up from `scripts/` directory

**False positives:**
- Check that your real credentials don't accidentally contain the word "placeholder"
- Ensure URLs use `https://` not `http://`
- Verify `.supabase.co` domain is spelled correctly
