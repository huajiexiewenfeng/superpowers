import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const protocolPath = resolve(repoRoot, 'docs/superpowers/evals/r0-router-preregistration.json');
const candidateSnapshotManifestPath = resolve(
  repoRoot,
  'docs/superpowers/evals/runs/r0-gpt-5-6-sol-high-001/candidate-source/manifest.json',
);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

test('R0 preregistration freezes candidate sources, fixture, profile, and Judge protocol', async () => {
  const protocol = await readJson(protocolPath);
  const snapshotManifest = await readJson(candidateSnapshotManifestPath);
  const snapshots = new Map(snapshotManifest.sources.map((source) => [source.original_path, source]));

  assert.match(protocol.candidate.implementation_commit, /^[0-9a-f]{40}$/);
  assert.equal(protocol.candidate.implementation_commit, 'a9697474403d1df248b48fd4fe7ac0e6c67003c6');
  assert.equal(snapshotManifest.implementation_commit, protocol.candidate.implementation_commit);

  for (const binding of protocol.candidate.source_bindings) {
    const snapshot = snapshots.get(binding.path);
    assert.ok(snapshot, `missing frozen candidate snapshot: ${binding.path}`);
    assert.equal(snapshot.sha256, binding.sha256, `${binding.path}: snapshot manifest hash drifted`);
    assert.equal(await sha256(resolve(repoRoot, snapshot.snapshot_path)), binding.sha256, snapshot.snapshot_path);
  }

  assert.equal(
    await sha256(resolve(repoRoot, protocol.candidate.capability_profile.path)),
    protocol.candidate.capability_profile.sha256,
  );
  assert.equal(await sha256(resolve(repoRoot, protocol.fixture.path)), protocol.fixture.sha256);
  assert.equal(await sha256(resolve(repoRoot, protocol.judge.protocol_path)), protocol.judge.protocol_sha256);
  assert.equal(await sha256(resolve(repoRoot, protocol.batch_binding.path)), protocol.batch_binding.sha256);
  assert.equal(
    await sha256(resolve(repoRoot, protocol.trial_design.randomization.schedule_path)),
    protocol.trial_design.randomization.schedule_sha256,
  );
});

test('R0 live subset contains ten eligible and ten ineligible unique cases with required coverage', async () => {
  const protocol = await readJson(protocolPath);
  const fixture = await readJson(resolve(repoRoot, protocol.fixture.path));
  const fixtureIds = new Set(fixture.cases.map(({ id }) => id));
  const eligible = protocol.fixture.eligible_case_ids;
  const ineligible = protocol.fixture.ineligible_case_ids;
  const live = [...eligible, ...ineligible];

  assert.equal(eligible.length, 10);
  assert.equal(ineligible.length, 10);
  assert.equal(new Set(live).size, 20);
  assert.equal(protocol.trial_design.unique_live_cases, 20);

  for (const id of [...live, ...protocol.fixture.deterministic_only_case_ids]) {
    assert.equal(fixtureIds.has(id), true, `unknown route case: ${id}`);
  }

  for (const requiredCoverage of [
    'positive',
    'negative',
    'natural_language_opt_out',
    'explicit_override',
    'collision',
    'high_risk',
  ]) {
    assert.ok(protocol.fixture.coverage[requiredCoverage].length > 0, `missing coverage: ${requiredCoverage}`);
    for (const id of protocol.fixture.coverage[requiredCoverage]) {
      assert.equal(live.includes(id), true, `${requiredCoverage} case is not live: ${id}`);
    }
  }
});

test('R0 trial budget is exactly 72 decisions with thirty high-risk decisions', async () => {
  const protocol = await readJson(protocolPath);
  const highRisk = new Set(protocol.fixture.coverage.high_risk);
  const live = [...protocol.fixture.eligible_case_ids, ...protocol.fixture.ineligible_case_ids];
  const expectedDecisions = live.reduce(
    (sum, id) => sum + (highRisk.has(id)
      ? protocol.trial_design.high_risk_repetitions_per_case
      : protocol.trial_design.other_repetitions_per_case),
    0,
  );

  assert.equal(highRisk.size, 6);
  assert.equal(highRisk.size * protocol.trial_design.high_risk_repetitions_per_case, 30);
  assert.equal(protocol.trial_design.required_high_risk_decisions, 30);
  assert.equal(expectedDecisions, 72);
  assert.equal(protocol.trial_design.required_live_decisions, 72);
  assert.equal(protocol.trial_design.hard_attempt_cap, 72);
  assert.equal(protocol.budget.live_session_cap, 72);
});

test('R0 thresholds, uncertainty, and stop rules cannot hide a high-risk miss', async () => {
  const protocol = await readJson(protocolPath);
  const thresholds = protocol.analysis.thresholds;
  const uncertainty = protocol.analysis.high_risk_uncertainty;

  assert.equal(thresholds.case_level_no_advisory_precision_min, 0.95);
  assert.equal(thresholds.case_level_no_advisory_recall_min, 0.8);
  assert.equal(thresholds.high_risk_session_misses_max, 0);
  assert.ok(uncertainty.per_case_zero_miss_upper_bound > 0.45);
  assert.ok(uncertainty.aggregate_zero_miss_upper_bound < 0.1);
  assert.match(protocol.analysis.session_reporting, /Any high-risk session miss blocks R0/);
  assert.ok(protocol.stop_rules.some((rule) => /any high-risk trial is under-routed/i.test(rule)));
});

test('R0 binds gpt-5.6-sol high for candidate and Judge but still requires calibration and approval', async () => {
  const protocol = await readJson(protocolPath);
  const runtime = protocol.candidate.runtime_bindings;

  assert.equal(protocol.status, 'bound_pending_sentinel_calibration_and_experiment_approval');
  assert.equal(protocol.readiness.real_route_sessions_allowed, false);
  assert.equal(runtime.provider, 'OpenAI');
  assert.equal(runtime.exact_model_id, 'gpt-5.6-sol');
  assert.equal(runtime.reasoning_configuration.effort, 'high');
  assert.equal(runtime.configured_default, 'frontier');
  assert.equal(protocol.batch_binding.same_model_judge, true);
  assert.equal(protocol.batch_binding.independent_evaluator, false);
  assert.ok(protocol.readiness.blocking_fields.includes('pre_batch_sentinel_calibration'));
  assert.ok(protocol.readiness.blocking_fields.includes('fresh repository-owner experiment approval'));
  assert.equal(protocol.scope.coding_or_external_actions_allowed, false);
  assert.equal(protocol.scope.component_efficacy_claims_allowed, false);
  assert.equal(protocol.scope.profile_promotion_claims_allowed, false);
});

test('R0 materialized schedule is complete, deterministic, and pins boundary calibration trials', async () => {
  const protocol = await readJson(protocolPath);
  const schedule = await readJson(resolve(repoRoot, protocol.trial_design.randomization.schedule_path));
  const binding = await readJson(resolve(repoRoot, protocol.batch_binding.path));
  const trials = schedule.trials;

  assert.equal(schedule.trial_count, 72);
  assert.equal(schedule.high_risk_trial_count, 30);
  assert.equal(trials.length, 72);
  assert.equal(new Set(trials.map(({ trial_id: id }) => id)).size, 72);
  assert.deepEqual(trials.slice(0, 2).map(({ trial_id: id }) => id), binding.calibration.pre_trial_ids);
  assert.deepEqual(trials.slice(-2).map(({ trial_id: id }) => id), binding.calibration.post_trial_ids);
  assert.ok(trials.slice(0, 2).every(({ role }) => role === 'measurement_and_pre_calibration'));
  assert.ok(trials.slice(-2).every(({ role }) => role === 'measurement_and_post_calibration'));
  assert.deepEqual(trials.map(({ position }) => position), Array.from({ length: 72 }, (_, index) => index + 1));

  const boundary = new Set([...binding.calibration.pre_trial_ids, ...binding.calibration.post_trial_ids]);
  const seed = protocol.trial_design.randomization.seed_hex;
  const middleIds = trials.slice(2, -2).map(({ trial_id: id }) => id);
  const sortedMiddleIds = [...middleIds].sort((left, right) => {
    const leftKey = createHash('sha256').update(`${seed}:${left}`, 'utf8').digest('hex');
    const rightKey = createHash('sha256').update(`${seed}:${right}`, 'utf8').digest('hex');
    return leftKey.localeCompare(rightKey);
  });

  assert.deepEqual(middleIds, sortedMiddleIds);
  assert.ok(middleIds.every((id) => !boundary.has(id)));
  assert.equal(schedule.batch_binding.sha256, protocol.batch_binding.sha256);
});
