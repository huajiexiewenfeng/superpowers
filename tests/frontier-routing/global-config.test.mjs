import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve, win32 } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

import {
  discoverGlobalConfigSync,
  discoverProjectTrialSync,
  formatGlobalConfigBootstrap,
  resolveGlobalConfigPath,
  resolveWorkflowProfile,
  validateGlobalConfig,
} from '../../skills/using-superpowers/scripts/resolve-config.mjs';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const trialTemplatePath = resolve(repoRoot, 'docs/superpowers/trial/frontier-trial.config.example.json');

function ownerConfig(defaultProfile = 'frontier') {
  return {
    schema_version: 1,
    mode: 'owner_default',
    default_profile: defaultProfile,
  };
}

async function tempRoot(context) {
  const root = await mkdtemp(resolve(tmpdir(), 'superpowers-global-config-'));
  context.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

async function writeJson(path, value) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function globalDiscovery(config, status = 'valid') {
  return {
    status,
    source: 'home_fallback',
    config: status === 'valid' ? config : null,
    diagnostic: status === 'invalid'
      ? { code: 'invalid_global_config', message: 'invalid fixture' }
      : null,
  };
}

function route(overrides = {}) {
  return resolveWorkflowProfile({
    explicitProfile: null,
    naturalLanguageOffRamp: false,
    taskClass: 'bounded',
    projectTrial: null,
    globalOwnerDefault: globalDiscovery(ownerConfig()),
    approvedCapabilityDefault: null,
    ...overrides,
  });
}

test('1: ordinary workspace uses a valid global frontier default without a project trial', () => {
  const actual = route();

  assert.equal(actual.requested_profile, 'frontier');
  assert.equal(actual.effective_profile, 'frontier');
  assert.equal(actual.source, 'global_owner_default');
});

test('2: an active eligible project trial remains an explicit project-level override', async () => {
  const template = JSON.parse(await readFile(trialTemplatePath, 'utf8'));
  template.status = 'active';
  template.expires_on = '2099-12-31';
  const projectTrial = {
    status: 'active',
    source: 'project_trial',
    config: template,
    diagnostic: null,
  };

  const actual = route({
    projectTrial,
    globalOwnerDefault: globalDiscovery(ownerConfig('full')),
  });

  assert.equal(actual.requested_profile, 'frontier');
  assert.equal(actual.source, 'project_trial');
});

test('3: a missing project trial falls through to the global owner default', async (context) => {
  const root = await tempRoot(context);
  const projectTrial = discoverProjectTrialSync({
    projectDir: root,
    now: new Date('2026-07-26T00:00:00.000Z'),
  });

  assert.equal(projectTrial.status, 'missing');
  assert.equal(route({ projectTrial }).source, 'global_owner_default');
});

test('4: expired, malformed, or ineligible project trials do not shadow the global owner default', async (context) => {
  const root = await tempRoot(context);
  const trialPath = resolve(root, '.superpowers/frontier-trial.config.json');
  const template = JSON.parse(await readFile(trialTemplatePath, 'utf8'));
  template.status = 'active';
  template.expires_on = '2026-01-01';
  await writeJson(trialPath, template);

  const expired = discoverProjectTrialSync({
    projectDir: root,
    now: new Date('2026-07-26T00:00:00.000Z'),
  });
  assert.equal(expired.status, 'inactive');
  assert.equal(route({ projectTrial: expired }).source, 'global_owner_default');

  await writeFile(trialPath, '{"mode":', 'utf8');
  const malformed = discoverProjectTrialSync({ projectDir: root });
  assert.equal(malformed.status, 'invalid');
  assert.equal(route({ projectTrial: malformed }).source, 'global_owner_default');
  assert.deepEqual(route({ projectTrial: malformed }).diagnostics, [malformed.diagnostic]);

  template.expires_on = '2099-12-31';
  template.routing.frontier_eligible_task_classes = ['mechanical'];
  await writeJson(trialPath, template);
  const ineligible = discoverProjectTrialSync({ projectDir: root });
  assert.equal(ineligible.status, 'active');
  assert.equal(route({ projectTrial: ineligible }).source, 'global_owner_default');
});

test('5: explicit full, frontier, and off directives override the global owner default', () => {
  for (const profile of ['full', 'frontier', 'off']) {
    const actual = route({ explicitProfile: profile });
    assert.equal(actual.requested_profile, profile);
    assert.equal(actual.effective_profile, profile);
    assert.equal(actual.source, 'explicit_directive');
  }

  const naturalOff = route({ naturalLanguageOffRamp: true });
  assert.equal(naturalOff.requested_profile, 'off');
  assert.equal(naturalOff.source, 'natural_language_off_ramp');
});

test('6: the mandatory risk floor forces high-risk work to effective full', () => {
  const global = route({ taskClass: 'high_risk' });
  assert.equal(global.requested_profile, 'frontier');
  assert.equal(global.effective_profile, 'full');

  const explicitOff = route({ taskClass: 'high_risk', explicitProfile: 'off' });
  assert.equal(explicitOff.requested_profile, 'off');
  assert.equal(explicitOff.effective_profile, 'full');
});

test('7: a missing global config uses an approved default and then conservative full', () => {
  const missing = {
    status: 'missing',
    source: 'home_fallback',
    config: null,
    diagnostic: { code: 'global_config_missing', message: 'missing fixture' },
  };
  const approved = route({
    globalOwnerDefault: missing,
    approvedCapabilityDefault: { status: 'approved', default_profile: 'frontier' },
  });
  assert.equal(approved.requested_profile, 'frontier');
  assert.equal(approved.source, 'approved_capability_default');

  const fallback = route({ globalOwnerDefault: missing });
  assert.equal(fallback.requested_profile, 'full');
  assert.equal(fallback.source, 'conservative_fallback');
});

test('8: malformed or schema-invalid global config never partially applies', async (context) => {
  const root = await tempRoot(context);
  const configPath = resolve(root, 'config.json');
  const env = { SUPERPOWERS_CONFIG: configPath };

  await writeFile(configPath, '{"default_profile":"frontier"', 'utf8');
  const malformed = discoverGlobalConfigSync({ env, homeDir: root });
  assert.equal(malformed.status, 'invalid');
  assert.equal(route({ globalOwnerDefault: malformed }).requested_profile, 'full');

  await writeJson(configPath, { ...ownerConfig(), exact_model_id: 'gpt-5.6-sol' });
  const unknownField = discoverGlobalConfigSync({ env, homeDir: root });
  assert.equal(unknownField.status, 'invalid');
  assert.match(unknownField.diagnostic.message, /unsupported global config field/);

  assert.throws(
    () => validateGlobalConfig({ ...ownerConfig(), reasoning_effort: 'high' }),
    /unsupported global config field/,
  );
});

test('canonical discovery honors SUPERPOWERS_CONFIG, XDG, home fallback, and platform path semantics', async (context) => {
  const root = await tempRoot(context);
  const explicit = resolve(root, 'custom', 'owner.json');
  const explicitLocation = resolveGlobalConfigPath({
    env: { SUPERPOWERS_CONFIG: explicit, XDG_CONFIG_HOME: resolve(root, 'ignored') },
    homeDir: root,
  });
  assert.equal(explicitLocation.source, 'environment_override');
  assert.equal(explicitLocation.path, explicit);

  const xdg = resolve(root, 'xdg');
  const xdgLocation = resolveGlobalConfigPath({ env: { XDG_CONFIG_HOME: xdg }, homeDir: root });
  assert.equal(xdgLocation.source, 'xdg_config_home');
  assert.equal(xdgLocation.path, resolve(xdg, 'superpowers', 'config.json'));

  const homeLocation = resolveGlobalConfigPath({ env: {}, homeDir: root });
  assert.equal(homeLocation.source, 'home_fallback');
  assert.equal(homeLocation.path, resolve(root, '.config', 'superpowers', 'config.json'));

  const windowsLocation = resolveGlobalConfigPath({
    env: {},
    homeDir: 'C:\\Users\\admin',
    platform: 'win32',
  });
  assert.equal(windowsLocation.path, win32.join('C:\\Users\\admin', '.config', 'superpowers', 'config.json'));

  const relativeOverride = resolveGlobalConfigPath({
    env: { SUPERPOWERS_CONFIG: 'relative/config.json' },
    homeDir: root,
  });
  assert.equal(relativeOverride.status, 'invalid');

  const relativeXdg = resolveGlobalConfigPath({
    env: { XDG_CONFIG_HOME: 'relative-xdg' },
    homeDir: root,
  });
  assert.equal(relativeXdg.status, 'invalid');
});

test('a verified installed snapshot is used only when the canonical path is access-blocked', () => {
  const canonicalPath = process.platform === 'win32'
    ? 'C:\\Users\\admin\\.config\\superpowers\\config.json'
    : '/home/admin/.config/superpowers/config.json';
  const adapterPath = process.platform === 'win32'
    ? 'C:\\Users\\admin\\.agents\\skills\\using-superpowers\\.runtime\\owner-config.json'
    : '/home/admin/.agents/skills/using-superpowers/.runtime/owner-config.json';
  const provenancePath = process.platform === 'win32'
    ? 'C:\\Users\\admin\\.agents\\skills\\using-superpowers\\.runtime\\owner-config.provenance.json'
    : '/home/admin/.agents/skills/using-superpowers/.runtime/owner-config.provenance.json';
  const snapshotText = `${JSON.stringify(ownerConfig(), null, 2)}\n`;
  const snapshotHash = createHash('sha256').update(snapshotText, 'utf8').digest('hex');
  const provenance = {
    schema_version: 1,
    adapter: 'generated_snapshot',
    canonical_path: canonicalPath,
    canonical_sha256: snapshotHash,
    snapshot_sha256: snapshotHash,
    generated_at: '2026-07-26T00:00:00.000Z',
  };
  const accessError = Object.assign(new Error('sandbox denied canonical path'), { code: 'EPERM' });
  const readFile = (path) => {
    if (path === canonicalPath) throw accessError;
    if (path === adapterPath) return snapshotText;
    if (path === provenancePath) return JSON.stringify(provenance);
    throw Object.assign(new Error('missing'), { code: 'ENOENT' });
  };

  const discovery = discoverGlobalConfigSync({
    env: { SUPERPOWERS_CONFIG: canonicalPath },
    homeDir: process.platform === 'win32' ? 'C:\\Users\\admin' : '/home/admin',
    installedAdapterPath: adapterPath,
    installedAdapterProvenancePath: provenancePath,
    readFile,
  });
  assert.equal(discovery.status, 'valid');
  assert.equal(discovery.source, 'installed_snapshot_adapter');
  assert.equal(discovery.config.default_profile, 'frontier');
  assert.equal(discovery.diagnostic.code, 'canonical_config_unreadable_using_adapter');

  const missingError = Object.assign(new Error('missing canonical'), { code: 'ENOENT' });
  const missing = discoverGlobalConfigSync({
    env: { SUPERPOWERS_CONFIG: canonicalPath },
    homeDir: process.platform === 'win32' ? 'C:\\Users\\admin' : '/home/admin',
    installedAdapterPath: adapterPath,
    installedAdapterProvenancePath: provenancePath,
    readFile: () => {
      throw missingError;
    },
  });
  assert.equal(missing.status, 'missing');
  assert.equal(missing.source, 'environment_override');

  const tampered = discoverGlobalConfigSync({
    env: { SUPERPOWERS_CONFIG: canonicalPath },
    homeDir: process.platform === 'win32' ? 'C:\\Users\\admin' : '/home/admin',
    installedAdapterPath: adapterPath,
    installedAdapterProvenancePath: provenancePath,
    readFile: (path) => {
      if (path === canonicalPath) throw accessError;
      if (path === adapterPath) return snapshotText.replace('frontier', 'full');
      if (path === provenancePath) return JSON.stringify(provenance);
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    },
  });
  assert.equal(tampered.status, 'invalid');
  assert.equal(tampered.source, 'environment_override');

  const wrongCanonicalBinding = discoverGlobalConfigSync({
    env: { SUPERPOWERS_CONFIG: canonicalPath },
    homeDir: process.platform === 'win32' ? 'C:\\Users\\admin' : '/home/admin',
    installedAdapterPath: adapterPath,
    installedAdapterProvenancePath: provenancePath,
    readFile: (path) => {
      if (path === canonicalPath) throw accessError;
      if (path === adapterPath) return snapshotText;
      if (path === provenancePath) {
        return JSON.stringify({
          ...provenance,
          canonical_path: process.platform === 'win32'
            ? 'C:\\Users\\other\\.config\\superpowers\\config.json'
            : '/home/other/.config/superpowers/config.json',
        });
      }
      throw Object.assign(new Error('missing'), { code: 'ENOENT' });
    },
  });
  assert.equal(wrongCanonicalBinding.status, 'invalid');
  assert.equal(wrongCanonicalBinding.source, 'environment_override');
});

test('bootstrap context exposes only validated routing metadata', () => {
  const text = formatGlobalConfigBootstrap(globalDiscovery(ownerConfig()));

  assert.match(text, /status: valid/);
  assert.match(text, /default_profile: frontier/);
  assert.match(text, /high_risk forces effective_profile=full/);
  assert.doesNotMatch(text, /exact_model_id|reasoning_effort|repository_path|user_content/);
});

test('OpenCode bootstrap consumes the same validated global owner config', async (context) => {
  const root = await tempRoot(context);
  const configPath = resolve(root, 'owner.json');
  await writeJson(configPath, ownerConfig());
  const previous = process.env.SUPERPOWERS_CONFIG;
  process.env.SUPERPOWERS_CONFIG = configPath;

  try {
    const pluginPath = resolve(repoRoot, '.opencode/plugins/superpowers.js');
    const mod = await import(`${pathToFileURL(pluginPath).href}?global-config=${Date.now()}-${Math.random()}`);
    const plugin = await mod.SuperpowersPlugin({ client: {}, directory: root });
    const output = {
      messages: [{
        info: { role: 'user' },
        parts: [{ type: 'text', text: 'Route this bounded task.' }],
      }],
    };

    await plugin['experimental.chat.messages.transform']({}, output);
    const bootstrap = output.messages[0].parts.find(
      (part) => part.type === 'text' && part.text.includes('EXTREMELY_IMPORTANT'),
    )?.text;
    assert.match(bootstrap, /<superpowers_global_config>/);
    assert.match(bootstrap, /source: environment_override/);
    assert.match(bootstrap, /default_profile: frontier/);
  } finally {
    if (previous === undefined) delete process.env.SUPERPOWERS_CONFIG;
    else process.env.SUPERPOWERS_CONFIG = previous;
  }
});
