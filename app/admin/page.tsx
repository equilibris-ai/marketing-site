import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { LeadRow, type LeadRowData } from "./LeadRow";

// Always render fresh — this is a live dashboard, never cache it.
export const dynamic = "force-dynamic";

/** Format a timestamp unambiguously in UTC (no server/client tz drift). */
function fmt(date: Date): string {
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

export default async function AdminPage() {
  const user = await requireAdmin();

  const leads = await prisma.lead.findMany({ orderBy: { createdAt: "desc" } });
  const total = leads.length;
  const confirmed = leads.filter((lead) => lead.verifiedAt).length;
  const pending = total - confirmed;
  const rate = total ? Math.round((confirmed / total) * 100) : 0;

  const rows: LeadRowData[] = leads.map((lead) => ({
    id: lead.id,
    email: lead.email,
    name: lead.name,
    source: lead.source,
    createdAt: fmt(lead.createdAt),
    verifiedAt: lead.verifiedAt ? fmt(lead.verifiedAt) : null,
  }));

  return (
    <main className="admin-wrap">
      <header className="admin-header">
        <div>
          <h1 className="admin-title">Waitlist</h1>
          <p className="admin-sub">Signed in as {user.email}</p>
        </div>
        <form action={signOut}>
          <button className="admin-btn" type="submit">
            Sign out
          </button>
        </form>
      </header>

      <section className="admin-stats">
        <div className="admin-card admin-stat">
          <span className="admin-stat-num">{total}</span>
          <span className="admin-stat-label">Total signups</span>
        </div>
        <div className="admin-card admin-stat">
          <span className="admin-stat-num">{confirmed}</span>
          <span className="admin-stat-label">Confirmed</span>
        </div>
        <div className="admin-card admin-stat">
          <span className="admin-stat-num">{pending}</span>
          <span className="admin-stat-label">Pending</span>
        </div>
        <div className="admin-card admin-stat">
          <span className="admin-stat-num">{rate}%</span>
          <span className="admin-stat-label">Conversion</span>
        </div>
      </section>

      <section className="admin-card admin-table-card">
        {total === 0 ? (
          <p className="admin-empty">No signups yet.</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Email</th>
                <th>Name</th>
                <th>Source</th>
                <th>Signed up</th>
                <th>Confirmed</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {rows.map((lead) => (
                <LeadRow key={lead.id} lead={lead} />
              ))}
            </tbody>
          </table>
        )}
      </section>
    </main>
  );
}
