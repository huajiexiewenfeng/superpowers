import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const protocolPath = resolve(repoRoot, 'docs/superpowers/evals/a0-fresh-session-baseline.json');

async function protocol() {
  return JSON.parse(await readFile(protocolPath, 'utf8'));
}

test('A0 fresh-session baseline is a five-session route-only protocol', async () => {
  const value = await protocol();

  assert.equal(value.status, 'draft_pending_explicit_thread_authorization');
  assert.equal(value.authorization.fresh_threads_approved, false);
  assert.equal(value.authorization.maximum_sessions, 5);
  assert.equal(value.authorization.coding_actions_allowed, false);
  assert.equal(value.authorization.workspace_mutations_allowed, false);
  assert.equal(value.authorization.external_actions_allowed, false);
  assert.equal(value.authorization.judge_model_calls_allowed, false);
  assert.equal(value.observation_contract.stop_after_first_assistant_turn, true);
  assert.equal(value.schedule.length, 5);
  assert.deepEqual(value.schedule.map(({ position }) => position), [1, 2, 3, 4, 5]);
  assert.equal(value.schedule.filter(({ role }) => role === 'exploration_regression').length, 3);
  assert.equal(value.schedule.filter(({ role }) => role === 'delivery_control').length, 2);
});

test('A0 cannot unlock B0 from self-report or response behavior alone', async () => {
  const value = await protocol();

  assert.deepEqual(value.observation_contract.evidence_priority.slice(0, 3), [
    'host_skill_load_event',
    'host_skill_selection_event',
    'host_skill_discovery_event',
  ]);
  assert.ok(value.decision_rules.b0_unlock_requires.includes('host_selection_or_load_events_available'));
  assert.ok(value.decision_rules.observational_only_when.includes('host_selection_or_load_events_unavailable'));
  assert.match(value.decision_rules.exploration_regression_reproduced_when, /two of three/i);
  assert.match(value.decision_rules.delivery_controls_pass_when, /Both delivery controls/);
});

test('A0 protocol binds the approved model and immutable Superpowers snapshots', async () => {
  const value = await protocol();

  assert.equal(value.runtime_binding.exact_model_id, 'gpt-5.6-sol');
  assert.equal(value.runtime_binding.reasoning_effort, 'high');
  assert.match(value.source_bindings.superpowers_behavior_commit, /^[0-9a-f]{40}$/);
  assert.match(value.source_bindings.a0_source_snapshot_commit, /^[0-9a-f]{40}$/);
  assert.match(value.source_bindings.a0_metadata_commit, /^[0-9a-f]{40}$/);
  assert.equal(value.runtime_binding.harness_version, null);
  assert.equal(value.runtime_binding.load_order, null);
});
