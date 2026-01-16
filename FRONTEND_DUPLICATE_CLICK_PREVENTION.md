# Frontend: Prevent Multiple Clicks on Next/Submit Buttons

## 🎯 Goal
Prevent users from clicking "Next" or "Submit" buttons multiple times, even though backend protection exists. This improves UX and reduces unnecessary network requests.

---

## ✅ Best Practices

### 1. **Disable Button During Request** ⭐ (MOST IMPORTANT)
Disable the button immediately when clicked and re-enable after the request completes.

### 2. **Show Loading State**
Display a loading spinner or text to indicate the request is in progress.

### 3. **Disable Form During Submission**
Prevent all form interactions while submitting.

### 4. **Use Request State Management**
Track if a request is in-flight using state.

### 5. **Handle Errors Properly**
Re-enable button if request fails.

---

## 📝 Implementation Examples

### **React with TypeScript - Complete Example**

#### **Option 1: Using useState Hook (Simple)**

```typescript
import { useState } from 'react';

const ClientForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const handleNext = async () => {
    // ✅ Prevent multiple clicks
    if (isSubmitting) {
      return; // Exit early if already submitting
    }

    try {
      setIsSubmitting(true); // Disable button immediately

      // Your API call
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Request failed');
      }

      const data = await response.json();

      // Move to next step
      setCurrentStep(currentStep + 1);
    } catch (error) {
      console.error('Error:', error);
      // Show error message to user
    } finally {
      setIsSubmitting(false); // Re-enable button
    }
  };

  return (
    <div>
      {/* Your form fields */}

      <button
        onClick={handleNext}
        disabled={isSubmitting} // ✅ Disable during submission
        className={isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}
      >
        {isSubmitting ? (
          <>
            <span className="spinner">⏳</span> Processing...
          </>
        ) : (
          'Next'
        )}
      </button>
    </div>
  );
};
```

---

#### **Option 2: Using useRef for Request Tracking (Advanced)**

```typescript
import { useState, useRef } from 'react';

const ClientForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const requestInFlight = useRef(false); // Track if request is active

  const handleNext = async () => {
    // ✅ Double protection: state + ref
    if (isSubmitting || requestInFlight.current) {
      console.log('Request already in progress, ignoring click');
      return;
    }

    try {
      setIsSubmitting(true);
      requestInFlight.current = true;

      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      // Handle success
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
      requestInFlight.current = false;
    }
  };

  return (
    <button
      onClick={handleNext}
      disabled={isSubmitting}
    >
      {isSubmitting ? 'Processing...' : 'Next'}
    </button>
  );
};
```

---

#### **Option 3: Custom Hook for Reusability**

```typescript
// hooks/useSubmitHandler.ts
import { useState, useCallback } from 'react';

export const useSubmitHandler = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(
    async (submitFn: () => Promise<any>) => {
      if (isSubmitting) {
        return; // Prevent multiple submissions
      }

      try {
        setIsSubmitting(true);
        setError(null);
        const result = await submitFn();
        return result;
      } catch (err: any) {
        setError(err.message || 'An error occurred');
        throw err; // Re-throw to allow caller to handle
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting]
  );

  return {
    isSubmitting,
    error,
    handleSubmit,
  };
};

// Usage in component
const ClientForm = () => {
  const { isSubmitting, error, handleSubmit } = useSubmitHandler();

  const onNext = async () => {
    await handleSubmit(async () => {
      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      return response.json();
    });
  };

  return (
    <div>
      {error && <div className="error">{error}</div>}
      <button onClick={onNext} disabled={isSubmitting}>
        {isSubmitting ? 'Processing...' : 'Next'}
      </button>
    </div>
  );
};
```

---

#### **Option 4: Multi-Step Form with Step-Specific Loading**

```typescript
import { useState } from 'react';

const MultiStepForm = () => {
  const [loadingStep, setLoadingStep] = useState<number | null>(null);
  const [currentStep, setCurrentStep] = useState(1);

  const handleStepSubmit = async (step: number, apiEndpoint: string, data: any) => {
    if (loadingStep !== null) {
      return; // Already processing a step
    }

    try {
      setLoadingStep(step); // Track which step is loading

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) throw new Error('Request failed');

      const result = await response.json();

      // Move to next step
      setCurrentStep(step + 1);
    } catch (error) {
      console.error(`Step ${step} error:`, error);
    } finally {
      setLoadingStep(null);
    }
  };

  const handleNextStep1 = () => {
    handleStepSubmit(1, '/api/clients', step1Data);
  };

  const handleNextStep2 = () => {
    handleStepSubmit(2, '/api/client-payments', step2Data);
  };

  const handleSubmitStep3 = () => {
    handleStepSubmit(3, '/api/client-product-payments', step3Data);
  };

  return (
    <div>
      {/* Step 1 */}
      {currentStep === 1 && (
        <button
          onClick={handleNextStep1}
          disabled={loadingStep === 1}
        >
          {loadingStep === 1 ? 'Saving...' : 'Next'}
        </button>
      )}

      {/* Step 2 */}
      {currentStep === 2 && (
        <button
          onClick={handleNextStep2}
          disabled={loadingStep === 2}
        >
          {loadingStep === 2 ? 'Saving...' : 'Next'}
        </button>
      )}

      {/* Step 3 */}
      {currentStep === 3 && (
        <button
          onClick={handleSubmitStep3}
          disabled={loadingStep === 3}
        >
          {loadingStep === 3 ? 'Submitting...' : 'Submit'}
        </button>
      )}
    </div>
  );
};
```

---

#### **Option 5: Using AbortController (Cancel Previous Requests)**

```typescript
import { useState, useRef, useEffect } from 'react';

const ClientForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const handleNext = async () => {
    if (isSubmitting) {
      return;
    }

    // Cancel any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        signal: abortController.signal, // ✅ Cancel if new request starts
      });

      const data = await response.json();
      // Handle success
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request was cancelled');
        return;
      }
      console.error('Error:', error);
    } finally {
      setIsSubmitting(false);
      abortControllerRef.current = null;
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return (
    <button onClick={handleNext} disabled={isSubmitting}>
      {isSubmitting ? 'Processing...' : 'Next'}
    </button>
  );
};
```

---

## 🎨 UI/UX Enhancements

### **Visual Feedback Examples**

```typescript
// Button with spinner
<button disabled={isSubmitting}>
  {isSubmitting ? (
    <>
      <Spinner size="small" />
      <span>Processing...</span>
    </>
  ) : (
    'Next'
  )}
</button>

// Button with progress indicator
<button disabled={isSubmitting}>
  {isSubmitting ? (
    <div className="flex items-center gap-2">
      <div className="animate-spin">⏳</div>
      <span>Saving client...</span>
    </div>
  ) : (
    'Next'
  )}
</button>

// Disabled state styling
<button
  disabled={isSubmitting}
  className={`
    px-4 py-2 rounded
    ${isSubmitting
      ? 'bg-gray-400 cursor-not-allowed opacity-50'
      : 'bg-blue-500 hover:bg-blue-600'
    }
  `}
>
  Next
</button>
```

---

## 🔒 Form-Level Protection

### **Disable Entire Form During Submission**

```typescript
const ClientForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      onSubmit={handleSubmit}
      className={isSubmitting ? 'pointer-events-none opacity-75' : ''}
    >
      <input
        type="text"
        disabled={isSubmitting}
        placeholder="Full Name"
      />

      <input
        type="date"
        disabled={isSubmitting}
      />

      <button
        type="submit"
        disabled={isSubmitting}
      >
        {isSubmitting ? 'Submitting...' : 'Submit'}
      </button>
    </form>
  );
};
```

---

## ⚡ Debouncing (Optional Extra Protection)

```typescript
import { useCallback, useRef } from 'react';

const useDebounce = (callback: Function, delay: number) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: any[]) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
};

// Usage
const ClientForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleNext = async () => {
    if (isSubmitting) return;
    // ... your logic
  };

  // Debounce the click handler (300ms delay)
  const debouncedHandleNext = useDebounce(handleNext, 300);

  return (
    <button onClick={debouncedHandleNext} disabled={isSubmitting}>
      Next
    </button>
  );
};
```

---

## 📋 Checklist for Frontend Implementation

### ✅ **Required (Must Have)**
- [ ] Disable button when `isSubmitting === true`
- [ ] Set `isSubmitting = true` immediately when button is clicked
- [ ] Set `isSubmitting = false` in `finally` block
- [ ] Show loading state (spinner/text) when submitting
- [ ] Early return if already submitting

### ✅ **Recommended (Should Have)**
- [ ] Disable form inputs during submission
- [ ] Show error message if request fails
- [ ] Use `useRef` for additional protection
- [ ] Visual feedback (opacity, cursor changes)

### ✅ **Optional (Nice to Have)**
- [ ] Debouncing (300ms delay)
- [ ] AbortController for request cancellation
- [ ] Custom hook for reusability
- [ ] Progress indicator

---

## 🚨 Common Mistakes to Avoid

### ❌ **DON'T:**
```typescript
// ❌ BAD: Only checking state, not preventing click
const handleNext = async () => {
  if (isSubmitting) {
    console.log('Already submitting');
    // Still allows the function to continue!
  }
  // ... rest of code
};

// ❌ BAD: Not using finally block
const handleNext = async () => {
  setIsSubmitting(true);
  try {
    await fetch(...);
  } catch (error) {
    // If error occurs, button stays disabled forever!
  }
  setIsSubmitting(false); // Only runs if no error
};

// ❌ BAD: Not disabling button
<button onClick={handleNext}>
  Next {/* Button still clickable! */}
</button>
```

### ✅ **DO:**
```typescript
// ✅ GOOD: Early return + disabled button
const handleNext = async () => {
  if (isSubmitting) return; // Exit immediately

  setIsSubmitting(true);
  try {
    await fetch(...);
  } catch (error) {
    // Handle error
  } finally {
    setIsSubmitting(false); // Always runs
  }
};

// ✅ GOOD: Button disabled
<button onClick={handleNext} disabled={isSubmitting}>
  {isSubmitting ? 'Processing...' : 'Next'}
</button>
```

---

## 🎯 Summary

**Minimum Implementation (Required):**
```typescript
const [isSubmitting, setIsSubmitting] = useState(false);

const handleNext = async () => {
  if (isSubmitting) return; // ✅ Early exit

  setIsSubmitting(true); // ✅ Disable immediately
  try {
    await apiCall();
  } finally {
    setIsSubmitting(false); // ✅ Always re-enable
  }
};

<button disabled={isSubmitting}> {/* ✅ Disable button */}
  {isSubmitting ? 'Processing...' : 'Next'}
</button>
```

**This simple pattern prevents 99% of duplicate click issues!**

---

## 🔗 Integration with Backend

The backend middleware (`preventDuplicateRequests`) provides **server-side protection** as a safety net. The frontend implementation provides **client-side UX** and reduces unnecessary network requests.

**Both layers work together:**
- **Frontend**: Prevents clicks, shows loading, better UX
- **Backend**: Prevents duplicate database operations, safety net

---

## 📚 Additional Resources

- React Hooks: https://react.dev/reference/react
- Fetch API: https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API
- AbortController: https://developer.mozilla.org/en-US/docs/Web/API/AbortController
