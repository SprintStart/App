# Low Bandwidth Mode (Lite Mode) - Phase 0.5

## Overview

Low Bandwidth Mode is a performance optimization feature that enhances the platform for users with slower internet connections. The feature is controlled by a feature flag and can be toggled on/off without redeployment.

## Feature Flag

**Default State:** OFF

```typescript
// src/lib/featureFlags.ts
export const FEATURE_LOW_BANDWIDTH_MODE = false;
```

When the flag is `false`, all Lite Mode functionality is disabled and the app behaves exactly as it did before this feature was implemented.

## Architecture

### localStorage-Only State Management

**No database writes.** All settings are stored in localStorage:

- `ss_low_bw_global_default` - Admin-set global default (boolean)
- `ss_low_bw_user_override` - User-specific override (boolean | null)

**Effective Mode Calculation:**
```typescript
const effectiveMode = user_override ?? global_default ?? false;
```

### Components

1. **LowBandwidthContext** (`src/contexts/LowBandwidthContext.tsx`)
   - Provides `isLowBandwidth`, `setUserOverride`, `setGlobalDefault`
   - Manages body class `.low-bandwidth-mode`
   - Listens to localStorage changes

2. **LowBandwidthIndicator** (`src/components/LowBandwidthIndicator.tsx`)
   - Fixed position toggle button (bottom-right)
   - Shows "Lite" or "Full" mode
   - User can click to toggle their override

3. **LowBandwidthSettings** (`src/components/admin/LowBandwidthSettings.tsx`)
   - Admin panel at `/admindashboard/settings`
   - Allows admin to set global default
   - Shows current localStorage state

4. **OptimizedImage** (`src/components/OptimizedImage.tsx`)
   - Wrapper component with `loading="lazy"` and `decoding="async"`
   - Requires explicit `width` and `height` to prevent layout shift
   - Falls back to regular `<img>` when flag is OFF

### Utilities

1. **cacheManager** (`src/lib/cacheManager.ts`)
   - localStorage-based cache with 10-minute TTL
   - Cache keys prefixed with `cache_`
   - Functions: `getCached()`, `setCache()`, `clearCache()`

2. **fetchWithRetry** (`src/lib/fetchWithRetry.ts`)
   - Retries network errors and 5xx/429 status codes
   - 1 retry after 500ms delay
   - Throws `RetryableError` with message: "Connection unstable — tap retry"
   - **No infinite retries**

### CSS

```css
/* Applied only when body has .low-bandwidth-mode class */
.low-bandwidth-mode * {
  animation-duration: 0.01ms !important;
  animation-iteration-count: 1 !important;
  transition-duration: 0.01ms !important;
}

/* Respect user's OS preference */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## Files Modified

### New Files Created
- `src/lib/cacheManager.ts`
- `src/lib/fetchWithRetry.ts`
- `src/components/OptimizedImage.tsx`
- `src/contexts/LowBandwidthContext.tsx`
- `src/hooks/useLowBandwidth.ts`
- `src/components/LowBandwidthIndicator.tsx`
- `src/components/admin/LowBandwidthSettings.tsx`

### Modified Files
- `src/lib/featureFlags.ts` - Added `FEATURE_LOW_BANDWIDTH_MODE = false`
- `src/App.tsx` - Added `LowBandwidthProvider` wrapper and `LowBandwidthIndicator`
- `src/pages/SchoolWall.tsx` - Used `OptimizedImage` for logo
- `src/index.css` - Added `.low-bandwidth-mode` CSS rules
- `src/pages/AdminDashboard.tsx` - Added `LowBandwidthSettings` to settings view

## Usage

### For Admins

1. Enable the feature flag: `FEATURE_LOW_BANDWIDTH_MODE = true`
2. Rebuild and deploy
3. Navigate to `/admindashboard/settings`
4. Toggle "Global Default Setting" to enable Lite mode for all users
5. Users can still override with the indicator button

### For Users

When Lite mode is active (either via global default or user override):
- A "Lite" indicator appears in bottom-right corner
- Click to toggle between Lite and Full mode
- User preference overrides global default
- Setting persists in localStorage

### For Developers

#### Using OptimizedImage

```tsx
import { OptimizedImage } from '../components/OptimizedImage';

<OptimizedImage
  src="/logo.png"
  alt="Logo"
  width={120}
  height={40}
  className="h-10 w-auto"
/>
```

#### Using fetchWithRetry

```tsx
import { fetchWithRetry, RetryableError } from '../lib/fetchWithRetry';

try {
  const response = await fetchWithRetry('/api/endpoint');
  const data = await response.json();
} catch (error) {
  if (error instanceof RetryableError) {
    // Show "Connection unstable — tap retry" UI
  }
}
```

#### Using Cache

```tsx
import { getCached, setCache } from '../lib/cacheManager';

// Try cache first
let data = getCached<QuizData>('quiz_' + quizId);

if (!data) {
  // Fetch from API
  const response = await fetch('/api/quiz/' + quizId);
  data = await response.json();

  // Store in cache (10min TTL)
  setCache('quiz_' + quizId, data);
}
```

#### Checking if Lite Mode is Active

```tsx
import { useLowBandwidth } from '../hooks/useLowBandwidth';

function MyComponent() {
  const { isLowBandwidth } = useLowBandwidth();

  if (isLowBandwidth) {
    // Render lite version
  }
}
```

## Rollback Plan

**Time to rollback: < 2 minutes**

1. Set `FEATURE_LOW_BANDWIDTH_MODE = false` in `src/lib/featureFlags.ts`
2. Run `npm run build`
3. Deploy

**Effect:**
- All Lite Mode features disabled immediately
- `OptimizedImage` renders as regular `<img>` tags
- `fetchWithRetry` becomes regular `fetch`
- Cache operations become no-ops
- Context always returns `isLowBandwidth: false`
- UI indicators hidden
- Admin settings panel hidden

**Data Safety:**
- No database writes - only localStorage
- Safe to clear user localStorage
- No backend state to clean up

## Testing

### Flag OFF Behavior (Default)

1. Verify feature flag is `false`
2. Build and run the app
3. No "Lite"/"Full" indicator visible
4. No `/admindashboard/settings` Low Bandwidth panel
5. All images load normally (no lazy loading attributes)
6. App behaves identically to pre-feature state

### Flag ON Behavior

1. Set `FEATURE_LOW_BANDWIDTH_MODE = true`
2. Build and run the app
3. "Full" indicator visible in bottom-right
4. Click indicator → toggles to "Lite"
5. Body gets `.low-bandwidth-mode` class
6. Animations disabled (check with DevTools)
7. Images have `loading="lazy"` and `decoding="async"`

### Admin Settings

1. Login as admin
2. Navigate to `/admindashboard/settings`
3. See "Low Bandwidth Mode Settings" panel
4. Toggle "Global Default Setting" ON
5. Open app in incognito window
6. Indicator shows "Lite" (global default active)
7. Toggle user override to "Full"
8. localStorage shows user override

### Slow 3G Test

1. Open DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Navigate to `/explore/global`
4. Enable Lite mode via indicator
5. Images load progressively with lazy loading
6. Verify smooth scrolling (no layout shift)

### Forced Failure Test

1. Open DevTools → Network tab
2. Set throttling to "Offline" briefly
3. Try to load a quiz
4. See retry happening (check Network tab)
5. After retry fails, see "Connection unstable — tap retry" message
6. Verify no infinite retry loop

## Validation Checklist

- [x] Feature flag default OFF
- [x] No database writes (localStorage only)
- [x] localStorage keys: `ss_low_bw_global_default`, `ss_low_bw_user_override`
- [x] OptimizedImage component (no patching existing images)
- [x] Retry on 5xx/429 + network errors (1 retry, 500ms delay)
- [x] No infinite retries
- [x] Zero routing changes
- [x] No SEO/meta changes
- [x] No quiz creation/publishing changes
- [x] Animations disabled only when Lite mode ON
- [x] Rollback < 2 minutes (flip flag, rebuild, deploy)

## Cache Keys

All cache keys are prefixed with `cache_` and stored in localStorage:

- Format: `cache_{key}`
- TTL: 10 minutes
- Example: `cache_quiz_abc123`, `cache_topics_math`

## Where fetchWithRetry Should Be Applied

Currently implemented as a utility ready to use in:
- Quiz question loading (if using direct fetch)
- API calls that need retry logic
- Any network requests that may encounter 5xx/429 errors

**Note:** Current implementation uses Supabase client which has its own retry logic, so fetchWithRetry is provided as a utility for future use with direct fetch calls.

## Hard Rules (Enforced)

1. **Zero routing changes** - All routes remain unchanged
2. **No SEO/meta changes** - No modifications to metadata or OG tags
3. **No quiz creation/publishing logic changes** - Quiz workflow untouched
4. **Heavy animations disabled only when Lite mode ON** - Respects user preference
5. **No database writes** - localStorage only
6. **No infinite retries** - Maximum 1 retry attempt

## Future Enhancements (Not in P0.5)

- Database persistence of global settings
- Per-route caching strategies
- Image compression/WebP conversion
- Service worker for offline support
- Analytics tracking of Lite mode usage
