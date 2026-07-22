import Image from "next/image";

/**
 * Branded "secure terminal" frame shared by every admin auth screen
 * (sign in, reset request, set new password). Renders the Equilibris glyph,
 * a live status line, and the title/subtitle; callers supply the form body.
 */
export function AuthCard({
  title,
  subtitle,
  children,
}: Readonly<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}>) {
  return (
    <div className="admin-auth">
      <section className="admin-auth-card">
        <header className="admin-auth-head">
          <Image
            src="/assets/images/logos/equilibris-logo-symbol.png"
            alt="Equilibris"
            width={52}
            height={52}
            className="admin-auth-mark"
            priority
          />
          <span className="admin-auth-status">
            <span className="admin-dot" aria-hidden="true" />
            secure&nbsp;terminal
          </span>
        </header>
        <h1 className="admin-auth-title">{title}</h1>
        <p className="admin-auth-sub">{subtitle}</p>
        {children}
      </section>
    </div>
  );
}
