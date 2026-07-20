import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const casesPath = resolve(repoRoot, 'tests/frontier-routing/routing-cases.json');
const routerPath = resolve(repoRoot, 'skills/using-superpowers/references/frontier-routing.md');
const skillPath = resolve(repoRoot, 'skills/using-superpowers/SKILL.md');
const inventoryPath = resolve(repoRoot, 'docs/superpowers/evals/bootstrap-entrypoints.json');

async function sha256(relativePath) {
  const bytes = await readFile(resolve(repoRoot, relativePath));
  return createHash('sha256').update(bytes).digest('hex');
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

test('full profile is anchored to the exact v6.1.1 using-superpowers baseline', async () => {
  const policy = await readJson(casesPath);
  const baseline = policy.full_profile_equivalence;
  const fixtureText = await readFile(resolve(repoRoot, baseline.baseline_fixture), 'utf8');

  assert.equal(await sha256(baseline.baseline_fixture), baseline.baseline_sha256);
  for (const selector of baseline.mandatory_rule_selectors) {
    assert.ok(fixtureText.includes(selector), `v6.1.1 fixture is missing: ${selector}`);
  }
});

test('full compatibility section preserves routing, checklist, and representative workflow semantics', async () => {
  const [policy, router] = await Promise.all([
    readJson(casesPath),
    readFile(routerPath, 'utf8'),
  ]);

  for (const selector of policy.full_profile_equivalence.mandatory_rule_selectors) {
    assert.ok(router.includes(selector), `full profile compatibility rule is missing: ${selector}`);
  }
  for (const line of policy.full_profile_equivalence.exact_rule_lines) {
    assert.ok(router.includes(line), `full profile exact rule drifted: ${line}`);
  }

  for (const route of policy.full_profile_equivalence.representative_routes) {
    assert.ok(router.includes(route.trigger), `${route.id}: full route trigger is missing`);
    for (const skill of route.expected_order) {
      assert.ok(router.includes(skill), `${route.id}: expected ${skill} in full compatibility mapping`);
    }
  }
});

test('Task 2 does not rewrite representative downstream workflow Skills', async () => {
  const expected = {
    'skills/brainstorming/SKILL.md': 'e14914605f640e0841758e45d0ab2a53243b59b921f929e47921c99668f2e61d',
    'skills/writing-plans/SKILL.md': '272e1af349f5062c28dc282b3e21b220d58d683a7314a10c455b7432ec91d845',
    'skills/test-driven-development/SKILL.md': 'b5b4717b8b761cce15a6cfe9022e33fd959e0894c0c39d72c9cb49c23486c10e',
    'skills/systematic-debugging/SKILL.md': '3b20719eca4f0461cb51a195221320d775dcf03b6859271066a03a5132a6ce7a',
    'skills/requesting-code-review/SKILL.md': '1017ccdd5bc61fab67c654cf118cbdb520464b313073a0a6b9a6b9aa647a3ad6',
    'skills/receiving-code-review/SKILL.md': '647036bbdab7bf2317e14e079595e984c9030f64295e2b4c0fb57dbeb48f25dd',
    'skills/verification-before-completion/SKILL.md': 'ea52d15aabaf72bc6b558efe2c126f161b53961090ddcd712000273bfe8c7b6c',
  };

  for (const [path, hash] of Object.entries(expected)) {
    assert.equal(await sha256(path), hash, `Task 2 changed downstream Skill bytes: ${path}`);
  }
});

test('bootstrap entrypoint loading shapes remain explicit after the router source changes', async () => {
  const inventory = await readJson(inventoryPath);
  const byId = new Map(inventory.entrypoints.map((entry) => [entry.id, entry]));

  assert.equal(await sha256(inventory.canonical_bootstrap_source.path), inventory.canonical_bootstrap_source.sha256);
  assert.equal(byId.get('claude-code-session-start').loading_shape, 'full_skill_with_frontmatter');
  assert.equal(byId.get('cursor-session-start').loading_shape, 'full_skill_with_frontmatter');
  assert.equal(byId.get('opencode-first-user-message').loading_shape, 'body_without_frontmatter');
  assert.equal(byId.get('pi-session-context').loading_shape, 'body_without_frontmatter');
  assert.equal(byId.get('kimi-native-session-start').loading_shape, 'native_skill_loading');
  assert.equal(byId.get('codex-native-discovery').loading_shape, 'native_skill_discovery_no_bootstrap');
  assert.equal(byId.get('gemini-context-legacy').support_status, 'legacy_eol');
});

test('OpenCode marker prevents duplicate injection when transformed messages are reused', async () => {
  const pluginPath = resolve(repoRoot, '.opencode/plugins/superpowers.js');
  const mod = await import(pathToFileURL(pluginPath).href + `?dedup=${Date.now()}`);
  const plugin = await mod.SuperpowersPlugin({ client: {}, directory: repoRoot });
  const transform = plugin['experimental.chat.messages.transform'];
  const output = {
    messages: [{
      info: { role: 'user' },
      parts: [{ type: 'text', text: 'Reuse this transformed message array.' }],
    }],
  };

  await transform({}, output);
  await transform({}, output);

  const bootstrapParts = output.messages[0].parts.filter(
    (part) => part.type === 'text' && part.text.includes('EXTREMELY_IMPORTANT'),
  );
  assert.equal(bootstrapParts.length, 1);
  assert.match(bootstrapParts[0].text, /requested_profile/);
  assert.match(bootstrapParts[0].text, /references\/frontier-routing\.md/);
});

test('thin Skill retains subagent, platform, and user-authority compatibility controls', async () => {
  const skill = await readFile(skillPath, 'utf8');

  assert.match(skill, /<SUBAGENT-STOP>/);
  assert.match(skill, /references\/codex-tools\.md/);
  assert.match(skill, /references\/pi-tools\.md/);
  assert.match(skill, /references\/antigravity-tools\.md/);
  assert.match(skill, /User instructions .* take precedence over skills/);
});
