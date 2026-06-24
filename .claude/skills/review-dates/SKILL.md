---
name: review-dates
description: >
  Proactively apply when editing or creating code that handles dates or timezones
  on frontend or backend. Ensures correct timezone patterns, avoids deprecated
  libraries, and prevents cross-timezone display bugs.
  Triggers on: date-fns, dayjs, formatDate, useDateUtils, formatInTimeZone,
  Date.now, new Date, timezone, time_zone, DATE_TRUNC, taken_at, post_date,
  IntervalPicker, time_series, chart.*date.
---

# Date & Timezone Handling Review

Apply these patterns when writing or modifying code that deals with dates, timezones, or time series.
Full reference: `docs/frontend/dates-and-timezones.md`.

---

## Core Principles

1. **Store and transmit in UTC.** All dates are ISO 8601 UTC in the database and over the wire.
2. **Convert to user timezone only at display.** Never use browser/system timezone.
3. **Use `date-fns` + `date-fns-tz`.** `dayjs` is deprecated. Never add new dayjs usage.

---

## Frontend — Deprecated Patterns (NEVER use in new code)

| Deprecated | Replacement |
|------------|-------------|
| `dayjs(...)` | `date-fns` functions or `formatInTimeZone` from `date-fns-tz` |
| `deprecated_dateToDay`, `deprecated_dateToHuman`, etc. | `formatInTimeZone(date, timezone, format)` |
| `deprecated_dateToMonth`, `deprecated_dateToYear` | `formatInTimeZone(date, timezone, format)` |
| `deprecated_dateTimeToHuman` | `formatInTimeZone(date, timezone, format)` |
| `deprecated_getLocalTimezone()` | `useDateUtils().timezone` (user's configured TZ) |
| `deprecated_localTimeToUtc(...)` | `useDateUtils().toUtc(...)` |
| `format(new Date(isoString), ...)` | `formatInTimeZone(isoString, timezone, ...)` |
| `new Date(isoString).toLocaleDateString()` | `useTranslate().formatDate(...)` |

---

## Frontend — Correct Patterns

### Displaying dates to users

```typescript
// Option 1: useTranslate (preferred for UI text)
const { formatDate } = useTranslate('crm')
formatDate(isoDate, { format: DATE_FORMATS.DATE })

// Option 2: formatInTimeZone (for charts, non-React contexts)
import { formatInTimeZone } from 'date-fns-tz'
formatInTimeZone(isoDate, timezone, DATE_FORMATS.DATE)
```

### Getting user timezone

```typescript
import { useDateUtils } from 'shared/lib/date'
const { timezone, toUtc, toZoned, nowUtc } = useDateUtils()
```

- `timezone` — user's configured timezone string (e.g., `'America/New_York'`)
- `toUtc(localDate)` — convert a date in user TZ to UTC
- `toZoned(utcDate)` — convert UTC to user TZ (for display)
- `nowUtc` — current time as UTC Date

### Time series charts (UTC grouping)

The backend groups time series via `DATE_TRUNC('day', field)` in **UTC**, then converts to user TZ for transport (`.in_time_zone.iso8601`). The frontend must format back in **UTC** to recover the correct bucket label:

```typescript
// ✅ CORRECT — UTC for chart axis labels matching backend grouping
formatInTimeZone(isoDate, 'UTC', DATE_FORMATS.DAY)

// ❌ WRONG — browser timezone shifts the date
format(new Date(isoDate), DATE_FORMATS.DAY)

// ❌ WRONG — stripping timezone then parsing as local
new Date(isoDate.replace(/Z|[+-]\d{2}:\d{2}$/, ''))
```

### Date manipulation

```typescript
// ✅ Use date-fns
import { add, sub, startOfDay, differenceInDays } from 'date-fns'

// ❌ Don't use dayjs
import dayjs from 'dayjs' // deprecated
```

### IntervalPicker (reports date range)

The `IntervalPicker` stores timezoned dates with a `tz` field so shared links work across timezones:

```typescript
{
  from: "timezoned ISO8601 string",
  to: "timezoned ISO8601 string",
  tz: "timezone in which from & to are calculated"
}
```

Always use `condition.value.tz || user.timezone` when interpreting these values.

---

## Backend — Correct Patterns

### GraphQL date types

```ruby
# ✅ Use custom types (enforce UTC)
field :date, Types::DateTimeWithZone, null: false
field :start_date, Types::DateWithZone, null: false

# ❌ Don't use deprecated types
field :date, GraphQL::Types::ISO8601DateTime  # rubocop will flag this
```

### Time-zone-aware operations

```ruby
# In GraphQL resolvers, Time.zone is set to user's timezone
DateTime.current  # ✅ timezone-aware
Time.zone.now     # ✅ timezone-aware
Time.now          # ❌ server timezone

# In Sidekiq workers, Time.zone is UTC (no current_user)
```

### Time series aggregation

```ruby
# Backend groups by UTC — this is intentional
DATE_TRUNC('day', taken_at)::TIMESTAMPTZ

# Output conversion to user timezone for transport
record.fetch('date').in_time_zone.iso8601
# Result: "2024-03-24T20:00:00-04:00" (EST user viewing Mar 25 UTC bucket)
```

---

## Common Bugs to Watch For

| Bug | Cause | Fix |
|-----|-------|-----|
| Chart dates shifted by 1 day per user | `format(new Date(iso), ...)` uses browser TZ | Use `formatInTimeZone(iso, 'UTC', ...)` for UTC-grouped data |
| Same data shows different dates for different users | Stripping TZ offset then parsing as local time | Parse with offset intact, format in target TZ |
| Date picker off by one day | Mixing UTC and local Date objects | Use `useDateUtils().toZoned()` consistently |
| Tooltip date doesn't match axis label | Axis uses one TZ, tooltip uses another | Use same timezone for both |

---

## Checklist

When reviewing date/timezone code:

- [ ] No new `dayjs` imports (use `date-fns` / `date-fns-tz`)
- [ ] No `deprecated_*` date functions from `shared/lib/date`
- [ ] No `format(new Date(isoString), ...)` — use `formatInTimeZone` instead
- [ ] No `new Date(string)` without understanding timezone implications
- [ ] Chart labels use UTC for UTC-grouped data
- [ ] User-facing dates use `useTranslate().formatDate()` or `formatInTimeZone(..., timezone, ...)`
- [ ] Backend uses `Types::DateTimeWithZone` / `Types::DateWithZone` for GraphQL fields
- [ ] No `Intl.DateTimeFormat().resolvedOptions().timeZone` (browser TZ) — use `useDateUtils().timezone` (user TZ)
