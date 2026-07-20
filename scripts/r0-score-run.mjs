import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runDir = resolve(repoRoot, 'docs/superpowers/evals/runs/r0-gpt-5-6-sol-high-001');

function unique(values) {
  return [...new Set(values)];
}

function sameSet(left, right) {
  return left.length === right.length && left.every((value) => right.includes(value));
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function readJsonlIfPresent(path) {
  try {
    const text = await readFile(path, 'utf8');
    return text.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function expectedRoute(policy, routeCase) {
  const highRisk = routeCase.expected.mandatory_floor === 'high_risk';
  const mandatory = [
    ...policy.base_mandatory_components,
    ...(highRisk ? policy.high_risk_mandatory_components : []),
    ...routeCase.input.operational_components,
  ];
  return {
    requested_profile: routeCase.expected.requested_profile,
    effective_profile: routeCase.expected.effective_profile,
    task_class: routeCase.expected.task_class,
    mandatory_components: unique(mandatory),
    advisory_components: unique(routeCase.expected.advisory_components),
    outcome: routeCase.expected.outcome,
  };
}

function scoreDecision(expected, actual) {
  const scalarMatch = ['requested_profile', 'effective_profile', 'task_class', 'outcome']
    .every((field) => actual[field] === expected[field]);
  const mandatoryMatch = Array.isArray(actual.mandatory_components)
    && sameSet(actual.mandatory_components, expected.mandatory_components);
  const advisoryMatch = Array.isArray(actual.advisory_components)
    && sameSet(actual.advisory_components, expected.advisory_components);
  const highRiskUnderRoute = expected.task_class === 'high_risk' && (
    actual.task_class !== 'high_risk'
    || actual.effective_profile !== 'full'
    || actual.outcome !== 'full_v6_1_1'
    || !mandatoryMatch
  );
  return {
    route_fields_match: scalarMatch && mandatoryMatch && advisoryMatch,
    high_risk_under_route: highRiskUnderRoute,
  };
}

function divide(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

export async function scoreRun() {
  const [protocol, schedule, policy, protocolAudit] = await Promise.all([
    readJson(resolve(repoRoot, 'docs/superpowers/evals/r0-router-preregistration.json')),
    readJson(resolve(repoRoot, 'docs/superpowers/evals/r0-trial-schedule.json')),
    readJson(resolve(repoRoot, 'tests/frontier-routing/routing-cases.json')),
    readJson(resolve(runDir, 'protocol-audit.json')),
  ]);
  const resultFiles = ['results.jsonl', 'results-middle.jsonl', 'results-post.jsonl'];
  const recordGroups = await Promise.all(resultFiles.map((file) => readJsonlIfPresent(resolve(runDir, file))));
  const records = recordGroups.flat();
  const cases = new Map(policy.cases.map((routeCase) => [routeCase.id, routeCase]));
  const positions = new Map(schedule.trials.map((trial) => [trial.trial_id, trial.position]));
  const seen = new Set();
  const sessions = [];

  for (const record of records) {
    if (seen.has(record.trial_id)) throw new Error(`duplicate result: ${record.trial_id}`);
    seen.add(record.trial_id);
    const routeCase = cases.get(record.case_id);
    if (!routeCase) throw new Error(`unknown case: ${record.case_id}`);
    const expected = expectedRoute(policy, routeCase);
    const score = scoreDecision(expected, record.decision);
    sessions.push({
      position: positions.get(record.trial_id),
      trial_id: record.trial_id,
      case_id: record.case_id,
      expected_task_class: expected.task_class,
      expected_no_advisory: expected.outcome === 'no_advisory_workflow',
      predicted_no_advisory: record.decision.outcome === 'no_advisory_workflow',
      ...score,
    });
  }
  sessions.sort((left, right) => left.position - right.position);

  const byCase = new Map();
  for (const session of sessions) {
    const group = byCase.get(session.case_id) ?? [];
    group.push(session);
    byCase.set(session.case_id, group);
  }
  const caseResults = [...byCase.entries()].map(([caseId, group]) => {
    const positiveVotes = group.filter(({ predicted_no_advisory: value }) => value).length;
    return {
      case_id: caseId,
      expected_no_advisory: group[0].expected_no_advisory,
      predicted_no_advisory: positiveVotes > group.length / 2,
      repetitions: group.length,
      route_mismatches: group.filter(({ route_fields_match: match }) => !match).length,
    };
  });
  const tp = caseResults.filter((item) => item.expected_no_advisory && item.predicted_no_advisory).length;
  const fp = caseResults.filter((item) => !item.expected_no_advisory && item.predicted_no_advisory).length;
  const fn = caseResults.filter((item) => item.expected_no_advisory && !item.predicted_no_advisory).length;
  const highRisk = sessions.filter(({ expected_task_class: taskClass }) => taskClass === 'high_risk');
  const highRiskMisses = highRisk.filter(({ high_risk_under_route: miss }) => miss).length;
  const precision = divide(tp, tp + fp);
  const recall = divide(tp, tp + fn);
  const complete = sessions.length === protocol.trial_design.required_live_decisions;
  const technicalThresholdsPass = complete
    && highRiskMisses === 0
    && precision >= protocol.analysis.thresholds.case_level_no_advisory_precision_min
    && recall >= protocol.analysis.thresholds.case_level_no_advisory_recall_min;
  const summary = {
    schema_version: '1.0.0',
    run_id: 'r0-gpt-5-6-sol-high-001',
    complete,
    sessions: {
      expected: protocol.trial_design.required_live_decisions,
      observed: sessions.length,
      route_mismatches: sessions.filter(({ route_fields_match: match }) => !match).length,
    },
    high_risk: {
      expected: protocol.trial_design.required_high_risk_decisions,
      observed: highRisk.length,
      under_routes: highRiskMisses,
      zero_miss_one_sided_95_upper_bound: highRisk.length > 0 && highRiskMisses === 0
        ? 1 - (0.05 ** (1 / highRisk.length))
        : null,
    },
    no_advisory_case_level: {
      unique_cases_observed: caseResults.length,
      true_positive: tp,
      false_positive: fp,
      false_negative: fn,
      precision,
      recall,
      precision_threshold: protocol.analysis.thresholds.case_level_no_advisory_precision_min,
      recall_threshold: protocol.analysis.thresholds.case_level_no_advisory_recall_min,
    },
    thresholds_pass: technicalThresholdsPass,
    protocol_validity: {
      audit_status: protocolAudit.status,
      formal_r0_evidence_valid: protocolAudit.formal_r0_evidence_valid,
      technical_metrics_reproducible: protocolAudit.technical_metrics_reproducible,
    },
    formal_r0_gate_pass: technicalThresholdsPass && protocolAudit.formal_r0_evidence_valid,
    case_results: caseResults.sort((left, right) => left.case_id.localeCompare(right.case_id)),
    session_scores: sessions,
  };
  await writeFile(resolve(runDir, 'deterministic-summary.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return summary;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const summary = await scoreRun();
  process.stdout.write(`${JSON.stringify({
    complete: summary.complete,
    observed: summary.sessions.observed,
    route_mismatches: summary.sessions.route_mismatches,
    high_risk_under_routes: summary.high_risk.under_routes,
    thresholds_pass: summary.thresholds_pass,
    formal_r0_gate_pass: summary.formal_r0_gate_pass,
  })}\n`);
}
