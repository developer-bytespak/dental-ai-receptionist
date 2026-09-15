"use client";

/**
 * The fixed ladder every booking climbs, in the order lib/audit.ts defines.
 *
 * Two sources feed it. The server poll is the truth, and it carries the real
 * status and timing. The agent's own tool call invocations arrive in the
 * browser a moment earlier, so a step is lit as running the instant the agent
 * reaches for it, then the poll settles it green, amber or red.
 */

import { useMemo } from "react";
import type { PipelineRow } from "@/app/hooks/useDemoState";
import type { ToolSignal } from "@/app/hooks/useRetellCall";

export interface PipelinePanelProps {
  events: PipelineRow[];
  /** The call the ladder is showing. Changing it resets the ladder. */
  focusCallId: string | null;
  toolSignals: ToolSignal[];
  live: boolean;
}

/** Mirrors PIPELINE_STEPS in lib/audit.ts, which is the contract. */
const PIPELINE_STEPS = [
  "signature_verified",
  "patient_matched",
  "slots_checked",
  "appointment_written",
  "audit_logged",
  "consent_recorded",
  "reminder_queued",
] as const;

type Step = (typeof PIPELINE_STEPS)[number];
type StepState = "idle" | "running" | "ok" | "warn" | "error";

const STEP_COPY: Record<Step, { name: string; hint: string }> = {
  signature_verified: {
    name: "Webhook signature verified",
    hint: "HMAC SHA256 on every inbound request",
  },
  patient_matched: {
    name: "Patient matched",
    hint: "Name and date of birth, two factors, exact match only",
  },
  slots_checked: {
    name: "Open time checked",
    hint: "Free slots only, no record is read",
  },
  appointment_written: {
    name: "Appointment written",
    hint: "One write, re-checked for conflicts first",
  },
  audit_logged: {
    name: "Access logged",
    hint: "Actor, action, outcome, hashed patient reference",
  },
  consent_recorded: {
    name: "Consent recorded",
    hint: "Recording notice and AI disclosure, script version kept",
  },
  reminder_queued: {
    name: "Reminder queued",
    hint: "Only if the caller opted in on this call",
  },
};

/** Which rung a tool call lights the moment the agent reaches for it. */
const TOOL_STEP: Record<string, Step> = {
  find_patient: "patient_matched",
  get_slots: "slots_checked",
  book_appointment: "appointment_written",
  reschedule_appointment: "appointment_written",
  cancel_appointment: "appointment_written",
  confirm_appointment: "appointment_written",
  record_sms_opt_in: "consent_recorded",
  queue_request: "appointment_written",
};

interface Rung {
  step: Step;
  state: StepState;
  detail: string | null;
  durationMs: number | null;
}

function toState(status: string): StepState {
  if (status === "ok" || status === "warn" || status === "error" || status === "running") {
    return status;
  }
  return "idle";
}

export default function PipelinePanel({
  events,
  focusCallId,
  toolSignals,
  live,
}: PipelinePanelProps) {
  const { rungs, extras, done } = useMemo(() => {
    const latest = new Map<Step, Rung>();
    const other: PipelineRow[] = [];

    for (const event of events) {
      if (focusCallId && event.call_id !== focusCallId) continue;
      const step = event.step as Step;
      if (!(PIPELINE_STEPS as readonly string[]).includes(step)) {
        other.push(event);
        continue;
      }
      latest.set(step, {
        step,
        state: toState(event.status),
        detail: event.detail,
        durationMs: event.duration_ms,
      });
    }

    // The browser sees the tool call before the server writes its row.
    if (focusCallId) {
      for (const signal of toolSignals) {
        const step = TOOL_STEP[signal.name];
        if (!step) continue;
        if (!latest.has(step)) {
          latest.set(step, { step, state: "running", detail: signal.name, durationMs: null });
        }
        if (!latest.has("signature_verified")) {
          latest.set("signature_verified", {
            step: "signature_verified",
            state: "running",
            detail: "checking the webhook signature",
            durationMs: null,
          });
        }
      }
    }

    const list: Rung[] = PIPELINE_STEPS.map(
      (step) =>
        latest.get(step) ?? { step, state: "idle" as StepState, detail: null, durationMs: null },
    );

    return {
      rungs: list,
      extras: other.slice(-3),
      done: list.filter((r) => r.state === "ok").length,
    };
  }, [events, focusCallId, toolSignals]);

  return (
    <section className="panel" aria-label="Booking pipeline">
      <div className="panel-head">
        <h2 className="panel-title">Pipeline</h2>
        <p className="panel-sub">Every booking takes the same seven steps</p>
        <div className="panel-head-end">
          <span className={`tag${live ? " tag-accent" : ""} num`}>
            {done} of {PIPELINE_STEPS.length}
          </span>
        </div>
      </div>

      <div className="panel-body scroll">
        <ol className="ladder" aria-live="polite" aria-label="Pipeline steps">
          {rungs.map((rung) => {
            const copy = STEP_COPY[rung.step];
            return (
              <li
                key={rung.step}
                className={`step${rung.state === "idle" ? "" : ` is-${rung.state}`}`}
              >
                <span className="step-dot" aria-hidden="true" />
                <span>
                  <span className="step-name">{copy.name}</span>
                  <span className="step-detail">
                    {rung.state === "idle" ? copy.hint : (rung.detail ?? copy.hint)}
                  </span>
                  <span className="sr-only">
                    {rung.state === "idle" ? "not started" : rung.state}
                  </span>
                </span>
                <span className="step-dur num">
                  {rung.durationMs !== null ? `${rung.durationMs} ms` : ""}
                </span>
              </li>
            );
          })}
        </ol>

        {extras.length > 0 ? (
          <ul className="ladder-extra">
            {extras.map((event) => (
              <li className="extra-row" key={String(event.id)}>
                <span className={`pill pill-${toState(event.status)}`}>{event.status}</span>
                <span>{event.step.replace(/_/g, " ")}</span>
                {event.detail ? <span>{event.detail}</span> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {!focusCallId ? (
          <div className="empty">
            The ladder is idle. It fills in from the top the moment a call asks for
            something, and it resets for every new call.
          </div>
        ) : null}
      </div>
    </section>
  );
}
