#!/usr/bin/env tsx
/**
 * audit-config.ts: weekly drift check of live Retell agents against the approved local JSON.
 *
 * 1. Lists every live agent (POST /v2/list-agents, voice and chat) and reports any agent that is
 *    not managed by a file in retell/agents (unmanaged agents are a finding, not a failure).
 * 2. For every local agent with an id in .ids.json, GETs the live agent and compares the
 *    compliance-relevant fields:
 *      data_storage_setting, data_storage_retention_days, pii_config, opt_in_signed_url, webhook_url
 *    plus signed_url_expiration_ms (the 1-hour signed-URL rule in the retention policy).
 * 3. Prints a diff and exits 1 on any drift or on a local agent that has no live counterpart.
 *
 * Usage:
 *   RETELL_API_KEY=... npx tsx scripts/audit-config.ts [--evidence] [--version latest_published|latest]
 *   --evidence writes ../docs/evidence/config-audit-<YYYY-MM-DD>.json (keep the first passing run).
 */
import { ENDPOINTS, loadLocalConfigs, readIds, resolvePlaceholders, retell, today, writeEvidence } from "./retell-api.js";

const AUDITED_FIELDS = [
  "data_storage_setting",
  "data_storage_retention_days",
  "pii_config",
  "opt_in_signed_url",
  "webhook_url",
  "signed_url_expiration_ms",
] as const;

const args = process.argv.slice(2);
const writeEvidenceFile = args.includes("--evidence");
const versionIdx = args.indexOf("--version");
const version = versionIdx >= 0 ? args[versionIdx + 1] : "latest_published";

interface Finding {
  agent: string;
  agent_id?: string;
  field: string;
  expected: unknown;
  actual: unknown;
}

/** Order-insensitive for pii_config.categories; otherwise structural equality. */
function normalize(field: string, value: unknown): unknown {
  if (value === undefined) return null;
  if (field === "pii_config" && value && typeof value === "object") {
    const v = value as { mode?: string; categories?: string[] };
    return { mode: v.mode ?? null, categories: [...(v.categories ?? [])].sort() };
  }
  return value;
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

interface LiveAgent {
  agent_id: string;
  agent_name?: string;
  channel: string;
}

async function listLiveAgents(): Promise<LiveAgent[]> {
  const items: LiveAgent[] = [];
  for (const channel of ["voice", "chat"]) {
    let paginationKey: string | undefined;
    do {
      const qs = new URLSearchParams({ limit: "1000" });
      if (paginationKey) qs.set("pagination_key", paginationKey);
      const page = await retell("POST", `/v2/list-agents?${qs}`, {
        filter_criteria: { channel: { op: "eq", value: channel } },
      });
      items.push(...(page.items ?? []));
      paginationKey = page.has_more ? page.pagination_key : undefined;
    } while (paginationKey);
  }
  return items;
}

async function main(): Promise<void> {
  const ids = readIds();
  const locals = loadLocalConfigs().filter((c) => c.kind === "voice-agent" || c.kind === "chat-agent");
  const findings: Finding[] = [];
  const notes: string[] = [];

  const live = await listLiveAgents();
  const managedIds = new Set(Object.values(ids));
  for (const a of live) {
    if (!managedIds.has(a.agent_id)) {
      notes.push(`UNMANAGED live agent: ${a.agent_id} "${a.agent_name ?? ""}" (${a.channel}) has no file in retell/agents`);
    }
  }

  for (const cfg of locals) {
    const id = ids[cfg.key];
    if (!id) {
      findings.push({ agent: cfg.name, field: "(agent)", expected: "exists in .ids.json", actual: "not pushed" });
      continue;
    }
    const expectedBody = resolvePlaceholders(cfg.body, ids).body as Record<string, unknown>;
    let liveAgent: Record<string, unknown>;
    try {
      liveAgent = await retell("GET", `${ENDPOINTS[cfg.kind].get(id)}?version=${encodeURIComponent(version)}`);
    } catch (err) {
      findings.push({ agent: cfg.name, agent_id: id, field: "(agent)", expected: "GET ok", actual: (err as Error).message });
      continue;
    }
    for (const field of AUDITED_FIELDS) {
      const expected = normalize(field, expectedBody[field]);
      const actual = normalize(field, liveAgent[field]);
      if (!same(expected, actual)) findings.push({ agent: cfg.name, agent_id: id, field, expected, actual });
    }
  }

  const report = {
    audited_at: new Date().toISOString(),
    version_checked: version,
    audited_fields: AUDITED_FIELDS,
    agents_checked: locals.map((c) => ({ name: c.name, agent_id: ids[c.key] ?? null })),
    live_agent_count: live.length,
    notes,
    findings,
    result: findings.length ? "DRIFT" : "PASS",
  };

  console.log(`Config audit ${report.audited_at} (version=${version})`);
  console.log(`Live agents: ${live.length}. Local agents: ${locals.length}.`);
  for (const n of notes) console.log(`  note: ${n}`);
  if (findings.length) {
    console.log(`\n${findings.length} drift finding(s):`);
    for (const f of findings) {
      console.log(`  [${f.agent}${f.agent_id ? " " + f.agent_id : ""}] ${f.field}`);
      console.log(`    expected: ${JSON.stringify(f.expected)}`);
      console.log(`    actual:   ${JSON.stringify(f.actual)}`);
    }
  } else {
    console.log("\nPASS: no drift on audited fields.");
  }

  if (writeEvidenceFile) {
    const path = writeEvidence(`config-audit-${today()}.json`, report);
    console.log(`Evidence written: ${path}`);
  }
  process.exit(findings.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
