# Frontier-Model Workflow Optimization Implementation Plan

> **Execution note:** This plan is self-contained. It must not depend on invoking the workflow being evaluated, and it must not edit multiple behavior-shaping components in one unreviewed batch.
>
> Chinese translation: [顶级模型工作流优化实施计划](./2026-07-19-frontier-model-workflow-optimization.zh-CN.md)

**Goal:** Adapt Superpowers for frontier reasoning models so that simple and bounded tasks avoid unnecessary workflow overhead while high-risk work retains strong safety, verification, and review guarantees.

**Architecture:** Replace the current all-or-nothing workflow with a component-aware router. The router selects `full`, `frontier`, or `off` advisory behavior from explicit user intent, task risk, task complexity, and declared model capability; invariant safety and verification components remain active in every profile. The first implementation slice changes only three high-value advisory components and uses budget gates before any larger evaluation matrix. Changes are promoted only after staged evidence shows non-inferior quality and materially lower cost.

**Tech Stack:** Markdown skills, JSON evaluation fixtures, Node.js built-in test runner, shell-based plugin tests, and the external `superpowers-evals` harness for real agent sessions.

**Design basis:** [Floor, Not Ceiling](https://gist.github.com/huajiexiewenfeng/71da8bd8431ec51e56a2b02a83f34a60), proposal v0.2. The implementation unit is the component, and a component must name either the failure it prevents or the capability it enables.

**Source snapshot:** Gist revision `d283da2e45f04363bc70734f88abed8a69c437eb`, updated `2026-07-16T14:16:50Z`; LF-normalized raw content SHA-256 `bd252a9a39d649d672dd4aff60b709a7bac18dbe6be08b3c85bae41b2fbc1dbe`. Later revisions require an explicit provenance update and design-delta review.

## Global Constraints

- Base repository: `obra/superpowers` v6.1.1, commit `d884ae04edebef577e82ff7c4e143debd0bbec99`.
- Working fork: `huajiexiewenfeng/superpowers`.
- Working branch: `feat/frontier-model-workflow-optimization`.
- Keep the project zero-dependency; do not add runtime packages.
- User override has precedence inside the advisory set and may always increase workflow intensity. It cannot reduce the mandatory risk floor computed from policy, permissions, and the concrete operation.
- Irreversible, security-sensitive, migration, release, and data-loss risks always force the required invariant components.
- Verification is always enabled; profiles may change verification scope, never eliminate evidence.
- A profile named `off` disables advisory workflow components only; it cannot disable permissions, destructive-action gates, or completion evidence.
- Prompt text alone is best-effort enforcement. A mandatory fail-closed gate must identify its runtime, permission, or deterministic enforcement boundary.
- Do not hardcode transient model product names in core policy. Harnesses may declare a capability tier; users may explicitly select a profile.
- Capability is bound to an evaluated model-and-runtime configuration, not inferred from a model-name wildcard or from the model's self-description.
- Phase 1 is limited to `brainstorming.universal_design_gate`, `writing-plans.micro_step_granularity`, and `test-driven-development.unconditional_tdd`; all other behavior changes remain backlog until the thin-slice method is validated.
- Evaluation budgets are progressive. A later matrix is not authorized merely because it appears in this plan; each expansion requires the preceding technical Gate and a fresh human approval.
- In this single-owner project, a pinned LLM judge plus disclosed human audit replaces any unsupported claim of independent human blind review.
- Record the exact Floor, Not Ceiling Gist revision used by the plan. A stale local mirror must never silently override the published v0.2 source.
- Change one behavior family per commit so evaluation regressions can be attributed.
- Experiment authorization, component quarantine, default-profile promotion, physical deletion, and upstream contribution are separate human decisions.
- Do not open an upstream pull request until a human reviews the complete diff and held-out evaluation evidence.
- Any future upstream PR must target `dev`, not `main`, and must comply with `CLAUDE.md` and `.github/PULL_REQUEST_TEMPLATE.md`.

---

## 1. Problem Statement

Superpowers was designed to compensate for models that often skipped decomposition, tests, verification, or review. Frontier models now perform much of that reasoning natively, so several unconditional instructions impose fixed costs without reliably improving outcomes:

- every request triggers skill inspection before any response;
- even bounded changes enter brainstorming and a written-spec gate;
- plans are decomposed into very small steps regardless of task size;
- every feature, bug fix, and refactor is forced through the same TDD shape;
- small changes may invoke worktrees, subagents, and reviews whose cost exceeds the work;
- multiple skills restate overlapping process constraints.

The objective is not to remove engineering discipline. It is to preserve the floor that prevents consequential failures while lifting the ceiling that limits stronger models.

## 2. Component Model

Every instruction changed by this branch must be classified before editing:

| Lifecycle | Meaning | Default treatment |
|---|---|---|
| `invariant_core` | Prevents unacceptable safety, permission, data-loss, or false-completion failures | Always active; prefer deterministic enforcement where available |
| `intentional_shaping` | Encodes a deliberate engineering preference that may improve quality | Routed by task risk and complexity |
| `compensatory_shell` | Compensates for failure patterns primarily observed in weaker models | Disabled or compressed in the frontier profile after evaluation |

Each component contract records:

- stable component ID;
- layer: `register`, `open_ended_reasoning`, or `operational_control`;
- kind: `register`, `reasoning_scaffold`, `fact`, `procedure`, `tool`, `state`, or `gate`;
- `failure_prevented` or `capability_enabled`, with at least one non-null;
- activation condition or mandatory condition;
- advisory or mandatory binding;
- actual enforcement mechanism;
- fail-open, fail-closed, or report-only behavior;
- who may satisfy a gate and what fresh evidence is required;
- who may change or waive policy;
- owner, freshness rule, compatibility check, and evaluation cases.

The three control layers have different design limits:

| Layer | Appropriate control | Inappropriate control |
|---|---|---|
| `register` | tone, structure, direction of attention, durable preferences | pretending a preference is a safety invariant |
| `open_ended_reasoning` | outcomes, acceptance criteria, risk boundaries | prewriting the model's complete reasoning path for every task |
| `operational_control` | private facts, procedures, tools, state, permissions, fail-closed gates | relying on persuasive prompt language where deterministic enforcement is required |

A chat confirmation may satisfy a gate only when the contract permits it and the evidence is fresh, authorized, action-specific, and non-replayable. Satisfying a gate does not rewrite the policy. Policy changes require the named policy authority through an intentional configuration change.

The retirement unit is the component, not the whole Skill. A Skill remains discoverable while any retained component still provides unique value.

## 3. Routing Contract

### 3.1 Precedence

The router resolves two sets in order:

1. **Mandatory floor:** derive non-waivable permissions, destructive-action confirmation, security/release/migration safeguards, required testing/review, and completion evidence from policy and operation risk. A chat directive cannot lower this set; only the named policy authority can change the policy through an intentional configuration change.
2. **Advisory set:** after the floor is fixed, apply explicit user instruction, task ambiguity and integration complexity, declared model capability tier, repository/organization default, and finally the conservative fallback. The user may raise this intensity or turn advisory components off, but cannot remove the mandatory floor.

Therefore `superpowers=off` is not above risk in a single flat precedence list. It is an advisory selection applied after the risk floor exists.

### 3.2 Profiles

| Profile | Intended use | Advisory workflow | Invariant core |
|---|---|---|---|
| `full` | weaker/unknown models, ambiguous projects, high-risk engineering | Complete design, planning, TDD, review, and verification workflow | Active |
| `frontier` | frontier models on simple or bounded work | Compact planning, targeted tests, selective review, proportional verification | Active |
| `off` | explicit user opt-out for advisory workflow | Disabled | Active |

Supported explicit directives:

```text
superpowers=full
superpowers=frontier
superpowers=off
```

If a harness cannot expose a trustworthy capability tier, the router must not infer a specific model identity. It uses task risk and the configured default instead.

### 3.3 Task Classes

| Class | Examples | Frontier behavior |
|---|---|---|
| `mechanical` | typo, rename, one-value config change, formatting | execute directly, run the smallest relevant check, report evidence |
| `bounded` | isolated bug fix or small feature with clear acceptance criteria | inline plan, targeted tests, no subagent unless independently useful |
| `complex` | cross-module behavior, unclear ownership, multi-step integration | compact design and plan; full workflow components selected as needed |
| `high_risk` | auth, security, release, migration, destructive data change | force full safety, testing, review, and verification components |

`no_advisory_workflow` is a valid routing result for a mechanical task. It is not a failure to find a Skill.

Natural-language requests such as "skip the framework this time" are a bounded advisory off-ramp. They silence advisory components only; they do not bypass tool permissions, destructive-action confirmation, or mandatory verification evidence. The routing suite must also test the opposite failure: under-activating useful components when a complex or high-risk task needs them.

### 3.4 Capability Profile

The router may consume an approved capability profile, but neither the model nor a model-name wildcard may declare the profile valid. Each measured profile is bound to the configuration that produced the evidence:

```json
{
  "profile_id": "frontier-candidate-001",
  "base_model": "exact deployment identifier",
  "reasoning_configuration": "effort, sampling, context settings",
  "harness_and_router": "version or immutable hash",
  "toolchain": "tools, permissions, and versions",
  "benchmark_suite": "version and held-out split",
  "evaluation_commit": "immutable candidate SHA",
  "approved_by": "human owner",
  "approved_at": "ISO-8601 timestamp"
}
```

A change to the model, reasoning configuration, harness, router, tools, permissions, or benchmark invalidates automatic reuse of the profile until the relevant measurements are repeated. Unknown configurations fall back conservatively without claiming that the model is weak or strong.

## 4. Skill Change Map

Phase 1 deliberately separates routing infrastructure from the three components whose efficacy is being tested. Editing the router is necessary to expose controlled variants; it is not evidence that every downstream Skill should be rewritten.

| Wave | Skill | Component action | Planned result |
|---|---|---|---|
| Infrastructure | `using-superpowers` | Replace the unconditional 1% trigger rule with the routing contract | Thin central router; mandatory components remain explicit |
| Phase 1 | `brainstorming` | Test `brainstorming.universal_design_gate`; keep ambiguity discovery | Skip mechanical work, compact path for bounded work, full path for ambiguous/complex work |
| Phase 1 | `writing-plans` | Test `writing-plans.micro_step_granularity`; keep interfaces and global constraints | Task boundaries sized by independent test/review value |
| Phase 1 | `test-driven-development` | Test `test-driven-development.unconditional_tdd`; keep red/green for behavior and regression risk | Strict, targeted, or not-applicable modes selected by change risk |
| Phase 2 backlog | `subagent-driven-development` | Add inline, serial, and delegated execution modes | One execution router instead of forcing delegation |
| Phase 2 backlog | `executing-plans` | Migrate unique serial/checkpoint behavior | Temporary alias, then retirement after compatibility evaluation |
| Phase 2 backlog | `dispatching-parallel-agents` | Keep independent-work parallelism | Add concurrency budget, write-set ownership, cancellation, and integration gate |
| Phase 2 backlog | `systematic-debugging` | Keep evidence and root-cause discipline | Permit explicitly labeled mitigation before full root cause when operational urgency requires it |
| Invariant audit | `verification-before-completion` | Keep as invariant core | Always on; scope is targeted, proportional, or full |
| Phase 2 backlog | `requesting-code-review` | Keep merge/high-risk review | Do not force independent review for trivial changes |
| Phase 2 backlog | `receiving-code-review` | Keep technical verification | Remove style-only prohibitions that do not affect correctness if evaluation shows no benefit |
| Phase 2 backlog | `using-git-worktrees` | Keep isolation capability | Trigger for collision risk, long-lived work, or explicit request, not every planned change |
| Invariant audit | `finishing-a-development-branch` | Keep test and destructive cleanup gates | Offer only context-relevant completion actions |

No Phase 2 backlog row may be edited during the first slice. It requires Gate R2, a revised component budget, and a new G1 experiment approval.

## 5. Planned File Structure

### Core fork

```text
skills/
  using-superpowers/
    SKILL.md
    references/
      frontier-routing.md
      component-contracts.json
  brainstorming/
    SKILL.md
  writing-plans/
    SKILL.md
  test-driven-development/
    SKILL.md
  subagent-driven-development/
    SKILL.md
    references/
      execution-modes.md
  executing-plans/
    SKILL.md
  dispatching-parallel-agents/
    SKILL.md
  systematic-debugging/
    SKILL.md
  verification-before-completion/
    SKILL.md
  requesting-code-review/
    SKILL.md
  receiving-code-review/
    SKILL.md
  using-git-worktrees/
    SKILL.md
  finishing-a-development-branch/
    SKILL.md
tests/
  frontier-routing/
    bootstrap-entrypoints.test.mjs
    capability-profile.test.mjs
    component-contracts.test.mjs
    full-profile-equivalence.test.mjs
    routing-cases.json
    routing-policy.test.mjs
docs/superpowers/
  evals/
    bootstrap-entrypoints.json
    capability-profile.schema.json
    judge-protocol.json
    source-provenance.json
    directional-micro-pilot-protocol.md
    profiles/
      frontier-candidate-001.json
  specs/
    2026-07-19-frontier-model-workflow-optimization-design.md
  plans/
    2026-07-19-frontier-model-workflow-optimization.md
    2026-07-19-frontier-model-workflow-optimization.zh-CN.md
```

### External evaluation workspace

The real behavioral runs belong in a separate fork of `prime-radiant-inc/superpowers-evals`. This core branch records the evaluation protocol and result summaries, but does not vendor the eval harness or add it as a dependency.

## 6. Evaluation Design

### 6.1 Operational Core Preflight

Operational components are not compared against model intelligence. Before any advisory workflow experiment, test them independently:

- facts: provenance, correctness, and freshness;
- procedures: validity against the real target environment;
- tools: compatibility, determinism, and failure handling;
- state: schema integrity, atomicity, recovery, and migration behavior;
- gates: fail-closed enforcement, authorized satisfier, fresh action-bound evidence, and policy-override authority.

A failed operational-core check blocks advisory experiments. Prompt-only mandatory language must be reported as best-effort rather than scored as deterministic enforcement.

### 6.2 Controlled Claims

Different claims require different interventions. A single aggregate "skill score" is not sufficient.

| Claim | Controlled intervention | Decision supported |
|---|---|---|
| Component efficacy | Force one target component on versus off while holding the model configuration, operational core, router, tools, permissions, context, and unrelated components fixed | keep, narrow, or nominate the component for quarantine |
| Routing | Freeze registry, router, model configuration, permissions, and component definitions; run labeled positive, negative, override, and collision cases | change activation rules, not component content |
| Component non-interference | Toggle only the target component on labeled negative cases | causal evidence that this component creates unnecessary cost or quality degradation |
| Framework non-interference | Natural router and full advisory registry versus no-advisory baseline on negative cases | overall framework health; never sufficient by itself to delete one component |

### 6.3 Framework Variants

- A: upstream Superpowers v6.1.1, full current workflow;
- B: this branch with `superpowers=frontier`;
- C: this branch with advisory workflow disabled.

A/B/C measures framework behavior. Component retirement decisions must use the component-level interventions in section 6.2.

The 12-session directional micro-pilot compares only A and B. Variant C and the full A/B/C framework matrix are deferred until the first slice demonstrates a useful signal; this prevents an exploratory question from spending a promotion-sized budget.

Every comparison must hold the model deployment, reasoning configuration, harness version, task prompt, toolchain, permissions, timeout, and judge protocol constant. A, B, and C necessarily use different repository/router SHAs; each variant SHA is frozen in advance and may differ only by the treatment authorized for that comparison. Record those distinct SHAs rather than claiming they are identical.

### 6.4 Stages

1. Static and entrypoint validation: contracts, schemas, inbound references, immutable SHAs, source provenance, and every bootstrap/hook/native-discovery injection path.
2. Harness smoke: use the smallest synthetic or fixture-based runs that confirm capture, timing, token, test, randomization, anonymization, and judge pipelines. These are infrastructure checks, not evidence of component value.
3. Router pilot: run classification-only positive, negative, override, collision, no-advisory, and high-risk cases before any downstream Skill rewrite. These short fresh-context decisions must not execute full coding tasks.
4. Directional micro-pilot after Task 3: three frozen mechanical prompts and three frozen bounded prompts, each run once under A and B. This is six sessions per class and twelve complete agent sessions total.
5. Selected-component pilot: test only the three Phase 1 components. For each component, use one positive and one negative frozen prompt, forced on and forced off, with three repetitions: at most 36 complete agent sessions. Report efficacy and non-interference separately.
6. Conditional framework pilot: `6 frozen tasks × 3 variants × 3 repetitions = 54 sessions` is a historical upper-stage design, not a Phase 1 commitment. It requires Gates R1 and R2, a frozen judge protocol, and fresh G1 approval.
7. Conditional held-out promotion: `12 unseen tasks × 3 variants × 3 repetitions = 108 sessions` is a historical ceiling, not an automatic design. Recalculate the required sample from pilot variance and effect size, publish the budget, and obtain a separate approval before running it.
8. Conditional cross-configuration validation: repeat only the evidence needed for the promotion claim on a second approved frontier capability profile.

The micro-pilot is directional, not retirement evidence. If B does not move toward at least 25% lower median token use or wall-clock time without a safety or required-quality regression, stop the larger matrix and diagnose the router or component hypothesis. A failed thin slice is a valid result and ends the current investment decision.

Critical path: `G0 → Task 1 → fresh G1 for the router variant → Task 2 → R0 → fresh G1 for Task 3 → Task 3 → R1 (12 sessions) → fresh G1 for Task 4/component trials → Task 4 → Task 7 selected-component pilot → R2 → separately approved framework pilot → separately approved held-out set → optional second profile`.

### 6.5 Task Mix and Metrics

The 12-session micro-pilot covers only mechanical and bounded work because it tests the cost hypothesis. Router-only evaluation supplies complex and high-risk classification coverage before Task 3. Any formal promotion set must include mechanical, bounded, complex, and high-risk tasks, with at least one tempting but unsafe shortcut in every class so that under-routing is observable.

Quality and safety metrics:

- acceptance criteria completed;
- build and relevant tests pass;
- root cause resolved when the task requires it;
- no unrelated or out-of-scope edits;
- no permission, data-loss, security, secret-leak, rollback, or false-completion violation;
- maintainability score from the pinned judge protocol;
- explicit `must_not` checks for each high-risk fixture.

Cost and interaction metrics:

- input, output, and total tokens;
- wall-clock time;
- tool calls and subagent calls;
- user questions and approval waits;
- retries and rework;
- plan/spec/review artifact count.

Routing metrics:

- correct task class;
- required invariant components activated;
- unnecessary advisory components avoided;
- no-advisory precision and recall;
- collision resolution accuracy;
- high-risk under-routing count;
- trial count `n`, miss count, observed miss rate, and one-sided 95% Clopper-Pearson upper bound for each high-risk case and the aggregate set.

Zero observed misses does not mean the true miss rate is zero. For zero misses in `n` independent trials, report the one-sided 95% upper bound as `1 - 0.05^(1/n)` and preserve the raw decisions needed to reproduce it. Independence is an explicit modeling assumption; shared prompts, deployments, or hidden runtime state may correlate trials, so the bound is descriptive evidence rather than proof of a production miss-rate guarantee.

The primary analysis unit is the unique case or task, not the repeated session. For routing, preregister majority vote (with ties counted as incorrect) to derive one case-level prediction, compute precision/recall on cases, and report every session-level miss separately; any high-risk session miss still blocks R0. For behavioral and held-out comparisons, aggregate repeated sessions within each task using the preregistered rule, then use paired, cluster-aware analysis across unique tasks. Repetitions estimate within-task variability and do not increase the effective task sample size or statistical power.

### 6.6 Solo-Project Judging Protocol

This is a single-owner project. The author cannot truthfully claim to be an independent human blind reviewer, so formal runs use the following bounded substitute:

- Prefer an immutable, separately identified LLM judge deployment; record model/deployment ID, provider version, reasoning and sampling settings, judge prompt SHA-256, rubric version, and execution date.
- If the provider exposes only a mutable model label, either use a fixed local judge or record the provider fingerprint and run a frozen sentinel/calibration set immediately before and after the batch. Any safety-sentinel flip or mean rubric drift greater than 0.25 on a five-point scale invalidates the batch. If neither an immutable/local judge nor auditable fingerprint plus calibration is available, results remain exploratory and cannot support default promotion.
- Hide A/B/C labels, branch names, expected hypotheses, and cost measurements from the judge until quality and safety verdicts are recorded. Randomize presentation order with a stored seed.
- Run deterministic acceptance, test, scope, and `must_not` checks before model judgment; the judge cannot override a deterministic safety failure.
- The human owner audits a stratified random sample of at least 20%, plus every safety failure, tie, judge disagreement, missing artifact, and statistical outlier. Variant labels remain hidden until the audit verdict is recorded.
- For the 12-session micro-pilot, the owner reviews all deterministic failures and all judge-flagged quality regressions; the 20% sample remains the minimum when no issue is flagged.
- Report this as pinned LLM-as-judge with owner audit, not independent human blind review. Record self-judging, provider correlation, style leakage, and unblinding risks explicitly.
- An external reviewer may strengthen the evidence but is optional. If the judge deployment or rubric changes, do not pool old and new verdicts without a calibration study; rerun affected comparisons when drift is material.

The judge protocol must be frozen before the 12-session micro-pilot. No 54-run or held-out evaluation may start while the judge identity, rubric, sampling, audit rate, or drift policy is unresolved.

### 6.7 Promotion Rules

Apply a lexicographic decision rule: safety, then required quality, then cost.

- Any catastrophic safety or destructive-action failure blocks promotion and is never averaged away.
- Before a formal held-out run, preregister deterministic task success as the primary quality outcome, a non-inferiority margin of 5 percentage points, one-sided `alpha = 0.05`, target power of at least 80%, the paired analysis method, and the exact task-class weights. Timeout, missing output, unavailable evidence, and protocol deviation count as failures in the primary analysis.
- Frontier quality must meet that preregistered non-inferiority rule against A; a lower quality result cannot be offset by token savings. Judge maintainability is secondary unless its scale, margin, and analysis are separately preregistered.
- Mechanical and bounded tasks should each reduce the preregistered primary cost endpoint by at least 25% relative to paired A runs. Total tokens are the default primary endpoint; wall-clock time remains secondary unless approved before data collection.
- High-risk tasks may cost the same as A; the optimization target is correct routing, not universal cost reduction.
- C is promoted for a task class only when it matches B on quality and safety while using less cost.
- Calculate the required held-out sample before approval. If it exceeds the approved ceiling, do not claim non-inferiority: narrow the claim, obtain a larger separately approved budget, or stop. Never truncate the sample at 108 and treat insufficient power as success.
- An unstable component becomes conditional or opt-in rather than deleted.
- Conflicting results trigger component-level investigation; do not compress them into an opaque composite score.

## 7. Implementation Tasks

### Task 1: Freeze Baseline and Component Contracts

**Files:**

- Create: `docs/superpowers/specs/2026-07-19-frontier-model-workflow-optimization-design.md`
- Create: `docs/superpowers/evals/bootstrap-entrypoints.json`
- Create: `docs/superpowers/evals/capability-profile.schema.json`
- Create: `docs/superpowers/evals/source-provenance.json`
- Create: `docs/superpowers/evals/profiles/frontier-candidate-001.json`
- Create: `skills/using-superpowers/references/component-contracts.json`
- Create: `tests/frontier-routing/bootstrap-entrypoints.test.mjs`
- Create: `tests/frontier-routing/capability-profile.test.mjs`
- Create: `tests/frontier-routing/component-contracts.test.mjs`

**Interfaces:**

- Consumes: upstream v6.1.1 Skill text and the component taxonomy in this plan.
- Produces: stable component IDs, immutable capability-profile records, a source-provenance record, and a complete map of the real bootstrap/hook/native-discovery surfaces used by router tests and evaluation reports.

- [ ] Record every instruction targeted by this initiative with layer, kind, lifecycle, activation, binding, enforcement, failure mode, authority, maintenance, and owner.
- [ ] Record the exact model, reasoning, harness, router, toolchain, permission, benchmark, and candidate SHA for each evaluated capability profile.
- [ ] Pin Floor, Not Ceiling v0.2 by Gist URL, Gist revision, published timestamp, fetched timestamp, and raw SHA-256; identify stale local mirrors without treating them as canonical.
- [ ] Register every known mirror with path alias, version, SHA-256, and one explicit disposition: `sync`, `archive`, or `deliberately_unmanaged`. The current baseline includes `$USERPROFILE/Downloads/floor-not-ceiling.md` (v0.1, `4263deaac47c45c3f10863effac61e4ea9ece796bd8a377cabb7e1aa3760c14a`), `$USERPROFILE/Downloads/floor-not-ceiling.zh.md` (v0.1, `f65637cd5cdf87d82a5a6eea8ffa7985cd6e1c27be53538fef0ab735bfac9b03`), and `$WORKSPACE/floor-not-ceiling-final.md` (v0.2 derivative, `5c3027a1cfdcf3f7811a4cdcd66e723ab3c1d26be72b0ab14452c973e93b764c`). The Gist currently has no Chinese v0.2, so the Chinese mirror requires an explicit translation/merge decision rather than a claimed byte-for-byte sync. Any overwrite outside the repository requires separate approval and a recoverable backup.
- [ ] Inventory every active or legacy injection surface with harness, support status, registration manifest, real hook/bootstrap entrypoint, content source, injection event, cache/dedup behavior, and corresponding test. The minimum inventory is:
  - Claude Code and Copilot CLI through implicit root auto-discovery from `.claude-plugin/plugin.json` to `hooks/hooks.json`, then `hooks/session-start` and `hooks/run-hook.cmd`; the manifest does not explicitly declare a hooks pointer;
  - Cursor through `.cursor-plugin/plugin.json`, `hooks/hooks-cursor.json`, `hooks/session-start`, and `hooks/run-hook.cmd`;
  - OpenCode through `.opencode/plugins/superpowers.js`, including its cached bootstrap path;
  - Pi through `.pi/extensions/superpowers.ts`, including startup and post-compaction reinjection;
  - Kimi through `.kimi-plugin/plugin.json` and `sessionStart.skill`;
  - Gemini through `gemini-extension.json` and `GEMINI.md`, explicitly marked as an EOL legacy residue rather than an active supported integration, including the missing `skills/using-superpowers/references/gemini-tools.md` include;
  - Codex through `.codex-plugin/plugin.json`, explicitly recorded as native Skill discovery with no session-start hook;
  - Factory Droid and Antigravity, recording their claimed reuse of the Claude-style hook surface, the actual verifiable boundary, and the absence of dedicated end-to-end loading tests.
- [ ] Record the distinct loading shapes: shell injection includes the complete SKILL frontmatter, OpenCode and Pi strip frontmatter and cache the body, while Kimi and Codex use native loading. Treat Codex `hooks: {}` as a critical negative control that prevents fallback SessionStart discovery.
- [ ] Record distribution-only manifests separately from injection points, including `.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`, and root `package.json` OpenCode/Pi registrations.
- [ ] Record the exact stale or missing references: `skills/using-superpowers/references/claude-code-tools.md`, `skills/using-superpowers/references/copilot-tools.md`, `skills/using-superpowers/references/gemini-tools.md`, `.antigravity-plugin/install.sh`, and the corresponding stale claims in `docs/porting-to-a-new-harness.md`.
- [ ] Record `hooks/run-hook.cmd` silently skipping injection when Bash is unavailable on Windows as a fail-open boundary; do not describe prompt injection as fail-closed on that path.
- [ ] Record each surface's missing-source behavior: the shell hook currently injects an error string and exits successfully when the Skill cannot be read, while OpenCode and Pi omit bootstrap content and cache the missing result.
- [ ] Write Node built-in tests that reject duplicate IDs, missing purpose, invalid lifecycle, incomplete capability profiles, and mandatory prompt-only components incorrectly labeled as deterministic.
- [ ] Write an entrypoint test that fails when a registered surface disappears, changes its content source, or lacks an explicit `test_status` and evidence classification. Allowed classifications are `live_e2e`, `static_only`, `shared_script_only`, and `legacy_unverified`, each with evidence, gap reason, and owner. A supported surface selected for promotion requires `live_e2e`; the inventory itself may pass with a disclosed weaker classification.
- [ ] Run `node --test tests/frontier-routing/bootstrap-entrypoints.test.mjs tests/frontier-routing/component-contracts.test.mjs tests/frontier-routing/capability-profile.test.mjs`; expect all inventory and schema tests to pass.
- [ ] Commit only the reviewed baseline design, contracts, capability schema/profile, source provenance, entrypoint inventory, and their tests with message `docs: define frontier workflow component contracts`.

### Task 2: Implement the Thin Central Router

**Files:**

- Modify: `skills/using-superpowers/SKILL.md`
- Create: `skills/using-superpowers/references/frontier-routing.md`
- Create: `docs/superpowers/evals/judge-protocol.json`
- Create: `tests/frontier-routing/routing-cases.json`
- Create: `tests/frontier-routing/routing-policy.test.mjs`
- Create: `tests/frontier-routing/full-profile-equivalence.test.mjs`

**Interfaces:**

- Consumes: component IDs and precedence from Task 1.
- Produces: profile, task class, required component set, and advisory component set.

- [ ] Replace the universal skill-invocation rule with explicit precedence and a compact task-class decision table.
- [ ] Preserve user instruction precedence and make high-risk fail-closed behavior explicit.
- [ ] Add positive, negative, collision, override, and no-advisory routing cases.
- [ ] Add differential fixtures proving that `superpowers=full` preserves the pinned v6.1.1 routing decisions, injected bootstrap meaning, mandatory gates, and representative design/TDD/review/verification flows. Any intentional full-profile difference must be separately authorized, not hidden in the frontier change.
- [ ] Run `node --test tests/frontier-routing/*.test.mjs`; expect zero failures.
- [ ] Freeze the solo-project judge identity, rubric, prompt hash, randomization seed policy, anonymization rules, 20% stratified audit minimum, escalation cases, and drift handling before any real-session comparison.
- [ ] Verify the router source and injected shape at the strongest available layer for every Task 1 surface, not only the source `SKILL.md`: session start, first-message injection, cached load, already-injected deduplication, post-compaction reinjection, Kimi manifest declaration, Gemini legacy-residue state, and Codex native-discovery/no-hook control. Do not call static or shared-script evidence actual runtime loading.
- [ ] Add a behavioral OpenCode assertion that feeds an already-injected message back through the transform and proves marker-based deduplication; its existing caching test is not sufficient for this branch.
- [ ] Run `tests/hooks/test-session-start.sh`, OpenCode, Pi, Kimi, Codex loading/packaging tests, and the Gemini legacy-residue guard required by the inventory; expect no bootstrap, cache, deduplication, native-discovery control, or packaging regression at the claimed test layer. Record the missing live E2E coverage for Kimi native loading, Codex native matching, Claude manifest auto-registration, Cursor manifest wiring, Factory Droid, Antigravity, and any other weakly tested path. Before promoting a profile for one of those harnesses, add its live E2E evidence.
- [ ] Commit with message `feat: add component-aware frontier workflow routing`.

### Gate R0: Router-Only Decision

Do not begin Tasks 3–6 merely because Task 2 is implemented.

- [ ] Freeze the router commit, registry, candidate definitions, capability profile, and permissions.
- [ ] Treat Node fixtures as deterministic policy-table tests only; they do not establish stochastic model routing behavior.
- [ ] Run fresh-context, route-only model decisions for positive, negative, natural-language opt-out, override, collision, no-advisory, and adversarial high-risk cases without executing the coding task.
- [ ] Include at least six distinct high-risk cases covering authentication/authorization, security or secrets, release, migration, destructive data change, and data-loss/rollback risk. Repeat each case at least five times under the frozen capability profile, for at least 30 high-risk decisions.
- [ ] Pre-register the sampling rule. Repetitions require fresh contexts and distinct recorded seeds or sampling nonces where the provider exposes them. Deterministic replays with the same seed count as one statistical observation. If independence cannot be supported, label the Clopper-Pearson result descriptive and do not present nominal coverage as guaranteed.
- [ ] Require zero observed high-risk under-routes, report `n`, every raw decision, per-case and aggregate miss counts, and the one-sided 95% Clopper-Pearson upper bounds. At the minimum `n=5` per case the bound is about 45.1%; at aggregate `n=30` it is about 9.5%. Do not claim that the true miss rate is zero.
- [ ] Pre-register at least ten `no_advisory_workflow`-eligible cases and ten ineligible cases, class weights, and three route-only decisions per case. Require precision at least 95% and recall at least 80%, reported both per task class and macro-averaged. High-risk trials may be reused as ineligible cases. Thresholds and weights cannot change after outcomes are seen.
- [ ] Require an aggregate descriptive upper bound no greater than 10% at zero high-risk misses; increase route-only repetitions when the sample is smaller or unstable. Report stratified results because pooling heterogeneous cases does not make them identically distributed.
- [ ] Present results and misroutes to the human owner.
- [ ] Continue only after explicit approval of the router experiment; approval does not authorize downstream component edits or retirement.

### Task 3: Add Proportional Design and Planning

**Files:**

- Modify: `skills/brainstorming/SKILL.md`
- Modify: `skills/writing-plans/SKILL.md`
- Extend: `tests/frontier-routing/routing-cases.json`

**Interfaces:**

- Consumes: task class and profile from the central router.
- Produces: `none`, `inline`, `compact`, or `full` design/plan depth.

- [ ] Preserve ambiguity discovery and user approval for consequential design choices.
- [ ] Permit direct execution for mechanical requests already containing exact scope and success criteria.
- [ ] Replace universal micro-step granularity with independently testable task boundaries.
- [ ] Add cases proving that complex and high-risk work still receives complete design and planning.
- [ ] Create `docs/superpowers/evals/directional-micro-pilot-protocol.md` with three frozen mechanical prompts and three frozen bounded prompts, deterministic checks, randomized A/B order, and the frozen judge protocol.
- [ ] Run each prompt once under A and B: six mechanical sessions plus six bounded sessions, twelve complete agent sessions total.
- [ ] Report safety and required quality before cost, then median tokens, time, interaction count, and artifacts by class. Do not use this directional sample to retire a component.
- [ ] Commit with message `feat: make design and planning proportional to task risk`.

### Gate R1: 12-Run Directional Economics

- [ ] Freeze the Task 3 commit, six prompts, A/B baseline SHAs, capability profile, tool permissions, and judge protocol before the first session.
- [ ] Pre-register paired total-token change as the primary cost endpoint. Wall-clock time, interaction count, and artifact count are secondary endpoints; they cannot replace the primary endpoint after results are visible. If token telemetry is unavailable, a different primary endpoint requires approval before the first run.
- [ ] Require no catastrophic failure and no deterministic or audited required-quality regression in B.
- [ ] Compute token reduction as `(A - B) / A` for each matched prompt. Require `median((A - B) / A) >= 0.25` separately for mechanical prompts and bounded prompts; pooling cannot hide a class regression. Report all secondary endpoints without using them to rescue a failed primary endpoint.
- [ ] Publish all twelve records and owner audit outcomes, including an explicit warning that the sample does not establish statistical non-inferiority.
- [ ] If the direction is absent, stop before Task 4 and every larger matrix. Diagnose the hypothesis, router, fixtures, or measurement system and request a new G1 approval before retrying.

### Task 4: Make Testing Strategy Risk-Based

**Files:**

- Modify: `skills/test-driven-development/SKILL.md`
- Extend: `skills/using-superpowers/references/component-contracts.json`
- Extend: `tests/frontier-routing/routing-cases.json`

**Interfaces:**

- Consumes: change type, regression risk, and task class.
- Produces: `strict_tdd`, `targeted_test`, `existing_check`, or `not_applicable` with a reason.

- [ ] Keep strict red/green for behavioral logic, regressions, and high-risk code.
- [ ] Permit targeted tests for bounded changes where a full red/green cycle adds no evidence.
- [ ] Mark documentation-only and mechanical non-behavioral changes as not applicable while still requiring relevant validation.
- [ ] Add adversarial cases where the model tries to label risky logic as mechanical.
- [ ] Prepare the TDD forced-on/forced-off treatment for the selected-component protocol. Task 7 runs these sessions once as the TDD share of the 36-session cap; do not run a separate duplicate batch. Reuse no approval or evidence from R0 as proof of TDD efficacy.
- [ ] Commit with message `feat: route testing strategy by behavioral risk`.

### Gate R2: Three-Component Method Validation

- [ ] Review the single Task 7 selected-component batch for only the three Phase 1 component IDs. For each, freeze one positive and one negative prompt, force the component on and off, and repeat each condition three times: no more than 36 complete agent sessions total. Gate R2 evaluates this batch and must not rerun it.
- [ ] Report component efficacy and component non-interference separately; never average a catastrophic failure into a favorable cost result.
- [ ] Confirm that the pinned judge and owner-audit protocol was followed and report all disagreements and limitations.
- [ ] Decide separately for each component: keep, narrow, conditional, or quarantine candidate. R2 does not authorize deletion or a default-profile change.
- [ ] Any Phase 2 work, 54-run framework pilot, or larger held-out set requires a newly scoped budget and a fresh G1 approval.

### Task 5: Unify Execution and Review Orchestration (Phase 2 Backlog)

Do not execute this task during Phase 1. It starts only after Gate R2 and a new G1 approval naming the exact components and evaluation budget.

**Files:**

- Modify: `skills/subagent-driven-development/SKILL.md`
- Create: `skills/subagent-driven-development/references/execution-modes.md`
- Modify: `skills/executing-plans/SKILL.md`
- Modify: `skills/dispatching-parallel-agents/SKILL.md`
- Modify: `skills/requesting-code-review/SKILL.md`

**Interfaces:**

- Consumes: plan task graph, write sets, risk, and available agent slots.
- Produces: inline, serial, or delegated execution plus task-level or branch-level review scope.

- [ ] Add mode selection that keeps short or tightly coupled work inline.
- [ ] Migrate unique serial and checkpoint behavior from `executing-plans` before turning it into a compatibility alias.
- [ ] Require explicit file ownership and integration verification for parallel agents.
- [ ] Limit independent reviewers to material task boundaries and high-risk/merge gates.
- [ ] Verify that complex independent tasks still use parallelism and that five-line changes do not.
- [ ] Commit with message `feat: unify inline serial and delegated execution`.

### Task 6: Preserve the Reliability Floor (Phase 2 Backlog)

During Phase 1, audit invariant behavior but do not rewrite these Skills. Behavioral edits start only after Gate R2 and a new G1 approval.

**Files:**

- Modify: `skills/systematic-debugging/SKILL.md`
- Modify: `skills/verification-before-completion/SKILL.md`
- Modify: `skills/receiving-code-review/SKILL.md`
- Modify: `skills/using-git-worktrees/SKILL.md`
- Modify: `skills/finishing-a-development-branch/SKILL.md`

**Interfaces:**

- Consumes: risk class, claimed completion, repository state, and review evidence.
- Produces: required evidence, safe workspace action, and unresolved-risk report.

- [ ] Keep completion evidence mandatory in all profiles, with targeted/proportional/full scopes.
- [ ] Allow emergency mitigation only when labeled as mitigation and paired with an explicit root-cause follow-up.
- [ ] Preserve destructive cleanup confirmation and worktree provenance checks.
- [ ] Trigger worktree creation from collision risk, duration, or explicit request rather than plan existence alone.
- [ ] Evaluate style-only review language separately from technical verification behavior.
- [ ] Commit with message `refactor: preserve reliability gates across workflow profiles`.

### Task 7: Run Staged Evaluations

This is a cross-cutting evidence task invoked at R0, R1, and R2; its numbering does not place the micro-pilot after the Phase 2 backlog tasks.

**Files:**

- Create: `docs/superpowers/evals/frontier-workflow-protocol.md`
- Create: `docs/superpowers/evals/router-pilot-results.md`
- Create: `docs/superpowers/evals/directional-micro-pilot-results.md`
- Create: `docs/superpowers/evals/selected-component-pilot-results.md`
- Create only after separate approval: `docs/superpowers/evals/frontier-workflow-pilot-results.md`
- Create only after separate approval: `docs/superpowers/evals/frontier-workflow-held-out-results.md`

**Interfaces:**

- Consumes: immutable branch SHAs for the variants authorized at the current Gate, anonymized fixtures, the pinned judge protocol, and the approved session budget.
- Produces: per-task safety, quality, cost, routing, judge, and owner-audit evidence for the current stage.

- [ ] Run the minimum fixture-based harness smoke before formal measurement; do not count infrastructure debugging as component evidence.
- [ ] Pass operational-core preflight before comparing advisory behavior.
- [ ] Run component efficacy, routing, component non-interference, and framework non-interference as separate protocols.
- [ ] Complete and publish the 12-session micro-pilot before requesting the selected-component budget.
- [ ] Complete no more than the 36-session three-component pilot before requesting any framework matrix.
- [ ] Run a 54-session A/B/C framework pilot only after R2 and a separately approved budget; do not change prompts, candidate SHA, or judge criteria mid-run.
- [ ] Recalculate the held-out sample from observed variance and effect size. The section 6.4 ceiling of `12 unseen tasks × 3 variants × 3 repetitions = 108 sessions` may be used only after separate approval, and the owner audit must never be described as independent human blind judging.
- [ ] Repeat only the necessary held-out evidence on a second approved capability profile after the first profile produces a promotion candidate.
- [ ] Commit raw result references and summarized evidence; do not claim improvement from selected examples.

### Task 8: Human Promotion Gate

**Files:**

- Modify: `README.md` only if the frontier profile is approved.
- Modify: `RELEASE-NOTES.md` only for a tagged fork release.

**Interfaces:**

- Consumes: complete diff, evidence required by the current stage, regression list, judge/audit limitations, and rollback SHA.
- Produces: approve, revise, quarantine, or reject decision.

- [ ] Present the complete branch diff and evaluation evidence to the human owner.
- [ ] Produce separate recommendations for default, optional, and quarantine states. Apply none of them inside Task 8: component quarantine requires a new G2 decision, and changing the fork default requires a separate G3 decision.
- [ ] Keep `full` available as a stable fallback for at least one release cycle.
- [ ] Do not open an upstream PR as part of this plan; upstream contribution requires a separate user decision and contributor-guideline audit.
- [ ] If approved, commit documentation with message `docs: publish frontier workflow profile evidence`.

## 8. Human Governance Gates

| Gate | Authorizes | Does not authorize |
|---|---|---|
| G0 Scope approval | read-only inventory, contracts, provenance, and baseline capture | canonical Skill edits |
| G1 Experiment approval | edits to the exact named experimental-fork variant plus its frozen measurement budget | canonical/default replacement, quarantine, or deletion |
| G2 Component quarantine | disable one measured candidate component in an isolated replacement and observe | deleting the enclosing Skill or changing the default profile |
| G3 Default promotion | make an evaluated profile the fork default with `full` retained as fallback | physical deletion or upstream PR |
| G4 Physical deletion | delete the exact component or legacy alias after dependency rescan, replacement verification, observation, and restore drill | any unlisted path |
| G5 Upstream proposal | prepare a separately reviewed PR against upstream `dev` | merging, force-pushing, or bypassing contributor requirements |

Every Gate requires the exact targets, immutable SHAs, evidence bundle, unresolved risks, and rollback artifact. Approval at one Gate cannot be reused as approval for the next.

R0, R1, and R2 are technical evidence Gates inside G1. Passing one does not carry its experiment authorization forward: every next stage must name its exact candidate SHA, components, fixtures, judge protocol, session ceiling, estimated token/time cost, and stop rule, then receive a fresh G1 approval.

## 9. Rollback Strategy

- Every behavior family lands in a separate commit.
- The `full` profile remains behaviorally equivalent to the v6.1.1 baseline until held-out promotion passes.
- A failed component is reverted or quarantined without reverting independent improvements.
- The fork branch is experimental; local installations must pin an immutable commit rather than follow the moving branch.
- Deleting legacy aliases, changing the default profile, or proposing upstream integration each requires a separate human approval.
- Quarantine disables only the measured candidate component; the enclosing Skill remains discoverable while any retained component remains.
- Physical deletion requires a fresh inbound-reference scan, replacement smoke test, observation record, matching backup hash, and successful restore drill.

## 10. Definition of Done

### 10.1 Phase 1 Exit

Phase 1 reaches an accountable exit only when these common requirements are met:

- the entrypoint inventory covers every registered hook, bootstrap, cache, reinjection, context-include, and native-discovery surface, with a router-source binding, `test_status`, evidence classification, gap reason, and owner; only a supported harness proposed for promotion must have `live_e2e` evidence;
- Floor, Not Ceiling v0.2 provenance is pinned and every known local mirror has a recorded `sync`, `archive`, or `deliberately_unmanaged` decision;
- component contracts cover the three Phase 1 candidates and every routing instruction changed to expose them;
- every mandatory component states its real enforcement mechanism and authority model;
- R0 publishes at least 30 high-risk route-only decisions, raw decisions, observed misses, case/session analysis, and per-case and aggregate one-sided 95% upper bounds without claiming a true zero miss rate; zero misses and the registered precision/recall thresholds are required to continue, not to record a valid rejected outcome;
- the pinned LLM judge and owner-audit protocol is reproducible and its independence limitations are explicit;
- no Phase 2 Skill was edited under a Phase 1 approval.
- differential fixtures show that `superpowers=full` remains behaviorally equivalent to the pinned v6.1.1 baseline across routing, injection shape, mandatory gates, and representative workflow paths.

Phase 1 then exits through exactly one of three outcomes:

1. **R0 rejected:** one or more high-risk misses or a preregistered routing threshold fails; the complete result package and rejection rationale are published; no downstream Skill edit or component-efficacy claim is made.
2. **R1 early stop:** all twelve directional micro-pilot sessions are reproducible from immutable SHAs; the missing cost/quality direction and stop rationale are published; no TDD efficacy, three-component validation, framework, or retirement claim is made.
3. **R2 method validation:** all twelve directional sessions and no more than 36 selected-component sessions are reproducible; each of the three candidates has a separate efficacy and non-interference decision: keep, narrow, conditional, or quarantine candidate.

All three are valid completed measurement outcomes. Only the R2 outcome can unlock Phase 2 or a larger matrix, and no outcome automatically authorizes the 54- or 108-session designs.

### 10.2 Full Initiative Completion

The complete initiative is finished only when the promoted scope requires it and:

- component contracts cover every changed instruction;
- every evaluation run is bound to an approved capability profile;
- routing tests include positive, negative, collision, override, and high-risk adversarial cases;
- invariant safety and completion evidence remain active in every profile;
- operational-core, component efficacy, routing, component non-interference, and framework non-interference results are reported separately;
- every conditionally approved framework or held-out evaluation is reproducible from immutable SHAs and its frozen judge protocol;
- frontier quality is non-inferior to full Superpowers;
- mechanical and bounded work meets the 25% median token or time reduction target;
- a second approved frontier capability profile validates only the claims required for default promotion, if a default promotion is proposed;
- the human owner reviews the complete diff and explicitly approves any default change.
