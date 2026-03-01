# Support Tickets Route Fix

## Issue
Admin could not access Support Inbox at `/admindashboard/support` - showing "Subject not found" error.

## Root Cause
The route `/admindashboard/support` was missing from the React Router configuration in `App.tsx`.

## Fix Applied

### 1. Added Missing Route in App.tsx
```tsx
<Route path="/admindashboard/support" element={<NewAdminDashboard />} />
```

### 2. Fixed Teacher Navigation
Changed the "View My Tickets" button in SupportPage.tsx from:
```tsx
navigate('/teacherdashboard/tickets')
```

To:
```tsx
navigate('/teacherdashboard?tab=tickets')
```

Teacher dashboard uses query parameters for tabs, not separate routes.

## Testing Steps

### Admin Access
1. Log in as admin
2. Go to `/admindashboard`
3. Click "Support Inbox" in sidebar
4. ✅ Page now loads correctly
5. ✅ Can view all tickets (once teachers create them)

### Teacher Flow
1. Log in as teacher
2. Go to Dashboard → Support
3. Fill out ticket form and submit
4. ✅ Success message appears
5. Click "View My Tickets"
6. ✅ Navigates to `/teacherdashboard?tab=tickets`
7. ✅ See list of your tickets

### Create Test Ticket
As a teacher, create a ticket:
- Category: Bug
- Subject: "Test ticket"
- Message: "This is a test"

Then as admin:
1. Go to Support Inbox
2. ✅ Ticket appears in list
3. Click ticket to open
4. ✅ Full details visible
5. Reply to ticket
6. ✅ Reply saved

## Files Modified
- `src/App.tsx` - Added `/admindashboard/support` route
- `src/components/teacher-dashboard/SupportPage.tsx` - Fixed navigation URL

## Status
✅ Fixed and ready for testing
