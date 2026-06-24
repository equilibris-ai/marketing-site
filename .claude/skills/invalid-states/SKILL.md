---
name: invalid-states
description: Apply "Make Invalid States Unrepresentable" pattern for TypeScript/React with FSD. Use when creating state types, reviewing props, or designing hooks with complex state. Eliminates runtime bugs through compile-time type safety.
---

# Make Invalid States Unrepresentable

**Core Principle:** Use the type system to make bugs impossible at compile time rather than catching them at runtime.

This skill guides you through applying discriminated unions (tagged unions) to represent state where only one variant is valid at a time.

---

## When to Invoke This Skill

Use `/invalid-states` when:

1. **Creating new types/interfaces for state** - Any state with multiple exclusive variants
2. **Reviewing component props** - Props with conflicting optional fields
3. **Designing hooks that return complex state** - Especially async or multi-phase operations
4. **Refactoring existing boolean flag patterns** - When you see `isLoading && !error && data` checks
5. **Creating form state machines** - Multi-step forms with validation phases

---

## Step 1: Identify Anti-Patterns

Look for these red flags in code:

### Anti-Pattern 1: Multiple Boolean Flags

```typescript
// ANTI-PATTERN: Can represent impossible states
interface AsyncState<T> {
  data?: T
  isLoading: boolean
  error?: Error
}

// Problem: Can be loading=true AND have error AND have data simultaneously!
// Requires defensive checks everywhere:
if (!isLoading && !error && data) {
  // Safe to use data... maybe?
}
```

### Anti-Pattern 2: Conflicting Optional Props

```typescript
// ANTI-PATTERN: Button that can be button OR link, but props don't enforce exclusivity
interface Props {
  href?: string // Makes it a link
  onClick?: VoidFunction // Makes it a button
  disabled?: boolean // Only valid for button
  target?: string // Only valid for link
}

// Problem: What if both href AND onClick are provided?
// Problem: What if disabled is true but it has href?
```

### Anti-Pattern 3: RTK Query Wrappers Without Discrimination

```typescript
// ANTI-PATTERN: Separate flags that can be inconsistent
const useCampaign = (id: UUID) => {
  const { data, error, isLoading } = useGetCampaignQuery({ id })

  return {
    campaign: data?.campaign ?? null, // null even when not loading?
    error: error ? getErrorMessage(error) : undefined,
    isLoading
  }
}
```

### Anti-Pattern 4: Switch Without Exhaustiveness

```typescript
// ANTI-PATTERN: Adding new enum value won't cause compile error
type Status = 'pending' | 'active' | 'completed'

function handleStatus(status: Status): string {
  switch (status) {
    case 'pending':
      return 'Waiting...'
    case 'active':
      return 'In Progress'
    // Forgot 'completed' - NO compile error!
  }
}
```

---

## Step 2: Apply Discriminated Union Pattern

### Pattern 1: AsyncState with Status Discriminant

**Before:**

```typescript
interface AsyncState<T> {
  data?: T
  isLoading: boolean
  error?: Error
}
```

**After:**

```typescript
type AsyncState<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: E }
  | { status: 'success'; data: T }

// Usage - TypeScript enforces correct access:
function renderContent(state: AsyncState<User>) {
  switch (state.status) {
    case 'idle':
      return <Placeholder />
    case 'loading':
      return <Spinner />
    case 'error':
      return <Error message={state.error.message} /> // .error exists here!
    case 'success':
      return <UserCard user={state.data} /> // .data exists here!
  }
}
```

### Pattern 2: Exclusive Component Variants

**Before:**

```typescript
interface Props {
  href?: string
  onClick?: VoidFunction
  disabled?: boolean
}
```

**After:**

```typescript
type ButtonBaseProps = {
  children: React.ReactNode
  className?: string
}

type ButtonAsButton = ButtonBaseProps & {
  as?: 'button'
  onClick: VoidFunction
  disabled?: boolean
}

type ButtonAsLink = ButtonBaseProps & {
  as: 'link'
  href: string
  target?: '_blank' | '_self'
}

type Props = ButtonAsButton | ButtonAsLink

// Usage - TypeScript enforces correct props:
const MyButton: React.FC<Props> = (props) => {
  if (props.as === 'link') {
    // TypeScript knows props.href exists, props.disabled does NOT
    return <a href={props.href} target={props.target}>{props.children}</a>
  }
  // TypeScript knows props.onClick exists, props.href does NOT
  return <button onClick={props.onClick} disabled={props.disabled}>{props.children}</button>
}
```

### Pattern 3: Form State Machine

**Before:**

```typescript
interface FormState {
  values: FormValues
  errors?: Record<string, string>
  isValidating: boolean
  isSubmitting: boolean
  isSubmitted: boolean
  submitError?: Error
}
```

**After:**

```typescript
type FormState<T> =
  | { phase: 'editing'; values: T }
  | { phase: 'validating'; values: T }
  | { phase: 'invalid'; values: T; errors: Record<string, string> }
  | { phase: 'submitting'; values: T }
  | { phase: 'submitted'; values: T; result: SubmitResult }
  | { phase: 'submitError'; values: T; error: Error }
```

### Pattern 4: RTK Query Wrapper with Discriminated Return

**Before:**

```typescript
export const useCampaign = (id: UUID) => {
  const { data, error, isLoading } = useGetCampaignQuery({ id })

  return {
    campaign: data?.campaign ?? null,
    error: error ? getErrorMessage(error) : undefined,
    isLoading
  }
}
```

**After:**

```typescript
type CampaignState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: string }
  | { status: 'success'; data: CRM.Campaign }

export const useCampaign = (id: UUID): CampaignState => {
  const { data, error, isLoading } = useGetCampaignQuery({ id })

  if (isLoading) return { status: 'loading' }
  if (error) return { status: 'error', error: getErrorMessage(error) }
  if (data?.campaign) return { status: 'success', data: data.campaign }
  return { status: 'idle' }
}

// Usage in component - exhaustive and type-safe:
const CampaignView: React.FC<{ id: UUID }> = ({ id }) => {
  const state = useCampaign(id)

  switch (state.status) {
    case 'idle':
    case 'loading':
      return <CampaignSkeleton />
    case 'error':
      return <ErrorMessage error={state.error} />
    case 'success':
      return <CampaignDetails campaign={state.data} />
  }
}
```

---

## Step 3: Type Utilities (Copy-Paste)

### AsyncState Type

```typescript
/**
 * Discriminated union for async operations.
 * Data only exists on success, error only exists on error.
 */
type AsyncState<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: E }
  | { status: 'success'; data: T }

// Type guards
function isSuccess<T, E>(state: AsyncState<T, E>): state is { status: 'success'; data: T } {
  return state.status === 'success'
}

function isError<T, E>(state: AsyncState<T, E>): state is { status: 'error'; error: E } {
  return state.status === 'error'
}

function isLoading<T, E>(state: AsyncState<T, E>): state is { status: 'loading' } {
  return state.status === 'loading'
}
```

### AsyncState with Refetch Support

```typescript
/**
 * AsyncState variant for RTK Query patterns where you can refetch
 * while still showing stale data.
 */
type AsyncStateWithRefetch<T, E = Error> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: E }
  | { status: 'success'; data: T; isRefetching: false }
  | { status: 'refetching'; data: T; isRefetching: true }
```

### Exhaustive Check Utility

```typescript
/**
 * Compile-time exhaustiveness check for switch statements.
 * Use in default case - if a new union member is added, TypeScript will error.
 */
function exhaustiveCheck(value: never, message?: string): never {
  throw new Error(message ?? `Unhandled case: ${JSON.stringify(value)}`)
}

// Usage:
type Status = 'pending' | 'active' | 'completed'

function handleStatus(status: Status): string {
  switch (status) {
    case 'pending':
      return 'Waiting...'
    case 'active':
      return 'In Progress'
    case 'completed':
      return 'Done!'
    default:
      return exhaustiveCheck(status) // Compile error if case is missing!
  }
}
```

### Result Type

```typescript
/**
 * Result type for operations that can succeed or fail.
 * Alternative to throwing exceptions.
 */
type Result<T, E = Error> = { ok: true; value: T } | { ok: false; error: E }

function ok<T>(value: T): Result<T, never> {
  return { ok: true, value }
}

function err<E>(error: E): Result<never, E> {
  return { ok: false, error }
}

// Usage:
function parseJSON<T>(json: string): Result<T, SyntaxError> {
  try {
    return ok(JSON.parse(json) as T)
  } catch (e) {
    return err(e as SyntaxError)
  }
}

const result = parseJSON<User>(jsonString)
if (result.ok) {
  console.log(result.value.name) // TypeScript knows value exists
} else {
  console.error(result.error.message) // TypeScript knows error exists
}
```

---

## Step 4: FSD Placement Guide

### Entity-Specific State Types

```
app/javascript/domains/{domain}/
├── entities/
│   └── {entity}/
│       ├── types/
│       │   └── state.ts    # Entity-specific discriminated unions
│       └── lib/
│           └── use{Entity}.ts  # Hook returning discriminated state
```

### Feature State Machines

```
app/javascript/domains/{domain}/
├── features/
│   └── {Feature}/
│       ├── types/
│       │   └── state.ts    # Feature state machine type
│       └── lib/
│           └── use{Feature}State.ts
```

### Shared Type Utilities

If you create reusable utilities like `AsyncState`, place them in:

```
app/javascript/shared/lib/types/
├── asyncState.ts
├── result.ts
├── exhaustive.ts
└── index.ts
```

---

## Step 5: Codebase Examples

### Good Pattern: Toast Types

**Location:** `app/javascript/domains/notificationCenter/entities/toasts/types.ts`

Uses `code` as discriminant - each toast type has unique code and type-safe meta:

```typescript
type ToastData<Code extends ToastCode, Meta extends object> = {
  code: Code
  meta: Meta
}

type ToastPropsGeneric = ToastData<ToastCode.GenericToast, GenericToastArgs>
type ToastPropsBulkDownload = ToastData<ToastCode.BulkDownloadPreparationStarted, { selectedItemsCount: number }>

type ToastDatas = ToastPropsGeneric | ToastPropsBulkDownload | ToastPropsDownloadReady
// ... exhaustive union
```

### Anti-Pattern: useAsyncEffect

**Location:** `app/javascript/shared/lib/effects/useAsyncEffect.ts`

Current (anti-pattern):

```typescript
interface UseAsyncEffectResult {
  result: unknown
  error: unknown
  isLoading: boolean
}
```

Recommended refactoring:

```typescript
type UseAsyncEffectResult<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; result: T }
```

---

## Step 6: Good Patterns In This Codebase

Reference these existing patterns when implementing:

### Modal Type Registry

**Location:** `app/javascript/shared/ui/kit/Modals/modalIdMapping.ts`

Excellent pattern - type-safe modal ID to props mapping:

```typescript
export const MODALS = {
  DownloadCSVUpsellModal: () => import('...'),
  DeleteWorkspaceModal: () => import('...')
} as const satisfies Record<string, ModalLoader>

export type ModalId = keyof typeof MODALS

// Computed type: each modal ID maps to correct props
type ModalArgs = {
  [K in ModalId]: Awaited<ReturnType<(typeof MODALS)[K]>>['Modal']
}

export type ModalMapping = {
  [key in ModalId]: {
    id: key
    args: ComponentProps<ModalArgs[key]> // Type-safe!
  }
}
```

### tryCatch Result Type

**Location:** `app/javascript/shared/lib/tryCatch.ts`

Already implements discriminated Result pattern:

```typescript
type Success<T> = { data: T; error: null }
type Failure<E> = { data: null; error: E }
type Result<T, E = Error> = Success<T> | Failure<E>

// Usage: impossible to have both data AND error
const result = await tryCatch(fetchUser())
if (result.error) {
  // TypeScript knows result.data is null
} else {
  // TypeScript knows result.data exists
}
```

### Opaque/Branded Types

**Location:** `app/javascript/shared/types/time.d.ts`

Uses `ts-essentials` Opaque for type-safe units:

```typescript
import { Opaque } from 'ts-essentials'

type Milliseconds = Opaque<number, 'Milliseconds'>
type Seconds = Opaque<number, 'Seconds'>

// Extend this pattern for IDs:
type UserId = Opaque<string, 'UserId'>
type ShopId = Opaque<string, 'ShopId'>
type CampaignId = Opaque<string, 'CampaignId'>

// Prevents: updateUser(shopId) - compile error!
```

### CustomAttributeEnriched Union

**Location:** `app/javascript/domains/crm/shared/types.ts`

30+ variant discriminated union with proper type extraction:

```typescript
type CustomAttributeEnriched =
  | CustomAttributeString
  | CustomAttributeStringList
  | CustomAttributeUrl
  | CustomAttributeEmail
// ... 30+ more variants

// Extract specific variant types:
type CustomAttributeValueMap = {
  [K in CustomAttributeTypeEnum]: Extract<CustomAttributeField, { type: K }>['value']
}
```

---

## Step 7: Additional Anti-Patterns Found

### Selection Dual-State

**Location:** `useBulkSelection.ts`

```typescript
// ANTI-PATTERN: Both can be truthy simultaneously
const [selectedIds, setSelectedIds] = useState<UUID[]>([])
const [isSelectAll, setIsSelectAll] = useState(false)
const [unselectedIds, setUnselectedIds] = useState<UUID[]>([])

// Confusing: isSelectAll=true AND selectedIds.length > 0 ?
```

**Fix:**

```typescript
type SelectionState = { mode: 'none' } | { mode: 'individual'; ids: UUID[] } | { mode: 'all'; exceptIds: UUID[] }
```

### Form Checkbox Flags

**Location:** `BulkModal.component.tsx`

```typescript
// ANTI-PATTERN: N² invalid combinations
const { isUsageRightsChecked, isWhitelistingChecked } = useScopeSelectData()
const submitDisabled = (!isUsageRightsChecked && !isWhitelistingChecked) || !isAllowedToSend
```

**Fix:**

```typescript
type ScopeSelection = { scope: 'none' } | { scope: 'usageRights' } | { scope: 'whitelisting' } | { scope: 'both' }
```

### Modal + Optional Data Race

**Location:** `CreatorProfileModal.component.tsx`

```typescript
// ANTI-PATTERN: Must check null before using
const [refreshRequest, setRefreshRequest] = useState<{
  requestId: UUID
  pendingInfluencerIds: UUID[]
} | null>(null)

const isWaitingForPullCompletion = refreshRequest !== null // Manual check
```

**Fix:**

```typescript
type RefreshState = { status: 'idle' } | { status: 'waiting'; requestId: UUID; pendingIds: UUID[] }
```

---

## Step 8: Advanced TypeScript Patterns

### Template Literal Types

For validated strings at compile time:

```typescript
// Event names
type Domain = 'crm' | 'auth' | 'social'
type Action = 'created' | 'updated' | 'deleted'
type EventName = `${Domain}.${Action}` // 'crm.created' | 'crm.updated' | ...

// Route paths
type RoutePath = `/${string}`
type ApiPath = `/api/${string}`
```

### `as const satisfies` Pattern

Compile-time validation without losing literal types:

```typescript
const ROUTES = {
  home: '/',
  campaign: '/campaigns/:id',
  settings: '/settings'
} as const satisfies Record<string, string>

// Type is still literal: typeof ROUTES.home = '/'
// But validated against Record<string, string> at compile time
```

---

## Step 9: Hook Return Patterns

### Codebase Convention: Object Returns Only

This codebase **never** uses tuple returns for custom hooks:

```typescript
// CORRECT (universal in codebase)
return { value, setValue, isLoading }

// NEVER USED
return [value, setValue]
```

**Why:** Objects are self-documenting and don't depend on position.

### Derived Boolean Helpers

From `useCreatorViewMode.ts` - good pattern for clarity:

```typescript
const isCreatorView = // ... some condition

// Derive readable helpers
const shouldShowCreatorView = isCreatorView
const shouldShowCrmView = !isCreatorView

return {
  isCreatorView,
  shouldShowCreatorView,  // Clearer than !isCreatorView in JSX
  shouldShowCrmView
}
```

### When to Consider useReducer

Codebase uses `useState` + `useMemo` but consider `useReducer` when:

- 3+ related state variables that change together
- Complex transitions between states
- Need to prevent invalid state combinations
- State logic is getting hard to follow

```typescript
// Before: Multiple related useState
const [step, setStep] = useState<'idle' | 'loading' | 'done'>('idle')
const [data, setData] = useState<Data | null>(null)
const [error, setError] = useState<Error | null>(null)

// After: useReducer with discriminated union
type State = { step: 'idle' } | { step: 'loading' } | { step: 'done'; data: Data } | { step: 'error'; error: Error }

const [state, dispatch] = useReducer(reducer, { step: 'idle' })
```

---

## Step 10: Migration Checklist

When refactoring existing code:

```
[ ] Identify all boolean flag combinations in the existing type
[ ] Map each valid combination to a union member
[ ] Add a status/phase/variant discriminant field
[ ] Update all consumers to use switch/if on discriminant
[ ] Add exhaustiveCheck() to default cases
[ ] Remove defensive boolean checks (now type-safe)
[ ] Update tests to use specific state variants
[ ] Run pnpm lint:ts to verify no type errors
```

---

## Quick Reference

| Anti-Pattern                      | Fix                                                         |
| --------------------------------- | ----------------------------------------------------------- |
| `isLoading && !error && data`     | `state.status === 'success'`                                |
| `href?: string; onClick?: fn`     | `{ as: 'link'; href } \| { as: 'button'; onClick }`         |
| `data?: T; error?: E`             | `{ status: 'success'; data } \| { status: 'error'; error }` |
| `switch` without default          | Add `default: return exhaustiveCheck(x)`                    |
| `if (loading) ... if (error) ...` | `switch (state.status) { ... }`                             |

---

## Summary

This skill helps you:

1. **Identify** boolean flag anti-patterns in state and props
2. **Transform** them into discriminated unions with status/type/variant fields
3. **Apply** exhaustive checking to switch statements
4. **Place** types correctly in FSD architecture
5. **Migrate** existing RTK Query patterns to type-safe wrappers

**Remember:** The goal is to make the TypeScript compiler catch bugs that would otherwise only be found at runtime. If a state is impossible, the type system should make it impossible to represent.
