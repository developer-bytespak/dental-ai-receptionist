"use client";

/**
 * The right hand column's lower half: the paper trail.
 *
 * Three views over the same call. The access log is what an auditor would ask
 * for, consent is what a recording notice has to prove, and the queue is the
 * honest answer to "what happens when the agent cannot do it".
 *
 * The toggle at the foot swaps the transcript in the call panel for the
 * redacted copy, which is the version the practice actually keeps.
 */

import { useState } from "react";
import type { AuditRow, ConsentRow, Counts, QueueRow } from "@/app/hooks/useDemoState";

export interface CompliancePanelProps {
  audit: AuditRow[];
  consent: ConsentRow[];
  queue: QueueRow[];
  counts: Counts;
  showStored: boolean;
  storedBusy: boolean;
  canShowStored: boolean;
  onToggleStored: () => void;
}

type Tab = "audit" | "consent" | "queue";

const TIME_FMT = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

function time(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "--:--:--" : TIME_FMT.format(d);
}

function outcomeClass(outcome: string): string {
  if (/denied|error|fail|refus/i.test(outcome)) return "pill pill-error";
  if (/not_found|queued|partial|warn|conflict/i.test(outcome)) return "pill pill-warn";
  return "pill pill-ok";
}

const CONSENT_COPY: Record<string, string> = {
  recording_notice: "Recording notice given",
  ai_disclosure: "Disclosed as an AI assistant",
  sms_opt_in: "Text reminders, opted in",
  sms_opt_out: "Text reminders, opted out",
  call_opt_out: "Asked not to be called again",
};

export default function CompliancePanel(props: CompliancePanelProps) {
  const { audit, consent, queue, counts, showStored, storedBusy, canShowStored, onToggleStored } =
    props;
  const [tab, setTab] = useState<Tab>("audit");

  const newestFirst = <T,>(rows: T[]): T[] => rows.slice().reverse();

  return (
    <section className="panel" aria-label="Compliance record">
      <div className="panel-head">
        <h2 className="panel-title">Compliance</h2>
        <p className="panel-sub">Written as the call happens, not after it</p>
      </div>

      <div className="counts">
        <div className="count">
          <div className="count-n num">{counts.audit_rows}</div>
          <div className="count-l">Access log rows</div>
        </div>
        <div className="count">
          <div className="count-n num">{counts.consent_rows}</div>
          <div className="count-l">Consent events</div>
        </div>
        <div className="count">
          <div className="count-n num">{counts.queue_open}</div>
          <div className="count-l">Open for front desk</div>
        </div>
        <div className="count is-accent">
          <div className="count-n num">{counts.ai_booked}</div>
          <div className="count-l">Booked by the agent</div>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Compliance views">
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={tab === "audit"}
          onClick={() => setTab("audit")}
        >
          Audit log <span className="tab-count num">{audit.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={tab === "consent"}
          onClick={() => setTab("consent")}
        >
          Consent <span className="tab-count num">{consent.length}</span>
        </button>
        <button
          type="button"
          role="tab"
          className="tab"
          aria-selected={tab === "queue"}
          onClick={() => setTab("queue")}
        >
          Queue <span className="tab-count num">{queue.length}</span>
        </button>
      </div>

      <div className="log scroll" role="tabpanel" aria-live="polite">
        {tab === "audit" ? (
          audit.length === 0 ? (
            <div className="empty">
              <strong>No access yet.</strong> Every time the agent touches the schedule, a
              row lands here with who asked, what they asked for, and how it ended. Patient
              references are salted hashes, never names.
            </div>
          ) : (
            newestFirst(audit).map((row) => (
              <div className="log-row" key={String(row.id)}>
                <span className="log-time">{time(row.occurred_at)}</span>
                <span className="log-main">
                  <span className="log-action">{row.action.replace(/_/g, " ")}</span>
                  <span className="log-sub">
                    {row.actor}
                    {row.patient_ref ? ` · ref ${row.patient_ref.slice(0, 10)}` : ""}
                    {row.location ? ` · ${row.location}` : ""}
                  </span>
                </span>
                <span className={outcomeClass(row.outcome)}>{row.outcome}</span>
              </div>
            ))
          )
        ) : null}

        {tab === "consent" ? (
          consent.length === 0 ? (
            <div className="empty">
              <strong>No consent events yet.</strong> The agent states that the call is
              recorded and that it is an AI assistant, and each of those is written here
              with the script version and the last four digits of the number, never the
              whole number.
            </div>
          ) : (
            newestFirst(consent).map((row) => (
              <div className="log-row" key={String(row.id)}>
                <span className="log-time">{time(row.occurred_at)}</span>
                <span className="log-main">
                  <span className="log-action">
                    {CONSENT_COPY[row.kind] ?? row.kind.replace(/_/g, " ")}
                  </span>
                  <span className="log-sub">
                    script {row.script_ver} {"·"} {row.channel} {"·"} ends{" "}
                    {row.phone_last4}
                  </span>
                </span>
                <span className="pill pill-accent">{row.kind.split("_")[0]}</span>
              </div>
            ))
          )
        ) : null}

        {tab === "queue" ? (
          queue.length === 0 ? (
            <div className="empty">
              <strong>Nothing waiting.</strong> When the agent cannot finish something
              safely, it does not guess. It takes a callback note and drops it here for a
              person, and tells the caller that is what it has done.
            </div>
          ) : (
            newestFirst(queue).map((row) => (
              <div className="log-row" key={String(row.id)}>
                <span className="log-time">{time(row.created_at)}</span>
                <span className="log-main">
                  <span className="log-action">{row.reason.replace(/_/g, " ")}</span>
                  <span className="log-sub">
                    {row.location} {"·"} item {String(row.id)}
                  </span>
                </span>
                <span className={row.fulfilled_at ? "pill pill-ok" : "pill pill-warn"}>
                  {row.fulfilled_at ? "done" : "open"}
                </span>
              </div>
            ))
          )
        ) : null}
      </div>

      <div className="switchbar">
        <button
          type="button"
          className="switch"
          aria-pressed={showStored}
          aria-label="Show what gets stored"
          onClick={onToggleStored}
          disabled={!canShowStored || storedBusy}
        />
        <span className="switch-text">
          <span className="switch-label">Show what gets stored</span>
          <span className="switch-hint">
            {canShowStored
              ? "Swaps the transcript for the redacted copy the practice keeps."
              : "Available once there is a transcript to redact."}
          </span>
        </span>
      </div>
    </section>
  );
}
