import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import {
  appendTrialRecord,
  createTrialRecord,
  isTrialConfigActive,
  readTrialRecords,
  summarizeTrialRecords,
  validateTrialConfig,
} from '../../scripts/frontier-trial-log.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const templatePath = resolve(repoRoot, 'docs/superpowers/trial/frontier-trial.config.example.json');

async function activeConfig() {
  const config = JSON.parse(await readFile(templatePath, 'utf8'));
  config.status = 'active';
  return config;
}

function taskInput(index, overrides = {}) {
  return {
    task_id: `dogfood-${String(index).padStart(3, '0')}`,
    requested_profile: 'frontier',
    effective_profile: 'frontier',
    task_class: 'bounded',
    outcome: 'selected_advisory_workflow',
    advisory_components: ['systematic-debugging'],
    verification: 'passed',
    result: 'satisfied',
    process: 'fit',
    rework: false,
    quality_regression: false,
    ...overrides,
  };
}

test('trial template is reversible, expires, preserves the high-risk floor, and cannot promote a profile', async () => {
  const config = await activeConfig();

  assert.equal(validateTrialConfig(config), config);
  assert.equal(isTrialConfigActive(config, new Date('2026-07-21T00:00:00.000Z')), true);
  assert.equal(isTrialConfigActive(config, new Date('2026-08-21T00:00:00.000Z')), false);
  assert.equal(config.default_profile, 'frontier');
  assert.equal(config.routing.high_risk_effective_profile, 'full');
  assert.equal(config.stop_rules.fallback_directive, 'superpowers=full');
  assert.equal(config.evidence_limits.formal_profile_promotion_allowed, false);
});

test('trial logger persists ten content-free real-task records and returns a directional review gate', async (context) => {
  const config = await activeConfig();
  const root = await mkdtemp(resolve(tmpdir(), 'superpowers-frontier-trial-'));
  const logPath = resolve(root, 'events.jsonl');
  context.after(() => rm(root, { recursive: true, force: true }));

  let summary;
  for (let index = 1; index <= 10; index += 1) {
    const record = createTrialRecord(config, taskInput(index, {
      prompt: 'must never be persisted',
      code: 'must never be persisted',
      repository_path: 'must never be persisted',
    }), new Date(`2026-07-${String(index + 10).padStart(2, '0')}T00:00:00.000Z`));
    summary = await appendTrialRecord(config, logPath, record);
  }

  const records = await readTrialRecords(logPath);
  const bytes = await readFile(logPath, 'utf8');
  assert.equal(records.length, 10);
  assert.equal(summary.target_reached, true);
  assert.equal(summary.stop_required, false);
  assert.equal(summary.next_action, 'review_trial_and_form_one_focused_hypothesis');
  assert.doesNotMatch(bytes, /must never be persisted/);
  for (const record of records) {
    assert.equal('prompt' in record, false);
    assert.equal('code' in record, false);
    assert.equal('repository_path' in record, false);
    assert.equal(record.evidence_scope, 'directional_local_dogfood_only');
  }

  await assert.rejects(
    appendTrialRecord(config, logPath, createTrialRecord(config, taskInput(1), new Date('2026-07-21T00:00:00.000Z'))),
    /duplicate task_id/,
  );
});

test('trial logger rejects internal component IDs in advisory fields', async () => {
  const config = await activeConfig();
  assert.throws(
    () => createTrialRecord(config, taskInput(1, {
      advisory_components: ['brainstorming.universal_design_gate'],
    }), new Date('2026-07-21T00:00:00.000Z')),
    /discoverable Skill identifier/,
  );
});

test('one high-risk under-route or two consecutive quality regressions stops trial routing', async () => {
  const config = await activeConfig();
  const highRisk = createTrialRecord(config, taskInput(1, {
    task_class: 'high_risk',
    effective_profile: 'frontier',
  }), new Date('2026-07-21T00:00:00.000Z'));
  const unsafeSummary = summarizeTrialRecords(config, [highRisk]);
  assert.equal(unsafeSummary.stop_required, true);
  assert.deepEqual(unsafeSummary.stop_reasons, ['high_risk_under_route']);
  assert.equal(unsafeSummary.next_action, 'superpowers=full');

  const regressionRecords = [1, 2].map((index) => createTrialRecord(config, taskInput(index, {
    result: 'unsatisfied',
    rework: true,
    quality_regression: true,
  }), new Date(`2026-07-2${index}T00:00:00.000Z`)));
  const regressionSummary = summarizeTrialRecords(config, regressionRecords);
  assert.equal(regressionSummary.stop_required, true);
  assert.deepEqual(regressionSummary.stop_reasons, ['consecutive_quality_regressions']);
  assert.equal(regressionSummary.next_action, 'superpowers=full');
});
