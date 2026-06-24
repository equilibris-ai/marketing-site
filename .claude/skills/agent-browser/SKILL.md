---
name: agent-browser
description: Use when the user wants to visually debug the local app, check how a page looks, inspect layout issues, take screenshots of localhost, or automate any browser task (forms, clicks, scraping, testing). Triggers: "what does this look like", "take a screenshot", "check the UI", "open a page locally", "fill out a form", "click a button", "scrape data", "test this flow", "open a website", "automate browser actions".
allowed-tools: Bash(bunx agent-browser:*)
---

# Browser Automation with agent-browser

The CLI uses Chrome/Chromium via CDP directly. It is installed as a project dependency — use `bunx agent-browser` (or alias `bunx agent-browser` as needed). Run `bunx agent-browser install` once to download Chrome.

## Core Workflow

Every browser automation follows this pattern:

1. **Navigate**: `agent-browser open <url>`
2. **Snapshot**: `agent-browser snapshot -i` (get element refs like `@e1`, `@e2`)
3. **Interact**: Use refs to click, fill, select
4. **Re-snapshot**: After navigation or DOM changes, get fresh refs

```bash
bunx agent-browser open https://example.com/form
bunx agent-browser snapshot -i
# Output: @e1 [input type="email"], @e2 [input type="password"], @e3 [button] "Submit"

bunx agent-browser fill @e1 "user@example.com"
bunx agent-browser fill @e2 "password123"
bunx agent-browser click @e3
bunx agent-browser wait --load networkidle
bunx agent-browser snapshot -i  # Check result
```

## Command Chaining

Commands can be chained with `&&` in a single shell invocation. The browser persists between commands via a background daemon, so chaining is safe and more efficient than separate calls.

```bash
# Chain open + wait + snapshot in one call
bunx agent-browser open https://example.com && bunx agent-browser wait --load networkidle && bunx agent-browser snapshot -i

# Chain multiple interactions
bunx agent-browser fill @e1 "user@example.com" && bunx agent-browser fill @e2 "password123" && bunx agent-browser click @e3

# Navigate and capture
bunx agent-browser open https://example.com && bunx agent-browser wait --load networkidle && bunx agent-browser screenshot page.png
```

**When to chain:** Use `&&` when you don't need to read the output of an intermediate command before proceeding (e.g., open + wait + screenshot). Run commands separately when you need to parse the output first (e.g., snapshot to discover refs, then interact using those refs).

## Authentication (Local Dev)

If a page requires login, prefer reusing an existing session over scripting the login form
every time (see [Session Persistence](#session-persistence) below and
[references/authentication.md](references/authentication.md)). If the app supports a dev
login bypass (e.g. a `?token=` query param or a seeded test user), ask the user for the
value rather than guessing one. Next.js dev servers typically run on `localhost:3000`.

## Essential Commands

```bash
# Navigation
bunx agent-browser open <url>              # Navigate (aliases: goto, navigate)
bunx agent-browser close                   # Close browser

# Snapshot
bunx agent-browser snapshot -i             # Interactive elements with refs (recommended)
bunx agent-browser snapshot -i -C          # Include cursor-interactive elements (divs with onclick, cursor:pointer)
bunx agent-browser snapshot -s "#selector" # Scope to CSS selector

# Interaction (use @refs from snapshot)
bunx agent-browser click @e1               # Click element
bunx agent-browser click @e1 --new-tab     # Click and open in new tab
bunx agent-browser fill @e2 "text"         # Clear and type text
bunx agent-browser type @e2 "text"         # Type without clearing
bunx agent-browser select @e1 "option"     # Select dropdown option
bunx agent-browser check @e1               # Check checkbox
bunx agent-browser press Enter             # Press key
bunx agent-browser keyboard type "text"    # Type at current focus (no selector)
bunx agent-browser keyboard inserttext "text"  # Insert without key events
bunx agent-browser scroll down 500         # Scroll page
bunx agent-browser scroll down 500 --selector "div.content"  # Scroll within a specific container

# Get information
bunx agent-browser get text @e1            # Get element text
bunx agent-browser get url                 # Get current URL
bunx agent-browser get title               # Get page title
bunx agent-browser get cdp-url             # Get CDP WebSocket URL

# Wait
bunx agent-browser wait @e1                # Wait for element
bunx agent-browser wait --load networkidle # Wait for network idle
bunx agent-browser wait --url "**/page"    # Wait for URL pattern
bunx agent-browser wait 2000               # Wait milliseconds
bunx agent-browser wait --text "Welcome"    # Wait for text to appear (substring match)
bunx agent-browser wait --fn "!document.body.innerText.includes('Loading...')"  # Wait for text to disappear
bunx agent-browser wait "#spinner" --state hidden  # Wait for element to disappear

# Downloads
bunx agent-browser download @e1 ./file.pdf          # Click element to trigger download
bunx agent-browser wait --download ./output.zip     # Wait for any download to complete
bunx agent-browser --download-path ./downloads open <url>  # Set default download directory

# Network
bunx agent-browser network requests                 # Inspect tracked requests
bunx agent-browser network route "**/api/*" --abort  # Block matching requests
bunx agent-browser network har start                # Start HAR recording
bunx agent-browser network har stop ./capture.har   # Stop and save HAR file

# Viewport & Device Emulation
bunx agent-browser set viewport 1920 1080          # Set viewport size (default: 1280x720)
bunx agent-browser set viewport 1920 1080 2        # 2x retina (same CSS size, higher res screenshots)
bunx agent-browser set device "iPhone 14"          # Emulate device (viewport + user agent)

# Capture
bunx agent-browser screenshot              # Screenshot to temp dir
bunx agent-browser screenshot --full       # Full page screenshot
bunx agent-browser screenshot --annotate   # Annotated screenshot with numbered element labels
bunx agent-browser screenshot --screenshot-dir ./shots  # Save to custom directory
bunx agent-browser screenshot --screenshot-format jpeg --screenshot-quality 80
bunx agent-browser pdf output.pdf          # Save as PDF

# Clipboard
bunx agent-browser clipboard read                      # Read text from clipboard
bunx agent-browser clipboard write "Hello, World!"     # Write text to clipboard
bunx agent-browser clipboard copy                      # Copy current selection
bunx agent-browser clipboard paste                     # Paste from clipboard

# Diff (compare page states)
bunx agent-browser diff snapshot                          # Compare current vs last snapshot
bunx agent-browser diff snapshot --baseline before.txt    # Compare current vs saved file
bunx agent-browser diff screenshot --baseline before.png  # Visual pixel diff
bunx agent-browser diff url <url1> <url2>                 # Compare two pages
bunx agent-browser diff url <url1> <url2> --wait-until networkidle  # Custom wait strategy
bunx agent-browser diff url <url1> <url2> --selector "#main"  # Scope to element
```

## Batch Execution

Execute multiple commands in a single invocation by piping a JSON array of string arrays to `batch`. This avoids per-command process startup overhead when running multi-step workflows.

```bash
echo '[
  ["open", "https://example.com"],
  ["snapshot", "-i"],
  ["click", "@e1"],
  ["screenshot", "result.png"]
]' | bunx agent-browser batch --json

# Stop on first error
bunx agent-browser batch --bail < commands.json
```

Use `batch` when you have a known sequence of commands that don't depend on intermediate output. Use separate commands or `&&` chaining when you need to parse output between steps (e.g., snapshot to discover refs, then interact).

## Common Patterns

### Form Submission

```bash
bunx agent-browser open https://example.com/signup
bunx agent-browser snapshot -i
bunx agent-browser fill @e1 "Jane Doe"
bunx agent-browser fill @e2 "jane@example.com"
bunx agent-browser select @e3 "California"
bunx agent-browser check @e4
bunx agent-browser click @e5
bunx agent-browser wait --load networkidle
```

### Authentication

Reuse a saved session where possible — see [Authentication (Local Dev)](#authentication-local-dev) above and [Session Persistence](#session-persistence) below.

### Session Persistence

```bash
# Auto-save/restore cookies and localStorage across browser restarts
bunx agent-browser --session-name myapp open https://app.example.com/login
# ... login flow ...
bunx agent-browser close  # State auto-saved to ~/.agent-browser/sessions/

# Next time, state is auto-loaded
bunx agent-browser --session-name myapp open https://app.example.com/dashboard

# Encrypt state at rest
export AGENT_BROWSER_ENCRYPTION_KEY=$(openssl rand -hex 32)
bunx agent-browser --session-name secure open https://app.example.com

# Manage saved states
bunx agent-browser state list
bunx agent-browser state show myapp-default.json
bunx agent-browser state clear myapp
bunx agent-browser state clean --older-than 7
```

### Working with Iframes

Iframe content is automatically inlined in snapshots. Refs inside iframes carry frame context, so you can interact with them directly.

```bash
bunx agent-browser open https://example.com/checkout
bunx agent-browser snapshot -i
# @e1 [heading] "Checkout"
# @e2 [Iframe] "payment-frame"
#   @e3 [input] "Card number"
#   @e4 [input] "Expiry"
#   @e5 [button] "Pay"

# Interact directly — no frame switch needed
bunx agent-browser fill @e3 "4111111111111111"
bunx agent-browser fill @e4 "12/28"
bunx agent-browser click @e5

# To scope a snapshot to one iframe:
bunx agent-browser frame @e2
bunx agent-browser snapshot -i         # Only iframe content
bunx agent-browser frame main          # Return to main frame
```

### Data Extraction

```bash
bunx agent-browser open https://example.com/products
bunx agent-browser snapshot -i
bunx agent-browser get text @e5           # Get specific element text
bunx agent-browser get text body > page.txt  # Get all page text

# JSON output for parsing
bunx agent-browser snapshot -i --json
bunx agent-browser get text @e1 --json
```

### Parallel Sessions

```bash
bunx agent-browser --session site1 open https://site-a.com
bunx agent-browser --session site2 open https://site-b.com

bunx agent-browser --session site1 snapshot -i
bunx agent-browser --session site2 snapshot -i

bunx agent-browser session list
```

### Connect to Existing Chrome

```bash
# Auto-discover running Chrome with remote debugging enabled
bunx agent-browser --auto-connect open https://example.com
bunx agent-browser --auto-connect snapshot

# Or with explicit CDP port
bunx agent-browser --cdp 9222 snapshot
```

Auto-connect discovers Chrome via `DevToolsActivePort`, common debugging ports (9222, 9229), and falls back to a direct WebSocket connection if HTTP-based CDP discovery fails.

### Color Scheme (Dark Mode)

```bash
# Persistent dark mode via flag (applies to all pages and new tabs)
bunx agent-browser --color-scheme dark open https://example.com

# Or via environment variable
AGENT_BROWSER_COLOR_SCHEME=dark bunx agent-browser open https://example.com

# Or set during session (persists for subsequent commands)
bunx agent-browser set media dark
```

### Viewport & Responsive Testing

```bash
# Set a custom viewport size (default is 1280x720)
bunx agent-browser set viewport 1920 1080
bunx agent-browser screenshot desktop.png

# Test mobile-width layout
bunx agent-browser set viewport 375 812
bunx agent-browser screenshot mobile.png

# Retina/HiDPI: same CSS layout at 2x pixel density
# Screenshots stay at logical viewport size, but content renders at higher DPI
bunx agent-browser set viewport 1920 1080 2
bunx agent-browser screenshot retina.png

# Device emulation (sets viewport + user agent in one step)
bunx agent-browser set device "iPhone 14"
bunx agent-browser screenshot device.png
```

The `scale` parameter (3rd argument) sets `window.devicePixelRatio` without changing CSS layout. Use it when testing retina rendering or capturing higher-resolution screenshots.

### Visual Browser (Debugging)

```bash
bunx agent-browser --headed open https://example.com
bunx agent-browser highlight @e1          # Highlight element
bunx agent-browser inspect                # Open Chrome DevTools for the active page
bunx agent-browser record start demo.webm # Record session
bunx agent-browser profiler start         # Start Chrome DevTools profiling
bunx agent-browser profiler stop trace.json # Stop and save profile (path optional)
```

Use `AGENT_BROWSER_HEADED=1` to enable headed mode via environment variable. Browser extensions work in both headed and headless mode.

### Local Files (PDFs, HTML)

```bash
# Open local files with file:// URLs
bunx agent-browser --allow-file-access open file:///path/to/document.pdf
bunx agent-browser --allow-file-access open file:///path/to/page.html
bunx agent-browser screenshot output.png
```

### iOS Simulator (Mobile Safari)

```bash
# List available iOS simulators
bunx agent-browser device list

# Launch Safari on a specific device
bunx agent-browser -p ios --device "iPhone 16 Pro" open https://example.com

# Same workflow as desktop - snapshot, interact, re-snapshot
bunx agent-browser -p ios snapshot -i
bunx agent-browser -p ios tap @e1          # Tap (alias for click)
bunx agent-browser -p ios fill @e2 "text"
bunx agent-browser -p ios swipe up         # Mobile-specific gesture

# Take screenshot
bunx agent-browser -p ios screenshot mobile.png

# Close session (shuts down simulator)
bunx agent-browser -p ios close
```

**Requirements:** macOS with Xcode, Appium (`npm install -g appium && appium driver install xcuitest`)

**Real devices:** Works with physical iOS devices if pre-configured. Use `--device "<UDID>"` where UDID is from `xcrun xctrace list devices`.

## Security

All security features are opt-in. By default, agent-browser imposes no restrictions on navigation, actions, or output.

### Content Boundaries (Recommended for AI Agents)

Enable `--content-boundaries` to wrap page-sourced output in markers that help LLMs distinguish tool output from untrusted page content:

```bash
export AGENT_BROWSER_CONTENT_BOUNDARIES=1
bunx agent-browser snapshot
# Output:
# --- AGENT_BROWSER_PAGE_CONTENT nonce=<hex> origin=https://example.com ---
# [accessibility tree]
# --- END_AGENT_BROWSER_PAGE_CONTENT nonce=<hex> ---
```

### Domain Allowlist

Restrict navigation to trusted domains. Wildcards like `*.example.com` also match the bare domain `example.com`. Sub-resource requests, WebSocket, and EventSource connections to non-allowed domains are also blocked. Include CDN domains your target pages depend on:

```bash
export AGENT_BROWSER_ALLOWED_DOMAINS="example.com,*.example.com"
bunx agent-browser open https://example.com        # OK
bunx agent-browser open https://malicious.com       # Blocked
```

### Action Policy

Use a policy file to gate destructive actions:

```bash
export AGENT_BROWSER_ACTION_POLICY=./policy.json
```

Example `policy.json`:

```json
{ "default": "deny", "allow": ["navigate", "snapshot", "click", "scroll", "wait", "get"] }
```

Auth vault operations (`auth login`, etc.) bypass action policy but domain allowlist still applies.

### Output Limits

Prevent context flooding from large pages:

```bash
export AGENT_BROWSER_MAX_OUTPUT=50000
```

## Diffing (Verifying Changes)

Use `diff snapshot` after performing an action to verify it had the intended effect. This compares the current accessibility tree against the last snapshot taken in the session.

```bash
# Typical workflow: snapshot -> action -> diff
bunx agent-browser snapshot -i          # Take baseline snapshot
bunx agent-browser click @e2            # Perform action
bunx agent-browser diff snapshot        # See what changed (auto-compares to last snapshot)
```

For visual regression testing or monitoring:

```bash
# Save a baseline screenshot, then compare later
bunx agent-browser screenshot baseline.png
# ... time passes or changes are made ...
bunx agent-browser diff screenshot --baseline baseline.png

# Compare staging vs production
bunx agent-browser diff url https://staging.example.com https://prod.example.com --screenshot
```

`diff snapshot` output uses `+` for additions and `-` for removals, similar to git diff. `diff screenshot` produces a diff image with changed pixels highlighted in red, plus a mismatch percentage.

## Timeouts and Slow Pages

The default timeout is 25 seconds. This can be overridden with the `AGENT_BROWSER_DEFAULT_TIMEOUT` environment variable (value in milliseconds). For slow websites or large pages, use explicit waits instead of relying on the default timeout:

```bash
# Wait for network activity to settle (best for slow pages)
bunx agent-browser wait --load networkidle

# Wait for a specific element to appear
bunx agent-browser wait "#content"
bunx agent-browser wait @e1

# Wait for a specific URL pattern (useful after redirects)
bunx agent-browser wait --url "**/dashboard"

# Wait for a JavaScript condition
bunx agent-browser wait --fn "document.readyState === 'complete'"

# Wait a fixed duration (milliseconds) as a last resort
bunx agent-browser wait 5000
```

When dealing with consistently slow websites, use `wait --load networkidle` after `open` to ensure the page is fully loaded before taking a snapshot. If a specific element is slow to render, wait for it directly with `wait <selector>` or `wait @ref`.

## Session Management and Cleanup

When running multiple agents or automations concurrently, always use named sessions to avoid conflicts:

```bash
# Each agent gets its own isolated session
bunx agent-browser --session agent1 open site-a.com
bunx agent-browser --session agent2 open site-b.com

# Check active sessions
bunx agent-browser session list
```

Always close your browser session when done to avoid leaked processes:

```bash
bunx agent-browser close                    # Close default session
bunx agent-browser --session agent1 close   # Close specific session
```

If a previous session was not closed properly, the daemon may still be running. Use `agent-browser close` to clean it up before starting new work.

To auto-shutdown the daemon after a period of inactivity (useful for ephemeral/CI environments):

```bash
AGENT_BROWSER_IDLE_TIMEOUT_MS=60000 bunx agent-browser open example.com
```

## Ref Lifecycle (Important)

Refs (`@e1`, `@e2`, etc.) are invalidated when the page changes. Always re-snapshot after:

- Clicking links or buttons that navigate
- Form submissions
- Dynamic content loading (dropdowns, modals)

```bash
bunx agent-browser click @e5              # Navigates to new page
bunx agent-browser snapshot -i            # MUST re-snapshot
bunx agent-browser click @e1              # Use new refs
```

## Annotated Screenshots (Vision Mode)

Use `--annotate` to take a screenshot with numbered labels overlaid on interactive elements. Each label `[N]` maps to ref `@eN`. This also caches refs, so you can interact with elements immediately without a separate snapshot.

```bash
bunx agent-browser screenshot --annotate
# Output includes the image path and a legend:
#   [1] @e1 button "Submit"
#   [2] @e2 link "Home"
#   [3] @e3 textbox "Email"
bunx agent-browser click @e2              # Click using ref from annotated screenshot
```

Use annotated screenshots when:

- The page has unlabeled icon buttons or visual-only elements
- You need to verify visual layout or styling
- Canvas or chart elements are present (invisible to text snapshots)
- You need spatial reasoning about element positions

## Semantic Locators (Alternative to Refs)

When refs are unavailable or unreliable, use semantic locators:

```bash
bunx agent-browser find text "Sign In" click
bunx agent-browser find label "Email" fill "user@test.com"
bunx agent-browser find role button click --name "Submit"
bunx agent-browser find placeholder "Search" type "query"
bunx agent-browser find testid "submit-btn" click
```

## JavaScript Evaluation (eval)

Use `eval` to run JavaScript in the browser context. **Shell quoting can corrupt complex expressions** -- use `--stdin` or `-b` to avoid issues.

```bash
# Simple expressions work with regular quoting
bunx agent-browser eval 'document.title'
bunx agent-browser eval 'document.querySelectorAll("img").length'

# Complex JS: use --stdin with heredoc (RECOMMENDED)
bunx agent-browser eval --stdin <<'EVALEOF'
JSON.stringify(
  Array.from(document.querySelectorAll("img"))
    .filter(i => !i.alt)
    .map(i => ({ src: i.src.split("/").pop(), width: i.width }))
)
EVALEOF

# Alternative: base64 encoding (avoids all shell escaping issues)
bunx agent-browser eval -b "$(echo -n 'Array.from(document.querySelectorAll("a")).map(a => a.href)' | base64)"
```

**Why this matters:** When the shell processes your command, inner double quotes, `!` characters (history expansion), backticks, and `$()` can all corrupt the JavaScript before it reaches agent-browser. The `--stdin` and `-b` flags bypass shell interpretation entirely.

**Rules of thumb:**

- Single-line, no nested quotes -> regular `eval 'expression'` with single quotes is fine
- Nested quotes, arrow functions, template literals, or multiline -> use `eval --stdin <<'EVALEOF'`
- Programmatic/generated scripts -> use `eval -b` with base64

## Configuration File

Create `agent-browser.json` in the project root for persistent settings:

```json
{
  "headed": true,
  "proxy": "http://localhost:8080",
  "profile": "./browser-data"
}
```

Priority (lowest to highest): `~/.agent-browser/config.json` < `./agent-browser.json` < env vars < CLI flags. Use `--config <path>` or `AGENT_BROWSER_CONFIG` env var for a custom config file (exits with error if missing/invalid). All CLI options map to camelCase keys (e.g., `--executable-path` -> `"executablePath"`). Boolean flags accept `true`/`false` values (e.g., `--headed false` overrides config). Extensions from user and project configs are merged, not replaced.

## Deep-Dive Documentation

| Reference                                                            | When to Use                                               |
| -------------------------------------------------------------------- | --------------------------------------------------------- |
| [references/commands.md](references/commands.md)                     | Full command reference with all options                   |
| [references/snapshot-refs.md](references/snapshot-refs.md)           | Ref lifecycle, invalidation rules, troubleshooting        |
| [references/session-management.md](references/session-management.md) | Parallel sessions, state persistence, concurrent scraping |
| [references/authentication.md](references/authentication.md)         | Login flows, OAuth, 2FA handling, state reuse             |
| [references/video-recording.md](references/video-recording.md)       | Recording workflows for debugging and documentation       |
| [references/profiling.md](references/profiling.md)                   | Chrome DevTools profiling for performance analysis        |
| [references/proxy-support.md](references/proxy-support.md)           | Proxy configuration, geo-testing, rotating proxies        |

## Browser Engine Selection

Use `--engine` to choose a local browser engine. The default is `chrome`.

```bash
# Use Lightpanda (fast headless browser, requires separate install)
bunx agent-browser --engine lightpanda open example.com

# Via environment variable
export AGENT_BROWSER_ENGINE=lightpanda
bunx agent-browser open example.com

# With custom binary path
bunx agent-browser --engine lightpanda --executable-path /path/to/lightpanda open example.com
```

Supported engines:

- `chrome` (default) -- Chrome/Chromium via CDP
- `lightpanda` -- Lightpanda headless browser via CDP (10x faster, 10x less memory than Chrome)

Lightpanda does not support `--extension`, `--profile`, `--state`, or `--allow-file-access`. Install Lightpanda from https://lightpanda.io/docs/open-source/installation.
