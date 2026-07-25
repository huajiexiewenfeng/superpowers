import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const runRoot = resolve(
  repoRoot,
  'docs/superpowers/evals/runs/a0-exploratory-routing-red-001',
);

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function sha256(path) {
  return createHash('sha256').update(await readFile(path)).digest('hex');
}

test('A0 prebaseline isolates its cases from the byte-frozen R0 fixture', async () => {
  const [manifest, red, r0Protocol] = await Promise.all([
    readJson(resolve(runRoot, 'run-manifest.json')),
    readJson(resolve(runRoot, 'deterministic-red.json')),
    readJson(resolve(repoRoot, 'docs/superpowers/evals/r0-router-preregistration.json')),
  ]);
  const r0CasesPath = resolve(repoRoot, 'tests/frontier-routing/routing-cases.json');
  const a0CasesPath = resolve(repoRoot, 'tests/frontier-routing/a0-exploratory-routing-cases.json');

  assert.equal(await sha256(r0CasesPath), r0Protocol.fixture.sha256);
  assert.equal(await sha256(r0CasesPath), manifest.observed_artifact_hashes.superpowers_r0_cases_sha256);
  assert.equal(await sha256(a0CasesPath), manifest.observed_artifact_hashes.superpowers_a0_cases_sha256);
  assert.equal(red.fixtures.base_policy_sha256, r0Protocol.fixture.sha256);
  assert.equal(red.fixtures.a0_cases_sha256, manifest.observed_artifact_hashes.superpowers_a0_cases_sha256);
});

test('A0 evidence remains an honest local prebaseline and cannot unlock B0', async () => {
  const manifest = await readJson(resolve(runRoot, 'run-manifest.json'));
  const hashes = manifest.observed_artifact_hashes;

  assert.equal(manifest.status, 'partial_a0_local_prebaseline');
  assert.equal(manifest.scope.target_skill_behavior_files_modified, false);
  assert.equal(manifest.scope.model_calls, 0);
  assert.equal(manifest.authorization.fresh_session_model_run_approved, false);
  assert.equal(manifest.freeze_quality.formal_freeze_complete, false);
  assert.equal(manifest.gate.b0_unlocked, false);
  assert.equal(manifest.verification.superpowers_deterministic.expected_failure_case, 'complex-exploratory-architecture-no-process');

  assert.equal(
    await sha256(resolve(repoRoot, 'skills/using-superpowers/references/frontier-routing.md')),
    hashes.superpowers_router_sha256,
  );
  assert.equal(
    await sha256(resolve(repoRoot, 'tests/frontier-routing/routing-policy.test.mjs')),
    hashes.superpowers_test_sha256,
  );
  assert.equal(
    await sha256(resolve(repoRoot, 'docs/superpowers/specs/2026-07-22-exploratory-routing-unified-design.md')),
    hashes.unified_design_sha256,
  );
  assert.equal(
    await sha256(resolve(runRoot, 'deterministic-red.json')),
    hashes.deterministic_red_summary_sha256,
  );
});
