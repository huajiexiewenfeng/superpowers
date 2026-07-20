import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const schemaPath = resolve(repoRoot, 'docs/superpowers/evals/capability-profile.schema.json');
const profilePath = resolve(repoRoot, 'docs/superpowers/evals/profiles/frontier-candidate-001.json');
const provenancePath = resolve(repoRoot, 'docs/superpowers/evals/source-provenance.json');
const bindingKeys = [
  'base_model',
  'reasoning_configuration',
  'harness_and_router',
  'toolchain',
  'permissions',
  'benchmark_suite',
  'evaluation_commit',
];

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function validateProfile(profile) {
  const errors = [];
  const required = [
    '$schema',
    'schema_version',
    'profile_id',
    'status',
    'intended_profile',
    'bindings',
    'missing_bindings',
    'baseline',
    'approval',
    'invalidation_triggers',
    'notes',
  ];

  for (const field of required) {
    if (!(field in profile)) errors.push(`missing ${field}`);
  }

  if (!['not_evaluated', 'evaluated', 'approved', 'invalidated'].includes(profile.status)) {
    errors.push('invalid status');
  }

  const missing = [];
  for (const key of bindingKeys) {
    if (!(key in (profile.bindings ?? {}))) errors.push(`missing binding key ${key}`);
    if (profile.bindings?.[key] == null) missing.push(key);
  }

  if (JSON.stringify([...missing].sort()) !== JSON.stringify([...(profile.missing_bindings ?? [])].sort())) {
    errors.push('missing_bindings does not match null bindings');
  }

  if (profile.status === 'approved') {
    if (missing.length > 0) errors.push('approved profile has unresolved bindings');
    if (profile.approval?.state !== 'approved') errors.push('approved profile lacks approval state');
    if (!profile.approval?.approved_by || !profile.approval?.approved_at) errors.push('approved profile lacks approval identity or time');
  } else if (profile.status === 'not_evaluated' && profile.approval?.state !== 'pending') {
    errors.push('not_evaluated profile must have pending approval');
  }

  for (const field of ['upstream_commit', 'fork_baseline_commit']) {
    if (!/^[0-9a-f]{40}$/.test(profile.baseline?.[field] ?? '')) errors.push(`invalid baseline ${field}`);
  }

  if (!Array.isArray(profile.invalidation_triggers) || profile.invalidation_triggers.length < 7) {
    errors.push('invalidation triggers are incomplete');
  }

  return errors;
}

test('capability profile schema is a zero-dependency JSON Schema contract', async () => {
  const schema = await readJson(schemaPath);

  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.$id, 'https://github.com/huajiexiewenfeng/superpowers/schemas/capability-profile.schema.json');
  assert.equal(schema.type, 'object');
  assert.deepEqual(new Set(schema.required), new Set([
    'schema_version',
    'profile_id',
    'status',
    'intended_profile',
    'bindings',
    'missing_bindings',
    'baseline',
    'approval',
    'invalidation_triggers',
    'notes',
  ]));
  assert.equal(schema.additionalProperties, false);
  assert.ok(Array.isArray(schema.allOf), 'schema must encode status-dependent approval rules');
});

test('frontier candidate is completely bound but remains honestly unmeasured', async () => {
  const profile = await readJson(profilePath);

  assert.equal(profile.$schema, '../capability-profile.schema.json');
  assert.equal(profile.schema_version, '1.0.0');
  assert.equal(profile.profile_id, 'frontier-candidate-001');
  assert.equal(profile.status, 'not_evaluated');
  assert.equal(profile.intended_profile, 'frontier');
  assert.deepEqual(validateProfile(profile), []);
  assert.deepEqual(profile.missing_bindings, []);
  assert.equal(profile.bindings.base_model.exact_model_id, 'gpt-5.6-sol');
  assert.equal(profile.bindings.reasoning_configuration.effort, 'high');
  assert.equal(profile.bindings.harness_and_router.configured_default, 'frontier');
  assert.equal(profile.approval.state, 'pending');
  assert.doesNotMatch(JSON.stringify(profile), /\b(?:TBD|TODO)\b|fill in|implement later/i);
});

test('approval validation rejects unresolved or unauthorised profiles', async () => {
  const profile = await readJson(profilePath);
  const invalidApproved = structuredClone(profile);
  invalidApproved.status = 'approved';
  invalidApproved.approval.state = 'approved';
  invalidApproved.bindings.base_model = null;
  invalidApproved.missing_bindings = ['base_model'];

  assert.ok(validateProfile(invalidApproved).includes('approved profile has unresolved bindings'));
  assert.ok(validateProfile(invalidApproved).includes('approved profile lacks approval identity or time'));

  const invalidDraft = structuredClone(profile);
  invalidDraft.missing_bindings = ['base_model'];
  assert.ok(validateProfile(invalidDraft).includes('missing_bindings does not match null bindings'));
});

test('design provenance pins the published v0.2 source and gives every known mirror one disposition', async () => {
  const provenance = await readJson(provenancePath);

  assert.equal(provenance.schema_version, '1.0.0');
  assert.equal(provenance.design_basis.status, 'Proposal v0.2');
  assert.equal(provenance.design_basis.revision, 'd283da2e45f04363bc70734f88abed8a69c437eb');
  assert.match(provenance.design_basis.lf_normalized_sha256, /^[0-9a-f]{64}$/);
  assert.equal(provenance.design_basis.canonicality, 'published_gist_is_authoritative');
  assert.equal(provenance.known_mirrors.length, 3);

  const allowedDispositions = new Set(['sync', 'archive', 'deliberately_unmanaged']);
  for (const mirror of provenance.known_mirrors) {
    assert.ok(mirror.location_alias.startsWith('$'), 'repository provenance must use a path alias');
    assert.match(mirror.sha256, /^[0-9a-f]{64}$/);
    assert.ok(allowedDispositions.has(mirror.disposition), `${mirror.location_alias}: invalid disposition`);
  }

  assert.equal(provenance.task1_policy.skill_behavior_changes_allowed, false);
  assert.equal(provenance.task1_policy.profile_activation_allowed, false);
  assert.doesNotMatch(JSON.stringify(provenance), /\b(?:TBD|TODO)\b|fill in|implement later/i);
});
