"use client";

import { type FormEvent, useState } from "react";

import { useAuditLogDetail } from "../hooks/use-audit-log-detail";
import { useAuditLogs } from "../hooks/use-audit-logs";
import {
  AUDIT_EVENT_CATEGORIES,
  type AuditEventCategory,
  type AuditLogListQuery,
} from "../types/audit-log.type";

import styles from "./audit-log-screen.module.css";

const PAGE_SIZE = 25;

type AppliedFilters = {
  eventCategory?: AuditEventCategory;
  action?: string;
};

function formatTimestamp(value: string): string {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-GB");
}

export function AuditLogScreen() {
  const [draftCategory, setDraftCategory] = useState<AuditEventCategory | "">(
    "",
  );
  const [draftAction, setDraftAction] = useState("");
  const [filters, setFilters] = useState<AppliedFilters>({});
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const query: AuditLogListQuery = {
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
    ...filters,
  };

  const logsQuery = useAuditLogs(query);
  const detailQuery = useAuditLogDetail(selectedId);
  const logs = logsQuery.data ?? [];

  const applyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const action = draftAction.trim().toUpperCase();
    setFilters({
      ...(draftCategory ? { eventCategory: draftCategory } : {}),
      ...(action ? { action } : {}),
    });
    setPage(0);
    setSelectedId(null);
  };

  const clearFilters = () => {
    setDraftCategory("");
    setDraftAction("");
    setFilters({});
    setPage(0);
    setSelectedId(null);
  };

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    setSelectedId(null);
  };

  return (
    <section className={styles.page} aria-labelledby="audit-log-heading">
      <div className={styles.heading}>
        <div>
          <h1 id="audit-log-heading">Audit Log</h1>
          <p>Read-only history of recorded Front Desk and hotel operations.</p>
        </div>
        <span className={styles.readOnly}>READ ONLY</span>
      </div>

      <form
        className={styles.filters}
        onSubmit={applyFilters}
        aria-label="Filter audit logs"
      >
        <div className={styles.field}>
          <label htmlFor="audit-category">EVENT CATEGORY</label>
          <select
            id="audit-category"
            value={draftCategory}
            onChange={(event) =>
              setDraftCategory(event.target.value as AuditEventCategory | "")
            }
          >
            <option value="">All categories</option>
            {AUDIT_EVENT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label htmlFor="audit-action">ACTION</label>
          <input
            id="audit-action"
            value={draftAction}
            onChange={(event) => setDraftAction(event.target.value)}
            maxLength={100}
            placeholder="e.g. CHECK_IN"
            aria-describedby="audit-action-help"
          />
          <span id="audit-action-help" className={styles.help}>
            Exact action match; case-insensitive.
          </span>
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.primaryButton}>
            Apply filters
          </button>
          <button
            type="button"
            onClick={clearFilters}
            className={styles.secondaryButton}
          >
            Clear
          </button>
        </div>
      </form>

      <div className={styles.panel}>
        <div className={styles.tableHeader}>
          <h2>Recorded Events</h2>
          <span>Latest first · 25 per page</span>
        </div>

        {logsQuery.isError ? (
          <div className={styles.state} role="alert">
            <p>Unable to load audit logs. Verify your session and try again.</p>
            <button type="button" onClick={() => void logsQuery.refetch()}>
              Retry loading
            </button>
          </div>
        ) : logsQuery.isPending ? (
          <p className={styles.state} role="status">
            Loading audit records...
          </p>
        ) : logs.length === 0 ? (
          <p className={styles.state}>
            No audit records found for these filters.
          </p>
        ) : (
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption className={styles.visuallyHidden}>
                Audit log records, newest first
              </caption>
              <thead>
                <tr>
                  <th scope="col">Created at</th>
                  <th scope="col">Category</th>
                  <th scope="col">Action</th>
                  <th scope="col">Actor</th>
                  <th scope="col">Entity</th>
                  <th scope="col">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => (
                  <tr key={entry.logId}>
                    <td>{formatTimestamp(entry.createdAt)}</td>
                    <td>
                      <span className={styles.category}>
                        {entry.eventCategory.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className={styles.actionText}>{entry.action}</td>
                    <td>
                      <span>{entry.actorType}</span>
                      {entry.staffUserId && (
                        <small className={styles.mono}>
                          {entry.staffUserId}
                        </small>
                      )}
                    </td>
                    <td>
                      <span>{entry.entityType}</span>
                      {entry.entityId && (
                        <small className={styles.mono}>{entry.entityId}</small>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        aria-expanded={selectedId === entry.logId}
                        aria-controls={
                          selectedId === entry.logId
                            ? "audit-log-details"
                            : undefined
                        }
                        onClick={() =>
                          setSelectedId(
                            selectedId === entry.logId ? null : entry.logId,
                          )
                        }
                        className={styles.detailButton}
                      >
                        {selectedId === entry.logId
                          ? "Hide details"
                          : "View details"}
                        <span className={styles.visuallyHidden}>
                          {" "}
                          for audit log {entry.logId}
                        </span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <nav className={styles.pagination} aria-label="Audit log pagination">
          <button
            type="button"
            disabled={page === 0 || logsQuery.isPending}
            onClick={() => changePage(page - 1)}
          >
            Previous
          </button>
          <span>Page {page + 1}</span>
          <button
            type="button"
            disabled={
              logsQuery.isPending ||
              logsQuery.isError ||
              logs.length < PAGE_SIZE
            }
            onClick={() => changePage(page + 1)}
          >
            Next
          </button>
        </nav>
      </div>

      {selectedId && (
        <section
          id="audit-log-details"
          className={styles.detailPanel}
          aria-labelledby="audit-detail-heading"
        >
          <div className={styles.detailHeading}>
            <h2 id="audit-detail-heading">Audit Event Details</h2>
            <button type="button" onClick={() => setSelectedId(null)}>
              Close details
            </button>
          </div>
          {detailQuery.isError ? (
            <div role="alert" className={styles.state}>
              Unable to retrieve this audit record.
              <button type="button" onClick={() => void detailQuery.refetch()}>
                Retry details
              </button>
            </div>
          ) : detailQuery.isPending ? (
            <p role="status">Loading audit details...</p>
          ) : detailQuery.data ? (
            <div className={styles.detailContent}>
              <dl className={styles.descriptionList}>
                <div>
                  <dt>Log ID</dt>
                  <dd>{detailQuery.data.logId}</dd>
                </div>
                <div>
                  <dt>Timestamp</dt>
                  <dd>{formatTimestamp(detailQuery.data.createdAt)}</dd>
                </div>
                <div>
                  <dt>Event category</dt>
                  <dd>{detailQuery.data.eventCategory}</dd>
                </div>
                <div>
                  <dt>Action</dt>
                  <dd>{detailQuery.data.action}</dd>
                </div>
                <div>
                  <dt>Actor type</dt>
                  <dd>{detailQuery.data.actorType}</dd>
                </div>
                <div>
                  <dt>Staff user</dt>
                  <dd>{detailQuery.data.staffUserId ?? "—"}</dd>
                </div>
                <div>
                  <dt>Entity type</dt>
                  <dd>{detailQuery.data.entityType}</dd>
                </div>
                <div>
                  <dt>Entity ID</dt>
                  <dd>{detailQuery.data.entityId ?? "—"}</dd>
                </div>
              </dl>
              <h3>Additional metadata</h3>
              <pre className={styles.json}>
                {JSON.stringify(detailQuery.data.details ?? {}, null, 2)}
              </pre>
              <p className={styles.help}>
                Sensitive values are redacted by the FDS backend.
              </p>
            </div>
          ) : null}
        </section>
      )}
    </section>
  );
}
