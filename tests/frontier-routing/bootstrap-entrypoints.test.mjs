import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const inventoryPath = resolve(repoRoot, 'docs/superpowers/evals/bootstrap-entrypoints.json');
const allowedTestStatus = new Set(['live_e2e', 'static_only', 'shared_script_only', 'legacy_unverified']);
const allowedSupportStatus = new Set(['supported', 'documented_shared_path', 'legacy_eol']);

async function readInventory() {
  return JSON.parse(await readFile(inventoryPath, 'utf8'));
}

async function sha256(relativePath) {
  const bytes = await readFile(resolve(repoRoot, relativePath));
  return createHash('sha256').update(bytes).digest('hex');
}

test('entrypoint inventory is complete, component-source bound, and placeholder-free', async () => {
  const inventory = await readInventory();

  assert.equal(inventory.schema_version, '1.0.0');
  assert.match(inventory.captured_from_commit, /^[0-9a-f]{40}$/);
  assert.equal(inventory.canonical_bootstrap_source.path, 'skills/using-superpowers/SKILL.md');
  assert.equal(await sha256(inventory.canonical_bootstrap_source.path), inventory.canonical_bootstrap_source.sha256);
  assert.ok(inventory.entrypoints.length >= 10, 'expected all supported, shared, native, and legacy surfaces');
  assert.doesNotMatch(JSON.stringify(inventory), /\b(?:TBD|TODO)\b|fill in|implement later/i);
});

test('each entrypoint declares support, injection shape, evidence level, gaps, and source hashes', async () => {
  const inventory = await readInventory();
  const ids = new Set();

  for (const entry of inventory.entrypoints) {
    assert.equal(ids.has(entry.id), false, `duplicate entrypoint id: ${entry.id}`);
    ids.add(entry.id);
    assert.ok(allowedSupportStatus.has(entry.support_status), `${entry.id}: invalid support status`);
    assert.ok(allowedTestStatus.has(entry.test_status), `${entry.id}: invalid test status`);
    assert.equal(typeof entry.selected_for_promotion, 'boolean', `${entry.id}: selected_for_promotion must be explicit`);
    assert.ok(entry.registration_mode, `${entry.id}: registration mode is required`);
    assert.ok(Array.isArray(entry.registration_paths) && entry.registration_paths.length > 0, `${entry.id}: registration paths are required`);
    assert.ok(Array.isArray(entry.entrypoint_paths) && entry.entrypoint_paths.length > 0, `${entry.id}: entrypoint paths are required`);
    assert.ok(entry.loading_shape, `${entry.id}: loading shape is required`);
    assert.ok(entry.injection_events.length > 0, `${entry.id}: injection events are required`);
    assert.ok(entry.cache_behavior, `${entry.id}: cache behavior is required`);
    assert.ok(entry.dedup_behavior, `${entry.id}: dedup behavior is required`);
    assert.ok(entry.missing_source_behavior, `${entry.id}: missing-source behavior is required`);
    assert.ok(entry.enforcement_boundary, `${entry.id}: enforcement boundary is required`);
    assert.ok(['fail_open', 'fail_closed', 'report_only'].includes(entry.failure_mode), `${entry.id}: invalid failure mode`);
    assert.ok(Array.isArray(entry.evidence_paths) && entry.evidence_paths.length > 0, `${entry.id}: evidence paths are required`);
    assert.ok(Array.isArray(entry.known_gaps), `${entry.id}: known gaps must be explicit`);
    assert.ok(entry.evidence_owner, `${entry.id}: evidence owner is required`);

    if (entry.selected_for_promotion && entry.support_status === 'supported') {
      assert.equal(entry.test_status, 'live_e2e', `${entry.id}: promoted supported harness requires live E2E evidence`);
    }

    for (const [path, expectedHash] of Object.entries(entry.source_hashes)) {
      assert.equal(existsSync(resolve(repoRoot, path)), true, `${entry.id}: source path missing: ${path}`);
      assert.equal(await sha256(path), expectedHash, `${entry.id}: source hash drifted: ${path}`);
    }
  }
});

test('known missing and stale references remain explicit rather than silently becoming entrypoints', async () => {
  const inventory = await readInventory();

  for (const missing of inventory.known_missing_paths) {
    assert.equal(existsSync(resolve(repoRoot, missing.path)), false, `expected missing path now exists: ${missing.path}`);
    assert.ok(missing.reason);
    assert.ok(missing.evidenced_by.length > 0);
  }

  const missingPaths = new Set(inventory.known_missing_paths.map(({ path }) => path));
  for (const required of [
    '.antigravity-plugin/install.sh',
    'skills/using-superpowers/references/claude-code-tools.md',
    'skills/using-superpowers/references/copilot-tools.md',
    'skills/using-superpowers/references/gemini-tools.md',
  ]) {
    assert.ok(missingPaths.has(required), `missing stale-path record: ${required}`);
  }
});

test('critical harness-specific controls and loading-shape differences are preserved', async () => {
  const inventory = await readInventory();
  const byId = new Map(inventory.entrypoints.map((entry) => [entry.id, entry]));

  assert.equal(byId.get('claude-code-session-start').registration_mode, 'implicit_root_auto_discovery');
  assert.equal(byId.get('claude-code-session-start').loading_shape, 'full_skill_with_frontmatter');
  assert.equal(byId.get('opencode-first-user-message').loading_shape, 'body_without_frontmatter');
  assert.equal(byId.get('pi-session-context').loading_shape, 'body_without_frontmatter');
  assert.equal(byId.get('kimi-native-session-start').loading_shape, 'native_skill_loading');
  assert.equal(byId.get('codex-native-discovery').loading_shape, 'native_skill_discovery_no_bootstrap');
  assert.equal(byId.get('gemini-context-legacy').support_status, 'legacy_eol');

  const codexManifest = JSON.parse(await readFile(resolve(repoRoot, '.codex-plugin/plugin.json'), 'utf8'));
  assert.deepEqual(codexManifest.hooks, {}, 'Codex hooks must remain an explicit empty object');

  const geminiText = await readFile(resolve(repoRoot, 'GEMINI.md'), 'utf8');
  assert.match(geminiText, /references\/gemini-tools\.md/);
});

test('distribution manifests stay distinct from runtime injection and Windows no-Bash behavior is explicit', async () => {
  const inventory = await readInventory();

  for (const manifest of inventory.distribution_manifests) {
    assert.equal(manifest.injects_runtime_context, false, `${manifest.path}: distribution metadata cannot be called an injector`);
    assert.equal(existsSync(resolve(repoRoot, manifest.path)), true, `distribution manifest missing: ${manifest.path}`);
    assert.equal(await sha256(manifest.path), manifest.sha256, `distribution manifest hash drifted: ${manifest.path}`);
    assert.ok(manifest.runtime_registration_owner);
  }

  assert.deepEqual(
    inventory.distribution_manifests.map(({ path }) => path).sort(),
    ['.agents/plugins/marketplace.json', '.claude-plugin/marketplace.json', 'package.json'].sort(),
  );
  assert.equal(inventory.shared_hook_runtime_boundaries.windows_without_bash.behavior, 'silent_skip');
  assert.equal(inventory.shared_hook_runtime_boundaries.windows_without_bash.failure_mode, 'fail_open');
});

test('every inventoried entrypoint is bound to the exact Task 2 router bytes and loading shape', async () => {
  const inventory = await readInventory();
  const entryIds = inventory.entrypoints.map(({ id }) => id).sort();
  const bindingIds = Object.keys(inventory.router_source_bindings).sort();

  assert.deepEqual(bindingIds, entryIds);
  for (const entry of inventory.entrypoints) {
    const binding = inventory.router_source_bindings[entry.id];
    assert.equal(binding.path, inventory.canonical_bootstrap_source.path, `${entry.id}: wrong router source`);
    assert.equal(binding.sha256, inventory.canonical_bootstrap_source.sha256, `${entry.id}: wrong router hash`);
    assert.equal(binding.loading_shape, entry.loading_shape, `${entry.id}: loading shape drifted`);
    assert.equal(await sha256(binding.path), binding.sha256, `${entry.id}: bound router bytes drifted`);
  }
});
