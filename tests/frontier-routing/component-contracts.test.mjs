import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const contractsPath = resolve(repoRoot, 'skills/using-superpowers/references/component-contracts.json');

const allowed = {
  state: new Set(['baseline', 'proposed']),
  layer: new Set(['register', 'open_ended_reasoning', 'operational_control']),
  kind: new Set(['register', 'reasoning_scaffold', 'fact', 'procedure', 'tool', 'state', 'gate']),
  lifecycle: new Set(['invariant_core', 'intentional_shaping', 'compensatory_shell']),
  binding: new Set(['advisory', 'mandatory']),
  failureMode: new Set(['fail_open', 'fail_closed', 'report_only']),
  phase1Action: new Set(['retain', 'replace', 'modify', 'proposed', 'no_change']),
};

const phase1Targets = [
  'brainstorming.universal_design_gate',
  'test-driven-development.unconditional_tdd',
  'writing-plans.micro_step_granularity',
].sort();

async function readContracts() {
  return JSON.parse(await readFile(contractsPath, 'utf8'));
}

async function sha256(relativePath) {
  const bytes = await readFile(resolve(repoRoot, relativePath));
  return createHash('sha256').update(bytes).digest('hex');
}

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

test('component contract registry declares the Phase 1 scope without placeholders', async () => {
  const registry = await readContracts();

  assert.equal(registry.schema_version, '1.0.0');
  assert.match(registry.baseline_commit, /^[0-9a-f]{40}$/);
  assert.equal(registry.retirement_unit, 'component');
  assert.deepEqual([...registry.phase1_target_component_ids].sort(), phase1Targets);
  assert.ok(Array.isArray(registry.contracts));
  assert.ok(registry.contracts.length >= 12, 'expected routing, target, retained, and invariant contracts');
  assert.doesNotMatch(JSON.stringify(registry), /\b(?:TBD|TODO)\b|fill in|implement later/i);
});

test('every component has a valid purpose, control contract, and maintenance owner', async () => {
  const registry = await readContracts();
  const ids = new Set();

  for (const component of registry.contracts) {
    assert.ok(nonEmpty(component.id), 'component id is required');
    assert.equal(ids.has(component.id), false, `duplicate component id: ${component.id}`);
    ids.add(component.id);

    assert.ok(allowed.state.has(component.state), `${component.id}: invalid state`);
    assert.ok(allowed.layer.has(component.layer), `${component.id}: invalid layer`);
    assert.ok(allowed.kind.has(component.kind), `${component.id}: invalid kind`);
    assert.ok(allowed.lifecycle.has(component.lifecycle), `${component.id}: invalid lifecycle`);
    assert.ok(allowed.binding.has(component.binding), `${component.id}: invalid binding`);
    assert.ok(allowed.failureMode.has(component.failure_mode), `${component.id}: invalid failure mode`);
    assert.ok(allowed.phase1Action.has(component.phase1_action), `${component.id}: invalid Phase 1 action`);
    assert.equal(component.retirement_scope, 'component', `${component.id}: retirement must be component-scoped`);
    assert.equal(component.whole_skill_deletion_candidate, false, `${component.id}: Task 1 cannot nominate whole-Skill deletion`);

    const { failure_prevented: failure, capability_enabled: capability } = component.purpose;
    assert.ok(nonEmpty(failure) || nonEmpty(capability), `${component.id}: purpose is missing`);

    const activation = component.activation ?? {};
    assert.ok(
      nonEmpty(activation.activate_when) || nonEmpty(activation.mandatory_when),
      `${component.id}: activation or mandatory condition is required`,
    );

    assert.ok(nonEmpty(component.enforcement.mechanism), `${component.id}: enforcement mechanism is required`);
    assert.ok(nonEmpty(component.enforcement.claim), `${component.id}: enforcement claim is required`);
    assert.ok(nonEmpty(component.authority.policy_owner), `${component.id}: policy owner is required`);
    assert.ok(nonEmpty(component.authority.satisfier), `${component.id}: satisfier is required`);
    assert.ok(nonEmpty(component.maintenance.owner), `${component.id}: maintenance owner is required`);
    assert.ok(nonEmpty(component.maintenance.freshness), `${component.id}: freshness rule is required`);
    assert.ok(nonEmpty(component.maintenance.compatibility_check), `${component.id}: compatibility check is required`);
    assert.ok(Array.isArray(component.maintenance.evaluation_cases));
    assert.ok(component.maintenance.evaluation_cases.length > 0, `${component.id}: evaluation cases are required`);

    if (component.binding === 'mandatory' && component.enforcement.mechanism === 'prompt_text') {
      assert.equal(component.enforcement.claim, 'best_effort', `${component.id}: prompt-only mandatory text cannot claim deterministic enforcement`);
      assert.notEqual(component.failure_mode, 'fail_closed', `${component.id}: prompt-only enforcement cannot be fail-closed`);
    }
  }
});

test('baseline components are bound to current source bytes and selectors', async () => {
  const registry = await readContracts();

  for (const component of registry.contracts.filter(({ state }) => state === 'baseline')) {
    assert.ok(nonEmpty(component.source.path), `${component.id}: baseline source path is required`);
    assert.match(component.source.sha256, /^[0-9a-f]{64}$/, `${component.id}: source SHA-256 is required`);
    assert.ok(nonEmpty(component.source.selector), `${component.id}: source selector is required`);

    const sourceText = await readFile(resolve(repoRoot, component.source.path), 'utf8');
    assert.equal(await sha256(component.source.path), component.source.sha256, `${component.id}: source hash drifted`);
    assert.ok(sourceText.includes(component.source.selector), `${component.id}: source selector not found`);
  }

  for (const component of registry.contracts.filter(({ state }) => state === 'proposed')) {
    assert.ok(nonEmpty(component.design_reference), `${component.id}: proposed component needs a design reference`);
    assert.equal(component.source, null, `${component.id}: proposed component must not pretend to exist in baseline source`);
  }
});

test('each Phase 1 target has retained neighboring capability and implemented router controls are source-bound', async () => {
  const registry = await readContracts();
  const byId = new Map(registry.contracts.map((component) => [component.id, component]));

  for (const id of phase1Targets) {
    assert.ok(byId.has(id), `missing Phase 1 target contract: ${id}`);
    assert.ok(['replace', 'modify'].includes(byId.get(id).phase1_action), `${id}: target action must be replace or modify`);
  }

  for (const skill of ['brainstorming', 'writing-plans', 'test-driven-development']) {
    assert.ok(
      registry.contracts.some((component) => component.skill === skill && component.phase1_action === 'retain'),
      `${skill}: target Skill needs an explicitly retained component`,
    );
  }

  for (const id of [
    'using-superpowers.explicit_profile_override',
    'using-superpowers.mandatory_risk_floor',
    'using-superpowers.no_advisory_workflow',
  ]) {
    assert.equal(byId.get(id)?.state, 'baseline', `missing implemented router component: ${id}`);
    assert.ok(byId.get(id)?.source, `implemented router component is not source-bound: ${id}`);
  }
});
