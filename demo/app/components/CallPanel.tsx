"use client";

/**
 * The left column: place the call, watch who is speaking, read the transcript.
 *
 * The transcript has two faces. By default it shows what was said. With the
 * compliance toggle on it shows what the practice actually stores, with every
 * identifier replaced by a numbered placeholder rendered as a dark chip.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { CallPhase, TranscriptTurn } from "@/app/hooks/useRetellCall";

export interface CallPanelProps {
  phase: CallPhase;
  isLive: boolean;
  configured: boolean;
  callId: string | null;
  startedAt: number | null;
  agentTalking: boolean;
  muted: boolean;
  turns: TranscriptTurn[];
  /** The redacted copy, present only while the stored view is on. */
  storedTurns: TranscriptTurn[] | null;
  showingStored: boolean;
  redactionCount: number;
  phoneNumber: string;
  practiceName: string;
  locationName: string;
  error: string | null;
  endedReason: string | null;
  flaggedSummary: string | null;
  onStart: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
}

const PLACEHOLDER = /\[([A-Z_]+) (\d+)\]/g;

/** Splits redacted text so the placeholders can be rendered as chips. */
function renderStored(text: string, key: string): React.ReactNode[] {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  PLACEHOLDER.lastIndex = 0;

  while ((match = PLACEHOLDER.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      <span className="pii" key={`${key}-${match.index}`}>
        {match[1].replace(/_/g, " ")} {match[2]}
      </span>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const PHASE_LABEL: Record<CallPhase, string> = {
  idle: "Ready",
  connecting: "Connecting",
  live: "Connected",
  ending: "Hanging up",
  ended: "Call ended",
  error: "Not connected",
};

export default function CallPanel(props: CallPanelProps) {
  const {
    phase,
    isLive,
    configured,
    callId,
    startedAt,
    agentTalking,
    muted,
    turns,
    storedTurns,
    showingStored,
    redactionCount,
    phoneNumber,
    practiceName,
    locationName,
    error,
    endedReason,
    flaggedSummary,
    onStart,
    onEnd,
    onToggleMute,
  } = props;

  const scroller = useRef<HTMLDivElement | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const visible = showingStored && storedTurns ? storedTurns : turns;

  useEffect(() => {
    if (!startedAt || phase === "idle") return;
    const tick = () => setElapsed(Date.now() - startedAt);
    tick();
    if (phase !== "live" && phase !== "connecting") return;
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt, phase]);

  // Follow the conversation, but leave the presenter alone if they scrolled up.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    if (distance < 140) {
      node.scrollTo({ top: node.scrollHeight, behavior: "smooth" });
    }
  }, [visible.length, visible[visible.length - 1]?.content]);

  const lastIndex = visible.length - 1;

  const voiceState = useMemo(() => {
    if (!isLive) return { className: "voice", label: "Microphone off", hint: "Start a call to hear the agent." };
    if (phase === "connecting") {
      return { className: "voice", label: "Connecting", hint: "Setting up the audio channel." };
    }
    if (agentTalking) {
      return {
        className: "voice is-agent",
        label: "Agent speaking",
        hint: "Interrupt at any point, it will stop and listen.",
      };
    }
    return {
      className: "voice is-listening",
      label: muted ? "Microphone muted" : "Listening",
      hint: muted ? "The agent cannot hear you." : "Go ahead, speak normally.",
    };
  }, [isLive, phase, agentTalking, muted]);

  return (
    <section className="panel" aria-label="Call the front desk">
      <div className="panel-head">
        <h2 className="panel-title">Front desk</h2>
        <p className="panel-sub">{locationName}</p>
        <div className="panel-head-end">
          <span className={`tag${isLive ? " tag-accent" : ""}`}>{PHASE_LABEL[phase]}</span>
        </div>
      </div>

      <div className="panel-body">
        <div className="call-top">
          <button
            type="button"
            className={`btn btn-cta${isLive ? " is-live" : ""}`}
            onClick={isLive ? onEnd : onStart}
            disabled={!configured || phase === "connecting" || phase === "ending"}
          >
            {isLive ? "End call" : "Call the front desk"}
          </button>

          {!configured && (
            <p className="setup-note">
              Voice is not wired up on this deployment. Set{" "}
              <code>NEXT_PUBLIC_RETELL_PUBLIC_KEY</code> and{" "}
              <code>NEXT_PUBLIC_RETELL_AGENT_ID</code>, then reload. Everything else on
              this screen is live.
            </p>
          )}

          {phoneNumber ? (
            <p className="phone-hint">
              or call us on <span className="phone-number num">{phoneNumber}</span>
            </p>
          ) : null}

          {error ? (
            <p className="call-error" role="alert">
              {error}
            </p>
          ) : null}

          <div className={voiceState.className}>
            <div className="voice-bars" aria-hidden="true">
              <span className="voice-bar" />
              <span className="voice-bar" />
              <span className="voice-bar" />
              <span className="voice-bar" />
              <span className="voice-bar" />
              <span className="voice-bar" />
              <span className="voice-bar" />
            </div>
            <div className="voice-text">
              <div className="voice-label">{voiceState.label}</div>
              <div className="voice-hint">{voiceState.hint}</div>
            </div>
          </div>

          <div className="call-status">
            <span className="call-id mono">
              {callId ? `call ${callId.slice(0, 18)}` : `agent for ${practiceName}`}
            </span>
            {isLive || phase === "ended" ? (
              <span className="num mono">{clock(elapsed)}</span>
            ) : null}
            {isLive ? (
              <button type="button" className="btn btn-quiet" onClick={onToggleMute}>
                {muted ? "Unmute" : "Mute"}
              </button>
            ) : null}
          </div>
        </div>

        {flaggedSummary ? (
          <div className="banner" role="status">
            <span className="banner-icon" aria-hidden="true">
              i
            </span>
            <div>
              <div className="banner-title">The agent handed this one to a person</div>
              <p className="banner-text">
                A clinical or billing question came up. The agent does not answer those, so
                it declined politely and offered a transfer to the front desk.{" "}
                {flaggedSummary}
              </p>
            </div>
          </div>
        ) : null}

        <div className="transcript-head">
          <span className="transcript-head-title">
            {showingStored ? "What gets stored" : "Live transcript"}
          </span>
          {showingStored ? (
            <span className="tag tag-warn">
              {redactionCount} {redactionCount === 1 ? "identifier" : "identifiers"} removed
            </span>
          ) : (
            <span className="tag">{turns.length} turns</span>
          )}
        </div>

        <div
          className="transcript scroll"
          ref={scroller}
          aria-live="polite"
          aria-atomic="false"
          aria-label="Call transcript"
        >
          {visible.length === 0 ? (
            <div className="empty">
              {phase === "ended" ? (
                <>
                  <strong>That call is done.</strong> The schedule, the pipeline and the
                  audit trail on this screen are exactly what it left behind. Start another
                  whenever you are ready.
                </>
              ) : (
                <>
                  <strong>Nothing said yet.</strong> Press call, allow the microphone, and
                  speak normally. A good opening is: I would like to book a cleaning, my
                  name is Sarah Whitfield, date of birth April 12th 1986.
                  <br />
                  <br />
                  Every word appears here as it is spoken. Nothing on this screen leaves the
                  demo.
                </>
              )}
            </div>
          ) : (
            visible.map((turn, index) => {
              const growing = index === lastIndex && phase === "live" && !showingStored;
              return (
                <article
                  key={turn.id}
                  className={`turn turn-${turn.role}${growing && agentTalking && turn.role === "agent" ? " is-growing" : ""}`}
                >
                  <div className="turn-role">{turn.role === "agent" ? "Agent" : "Caller"}</div>
                  <div className="turn-text">
                    {showingStored ? renderStored(turn.content, turn.id) : turn.content}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {endedReason ? (
          <div className="panel-foot mono">Ended: {endedReason.replace(/_/g, " ")}</div>
        ) : null}
      </div>
    </section>
  );
}
