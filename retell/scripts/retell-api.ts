// Shared helpers for push-config.ts and audit-config.ts.
// Endpoint paths verified against https://docs.retellai.com/api-references (Sept 2026):
//   POST  /create-agent                     GET /get-agent/{id}                 PATCH /update-agent/{id}
//   POST  /create-chat-agent                GET /get-chat-agent/{id}            PATCH /update-chat-agent/{id}
//   POST  /create-conversation-flow         GET /get-conversation-flow/{id}     PATCH /update-conversation-flow/{id}
//   POST  /v2/list-agents  (body: { filter_criteria: { channel: { op: "eq", value: "voice"|"chat" } } })
//   GET   /v2/list-conversation-flows
//   POST  /create-retell-llm                GET /get-retell-llm/{id}            PATCH /update-retell-llm/{id}   TODO: verify (not fetched from docs)
// Auth: Authorization: Bearer <RETELL_API_KEY>

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const BASE_URL = process.env.RETELL_BASE_URL ?? "https://api.retellai.com";
export const RETELL_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const IDS_FILE = join(RETELL_DIR, ".ids.json");
export const EVIDENCE_DIR = resolve(RETELL_DIR, "..", "docs", "evidence");

export type Kind = "voice-agent" | "chat-agent" | "conversation-flow" | "retell-llm";

export interface LocalConfig {
  /** Path relative to retell/, e.g. "agents/inbound-reception.json". Used as the key in .ids.json. */
  key: string;
  /** Short name used in evidence file names, e.g. "inbound-reception". */
  name: string;
  kind: Kind;
  body: Record<string, unknown>;
}

export const ENDPOINTS: Record<Kind, { create: string; get: (id: string) => string; update: (id: string) => string }> = {
  "voice-agent": { create: "/create-agent", get: (id) => `/get-agent/${id}`, update: (id) => `/update-agent/${id}` },
  "chat-agent": { create: "/create-chat-agent", get: (id) => `/get-chat-agent/${id}`, update: (id) => `/update-chat-agent/${id}` },
  "conversation-flow": {
    create: "/create-conversation-flow",
    get: (id) => `/get-conversation-flow/${id}`,
    update: (id) => `/update-conversation-flow/${id}`,
  },
  // TODO: verify Retell LLM endpoint paths against https://docs.retellai.com/api-references/create-retell-llm
  "retell-llm": { create: "/create-retell-llm", get: (id) => `/get-retell-llm/${id}`, update: (id) => `/update-retell-llm/${id}` },
};

export function apiKey(): string {
  const key = process.env.RETELL_API_KEY;
  if (!key) {
    console.error("RETELL_API_KEY is not set. Export it from a password manager; never commit it.");
    process.exit(2);
  }
  return key;
}

export async function retell<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${method} ${path} -> HTTP ${res.status}: ${text.slice(0, 2000)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export function readIds(): Record<string, string> {
  if (!existsSync(IDS_FILE)) return {};
  return JSON.parse(readFileSync(IDS_FILE, "utf8"));
}

export function writeIds(ids: Record<string, string>): void {
  const sorted = Object.fromEntries(Object.entries(ids).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(IDS_FILE, JSON.stringify(sorted, null, 2) + "\n");
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function writeEvidence(fileName: string, data: unknown): string {
  mkdirSync(EVIDENCE_DIR, { recursive: true });
  const path = join(EVIDENCE_DIR, fileName);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  return path;
}

/** Load every local config file. Chat agents are recognised by the absence of voice_id. */
export function loadLocalConfigs(): LocalConfig[] {
  const out: LocalConfig[] = [];

  const flowDir = join(RETELL_DIR, "conversation-flow");
  if (existsSync(flowDir)) {
    for (const f of readdirSync(flowDir).filter((f) => f.endsWith(".flow.json")).sort()) {
      out.push({
        key: `conversation-flow/${f}`,
        name: f.replace(/\.flow\.json$/, ""),
        kind: "conversation-flow",
        body: JSON.parse(readFileSync(join(flowDir, f), "utf8")),
      });
    }
  }

  const agentDir = join(RETELL_DIR, "agents");
  if (existsSync(agentDir)) {
    for (const f of readdirSync(agentDir).filter((f) => f.endsWith(".json")).sort()) {
      const body = JSON.parse(readFileSync(join(agentDir, f), "utf8"));
      if (f.endsWith(".llm.json")) {
        out.push({ key: `agents/${f}`, name: f.replace(/\.llm\.json$/, ""), kind: "retell-llm", body });
      } else {
        out.push({
          key: `agents/${f}`,
          name: f.replace(/\.json$/, ""),
          kind: typeof body.voice_id === "string" ? "voice-agent" : "chat-agent",
          body,
        });
      }
    }
  }
  return out;
}

/**
 * Resolve cross-file placeholders from .ids.json:
 *   <CONVERSATION_FLOW_ID:inbound-reception>  -> id of conversation-flow/inbound-reception.flow.json
 *   <RETELL_LLM_ID:sms-reminder>              -> id of agents/sms-reminder.llm.json
 *   <INBOUND_AGENT_ID>                        -> id of agents/inbound-reception.json
 * Returns the resolved body and the list of placeholders that are still unresolved
 * (including client placeholders such as <VOICE_ID> or <CLIENT_DOMAIN> that must be edited by hand).
 */
export function resolvePlaceholders(body: unknown, ids: Record<string, string>): { body: unknown; unresolved: string[] } {
  const unresolved = new Set<string>();
  const json = JSON.stringify(body).replace(/<([A-Z_]+)(?::([a-z0-9-]+))?>/g, (match, tag: string, ref?: string) => {
    let key: string | undefined;
    if (tag === "CONVERSATION_FLOW_ID" && ref) key = `conversation-flow/${ref}.flow.json`;
    else if (tag === "RETELL_LLM_ID" && ref) key = `agents/${ref}.llm.json`;
    else if (tag === "INBOUND_AGENT_ID") key = "agents/inbound-reception.json";
    const id = key ? ids[key] : undefined;
    if (id) return id;
    unresolved.add(match);
    return match;
  });
  return { body: JSON.parse(json), unresolved: [...unresolved] };
}
