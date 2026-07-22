"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { requestReset, type ForgotState } from "./actions";
import { AuthCard } from "../AuthCard";

const INITIAL: ForgotState = {};

function ForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(requestReset, INITIAL);
  // The /admin/reset handler bounces back here with ?error=expired when a link
  // is stale or invalid.
  const expired = useSearchParams().get("error") === "expired";

  if (state.sent) {
    return (
      <AuthCard
        title="Check your inbox"
        subtitle="If that email belongs to an admin, a reset link is on its way. It expires shortly — use it soon."
      >
        <Link className="admin-btn admin-btn-primary admin-btn-link" href="/admin/login">
          Back to sign in
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard title="Reset password" subtitle="We'll email you a secure reset link.">
      <form className="admin-auth-form" action={formAction}>
        {expired && (
          <p className="admin-error" role="alert">
            That reset link has expired or was already used. Request a new one.
          </p>
        )}

        <label className="admin-label" htmlFor="email">
          Admin email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="admin-input"
        />

        {state.error && (
          <p className="admin-error" role="alert">
            {state.error}
          </p>
        )}

        <button className="admin-btn admin-btn-primary" type="submit" disabled={pending}>
          {pending ? "Sending…" : "Send reset link"}
        </button>

        <Link className="admin-link" href="/admin/login">
          Back to sign in
        </Link>
      </form>
    </AuthCard>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ForgotPasswordForm />
    </Suspense>
  );
}
