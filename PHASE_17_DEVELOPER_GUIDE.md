# Phase 17: Developer Quick Reference

## Toast Notifications

### Usage
```typescript
'use client';  // Must be client component
import { useToast } from '@/components/ToastProvider';

export function MyComponent() {
  const { success, error, warning, info } = useToast();
  
  // Show success toast
  success('Operation completed!');
  
  // Show error toast (default 5s duration)
  error('Failed to save');
  
  // Custom duration (10 seconds)
  warning('Check your input', 10000);
  
  // Info toast
  info('Processing in background');
}
```

### Toast Types
- **success** - Green, checkmark icon
- **error** - Red, X icon
- **warning** - Yellow, alert icon
- **info** - Blue, info icon

---

## Error Handling in API Routes

### Standard Pattern
```typescript
import { handleApiError, ErrorMessages } from '@/lib/errorHandling';

export async function POST(req: Request) {
  try {
    // Your logic here
    const result = await doSomething();
    
    return NextResponse.json({ 
      success: true,
      data: result 
    });
    
  } catch (error) {
    console.error('[my-route]', error);  // Server-side log
    return handleApiError(error, 'Failed to process request');
  }
}
```

### Available Error Messages
```typescript
import { ErrorMessages } from '@/lib/errorHandling';

ErrorMessages.UNAUTHORIZED      // 'Authentication required'
ErrorMessages.FORBIDDEN          // 'You do not have permission...'
ErrorMessages.NOT_FOUND          // 'Resource not found'
ErrorMessages.BAD_REQUEST        // 'Invalid request'
ErrorMessages.VALIDATION_FAILED  // 'Validation failed'
ErrorMessages.INTERNAL_ERROR     // 'An error occurred...'
ErrorMessages.DATABASE_ERROR     // 'Database operation failed'
ErrorMessages.CONFLICT           // 'Resource already exists...'
```

### Database Error Sanitization
```typescript
import { sanitizeDatabaseError } from '@/lib/errorHandling';

try {
  await supabase.from('table').insert(data);
} catch (error) {
  // Converts DB errors to safe messages
  const safeMessage = sanitizeDatabaseError(error);
  return NextResponse.json({ error: safeMessage }, { status: 500 });
}
```

---

## Error Boundary

### Already Integrated
Error boundaries are automatically active at the root level. No additional setup needed.

### Custom Error Boundary (Optional)
```typescript
import { ErrorBoundary } from '@/components/ErrorBoundary';

export function MyComponent() {
  return (
    <ErrorBoundary fallback={<div>Custom error UI</div>}>
      <ChildComponentThatMightError />
    </ErrorBoundary>
  );
}
```

---

## Responsive Design

### Grid Layouts
```tsx
{/* Mobile: 1 col, Tablet: 2 cols, Desktop: 3 cols */}
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

{/* Mobile: 1 col, Desktop: 2 cols */}
<div className="grid gap-4 lg:grid-cols-2">
  <div>Left</div>
  <div>Right</div>
</div>
```

### Flex Layouts
```tsx
{/* Stack on mobile, row on desktop */}
<div className="flex flex-col md:flex-row gap-4">
  <div>Left</div>
  <div>Right</div>
</div>

{/* Wrap items on small screens */}
<div className="flex flex-wrap gap-2">
  <button>Action 1</button>
  <button>Action 2</button>
  <button>Action 3</button>
</div>
```

### Hide/Show Elements
```tsx
{/* Hidden on mobile, visible on tablet+ */}
<div className="hidden md:block">
  Desktop only content
</div>

{/* Visible on mobile, hidden on desktop */}
<div className="block md:hidden">
  Mobile only content
</div>
```

---

## Common Patterns

### API Route with Toast Feedback
```typescript
// API Route (backend)
export async function POST(req: Request) {
  try {
    // ... logic
    return NextResponse.json({ 
      success: true,
      message: 'Action completed successfully'  // ← Frontend can show this
    });
  } catch (error) {
    console.error('[my-action]', error);
    return handleApiError(error, 'Failed to complete action');
  }
}

// Component (frontend)
'use client';
import { useToast } from '@/components/ToastProvider';

export function MyComponent() {
  const { success, error } = useToast();
  
  const handleAction = async () => {
    try {
      const res = await fetch('/api/admin/my-action', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      const result = await res.json();
      
      if (res.ok) {
        success(result.message || 'Success!');
      } else {
        error(result.error || 'Something went wrong');
      }
    } catch (err) {
      error('Network error');
    }
  };
  
  return <button onClick={handleAction}>Do Action</button>;
}
```

### React Query with Toast
```typescript
'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ToastProvider';

export function MyComponent() {
  const { success, error } = useToast();
  const queryClient = useQueryClient();
  
  const mutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch('/api/admin/something', {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      success(data.message || 'Success!');
      queryClient.invalidateQueries({ queryKey: ['myData'] });
    },
    onError: (err: Error) => {
      error(err.message || 'Something went wrong');
    }
  });
  
  return (
    <button 
      onClick={() => mutation.mutate(formData)}
      disabled={mutation.isPending}
    >
      {mutation.isPending ? 'Loading...' : 'Submit'}
    </button>
  );
}
```

---

## Security Checklist

### ✅ DO
- Use `handleApiError()` in all API route catch blocks
- Log full errors server-side with `console.error('[context]', error)`
- Return generic error messages to clients
- Use `ErrorMessages` constants for common errors
- Test error responses don't leak sensitive info

### ❌ DON'T
- Return `error.message` directly to clients
- Expose database errors to clients
- Include stack traces in API responses
- Return detailed validation errors with schema info
- Leak file paths, credentials, or internal implementation details

---

## Testing

### Test Toast Notifications
```typescript
// In your component
const { success } = useToast();

// Trigger toast
success('Test notification');

// Verify:
// - Toast appears top-right
// - Green background with checkmark
// - Auto-dismisses after 5 seconds
// - Manual dismiss button works
// - Dark mode styling works
```

### Test Error Sanitization
```typescript
// In API route, intentionally throw database error
throw new Error('duplicate key value violates unique constraint "users_email_key"');

// Should return to client:
{ error: "A record with this value already exists" }

// NOT return:
{ error: "duplicate key value violates unique constraint \"users_email_key\"" }
```

### Test Responsive Design
```
Mobile:   375px, 414px  (iPhone SE, iPhone 12)
Tablet:   768px, 1024px (iPad)
Desktop:  1280px, 1920px (Laptop, Desktop)

Check:
- No horizontal scroll
- Buttons are touch-friendly (44px min)
- Text is readable (16px+ font size)
- Grids collapse to single column on mobile
```

---

## Migration Guide

### Existing Code → Phase 17 Pattern

**Before:**
```typescript
catch (error: any) {
  return NextResponse.json({ 
    error: error.message || 'Failed' 
  }, { status: 500 });
}
```

**After:**
```typescript
import { handleApiError } from '@/lib/errorHandling';

catch (error: any) {
  console.error('[my-route]', error);
  return handleApiError(error, 'Failed to process');
}
```

---

## Troubleshooting

### Toast not showing?
- Ensure component is marked `'use client'`
- Check ToastProvider is in root layout
- Verify no z-index conflicts (toasts use z-50)

### Error boundary not catching errors?
- Error boundaries only catch rendering errors
- They don't catch async errors or event handler errors
- Use try-catch in async functions

### Responsive design broken?
- Check for fixed widths (`w-[500px]`)
- Use `max-w-*` instead of `w-*`
- Add `overflow-x-auto` to tables
- Test on actual devices, not just browser resize

---

## Reference Links

- [Toast Provider Implementation](../src/components/ToastProvider.tsx)
- [Error Handling Utils](../src/lib/errorHandling.ts)
- [Error Boundary](../src/components/ErrorBoundary.tsx)
- [Phase 17 Report](./PHASE_17_COMPLETE.md)
