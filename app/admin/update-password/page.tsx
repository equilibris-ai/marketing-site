"use client";

import { useActionState } from "react";
import { updatePassword, type UpdatePasswordState } from "./actions";
import { AuthCard } from "../AuthCard";

const INITIAL: UpdatePasswordState = {};

export default function UpdatePasswordPage() {
  const [state, formAction, pending] = useActionState(updatePassword, INITIAL);

  return (
    <AuthCard title="New password" subtitle="Pick something strong you don't reuse elsewhere.">
      <form className="admin-auth-form" action={formAction}>
        <label className="admin-label" htmlFor="password">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="admin-input"
        />

        <label className="admin-label" htmlFor="confirm">
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          required
          minLength={10}
          autoComplete="new-password"
          className="admin-input"
        />

        {state.error && (
          <p className="admin-error" role="alert">
            {state.error}
          </p>
        )}

        <button className="admin-btn admin-btn-primary" type="submit" disabled={pending}>
          {pending ? "Saving…" : "Update password"}
        </button>
      </form>
    </AuthCard>
  );
}
