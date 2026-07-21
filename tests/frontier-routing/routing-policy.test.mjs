import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const casesPath = resolve(repoRoot, 'tests/frontier-routing/routing-cases.json');
const routerPath = resolve(repoRoot, 'skills/using-superpowers/references/frontier-routing.md');
const skillPath = resolve(repoRoot, 'skills/using-superpowers/SKILL.md');
const judgePath = resolve(repoRoot, 'docs/superpowers/evals/judge-protocol.json');
const contractsPath = resolve(repoRoot, 'skills/using-superpowers/references/component-contracts.json');
const discoverableSkillIdentifier = /^[a-z0-9][a-z0-9:_-]*$/;

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function unique(values) {
  return [...new Set(values)];
}

function classifyTask(input) {
  if (input.risk_flags.length > 0) return 'high_risk';
  if (input.ambiguity === 'material' || ['cross_module', 'multi_stage'].includes(input.scope)) return 'complex';
  if (input.behavioral_change || input.scope === 'single_module') return 'bounded';
  return 'mechanical';
}

function selectRequestedProfile(input, taskClass = classifyTask(input)) {
  if (input.explicit_profile) return input.explicit_profile;
  if (input.natural_language_advisory_off_ramp) return 'off';
  if (
    input.trial_mode_status === 'active'
    && input.configured_default === 'frontier'
    && input.trial_frontier_eligible_task_classes?.includes(taskClass)
  ) return 'frontier';
  if (input.capability_profile_status === 'approved') return input.configured_default;
  return 'full';
}

function resolveRoute(policy, input) {
  const taskClass = classifyTask(input);
  const requestedProfile = selectRequestedProfile(input, taskClass);
  const effectiveProfile = taskClass === 'high_risk' ? 'full' : requestedProfile;
  const mandatory = [...policy.base_mandatory_components];
  if (taskClass === 'high_risk') mandatory.push(...policy.high_risk_mandatory_components);
  mandatory.push(...input.operational_components);

  let advisory;
  if (effectiveProfile === 'full') {
    advisory = unique([...input.applicable_skills, ...input.explicit_skill_requests]);
  } else if (effectiveProfile === 'off' || taskClass === 'mechanical') {
    advisory = unique(input.explicit_skill_requests);
  } else {
    advisory = unique([...input.applicable_skills, ...input.explicit_skill_requests]);
  }

  for (const identifier of advisory) {
    assert.match(identifier, discoverableSkillIdentifier, `advisory component must be an exact discoverable Skill identifier: ${identifier}`);
  }

  return {
    requested_profile: requestedProfile,
    effective_profile: effectiveProfile,
    task_class: taskClass,
    mandatory_components: unique(mandatory),
    advisory_components: advisory,
    outcome: effectiveProfile === 'full'
      ? 'full_v6_1_1'
      : advisory.length === 0
        ? 'no_advisory_workflow'
        : 'selected_advisory_workflow',
  };
}

test('routing fixture freezes enough positive, negative, conflict, override, and high-risk cases', async () => {
  const policy = await readJson(casesPath);
  const ids = new Set();

  assert.equal(policy.schema_version, '1.0.0');
  assert.deepEqual(policy.classification_precedence, ['high_risk', 'complex', 'bounded', 'mechanical']);
  assert.equal(policy.cases.filter(({ category }) => category === 'no_advisory_positive').length, 10);
  assert.ok(policy.cases.filter(({ category }) => category === 'no_advisory_negative').length >= 10);
  assert.ok(policy.cases.filter(({ input }) => input.risk_flags.length > 0).length >= 6);
  assert.ok(policy.cases.some(({ category }) => category === 'conflict'));
  assert.ok(policy.cases.some(({ category }) => category === 'override'));

  for (const routeCase of policy.cases) {
    assert.equal(ids.has(routeCase.id), false, `duplicate route case: ${routeCase.id}`);
    ids.add(routeCase.id);
    assert.ok(routeCase.prompt.length > 0, `${routeCase.id}: prompt is required`);
  }
});

test('deterministic policy table matches every frozen route case', async () => {
  const policy = await readJson(casesPath);

  for (const routeCase of policy.cases) {
    const actual = resolveRoute(policy, routeCase.input);
    const expectedMandatory = routeCase.expected.mandatory_floor === 'high_risk'
      ? unique([
          ...policy.base_mandatory_components,
          ...policy.high_risk_mandatory_components,
          ...routeCase.input.operational_components,
        ])
      : unique([...policy.base_mandatory_components, ...routeCase.input.operational_components]);

    assert.deepEqual(actual, {
      requested_profile: routeCase.expected.requested_profile,
      effective_profile: routeCase.expected.effective_profile,
      task_class: routeCase.expected.task_class,
      mandatory_components: expectedMandatory,
      advisory_components: routeCase.expected.advisory_components,
      outcome: routeCase.expected.outcome,
    }, routeCase.id);
  }
});

test('router documentation exposes the normative precedence, outputs, profiles, and fail-closed boundary', async () => {
  const [router, skill] = await Promise.all([
    readFile(routerPath, 'utf8'),
    readFile(skillPath, 'utf8'),
  ]);

  for (const required of [
    'mandatory floor',
    'advisory set',
    'requested_profile',
    'effective_profile',
    'task_class',
    'mandatory_components',
    'advisory_components',
    'no_advisory_workflow',
    'superpowers=full',
    'superpowers=frontier',
    'superpowers=off',
    'fail closed',
  ]) {
    assert.ok(router.toLowerCase().includes(required.toLowerCase()), `router reference is missing: ${required}`);
  }

  assert.match(skill, /references\/frontier-routing\.md/);
  assert.match(skill, /high_risk/);
  assert.match(skill, /no_advisory_workflow/);
  assert.match(skill, /User instructions .* take precedence over skills/);
  assert.match(router, /use `brainstorming`, not `brainstorming\.universal_design_gate`/);
  assert.match(skill, /\.superpowers\/frontier-trial\.config\.json/);
});

test('active local trial selects frontier without claiming profile approval while explicit controls still win', async () => {
  const policy = await readJson(casesPath);
  const baseInput = {
    explicit_profile: null,
    natural_language_advisory_off_ramp: false,
    configured_default: 'frontier',
    capability_profile_status: 'not_evaluated',
    trial_mode_status: 'active',
    trial_frontier_eligible_task_classes: ['mechanical', 'bounded', 'complex'],
    risk_flags: [],
    ambiguity: 'low',
    scope: 'single_module',
    behavioral_change: true,
    applicable_skills: ['systematic-debugging'],
    explicit_skill_requests: [],
    operational_components: [],
  };

  assert.equal(resolveRoute(policy, baseInput).requested_profile, 'frontier');
  assert.equal(resolveRoute(policy, { ...baseInput, explicit_profile: 'full' }).requested_profile, 'full');
  assert.equal(resolveRoute(policy, { ...baseInput, natural_language_advisory_off_ramp: true }).requested_profile, 'off');

  const highRisk = resolveRoute(policy, {
    ...baseInput,
    risk_flags: ['release'],
    scope: 'multi_stage',
    applicable_skills: ['release-procedure'],
  });
  assert.equal(highRisk.task_class, 'high_risk');
  assert.equal(highRisk.requested_profile, 'full');
  assert.equal(highRisk.effective_profile, 'full');
});

test('advisory route fields reject internal component-contract IDs', async () => {
  const policy = await readJson(casesPath);
  assert.throws(() => resolveRoute(policy, {
    explicit_profile: 'frontier',
    natural_language_advisory_off_ramp: false,
    configured_default: 'full',
    capability_profile_status: 'not_evaluated',
    risk_flags: [],
    ambiguity: 'material',
    scope: 'single_module',
    behavioral_change: true,
    applicable_skills: ['brainstorming.universal_design_gate'],
    explicit_skill_requests: [],
    operational_components: [],
  }), /exact discoverable Skill identifier/);
});

test('judge protocol binds the selected same-model Judge but blocks runs until calibration and approval', async () => {
  const protocol = await readJson(judgePath);
  const promptHash = createHash('sha256').update(protocol.judge_prompt.text, 'utf8').digest('hex');

  assert.equal(protocol.schema_version, '1.0.0');
  assert.equal(promptHash, protocol.judge_prompt.sha256);
  assert.deepEqual(protocol.rubric.ordering, ['safety', 'required_quality', 'routing_correctness', 'cost']);
  assert.equal(protocol.owner_audit.minimum_stratified_sample_rate, 0.2);
  assert.equal(protocol.readiness.real_session_comparison_allowed, false);
  assert.equal(protocol.status, 'bound_pending_calibration_and_experiment_approval');
  assert.equal(protocol.primary_judge.provider, 'OpenAI');
  assert.equal(protocol.primary_judge.exact_model_id, 'gpt-5.6-sol');
  assert.equal(protocol.primary_judge.reasoning_configuration.effort, 'high');
  assert.equal(protocol.primary_judge.model_revision.provider_revision_exposed, false);
  assert.match(protocol.primary_judge.independence_limitation, /same gpt-5\.6-sol model/i);
  assert.ok(protocol.readiness.blocking_fields.includes('pre_batch_sentinel_calibration'));
  assert.ok(protocol.readiness.blocking_fields.includes('fresh_repository_owner_experiment_approval'));
  assert.doesNotMatch(JSON.stringify(protocol), /\b(?:TBD|TODO)\b|fill in|implement later/i);
});

test('high-risk prompt routing is honest about fail-open classification and fail-closed action boundaries', async () => {
  const registry = await readJson(contractsPath);
  const component = registry.contracts.find(({ id }) => id === 'using-superpowers.mandatory_risk_floor');

  assert.equal(component.enforcement.mechanism, 'prompt_text');
  assert.equal(component.enforcement.claim, 'best_effort');
  assert.equal(component.failure_mode, 'fail_open');
  assert.equal(component.external_enforcement.failure_mode, 'fail_closed');
  assert.match(component.external_enforcement.if_unavailable, /Stop before/);
});

export { classifyTask, resolveRoute, selectRequestedProfile };
