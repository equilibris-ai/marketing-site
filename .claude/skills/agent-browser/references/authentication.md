# Authentication

**Related**: [SKILL.md](../SKILL.md) for quick start.

Automating a login flow once and reusing the resulting session is almost always better than
re-scripting the form on every run.

## Reuse a saved session (preferred)

```bash
# Log in once with a named session — cookies + localStorage are saved on close
bunx agent-browser --session-name myapp open https://app.example.com/login
# ... drive the login form / OAuth flow ...
bunx agent-browser --session-name myapp close

# Subsequent runs auto-restore the authenticated session
bunx agent-browser --session-name myapp open https://app.example.com/dashboard
```

Encrypt saved state at rest when it contains credentials:

```bash
export AGENT_BROWSER_ENCRYPTION_KEY=$(openssl rand -hex 32)
bunx agent-browser --session-name secure open https://app.example.com
```

## Dev login bypass

Many apps expose a development-only shortcut (a `?token=` query param, a magic-link URL, or a
seeded test user) so you can skip an external identity provider locally. If one exists, ask
the user for the exact value — do not invent a token. Once the page loads, the session cookie
is set and you can navigate freely within that session.

## OAuth / SSO / 2FA

Third-party redirect flows (Auth0, Google, Okta, etc.) generally cannot be fully automated
headlessly. Either run `--headed` and complete the flow interactively once, then save the
session, or use the app's dev bypass if available.
