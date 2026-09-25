"use client";

/**
 * The single poll that feeds the whole screen.
 *
 * GET /api/state is asked roughly twice a second with the highest row id we
 * have already seen, so the compliance panels append instead of redrawing and
 * their animations stay smooth. Appointments have no cursor and are replaced
 * wholesale, which is what lets the calendar show a cancellation.
 *
 * Polling is paused while the tab is hidden and resumed the moment it comes
 * back, and a failed fetch is swallowed and retried. A demo laptop that sleeps
 * mid presentation reconnects on its own.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const POLL_MS = 700;
const RETRY_MS = 1400;
/** Keep the appended logs bounded, a long demo should not grow without limit. */
const MAX_ROWS = 400;

/** Postgres bigserial arrives as a string over the pg driver and a number over PGlite. */
export type RowId = number | string;

export interface AppointmentRow {
  id: string;
  provider_id: string;
  operatory_id: string;
  type_id: string;
  status: string;
  created_by: string;
  call_id: string | null;
  starts_at: string;
  ends_at: string;
  first_name: string | null;
  last_name: string | null;
}

export interface PipelineRow {
  id: RowId;
  occurred_at: string;
  call_id: string;
  step: string;
  status: string;
  detail: string | null;
  duration_ms: number | null;
}

export interface AuditRow {
  id: RowId;
  occurred_at: string;
  actor: string;
  action: string;
  call_id: string | null;
  patient_ref: string | null;
  appointment_ref: string | null;
  location: string | null;
  outcome: string;
  detail: Record<string, unknown> | null;
}

export interface ConsentRow {
  id: RowId;
  occurred_at: string;
  call_id: string;
  phone_last4: string;
  kind: string;
  script_ver: string;
  channel: string;
}

export interface QueueRow {
  id: RowId;
  created_at: string;
  call_id: string;
  location: string;
  reason: string;
  requested: Record<string, unknown> | null;
  fulfilled_at: string | null;
}

export interface CallRow {
  call_id: string;
  started_at: string;
  ended_at: string | null;
  channel: string;
  outcome: string | null;
  flagged: boolean;
  summary: string | null;
}

export interface Counts {
  audit_rows: number;
  consent_rows: number;
  queue_open: number;
  ai_booked: number;
}

export type ProviderTone = "teal" | "plum" | "amber" | "slate";

export interface GridProvider {
  id: string;
  name: string;
  title: string;
  tone: ProviderTone;
}

export interface GridLocation {
  id: string;
  name: string;
  hours: string;
}

export interface GridOperatory {
  id: string;
  name: string;
  locationId: string;
}

export interface GridType {
  id: string;
  name: string;
  minutes: number;
}

export interface Grid {
  locationId: string;
  dayOffset: number;
  date: string;
  startHour: number;
  endHour: number;
  locations: GridLocation[];
  providers: GridProvider[];
  operatories: GridOperatory[];
  types: GridType[];
}

export interface Practice {
  name: string;
  shortName: string;
  tagline: string;
  callbackNumber: string;
}

interface Cursors {
  pipeline: number;
  audit: number;
  consent: number;
  queue: number;
}

interface StateResponse {
  practice: Practice;
  grid: Grid;
  appointments: AppointmentRow[];
  pipeline: PipelineRow[];
  audit: AuditRow[];
  consent: ConsentRow[];
  queue: QueueRow[];
  calls: CallRow[];
  counts: Counts;
  cursors: Cursors;
}

export interface DemoState {
  practice: Practice | null;
  grid: Grid | null;
  appointments: AppointmentRow[];
  pipeline: PipelineRow[];
  audit: AuditRow[];
  consent: ConsentRow[];
  queue: QueueRow[];
  calls: CallRow[];
  counts: Counts;
  /** False once a poll has failed, true again on the next good response. */
  connected: boolean;
  /** True after the first successful poll, used to avoid a flash of empties. */
  loaded: boolean;
}

const EMPTY_COUNTS: Counts = { audit_rows: 0, consent_rows: 0, queue_open: 0, ai_booked: 0 };

const INITIAL: DemoState = {
  practice: null,
  grid: null,
  appointments: [],
  pipeline: [],
  audit: [],
  consent: [],
  queue: [],
  calls: [],
  counts: EMPTY_COUNTS,
  connected: true,
  loaded: false,
};

function tail<T>(existing: T[], incoming: T[]): T[] {
  if (incoming.length === 0) return existing;
  const next = existing.concat(incoming);
  return next.length > MAX_ROWS ? next.slice(next.length - MAX_ROWS) : next;
}

export interface UseDemoState {
  state: DemoState;
  /** Drops every appended row and rewinds the cursors, for the reset button. */
  clear: () => void;
}

/** Which workspace the poll reads: the public demo, or the signed-in one. */
export type Scope = "demo" | "app";

export function useDemoState(locationId: string, dayOffset: number, scope: Scope = "demo"): UseDemoState {
  const [state, setState] = useState<DemoState>(INITIAL);

  const cursors = useRef<Cursors>({ pipeline: 0, audit: 0, consent: 0, queue: 0 });
  const location = useRef(locationId);
  const day = useRef(dayOffset);
  /** Bumped on clear so a request already in flight is discarded. */
  const generation = useRef(0);

  location.current = locationId;
  day.current = dayOffset;

  const clear = useCallback(() => {
    generation.current += 1;
    cursors.current = { pipeline: 0, audit: 0, consent: 0, queue: 0 };
    setState((prev) => ({
      ...prev,
      pipeline: [],
      audit: [],
      consent: [],
      queue: [],
      calls: [],
      appointments: [],
      counts: EMPTY_COUNTS,
    }));
  }, []);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = (ms: number) => {
      if (!alive) return;
      timer = setTimeout(run, ms);
    };

    async function run(): Promise<void> {
      if (!alive) return;

      // A hidden tab burns battery and browser timers throttle anyway. Wait
      // for the visibility listener below to wake the loop.
      if (typeof document !== "undefined" && document.hidden) {
        schedule(POLL_MS);
        return;
      }

      const mine = generation.current;
      const c = cursors.current;
      // An empty location means the client has not chosen yet, so let the
      // server answer with its own default rather than asking for nothing.
      const where = location.current
        ? `&location=${encodeURIComponent(location.current)}`
        : "";
      const url =
        `/api/state?scope=${scope}&audit=${c.audit}&pipeline=${c.pipeline}` +
        `&consent=${c.consent}&queue=${c.queue}${where}&day=${day.current}`;

      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(`state responded ${response.status}`);
        const data = (await response.json()) as StateResponse;

        if (!alive || generation.current !== mine) {
          schedule(POLL_MS);
          return;
        }

        cursors.current = data.cursors;

        setState((prev) => ({
          practice: data.practice,
          grid: data.grid,
          appointments: data.appointments,
          pipeline: tail(prev.pipeline, data.pipeline),
          audit: tail(prev.audit, data.audit),
          consent: tail(prev.consent, data.consent),
          queue: tail(prev.queue, data.queue),
          calls: data.calls,
          counts: data.counts,
          connected: true,
          loaded: true,
        }));

        schedule(POLL_MS);
      } catch {
        // Silent by design. A conference network drops packets and the demo
        // should simply catch up, not show an error to the client.
        if (alive && generation.current === mine) {
          setState((prev) => (prev.connected ? { ...prev, connected: false } : prev));
        }
        schedule(RETRY_MS);
      }
    }

    const wake = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        if (timer) clearTimeout(timer);
        schedule(0);
      }
    };

    document.addEventListener("visibilitychange", wake);
    void run();

    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", wake);
    };
  }, [scope]);

  return { state, clear };
}
