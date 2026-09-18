"use client";

/**
 * The demo screen. One full height page, four regions, no page scrolling.
 *
 * Left is the call, centre is the practice day it writes into, right is the
 * pipeline and the compliance record. Everything is fed by a single poll of
 * /api/state, so the whole screen agrees with itself at every moment.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import CallPanel from "@/app/components/CallPanel";
import SchedulePanel from "@/app/components/SchedulePanel";
import PipelinePanel from "@/app/components/PipelinePanel";
import CompliancePanel from "@/app/components/CompliancePanel";
import { LOCATIONS, PRACTICE } from "@/lib/config";
import { useDemoState } from "@/app/hooks/useDemoState";
import { useRetellCall, type TranscriptTurn } from "@/app/hooks/useRetellCall";

/**
 * The sidebar. Only the first item is a real screen. The others put a
 * spotlight on one region of it, which is what a presenter actually wants
 * mid demo: "let's look at the compliance trail" and the rest steps back.
 */
type View = "desk" | "call" | "schedule" | "compliance";

const NAV: { id: View; label: string; icon: string }[] = [
  { id: "desk", label: "Live desk", icon: "M4 6h16M4 12h16M4 18h10" },
  { id: "call", label: "Front desk", icon: "M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" },
  { id: "schedule", label: "Schedule", icon: "M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" },
  { id: "compliance", label: "Compliance", icon: "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" },
];

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

const DAYS = [
  { offset: 0, label: "Today" },
  { offset: 1, label: "Tomorrow" },
  { offset: 2, label: "In two days" },
];

type Theme = "system" | "light" | "dark";

interface RedactResponse {
  turns: { role: string; content: string }[];
  found: { category: string; index: number }[];
}

export default function Page() {
  const [locationId, setLocationId] = useState("");
  const [dayOffset, setDayOffset] = useState(0);
  const [theme, setTheme] = useState<Theme>("system");

  /**
   * What the screen actually looks like right now. With no explicit choice
   * the operating system decides, so the toggle has to ask it rather than
   * guess, or the button offers the theme you are already looking at.
   */
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const showingDark = theme === "dark" || (theme === "system" && systemDark);
  const [resetting, setResetting] = useState(false);
  const [view, setView] = useState<View>("desk");

  const [showStored, setShowStored] = useState(false);
  const [storedTurns, setStoredTurns] = useState<TranscriptTurn[] | null>(null);
  const [redactionCount, setRedactionCount] = useState(0);
  const [storedBusy, setStoredBusy] = useState(false);

  const { state, clear } = useDemoState(locationId, dayOffset);

  const activeLocation = locationId || state.grid?.locationId || "";

  const locations = useMemo(() => {
    if (state.grid?.locations.length) return state.grid.locations;
    return [];
  }, [state.grid]);

  const locationName =
    locations.find((l) => l.id === activeLocation)?.name ??
    LOCATIONS.find((l) => l.id === activeLocation)?.name ??
    LOCATIONS[0].name;

  const call = useRetellCall(locationName);

  // Fall back to the public config for the header before the first poll lands,
  // so the screen is never a blank shell.
  const headerLocations = useMemo(() => {
    if (locations.length) return locations.map((l) => ({ id: l.id, name: l.name }));
    if (call.config?.locations.length) {
      return call.config.locations.map((l) => ({ id: l.id, name: l.name }));
    }
    return LOCATIONS.map((l) => ({ id: l.id, name: l.name }));
  }, [locations, call.config]);

  const practiceName = state.practice?.name ?? call.config?.practice.name ?? PRACTICE.name;
  const tagline = state.practice?.tagline ?? call.config?.practice.tagline ?? PRACTICE.tagline;
  const phoneNumber = call.config?.retell.phoneNumber ?? "";
  const configured = call.config?.retell.configured ?? false;

  const latestCall = state.calls[0] ?? null;
  const focusCallId = call.callId ?? latestCall?.call_id ?? null;
  const flaggedSummary = latestCall?.flagged
    ? (latestCall.summary ?? "The detail stayed with the practice, not with the agent.")
    : null;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") delete root.dataset.theme;
    else root.dataset.theme = theme;
  }, [theme]);

  // Ask the server what the stored copy of this transcript looks like. It is
  // re-run as the call grows so the toggle stays truthful mid conversation.
  useEffect(() => {
    if (!showStored || call.turns.length === 0) {
      setStoredTurns(null);
      setRedactionCount(0);
      return;
    }

    let alive = true;
    setStoredBusy(true);

    fetch("/api/redact", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        turns: call.turns.map((t) => ({ role: t.role, content: t.content })),
      }),
    })
      .then((r) => (r.ok ? (r.json() as Promise<RedactResponse>) : null))
      .then((data) => {
        if (!alive || !data) return;
        setStoredTurns(
          call.turns.map((t, i) => ({ ...t, content: data.turns[i]?.content ?? t.content })),
        );
        setRedactionCount(data.found.length);
      })
      .catch(() => {
        /* The plain transcript stays on screen, which is the safe failure. */
      })
      .finally(() => {
        if (alive) setStoredBusy(false);
      });

    return () => {
      alive = false;
    };
  }, [showStored, call.turns]);

  const onReset = useCallback(async () => {
    setResetting(true);
    try {
      await fetch("/api/reset", { method: "POST" });
    } catch {
      /* Reported by the connection tag on the next poll. */
    }
    clear();
    setShowStored(false);
    setStoredTurns(null);
    setRedactionCount(0);
    setDayOffset(0);
    setResetting(false);
  }, [clear]);

  return (
    <div className="app" data-view={view}>
      <aside className="sidebar" aria-label="Sections">
        <div className="side-brand">
          <span className="brand-mark" aria-hidden="true">
            {practiceName.slice(0, 1)}
          </span>
          <div className="brand-text">
            <span className="brand-name">{practiceName}</span>
            <span className="brand-tagline">AI front desk</span>
          </div>
        </div>

        <nav className="nav">
          {NAV.map((item) => (
            <button
              key={item.id}
              type="button"
              className="nav-item"
              title={item.label}
              aria-current={view === item.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              <svg className="nav-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d={item.icon} />
              </svg>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="side-foot">
          <span className={`onair${call.isLive ? "" : " onair-idle"}`} role="status">
            <span className="onair-dot" aria-hidden="true" />
            <span className="onair-text">{call.isLive ? "On air" : "Standby"}</span>
          </span>
          <button type="button" className="side-reset" onClick={onReset} disabled={resetting} title="Reset demo">
            <svg className="side-reset-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5" />
            </svg>
            <span className="side-reset-label">{resetting ? "Resetting" : "Reset demo"}</span>
            <span className="side-reset-hint">Clears the board and the log</span>
          </button>
        </div>
      </aside>

      <div className="stage">
        <header className="topbar">
          <div className="greet">
            <h1 className="greet-title">
              {greetingForHour(new Date().getHours())}, {practiceName.split(" ")[0]}
            </h1>
            <p className="greet-sub">{tagline}</p>
          </div>

          {!state.connected ? (
            <span className="tag tag-warn" role="status">
              Reconnecting
            </span>
          ) : null}

          <div className="header-spacer" />

          <div className="header-controls">
            <div className="field">
              <span className="field-label" id="location-label">
                Location
              </span>
              <div className="seg" role="group" aria-labelledby="location-label">
                {headerLocations.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    className="seg-btn"
                    aria-pressed={activeLocation === l.id}
                    onClick={() => setLocationId(l.id)}
                  >
                    {l.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <span className="field-label" id="day-label">
                Day
              </span>
              <div className="seg" role="group" aria-labelledby="day-label">
                {DAYS.map((d) => (
                  <button
                    key={d.offset}
                    type="button"
                    className="seg-btn"
                    aria-pressed={dayOffset === d.offset}
                    onClick={() => setDayOffset(d.offset)}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => setTheme(showingDark ? "light" : "dark")}
            >
              {showingDark ? "Light" : "Dark"}
            </button>

            <div className="avatar" aria-label={`Front desk, ${locationName}`}>
              <span className="avatar-mark" aria-hidden="true">
                {practiceName
                  .split(" ")
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join("")}
              </span>
              <span className="avatar-text">
                <span className="avatar-name">Front desk</span>
                <span className="avatar-sub">{locationName}</span>
              </span>
            </div>
          </div>
        </header>

      <main className="main">
        <div className="col col-call">
          <CallPanel
            phase={call.phase}
            isLive={call.isLive}
            configured={configured}
            callId={call.callId}
            startedAt={call.startedAt}
            agentTalking={call.agentTalking}
            muted={call.muted}
            turns={call.turns}
            storedTurns={storedTurns}
            showingStored={showStored}
            redactionCount={redactionCount}
            phoneNumber={phoneNumber}
            practiceName={practiceName}
            locationName={locationName}
            error={call.error}
            endedReason={call.endedReason}
            flaggedSummary={flaggedSummary}
            onStart={() => {
              void call.start();
            }}
            onEnd={() => {
              void call.end();
            }}
            onToggleMute={call.toggleMute}
          />
        </div>

        <div className="col col-schedule">
          <SchedulePanel
            grid={state.grid}
            appointments={state.appointments}
            dayOffset={dayOffset}
            loaded={state.loaded}
          />
        </div>

        <div className="col col-right col-compliance">
          <PipelinePanel
            events={state.pipeline}
            focusCallId={focusCallId}
            toolSignals={call.toolSignals}
            live={call.isLive}
          />
          <CompliancePanel
            audit={state.audit}
            consent={state.consent}
            queue={state.queue}
            counts={state.counts}
            showStored={showStored}
            storedBusy={storedBusy}
            canShowStored={call.turns.length > 0}
            onToggleStored={() => setShowStored((prev) => !prev)}
          />
        </div>
      </main>
      </div>
    </div>
  );
}
