"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";

const INITIAL: SignInState = {};

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);

  return (
    <div className="admin-login">
      <form className="admin-card admin-login-form" action={formAction}>
        <h1 className="admin-title">Admin sign in</h1>
        <p className="admin-sub">Equilibris waitlist dashboard</p>

        <label className="admin-label" htmlFor="email">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="admin-input"
        />

        <label className="admin-label" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="admin-input"
        />

        {state.error && (
          <p className="admin-error" role="alert">
            {state.error}
          </p>
        )}

        <button className="admin-btn admin-btn-primary" type="submit" disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
