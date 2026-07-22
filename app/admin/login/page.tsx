"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn, type SignInState } from "./actions";
import { AuthCard } from "../AuthCard";

const INITIAL: SignInState = {};

export default function AdminLoginPage() {
  const [state, formAction, pending] = useActionState(signIn, INITIAL);

  return (
    <AuthCard title="Admin access" subtitle="Equilibris waitlist console">
      <form className="admin-auth-form" action={formAction}>
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
          {pending ? "Authenticating…" : "Sign in"}
        </button>

        <Link className="admin-link" href="/admin/forgot-password">
          Forgot your password?
        </Link>
      </form>
    </AuthCard>
  );
}
