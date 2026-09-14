#!/usr/bin/env tsx
/**
 * push-config.ts: config-as-code for Retell.
 *
 * For each conversation-flow/*.flow.json and agents/*.json:
 *   - if .ids.json maps the file to an id  -> PATCH /update-<kind>/{id}
 *   - otherwise                            -> POST  /create-<kind>, then record the id in .ids.json
 * Then GET the live object and write it to ../docs/evidence/<kind>-<name>-<YYYY-MM-DD>.json.
 *
 * Order: Retell LLMs, then conversation flows, then agents (agents reference flow/LLM ids).
 * Placeholders such as <VOICE_ID>, <CLIENT_DOMAIN>, <KB_ID_SHARED> must be replaced in the JSON
 * before pushing; cross-file ids (<CONVERSATION_FLOW_ID:name>, <RETELL_LLM_ID:name>, <INBOUND_AGENT_ID>)
 * are filled from .ids.json automatically.
 *
 * Usage:
 *   RETELL_API_KEY=... npx tsx scripts/push-config.ts [--dry-run] [--only <name>] [--allow-placeholders]
 *
 * Note: update-agent writes a new draft version. Publish in the dashboard (or via /publish-agent)
 * after reviewing, and bind the phone numbers to the published version.
 */
import {
  ENDPOINTS,
  loadLocalConfigs,
  readIds,
  resolvePlaceholders,
  retell,
  today,
  writeEvidence,
  writeIds,
  type LocalConfig,
} from "./retell-api.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const allowPlaceholders = args.includes("--allow-placeholders");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : undefined;

const ORDER: Record<LocalConfig["kind"], number> = {
  "retell-llm": 0,
  "conversation-flow": 1,
  "voice-agent": 2,
  "chat-agent": 2,
};

const EVIDENCE_PREFIX: Record<LocalConfig["kind"], string> = {
  "retell-llm": "llm",
  "conversation-flow": "flow",
  "voice-agent": "agent",
  "chat-agent": "agent",
};

async function pushOne(cfg: LocalConfig, ids: Record<string, string>): Promise<void> {
  const ep = ENDPOINTS[cfg.kind];
  const existingId = ids[cfg.key];
  const action = existingId ? `PATCH ${ep.update(existingId)}` : `POST ${ep.create}`;
  console.log(`- ${cfg.key} (${cfg.kind}): ${action}`);

  const { body, unresolved } = resolvePlaceholders(cfg.body, ids);
  if (unresolved.length) {
    // Cross-file ids (<CONVERSATION_FLOW_ID:x>, <RETELL_LLM_ID:x>, <INBOUND_AGENT_ID>) resolve once the
    // referenced object has been pushed; everything else must be edited by hand before a real push.
    const msg = `${cfg.key}: unresolved placeholders ${unresolved.join(", ")}`;
    if (dryRun) {
      console.warn(`  warning: ${msg}`);
      return;
    }
    if (!allowPlaceholders) throw new Error(`${msg} (fill them in, or pass --allow-placeholders)`);
    console.warn(`  warning: pushing with placeholders ${unresolved.join(", ")}`);
  }
  if (dryRun) return;

  const result = existingId
    ? await retell("PATCH", ep.update(existingId), body)
    : await retell("POST", ep.create, body);

  const id: string | undefined = result.agent_id ?? result.conversation_flow_id ?? result.llm_id;
  if (!id) throw new Error(`${cfg.key}: response had no id field: ${JSON.stringify(result).slice(0, 300)}`);
  if (!existingId) {
    ids[cfg.key] = id;
    writeIds(ids);
    console.log(`  created ${id} (recorded in .ids.json)`);
  } else {
    console.log(`  updated ${id} version ${result.version ?? "?"}`);
  }

  const live = await retell("GET", ep.get(id));
  const path = writeEvidence(`${EVIDENCE_PREFIX[cfg.kind]}-${cfg.name}-${today()}.json`, live);
  console.log(`  evidence: ${path}`);
}

async function main(): Promise<void> {
  const ids = readIds();
  const configs = loadLocalConfigs()
    .filter((c) => !only || c.name === only)
    .sort((a, b) => ORDER[a.kind] - ORDER[b.kind] || a.key.localeCompare(b.key));
  if (!configs.length) {
    console.error("No config files found.");
    process.exit(1);
  }
  console.log(`${dryRun ? "[dry-run] " : ""}Pushing ${configs.length} object(s) to Retell`);
  let failed = 0;
  for (const cfg of configs) {
    try {
      await pushOne(cfg, ids);
    } catch (err) {
      failed++;
      console.error(`  FAILED: ${(err as Error).message}`);
    }
  }
  if (failed) {
    console.error(`${failed} object(s) failed.`);
    process.exit(1);
  }
  console.log("Done. Review drafts in the Retell dashboard, publish, then run audit-config.ts.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
