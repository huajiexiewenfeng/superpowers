#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, posix, resolve, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROFILES = new Set(['full', 'frontier', 'off']);
const TASK_CLASSES = new Set(['mechanical', 'bounded', 'complex', 'high_risk']);
const GLOBAL_CONFIG_KEYS = new Set(['schema_version', 'mode', 'default_profile']);
const PROJECT_TRIAL_RELATIVE_PATH = '.superpowers/frontier-trial.config.json';
const DEFAULT_INSTALLED_ADAPTER_PATH = resolve(
  dirname(SCRIPT_PATH),
  '..',
  '.runtime',
  'owner-config.json',
);
const DEFAULT_INSTALLED_ADAPTER_PROVENANCE_PATH = resolve(
  dirname(SCRIPT_PATH),
  '..',
  '.runtime',
  'owner-config.provenance.json',
);
const ADAPTER_PROVENANCE_KEYS = new Set([
  'schema_version',
  'adapter',
  'canonical_path',
  'canonical_sha256',
  'snapshot_sha256',
  'generated_at',
]);

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function pathApiFor(platform) {
  return platform === 'win32' ? win32 : posix;
}

function diagnostic(code, message) {
  return { code, message };
}

export function validateGlobalConfig(config) {
  requireCondition(isObject(config), 'global config must be an object');
  const unknownKeys = Object.keys(config).filter((key) => !GLOBAL_CONFIG_KEYS.has(key));
  requireCondition(unknownKeys.length === 0, `unsupported global config field: ${unknownKeys[0]}`);
  requireCondition(config.schema_version === 1, 'unsupported global config schema_version');
  requireCondition(config.mode === 'owner_default', 'global config mode must be owner_default');
  requireCondition(PROFILES.has(config.default_profile), 'global config default_profile must be full, frontier, or off');
  return config;
}

export function resolveGlobalConfigPath({
  env = process.env,
  homeDir = homedir(),
  platform = process.platform,
} = {}) {
  const pathApi = pathApiFor(platform);
  const explicitPath = env.SUPERPOWERS_CONFIG;
  if (explicitPath !== undefined) {
    const trimmed = explicitPath.trim();
    if (!trimmed || !pathApi.isAbsolute(trimmed)) {
      return {
        status: 'invalid',
        source: 'environment_override',
        path: null,
        diagnostic: diagnostic(
          'invalid_superpowers_config_path',
          'SUPERPOWERS_CONFIG must be a non-empty absolute file path',
        ),
      };
    }
    return { status: 'resolved', source: 'environment_override', path: pathApi.normalize(trimmed) };
  }

  const xdgConfigHome = env.XDG_CONFIG_HOME;
  if (xdgConfigHome !== undefined && xdgConfigHome.trim() !== '') {
    const trimmed = xdgConfigHome.trim();
    if (!pathApi.isAbsolute(trimmed)) {
      return {
        status: 'invalid',
        source: 'xdg_config_home',
        path: null,
        diagnostic: diagnostic(
          'invalid_xdg_config_home',
          'XDG_CONFIG_HOME must be an absolute directory path',
        ),
      };
    }
    return {
      status: 'resolved',
      source: 'xdg_config_home',
      path: pathApi.join(trimmed, 'superpowers', 'config.json'),
    };
  }

  requireCondition(typeof homeDir === 'string' && homeDir.trim() !== '', 'home directory is required');
  requireCondition(pathApi.isAbsolute(homeDir), 'home directory must be absolute');
  return {
    status: 'resolved',
    source: 'home_fallback',
    path: pathApi.join(homeDir, '.config', 'superpowers', 'config.json'),
  };
}

function readJsonFile(path, readFile = readFileSync) {
  return JSON.parse(readFile(path, 'utf8'));
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

function canonicalPathsEqual(left, right, platform) {
  const pathApi = pathApiFor(platform);
  const normalizedLeft = pathApi.normalize(left);
  const normalizedRight = pathApi.normalize(right);
  return platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function validateAdapterProvenance(provenance, snapshotText, expectedCanonicalPath, platform) {
  requireCondition(isObject(provenance), 'adapter provenance must be an object');
  const unknownKeys = Object.keys(provenance).filter((key) => !ADAPTER_PROVENANCE_KEYS.has(key));
  requireCondition(unknownKeys.length === 0, `unsupported adapter provenance field: ${unknownKeys[0]}`);
  requireCondition(provenance.schema_version === 1, 'unsupported adapter provenance schema_version');
  requireCondition(provenance.adapter === 'generated_snapshot', 'adapter provenance mode must be generated_snapshot');
  requireCondition(
    typeof provenance.canonical_path === 'string' && provenance.canonical_path.length > 0,
    'adapter canonical_path is required',
  );
  requireCondition(
    canonicalPathsEqual(provenance.canonical_path, expectedCanonicalPath, platform),
    'adapter canonical_path does not match the resolved canonical config path',
  );
  requireCondition(/^[a-f0-9]{64}$/.test(provenance.canonical_sha256), 'invalid adapter canonical_sha256');
  requireCondition(/^[a-f0-9]{64}$/.test(provenance.snapshot_sha256), 'invalid adapter snapshot_sha256');
  requireCondition(
    provenance.canonical_sha256 === provenance.snapshot_sha256,
    'adapter snapshot does not match the canonical hash captured at installation',
  );
  requireCondition(
    sha256(snapshotText) === provenance.snapshot_sha256,
    'adapter snapshot hash does not match provenance',
  );
  requireCondition(Number.isFinite(Date.parse(provenance.generated_at)), 'adapter generated_at must be ISO-8601');
  return provenance;
}

export function discoverGlobalConfigSync(options = {}) {
  const location = resolveGlobalConfigPath(options);
  if (location.status === 'invalid') {
    return { ...location, config: null };
  }

  try {
    const config = validateGlobalConfig(readJsonFile(location.path, options.readFile));
    return { ...location, status: 'valid', config, diagnostic: null };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        ...location,
        status: 'missing',
        config: null,
        diagnostic: diagnostic('global_config_missing', 'global owner config was not found'),
      };
    }
    if (['EACCES', 'EPERM'].includes(error?.code)) {
      const adapterPath = options.installedAdapterPath === undefined
        ? DEFAULT_INSTALLED_ADAPTER_PATH
        : options.installedAdapterPath;
      const provenancePath = options.installedAdapterProvenancePath === undefined
        ? DEFAULT_INSTALLED_ADAPTER_PROVENANCE_PATH
        : options.installedAdapterProvenancePath;
      if (adapterPath) {
        try {
          const readFile = options.readFile ?? readFileSync;
          const snapshotText = readFile(adapterPath, 'utf8');
          const config = validateGlobalConfig(JSON.parse(snapshotText));
          validateAdapterProvenance(
            readJsonFile(provenancePath, readFile),
            snapshotText,
            location.path,
            options.platform ?? process.platform,
          );
          return {
            status: 'valid',
            source: 'installed_snapshot_adapter',
            path: adapterPath,
            config,
            diagnostic: diagnostic(
              'canonical_config_unreadable_using_adapter',
              'canonical owner config was unreadable; using the verified installed snapshot',
            ),
          };
        } catch {
          // Report the canonical access failure below. Adapter failures never
          // replace it with a less useful secondary error.
        }
      }
    }
    return {
      ...location,
      status: 'invalid',
      config: null,
      diagnostic: diagnostic('invalid_global_config', error.message),
    };
  }
}

function expiryTimestamp(expiresOn) {
  requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(expiresOn), 'trial expires_on must use YYYY-MM-DD');
  const timestamp = Date.parse(`${expiresOn}T23:59:59.999Z`);
  requireCondition(Number.isFinite(timestamp), 'trial expires_on must be a real calendar date');
  return timestamp;
}

export function validateProjectTrialForRouting(config) {
  requireCondition(isObject(config), 'project trial must be an object');
  requireCondition(config.schema_version === '1.1.0', 'unsupported project trial schema_version');
  requireCondition(config.mode === 'trial', 'project trial mode must be trial');
  requireCondition(['active', 'inactive', 'inactive_template'].includes(config.status), 'invalid project trial status');
  requireCondition(config.default_profile === 'frontier', 'project trial default_profile must be frontier');
  expiryTimestamp(config.expires_on);
  const eligible = config.routing?.frontier_eligible_task_classes;
  requireCondition(Array.isArray(eligible), 'project trial eligible task classes are required');
  requireCondition(
    eligible.every((value) => TASK_CLASSES.has(value) && value !== 'high_risk'),
    'project trial may only select non-high-risk task classes',
  );
  requireCondition(
    config.routing?.high_risk_effective_profile === 'full',
    'project trial must preserve the high-risk full profile',
  );
  return config;
}

export function discoverProjectTrialSync({
  projectDir = process.cwd(),
  now = new Date(),
  readFile = readFileSync,
  platform = process.platform,
} = {}) {
  const pathApi = pathApiFor(platform);
  const trialPath = pathApi.resolve(projectDir, PROJECT_TRIAL_RELATIVE_PATH);
  try {
    const config = validateProjectTrialForRouting(readJsonFile(trialPath, readFile));
    const active = config.status === 'active' && now.getTime() <= expiryTimestamp(config.expires_on);
    return {
      status: active ? 'active' : 'inactive',
      source: 'project_trial',
      path: trialPath,
      config,
      diagnostic: active
        ? null
        : diagnostic('project_trial_inactive', 'project trial is inactive or expired'),
    };
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return {
        status: 'missing',
        source: 'project_trial',
        path: trialPath,
        config: null,
        diagnostic: diagnostic('project_trial_missing', 'project trial was not found'),
      };
    }
    return {
      status: 'invalid',
      source: 'project_trial',
      path: trialPath,
      config: null,
      diagnostic: diagnostic('invalid_project_trial', error.message),
    };
  }
}

function approvedDefaultProfile(approvedCapabilityDefault) {
  if (!approvedCapabilityDefault) return null;
  if (
    approvedCapabilityDefault.status === 'approved'
    && PROFILES.has(approvedCapabilityDefault.default_profile)
  ) {
    return approvedCapabilityDefault.default_profile;
  }
  return null;
}

export function resolveRequestedProfile({
  explicitProfile = null,
  naturalLanguageOffRamp = false,
  taskClass,
  projectTrial = null,
  globalOwnerDefault = null,
  approvedCapabilityDefault = null,
}) {
  requireCondition(TASK_CLASSES.has(taskClass), 'taskClass must be mechanical, bounded, complex, or high_risk');
  requireCondition(explicitProfile === null || PROFILES.has(explicitProfile), 'invalid explicit profile');

  if (explicitProfile) {
    return { requested_profile: explicitProfile, source: 'explicit_directive', diagnostics: [] };
  }
  if (naturalLanguageOffRamp) {
    return { requested_profile: 'off', source: 'natural_language_off_ramp', diagnostics: [] };
  }

  const diagnostics = [];
  if (projectTrial) {
    if (
      projectTrial.status === 'active'
      && projectTrial.config?.routing?.frontier_eligible_task_classes?.includes(taskClass)
      && PROFILES.has(projectTrial.config.default_profile)
    ) {
      return {
        requested_profile: projectTrial.config.default_profile,
        source: 'project_trial',
        diagnostics,
      };
    }
    if (projectTrial.status === 'invalid') diagnostics.push(projectTrial.diagnostic);
  }

  if (globalOwnerDefault) {
    if (globalOwnerDefault.status === 'valid') {
      return {
        requested_profile: globalOwnerDefault.config.default_profile,
        source: 'global_owner_default',
        diagnostics,
      };
    }
    if (globalOwnerDefault.status === 'invalid') diagnostics.push(globalOwnerDefault.diagnostic);
  }

  const approvedProfile = approvedDefaultProfile(approvedCapabilityDefault);
  if (approvedProfile) {
    return {
      requested_profile: approvedProfile,
      source: 'approved_capability_default',
      diagnostics,
    };
  }

  return { requested_profile: 'full', source: 'conservative_fallback', diagnostics };
}

export function applyMandatoryRiskFloor({ requestedProfile, taskClass }) {
  requireCondition(PROFILES.has(requestedProfile), 'invalid requested profile');
  requireCondition(TASK_CLASSES.has(taskClass), 'invalid task class');
  return taskClass === 'high_risk' ? 'full' : requestedProfile;
}

export function resolveWorkflowProfile(options) {
  const requested = resolveRequestedProfile(options);
  return {
    ...requested,
    effective_profile: applyMandatoryRiskFloor({
      requestedProfile: requested.requested_profile,
      taskClass: options.taskClass,
    }),
    task_class: options.taskClass,
  };
}

export function formatGlobalConfigBootstrap(discovery) {
  if (discovery.status === 'valid') {
    return `<superpowers_global_config>
status: valid
source: ${discovery.source}
mode: ${discovery.config.mode}
default_profile: ${discovery.config.default_profile}
precedence: explicit directive, natural-language off-ramp, active eligible project trial, global owner default, approved capability default, conservative full
mandatory_floor: high_risk forces effective_profile=full
evidence: owner preference only; not formal capability approval
</superpowers_global_config>`;
  }

  const code = discovery.diagnostic?.code ?? 'unknown_global_config_status';
  return `<superpowers_global_config>
status: ${discovery.status}
source: ${discovery.source}
diagnostic: ${code}
fallback: continue to approved capability default, then conservative full
</superpowers_global_config>`;
}

function parseArguments(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    requireCondition(key?.startsWith('--'), `invalid option: ${key ?? '<end>'}`);
    const normalized = key.slice(2).replaceAll('-', '_');
    requireCondition(!(normalized in values), `duplicate option: ${key}`);
    const next = argv[index + 1];
    if (next === undefined || next.startsWith('--')) {
      values[normalized] = true;
    } else {
      values[normalized] = next;
      index += 1;
    }
  }
  const allowed = new Set([
    'format',
    'task_class',
    'explicit_profile',
    'natural_language_off_ramp',
    'project_dir',
    'approved_capability_default',
  ]);
  for (const key of Object.keys(values)) {
    requireCondition(allowed.has(key), `unsupported option: --${key.replaceAll('_', '-')}`);
  }
  return values;
}

function booleanOption(value) {
  if (value === undefined || value === false) return false;
  if (value === true || value === 'true' || value === 'yes') return true;
  if (value === 'false' || value === 'no') return false;
  throw new Error('natural-language-off-ramp must be true/false or yes/no');
}

function publicDiscovery(discovery) {
  return {
    status: discovery.status,
    source: discovery.source,
    config: discovery.config,
    diagnostic: discovery.diagnostic,
  };
}

function runCli(argv) {
  const values = parseArguments(argv);
  const format = values.format ?? 'json';
  requireCondition(['json', 'bootstrap'].includes(format), 'format must be json or bootstrap');
  const globalOwnerDefault = discoverGlobalConfigSync();

  if (format === 'bootstrap') {
    process.stdout.write(`${formatGlobalConfigBootstrap(globalOwnerDefault)}\n`);
    return;
  }

  const taskClass = values.task_class;
  const projectTrial = taskClass
    ? discoverProjectTrialSync({ projectDir: values.project_dir ?? process.cwd() })
    : null;
  const route = taskClass
    ? resolveWorkflowProfile({
        explicitProfile: values.explicit_profile ?? null,
        naturalLanguageOffRamp: booleanOption(values.natural_language_off_ramp),
        taskClass,
        projectTrial,
        globalOwnerDefault,
        approvedCapabilityDefault: values.approved_capability_default
          ? { status: 'approved', default_profile: values.approved_capability_default }
          : null,
      })
    : null;

  process.stdout.write(`${JSON.stringify({
    global_config: publicDiscovery(globalOwnerDefault),
    project_trial: projectTrial ? publicDiscovery(projectTrial) : null,
    route,
  }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  try {
    runCli(process.argv.slice(2));
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
