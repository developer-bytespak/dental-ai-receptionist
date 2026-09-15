"use client";

/**
 * The centre column: one clinic day, one column per provider.
 *
 * Blocks are positioned as a percentage of the working day rather than in
 * pixels, so the grid stays correct on a projector, a laptop and a 4K panel
 * without recalculating anything in JavaScript.
 *
 * Nothing that identifies a patient is drawn here. Initials only, by design.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { DAY_END_HOUR, DAY_START_HOUR, SLOT_MINUTES } from "@/lib/config";
import type { AppointmentRow, Grid, ProviderTone } from "@/app/hooks/useDemoState";

export interface SchedulePanelProps {
  grid: Grid | null;
  appointments: AppointmentRow[];
  dayOffset: number;
  loaded: boolean;
}

const TIME_FMT = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DAY_FMT = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "short",
  day: "numeric",
});

/** Minutes past midnight, in the viewer's local time. */
function minutesOfDay(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

function hourLabel(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "am" : "pm"}`;
}

function initials(first: string | null, last: string | null): string {
  const a = first?.trim()?.[0];
  const b = last?.trim()?.[0];
  if (!a && !b) return "--";
  return `${a ?? ""}${b ? `.${b}` : ""}.`.toUpperCase();
}

const TONE_VARS: Record<ProviderTone, { tone: string; fill: string }> = {
  teal: { tone: "var(--tone-teal)", fill: "var(--tone-teal-fill)" },
  plum: { tone: "var(--tone-plum)", fill: "var(--tone-plum-fill)" },
  amber: { tone: "var(--tone-amber)", fill: "var(--tone-amber-fill)" },
  slate: { tone: "var(--tone-slate)", fill: "var(--tone-slate-fill)" },
};

export default function SchedulePanel({
  grid,
  appointments,
  dayOffset,
  loaded,
}: SchedulePanelProps) {
  const [nowMinutes, setNowMinutes] = useState<number | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(() => new Set());

  const seen = useRef<Set<string> | null>(null);
  const gridKey = `${grid?.locationId ?? ""}:${grid?.dayOffset ?? 0}`;
  const lastKey = useRef(gridKey);

  // A quiet clock, so the red line on today's column stays honest.
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMinutes(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Anything the agent books while the client is watching gets one highlight,
  // then settles into the ordinary AI treatment. The first load never animates.
  useEffect(() => {
    if (lastKey.current !== gridKey) {
      lastKey.current = gridKey;
      seen.current = null;
      setFresh(new Set());
    }

    if (seen.current === null) {
      if (!loaded) return;
      seen.current = new Set(appointments.map((a) => a.id));
      return;
    }

    const arrivals: string[] = [];
    for (const a of appointments) {
      if (!seen.current.has(a.id)) {
        seen.current.add(a.id);
        if (a.created_by === "ai_agent" && a.status !== "cancelled") arrivals.push(a.id);
      }
    }
    if (arrivals.length === 0) return;

    setFresh((prev) => {
      const next = new Set(prev);
      for (const id of arrivals) next.add(id);
      return next;
    });

    const timer = window.setTimeout(() => {
      setFresh((prev) => {
        const next = new Set(prev);
        for (const id of arrivals) next.delete(id);
        return next;
      });
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [appointments, gridKey, loaded]);

  const startHour = grid?.startHour ?? DAY_START_HOUR;
  const endHour = grid?.endHour ?? DAY_END_HOUR;
  const dayMinutes = Math.max(60, (endHour - startHour) * 60);
  const providers = useMemo(() => grid?.providers ?? [], [grid]);

  const typeNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of grid?.types ?? []) map.set(t.id, t.name);
    return map;
  }, [grid]);

  const byProvider = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const p of providers) map.set(p.id, []);
    for (const a of appointments) {
      const list = map.get(a.provider_id);
      if (list) list.push(a);
    }
    return map;
  }, [appointments, providers]);

  const hours = useMemo(() => {
    const out: number[] = [];
    for (let h = startHour; h <= endHour; h++) out.push(h);
    return out;
  }, [startHour, endHour]);

  const slots = Math.max(1, Math.round(dayMinutes / SLOT_MINUTES));
  const pct = (minutes: number) => `${(minutes / dayMinutes) * 100}%`;

  const nowTop =
    dayOffset === 0 && nowMinutes !== null &&
    nowMinutes >= startHour * 60 &&
    nowMinutes <= endHour * 60
      ? pct(nowMinutes - startHour * 60)
      : null;

  const aiCount = appointments.filter(
    (a) => a.created_by === "ai_agent" && a.status !== "cancelled",
  ).length;

  const dayLabel = grid ? DAY_FMT.format(new Date(grid.date)) : "";
  const locationName =
    grid?.locations.find((l) => l.id === grid.locationId)?.name ?? "";

  const style = {
    "--lanes": String(Math.max(1, providers.length)),
    "--slots": String(slots),
  } as React.CSSProperties;

  return (
    <section className="panel" aria-label="Appointment schedule">
      <div className="panel-head">
        <h2 className="panel-title">Schedule</h2>
        <p className="panel-sub">
          {dayLabel}
          {locationName ? ` · ${locationName}` : ""}
        </p>
        <div className="panel-head-end">
          <span className={`tag${aiCount > 0 ? " tag-accent" : ""}`}>
            {aiCount} booked by the agent
          </span>
        </div>
      </div>

      <div className="panel-body">
        {providers.length === 0 ? (
          <div className="empty">
            {loaded ? (
              <>
                <strong>No providers at this location today.</strong> Switch location in the
                header to see the other diary.
              </>
            ) : (
              <>Loading the practice day.</>
            )}
          </div>
        ) : (
          <div className="cal">
            <div className="cal-columns" style={style}>
              <div className="cal-corner" />
              {providers.map((p) => (
                <div
                  key={p.id}
                  className="lane-head"
                  style={{ ["--tone" as string]: TONE_VARS[p.tone].tone }}
                >
                  <div className="lane-name">{p.name}</div>
                  <div className="lane-role">{p.title}</div>
                </div>
              ))}
            </div>

            <div className="cal-scroll scroll">
              <div className="cal-body" style={style}>
                <div className="time-col">
                  {hours.map((h) => (
                    <div
                      key={h}
                      className="time-mark"
                      style={{ top: pct((h - startHour) * 60) }}
                    >
                      {hourLabel(h)}
                    </div>
                  ))}
                </div>

                {providers.map((p) => {
                  const tone = TONE_VARS[p.tone];
                  const rows = byProvider.get(p.id) ?? [];
                  return (
                    <div
                      key={p.id}
                      className="lane"
                      style={{
                        ["--tone" as string]: tone.tone,
                        ["--tone-fill" as string]: tone.fill,
                      }}
                    >
                      {hours.slice(1).map((h) => (
                        <div
                          key={h}
                          className="lane-hour"
                          style={{ top: pct((h - startHour) * 60) }}
                        />
                      ))}

                      {startHour <= 12 && endHour > 12 ? (
                        <div
                          className="lunch"
                          style={{ top: pct((12 - startHour) * 60), height: pct(60) }}
                          aria-hidden="true"
                        />
                      ) : null}

                      {nowTop ? <div className="now-line" style={{ top: nowTop }} /> : null}

                      {rows.map((a) => {
                        const start = minutesOfDay(a.starts_at) - startHour * 60;
                        const end = minutesOfDay(a.ends_at) - startHour * 60;
                        const top = Math.max(0, Math.min(start, dayMinutes));
                        const height = Math.max(18, Math.min(end, dayMinutes) - top);
                        const ai = a.created_by === "ai_agent";
                        const cancelled = a.status === "cancelled";
                        const compact = height < 42;
                        const name = typeNames.get(a.type_id) ?? a.type_id;
                        const who = initials(a.first_name, a.last_name);
                        const when = TIME_FMT.format(new Date(a.starts_at));

                        return (
                          <div
                            key={a.id}
                            className={[
                              "appt",
                              ai ? "appt-ai" : "",
                              cancelled ? "appt-cancelled" : "",
                              fresh.has(a.id) ? "appt-new" : "",
                            ]
                              .filter(Boolean)
                              .join(" ")}
                            style={{ top: pct(top), height: pct(height) }}
                            title={`${name}, ${when}, ${p.name}${ai ? ", booked by the agent" : ""}${cancelled ? ", cancelled" : ""}`}
                          >
                            {compact ? (
                              <div className="appt-short">
                                <span className="appt-type">{name}</span>
                                <span className="appt-meta">{who}</span>
                                {ai ? <span className="appt-ai-badge">AI</span> : null}
                              </div>
                            ) : (
                              <>
                                <div className="appt-type">
                                  {name}
                                  {ai ? <span className="appt-ai-badge">AI</span> : null}
                                </div>
                                <div className="appt-meta">
                                  {when} {"·"} {who}
                                </div>
                              </>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="panel-foot">
        <div className="cal-legend">
          {providers.map((p) => (
            <span className="legend-item" key={p.id}>
              <span
                className="legend-swatch"
                style={{ ["--tone" as string]: TONE_VARS[p.tone].tone }}
              />
              {p.name}
            </span>
          ))}
          <span className="legend-item">
            <span className="legend-swatch is-ai" />
            Booked by the agent
          </span>
          <span className="legend-item">
            Initials only. Patient names, numbers and notes never reach this screen.
          </span>
        </div>
      </div>
    </section>
  );
}
