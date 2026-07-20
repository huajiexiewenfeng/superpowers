import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const protocolPath = resolve(repoRoot, 'docs/superpowers/evals/r0-router-preregistration.json');
const bindingPath = resolve(repoRoot, 'docs/superpowers/evals/r0-batch-binding.json');
const schedulePath = resolve(repoRoot, 'docs/superpowers/evals/r0-trial-schedule.json');

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function makeTrial(caseId, repetition, highRisk) {
  return {
    trial_id: `${caseId}#${repetition}`,
    case_id: caseId,
    repetition,
    risk_stratum: highRisk ? 'high_risk' : 'other',
    role: 'measurement',
  };
}

export async function materializeSchedule() {
  const [protocolBytes, bindingBytes] = await Promise.all([
    readFile(protocolPath),
    readFile(bindingPath),
  ]);
  const protocol = JSON.parse(protocolBytes.toString('utf8'));
  const binding = JSON.parse(bindingBytes.toString('utf8'));
  const highRisk = new Set(protocol.fixture.coverage.high_risk);
  const liveCases = [
    ...protocol.fixture.eligible_case_ids,
    ...protocol.fixture.ineligible_case_ids,
  ];
  const trials = [];

  for (const caseId of liveCases) {
    const repetitions = highRisk.has(caseId)
      ? protocol.trial_design.high_risk_repetitions_per_case
      : protocol.trial_design.other_repetitions_per_case;
    for (let repetition = 1; repetition <= repetitions; repetition += 1) {
      trials.push(makeTrial(caseId, repetition, highRisk.has(caseId)));
    }
  }

  const preIds = binding.calibration.pre_trial_ids;
  const postIds = binding.calibration.post_trial_ids;
  const boundaryIds = new Set([...preIds, ...postIds]);
  const byId = new Map(trials.map((trial) => [trial.trial_id, trial]));
  const seed = protocol.trial_design.randomization.seed_hex;
  const middle = trials
    .filter(({ trial_id: trialId }) => !boundaryIds.has(trialId))
    .sort((left, right) => {
      const leftKey = sha256(Buffer.from(`${seed}:${left.trial_id}`, 'utf8'));
      const rightKey = sha256(Buffer.from(`${seed}:${right.trial_id}`, 'utf8'));
      return leftKey.localeCompare(rightKey);
    });

  const ordered = [
    ...preIds.map((id) => ({ ...byId.get(id), role: 'measurement_and_pre_calibration' })),
    ...middle,
    ...postIds.map((id) => ({ ...byId.get(id), role: 'measurement_and_post_calibration' })),
  ].map((trial, index) => ({ position: index + 1, ...trial }));

  const schedule = {
    schema_version: '1.0.0',
    schedule_id: 'r0-frontier-router-001-schedule-001',
    protocol_id: protocol.protocol_id,
    candidate_implementation_commit: protocol.candidate.implementation_commit,
    batch_binding: {
      path: 'docs/superpowers/evals/r0-batch-binding.json',
      sha256: sha256(bindingBytes),
    },
    randomization: {
      seed_hex: seed,
      algorithm: protocol.trial_design.randomization.algorithm,
      boundary_calibration_trials_are_fixed: true,
    },
    trial_count: ordered.length,
    high_risk_trial_count: ordered.filter(({ risk_stratum: stratum }) => stratum === 'high_risk').length,
    trials: ordered,
  };
  const output = `${JSON.stringify(schedule, null, 2)}\n`;
  await writeFile(schedulePath, output, 'utf8');
  return { schedule, sha256: sha256(Buffer.from(output, 'utf8')) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await materializeSchedule();
  process.stdout.write(`${result.sha256}\n`);
}
