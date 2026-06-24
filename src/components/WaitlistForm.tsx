"use client";

import { useState } from "react";

type Status = "idle" | "submitting" | "success" | "error";

/**
 * Waitlist capture form. Uses the `.form` / `.field` / `.submit` / `.form-note`
 * classes already defined in app/globals.css.
 *
 * NOTE: this is a UI-complete stub. Wire `submit()` to the real backend
 * (Supabase `users` + email-verification `tokens`) once the API route exists —
 * see the TODO below.
 */
export default function WaitlistForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("submitting");
    try {
      // TODO: POST to /api/waitlist — insert into Supabase `users`, issue an
      // email-verification token, and send the verification email.
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      setStatus("success");
    } catch {
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p className="form-note" role="status">
        You&rsquo;re on the list — check your inbox to confirm your email.
      </p>
    );
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <div className="field">
        <label htmlFor="waitlist-name">
          Name <span className="opt">(optional)</span>
        </label>
        <input
          id="waitlist-name"
          name="name"
          type="text"
          autoComplete="name"
          placeholder="Jane Doe"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="waitlist-email">
          Email <span className="req">*</span>
        </label>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <button className="submit" type="submit" disabled={status === "submitting"}>
        {status === "submitting" ? "Joining…" : "Join the Waitlist"}
      </button>

      {status === "error" && (
        <p className="form-note" role="alert">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
