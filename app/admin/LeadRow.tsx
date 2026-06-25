"use client";

import { resendConfirmation, deleteLead } from "./actions";

/** A serializable, pre-formatted row (dates formatted server-side to avoid
 * timezone/hydration mismatch). */
export type LeadRowData = {
  id: string;
  email: string;
  name: string | null;
  source: string;
  createdAt: string;
  verifiedAt: string | null;
};

export function LeadRow({ lead }: { lead: LeadRowData }) {
  const verified = lead.verifiedAt !== null;

  return (
    <tr>
      <td className="admin-email">{lead.email}</td>
      <td>{lead.name ?? <span className="admin-muted">—</span>}</td>
      <td>{lead.source}</td>
      <td className="admin-nowrap">{lead.createdAt}</td>
      <td>
        {verified ? (
          <span className="admin-badge admin-badge-ok">{lead.verifiedAt}</span>
        ) : (
          <span className="admin-badge admin-badge-pending">pending</span>
        )}
      </td>
      <td className="admin-row-actions">
        {!verified && (
          <form action={resendConfirmation}>
            <input type="hidden" name="leadId" value={lead.id} />
            <button className="admin-btn admin-btn-sm" type="submit">
              Resend
            </button>
          </form>
        )}
        <form
          action={deleteLead}
          onSubmit={(event) => {
            if (!window.confirm(`Delete ${lead.email}? This cannot be undone.`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="leadId" value={lead.id} />
          <button className="admin-btn admin-btn-sm admin-btn-danger" type="submit">
            Delete
          </button>
        </form>
      </td>
    </tr>
  );
}
