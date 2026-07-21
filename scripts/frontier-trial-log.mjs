import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_PATH = fileURLToPath(import.meta.url);
const PROFILES = new Set(['full', 'frontier', 'off']);
const TASK_CLASSES = new Set(['mechanical', 'bounded', 'complex', 'high_risk']);
const OUTCOMES = new Set(['full_v6_1_1', 'selected_advisory_workflow', 'no_advisory_workflow']);
const VERIFICATION_RESULTS = new Set(['passed', 'failed', 'not_run']);
const RESULT_VALUES = new Set(['satisfied', 'acceptable', 'unsatisfied']);
const PROCESS_VALUES = new Set(['heavy', 'fit', 'light']);
const SKILL_IDENTIFIER = /^[a-z0-9][a-z0-9:_-]*$/;

function requireCondition(condition, message) {
  if (!condition) throw new Error(message);
}

function parseBoolean(value, name) {
  if (value === true || value === 'yes' || value === 'true') return true;
  if (value === false || value === 'no' || value === 'false') return false;
  throw new Error(`${name} must be yes/no or true/false`);
}

function parseOptionalInteger(value, name) {
  if (value === undefined) return null;
  const number = Number(value);
  requireCondition(Number.isSafeInteger(number) && number >= 0, `${name} must be a non-negative integer`);
  return number;
}

function expiryTimestamp(expiresOn) {
  requireCondition(/^\d{4}-\d{2}-\d{2}$/.test(expiresOn), 'expires_on must use YYYY-MM-DD');
  const timestamp = Date.parse(`${expiresOn}T23:59:59.999Z`);
  requireCondition(Number.isFinite(timestamp), 'expires_on must be a real calendar date');
  return timestamp;
}

export function validateTrialConfig(config) {
  requireCondition(config && typeof config === 'object' && !Array.isArray(config), 'trial config must be an object');
  requireCondition(config.schema_version === '1.0.0', 'unsupported trial config schema_version');
  requireCondition(typeof config.trial_id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(config.trial_id), 'invalid trial_id');
  requireCondition(config.mode === 'trial', 'mode must be trial');
  requireCondition(['active', 'inactive_template', 'inactive'].includes(config.status), 'invalid trial status');
  expiryTimestamp(config.expires_on);
  requireCondition(config.default_profile === 'frontier', 'trial default_profile must be frontier');
  requireCondition(config.model_binding?.exact_model_id === 'gpt-5.6-sol', 'trial model must be gpt-5.6-sol');
  requireCondition(config.model_binding?.reasoning_effort === 'high', 'trial reasoning effort must be high');
  requireCondition(Array.isArray(config.routing?.frontier_eligible_task_classes), 'eligible task classes are required');
  requireCondition(
    config.routing.frontier_eligible_task_classes.every((value) => ['mechanical', 'bounded', 'complex'].includes(value)),
    'only non-high-risk classes may be frontier eligible',
  );
  requireCondition(config.routing.high_risk_effective_profile === 'full', 'high-risk profile must remain full');
  requireCondition(config.routing.fallback_profile === 'full', 'fallback profile must remain full');
  requireCondition(config.stop_rules?.high_risk_under_routes_max === 0, 'trial must stop on the first high-risk under-route');
  requireCondition(config.stop_rules?.consecutive_quality_regressions_max === 1, 'trial must stop before a second consecutive quality regression');
  requireCondition(config.stop_rules?.fallback_directive === 'superpowers=full', 'fallback directive must be superpowers=full');
  requireCondition(Number.isSafeInteger(config.sample?.target_real_tasks) && config.sample.target_real_tasks > 0, 'target_real_tasks must be positive');
  requireCondition(config.sample.synthetic_session_requirement === 0, 'dogfood trial cannot require synthetic sessions');
  requireCondition(config.evidence_limits?.formal_profile_promotion_allowed === false, 'dogfood cannot authorize formal promotion');
  requireCondition(typeof config.logging?.relative_path === 'string' && config.logging.relative_path.length > 0, 'logging path is required');
  for (const forbidden of ['prompt', 'code', 'repository_path', 'file_path', 'secret', 'user_content']) {
    requireCondition(config.logging.content_fields_forbidden?.includes(forbidden), `missing forbidden content field: ${forbidden}`);
  }
  return config;
}

export function isTrialConfigActive(config, now = new Date()) {
  validateTrialConfig(config);
  return config.status === 'active' && now.getTime() <= expiryTimestamp(config.expires_on);
}

export function createTrialRecord(config, input, now = new Date()) {
  requireCondition(isTrialConfigActive(config, now), 'trial config is not active or has expired');
  requireCondition(typeof input.task_id === 'string' && /^[a-z0-9][a-z0-9-]*$/.test(input.task_id), 'invalid task_id');
  requireCondition(PROFILES.has(input.requested_profile), 'invalid requested_profile');
  requireCondition(PROFILES.has(input.effective_profile), 'invalid effective_profile');
  requireCondition(TASK_CLASSES.has(input.task_class), 'invalid task_class');
  requireCondition(OUTCOMES.has(input.outcome), 'invalid outcome');
  requireCondition(Array.isArray(input.advisory_components), 'advisory_components must be an array');
  requireCondition(new Set(input.advisory_components).size === input.advisory_components.length, 'advisory_components must be unique');
  for (const identifier of input.advisory_components) {
    requireCondition(SKILL_IDENTIFIER.test(identifier), `advisory component is not a discoverable Skill identifier: ${identifier}`);
  }
  requireCondition(VERIFICATION_RESULTS.has(input.verification), 'invalid verification result');
  requireCondition(RESULT_VALUES.has(input.result), 'invalid result feedback');
  requireCondition(PROCESS_VALUES.has(input.process), 'invalid process feedback');

  const highRiskUnderRoute = input.task_class === 'high_risk'
    && (input.effective_profile !== 'full' || input.outcome !== 'full_v6_1_1');
  const expectedOutcome = input.effective_profile === 'full'
    ? 'full_v6_1_1'
    : input.advisory_components.length === 0
      ? 'no_advisory_workflow'
      : 'selected_advisory_workflow';

  return {
    schema_version: '1.0.0',
    event_type: 'real_task_outcome',
    trial_id: config.trial_id,
    task_id: input.task_id,
    recorded_at: now.toISOString(),
    model_binding: {
      exact_model_id: config.model_binding.exact_model_id,
      reasoning_effort: config.model_binding.reasoning_effort,
    },
    route: {
      requested_profile: input.requested_profile,
      effective_profile: input.effective_profile,
      task_class: input.task_class,
      advisory_components: input.advisory_components,
      outcome: input.outcome,
      schema_consistent: input.outcome === expectedOutcome,
      high_risk_under_route: highRiskUnderRoute,
    },
    completion: {
      verification: input.verification,
      rework: parseBoolean(input.rework, 'rework'),
      quality_regression: parseBoolean(input.quality_regression, 'quality_regression'),
    },
    feedback: {
      result: input.result,
      process: input.process,
    },
    metrics: {
      wall_clock_ms: parseOptionalInteger(input.wall_clock_ms, 'wall_clock_ms'),
      interaction_count: parseOptionalInteger(input.interaction_count, 'interaction_count'),
      total_tokens: parseOptionalInteger(input.total_tokens, 'total_tokens'),
    },
    privacy: {
      prompt_logged: false,
      code_logged: false,
      paths_logged: false,
      secrets_logged: false,
    },
    evidence_scope: 'directional_local_dogfood_only',
  };
}

export async function readTrialRecords(logPath) {
  try {
    const text = await readFile(logPath, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).map((line, index) => {
      try {
        return JSON.parse(line);
      } catch (error) {
        throw new Error(`invalid JSONL at line ${index + 1}: ${error.message}`);
      }
    });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function maxConsecutiveQualityRegressions(records) {
  let current = 0;
  let maximum = 0;
  for (const record of records) {
    current = record.completion?.quality_regression ? current + 1 : 0;
    maximum = Math.max(maximum, current);
  }
  return maximum;
}

function countValues(records, selector, allowed) {
  return Object.fromEntries([...allowed].map((value) => [value, records.filter((record) => selector(record) === value).length]));
}

export function summarizeTrialRecords(config, records) {
  validateTrialConfig(config);
  const highRiskUnderRoutes = records.filter((record) => record.route?.high_risk_under_route).length;
  const routeSchemaMismatches = records.filter((record) => record.route?.schema_consistent === false).length;
  const maxConsecutiveRegressions = maxConsecutiveQualityRegressions(records);
  const stopReasons = [];
  if (highRiskUnderRoutes > config.stop_rules.high_risk_under_routes_max) stopReasons.push('high_risk_under_route');
  if (maxConsecutiveRegressions > config.stop_rules.consecutive_quality_regressions_max) {
    stopReasons.push('consecutive_quality_regressions');
  }

  return {
    schema_version: '1.0.0',
    trial_id: config.trial_id,
    real_tasks_observed: records.length,
    target_real_tasks: config.sample.target_real_tasks,
    target_reached: records.length >= config.sample.target_real_tasks,
    safety: {
      high_risk_under_routes: highRiskUnderRoutes,
      route_schema_mismatches: routeSchemaMismatches,
    },
    quality: {
      regressions: records.filter((record) => record.completion?.quality_regression).length,
      max_consecutive_regressions: maxConsecutiveRegressions,
      rework_tasks: records.filter((record) => record.completion?.rework).length,
      verification_failures: records.filter((record) => record.completion?.verification === 'failed').length,
    },
    feedback: {
      result: countValues(records, (record) => record.feedback?.result, RESULT_VALUES),
      process: countValues(records, (record) => record.feedback?.process, PROCESS_VALUES),
    },
    stop_required: stopReasons.length > 0,
    stop_reasons: stopReasons,
    next_action: stopReasons.length > 0
      ? config.stop_rules.fallback_directive
      : records.length >= config.sample.target_real_tasks
        ? 'review_trial_and_form_one_focused_hypothesis'
        : 'continue_real_task_trial',
    evidence_scope: 'directional_local_dogfood_only',
  };
}

export async function appendTrialRecord(config, logPath, record) {
  const records = await readTrialRecords(logPath);
  requireCondition(!records.some(({ task_id: taskId }) => taskId === record.task_id), `duplicate task_id: ${record.task_id}`);
  await mkdir(dirname(logPath), { recursive: true });
  await appendFile(logPath, `${JSON.stringify(record)}\n`, 'utf8');
  return summarizeTrialRecords(config, [...records, record]);
}

function parseArguments(argv) {
  const command = argv[0];
  requireCondition(['record', 'summary'].includes(command), 'usage: frontier-trial-log.mjs record|summary [options]');
  const values = {};
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    requireCondition(key?.startsWith('--') && value !== undefined, `invalid option near ${key ?? '<end>'}`);
    const normalized = key.slice(2).replaceAll('-', '_');
    requireCondition(!(normalized in values), `duplicate option: ${key}`);
    values[normalized] = value;
  }
  const common = new Set(['config', 'log']);
  const recordOnly = new Set([
    'task_id',
    'requested_profile',
    'effective_profile',
    'task_class',
    'outcome',
    'advisory',
    'verification',
    'result',
    'process',
    'rework',
    'quality_regression',
    'wall_clock_ms',
    'interaction_count',
    'total_tokens',
  ]);
  for (const key of Object.keys(values)) {
    requireCondition(common.has(key) || (command === 'record' && recordOnly.has(key)), `unsupported option: --${key.replaceAll('_', '-')}`);
  }
  return { command, values };
}

async function loadConfig(path) {
  return validateTrialConfig(JSON.parse(await readFile(path, 'utf8')));
}

async function runCli(argv) {
  const { command, values } = parseArguments(argv);
  const configPath = resolve(values.config ?? '.superpowers/frontier-trial.config.json');
  const config = await loadConfig(configPath);
  const logPath = resolve(values.log ?? config.logging.relative_path);

  if (command === 'summary') {
    process.stdout.write(`${JSON.stringify(summarizeTrialRecords(config, await readTrialRecords(logPath)), null, 2)}\n`);
    return;
  }

  const record = createTrialRecord(config, {
    task_id: values.task_id,
    requested_profile: values.requested_profile,
    effective_profile: values.effective_profile,
    task_class: values.task_class,
    outcome: values.outcome,
    advisory_components: values.advisory && values.advisory !== '-'
      ? values.advisory.split(',').map((value) => value.trim()).filter(Boolean)
      : [],
    verification: values.verification,
    result: values.result,
    process: values.process,
    rework: values.rework,
    quality_regression: values.quality_regression,
    wall_clock_ms: values.wall_clock_ms,
    interaction_count: values.interaction_count,
    total_tokens: values.total_tokens,
  });
  const summary = await appendTrialRecord(config, logPath, record);
  process.stdout.write(`${JSON.stringify({ recorded_task_id: record.task_id, ...summary }, null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(SCRIPT_PATH)) {
  runCli(process.argv.slice(2)).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
