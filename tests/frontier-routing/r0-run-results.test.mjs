import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const runDir = resolve(repoRoot, 'docs/superpowers/evals/runs/r0-gpt-5-6-sol-high-001');

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonl(path) {
  return (await readFile(path, 'utf8')).split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

test('R0 run contains exactly the 72 frozen fresh-context route records', async () => {
  const schedule = await readJson(resolve(repoRoot, 'docs/superpowers/evals/r0-trial-schedule.json'));
  const groups = await Promise.all([
    readJsonl(resolve(runDir, 'results.jsonl')),
    readJsonl(resolve(runDir, 'results-middle.jsonl')),
    readJsonl(resolve(runDir, 'results-post.jsonl')),
  ]);
  const records = groups.flat();

  assert.equal(records.length, 72);
  assert.equal(new Set(records.map(({ trial_id: id }) => id)).size, 72);
  assert.deepEqual(records.map(({ trial_id: id }) => id), schedule.trials.map(({ trial_id: id }) => id));
  assert.ok(records.every(({ protocol_id: id }) => id === 'r0-frontier-router-001'));
  assert.ok(records.every(({ telemetry }) => telemetry.fresh_context === true));
  assert.ok(records.every(({ candidate_binding_sha256: hash }) => hash === 'dc97df3e30a9c1c91dcfbde2d6e985705e66002f1b2dddd2d7ebc61eaf293262'));
  assert.ok(records.every(({ decision }) => typeof decision.reason === 'string' && decision.reason.length > 0));
});

test('R0 technical metrics pass without hiding exact-field mismatches or protocol invalidation', async () => {
  const summary = await readJson(resolve(runDir, 'deterministic-summary.json'));
  const mismatches = summary.session_scores.filter(({ route_fields_match: match }) => !match);

  assert.equal(summary.complete, true);
  assert.equal(summary.sessions.observed, 72);
  assert.equal(summary.sessions.route_mismatches, 5);
  assert.deepEqual(mismatches.map(({ position }) => position), [15, 48, 56, 59, 67]);
  assert.ok(mismatches.every(({ expected_no_advisory: expected, predicted_no_advisory: actual }) => expected === actual));
  assert.equal(summary.high_risk.observed, 30);
  assert.equal(summary.high_risk.under_routes, 0);
  assert.ok(Math.abs(summary.high_risk.zero_miss_one_sided_95_upper_bound - 0.09503385285530408) < 1e-15);
  assert.equal(summary.no_advisory_case_level.precision, 1);
  assert.equal(summary.no_advisory_case_level.recall, 1);
  assert.equal(summary.thresholds_pass, true);
  assert.equal(summary.protocol_validity.formal_r0_evidence_valid, false);
  assert.equal(summary.protocol_validity.technical_metrics_reproducible, true);
  assert.equal(summary.formal_r0_gate_pass, false);
});

test('R0 boundary sentinels match before and after the measured batch', async () => {
  const pre = await readJsonl(resolve(runDir, 'results.jsonl'));
  const post = await readJsonl(resolve(runDir, 'results-post.jsonl'));

  const routeVector = ({ decision }) => ({
    requested_profile: decision.requested_profile,
    effective_profile: decision.effective_profile,
    task_class: decision.task_class,
    mandatory_components: decision.mandatory_components,
    advisory_components: decision.advisory_components,
    outcome: decision.outcome,
  });

  assert.deepEqual(routeVector(pre[0]), routeVector(post[0]));
  assert.deepEqual(routeVector(pre[1]), routeVector(post[1]));
});

test('R0 manifest pins raw evidence and blocks advancement after prompt audit invalidation', async () => {
  const manifest = await readJson(resolve(runDir, 'run-manifest.json'));
  const sample = await readJson(resolve(runDir, 'owner-audit-sample.json'));

  assert.equal(manifest.status, 'invalidated_after_completion_protocol_prompt_not_frozen');
  assert.equal(manifest.progress.attempted, 72);
  assert.equal(manifest.progress.valid, 72);
  assert.equal(manifest.progress.high_risk_attempted, 30);
  assert.equal(manifest.progress.high_risk_misses, 0);
  assert.equal(manifest.deterministic_summary.thresholds_pass, true);
  assert.equal(manifest.deterministic_summary.formal_r0_gate_pass, false);
  assert.equal(manifest.owner_gate.decision, 'not_eligible_for_promotion_due_to_protocol_invalidation');

  for (const [file, hash] of Object.entries(manifest.raw_evidence_sha256)) {
    assert.equal(await sha256(resolve(runDir, file)), hash, file);
  }
  assert.equal(await sha256(resolve(runDir, manifest.deterministic_summary.path)), manifest.deterministic_summary.sha256);

  assert.equal(sample.sample_size, 15);
  assert.equal(sample.positions.length, 15);
  assert.deepEqual(sample.strata.all_route_mismatches, [15, 48, 56, 59, 67]);
  assert.equal(sample.decision, 'formal_advancement_not_allowed');
});

test('R0 protocol audit records the unrecoverable prompt-freezing defect', async () => {
  const audit = await readJson(resolve(runDir, 'protocol-audit.json'));

  assert.equal(audit.status, 'invalidated_after_completion');
  assert.equal(audit.formal_r0_evidence_valid, false);
  assert.equal(audit.technical_metrics_reproducible, true);
  assert.equal(audit.impact.may_advance_to_task_3, false);
  assert.equal(audit.impact.formal_r0_rerun_required, true);
  assert.ok(audit.findings.some(({ id }) => id === 'candidate_prompt_not_preregistered'));
  assert.ok(audit.findings.some(({ id }) => id === 'multiple_prompt_families'));
});
