# Frontier-Model Workflow Optimization Implementation Plan

> **Execution note:** This plan is self-contained. It must not depend on invoking the workflow being evaluated, and it must not edit multiple behavior-shaping components in one unreviewed batch.
>
> Chinese translation: [顶级模型工作流优化实施计划](./2026-07-19-frontier-model-workflow-optimization.zh-CN.md)

**Goal:** Adapt Superpowers for frontier reasoning models so that simple and bounded tasks avoid unnecessary workflow overhead while high-risk work retains strong safety, verification, and review guarantees.

**Architecture:** Replace the current all-or-nothing workflow with a component-aware router. The router selects `full`, `frontier`, or `off` advisory behavior from explicit user intent, task risk, task complexity, and declared model capability; invariant safety and verification components remain active in every profile. Changes are promoted only after held-out A/B/C evaluations show non-inferior quality and materially lower cost.

**Tech Stack:** Markdown skills, JSON evaluation fixtures, Node.js built-in test runner, shell-based plugin tests, and the external `superpowers-evals` harness for real agent sessions.

**Design basis:** [Floor, Not Ceiling](https://gist.github.com/huajiexiewenfeng/71da8bd8431ec51e56a2b02a83f34a60), proposal v0.2. The implementation unit is the component, and a component must name either the failure it prevents or the capability it enables.

## Global Constraints

- Base repository: `obra/superpowers` v6.1.1, commit `d884ae04edebef577e82ff7c4e143debd0bbec99`.
- Working fork: `huajiexiewenfeng/superpowers`.
- Working branch: `feat/frontier-model-workflow-optimization`.
- Keep the project zero-dependency; do not add runtime packages.
- User override takes precedence over risk, complexity, model tier, and defaults.
- Irreversible, security-sensitive, migration, release, and data-loss risks always force the required invariant components.
- Verification is always enabled; profiles may change verification scope, never eliminate evidence.
- A profile named `off` disables advisory workflow components only; it cannot disable permissions, destructive-action gates, or completion evidence.
- Prompt text alone is best-effort enforcement. A mandatory fail-closed gate must identify its runtime, permission, or deterministic enforcement boundary.
- Do not hardcode transient model product names in core policy. Harnesses may declare a capability tier; users may explicitly select a profile.
- Capability is bound to an evaluated model-and-runtime configuration, not inferred from a model-name wildcard or from the model's self-description.
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

The router resolves workflow intensity in this order:

1. explicit user instruction;
2. irreversible or high-risk operation;
3. task ambiguity and integration complexity;
4. declared model capability tier;
5. repository or organization default;
6. Superpowers conservative fallback.

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

| Skill | Component action | Planned result |
|---|---|---|
| `using-superpowers` | Replace the unconditional 1% trigger rule with the routing contract | Thin central router; mandatory components remain explicit |
| `brainstorming` | Keep ambiguity discovery; retire universal design gate | Skip mechanical work, compact path for bounded work, full path for ambiguous/complex work |
| `writing-plans` | Keep interfaces and global constraints; retire universal 2–5 minute granularity | Task boundaries sized by independent test/review value |
| `test-driven-development` | Keep red/green for behavior and regression risk; remove universal applicability | Strict, targeted, or not-applicable modes selected by change risk |
| `subagent-driven-development` | Add inline, serial, and delegated execution modes | One execution router instead of forcing delegation |
| `executing-plans` | Migrate unique serial/checkpoint behavior | Temporary alias, then retirement after compatibility evaluation |
| `dispatching-parallel-agents` | Keep independent-work parallelism | Add concurrency budget, write-set ownership, cancellation, and integration gate |
| `systematic-debugging` | Keep evidence and root-cause discipline | Permit explicitly labeled mitigation before full root cause when operational urgency requires it |
| `verification-before-completion` | Keep as invariant core | Always on; scope is targeted, proportional, or full |
| `requesting-code-review` | Keep merge/high-risk review | Do not force independent review for trivial changes |
| `receiving-code-review` | Keep technical verification | Remove style-only prohibitions that do not affect correctness if evaluation shows no benefit |
| `using-git-worktrees` | Keep isolation capability | Trigger for collision risk, long-lived work, or explicit request, not every planned change |
| `finishing-a-development-branch` | Keep test and destructive cleanup gates | Offer only context-relevant completion actions |

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
    capability-profile.test.mjs
    component-contracts.test.mjs
    routing-cases.json
    routing-policy.test.mjs
docs/superpowers/
  evals/
    capability-profile.schema.json
    profiles/
      frontier-candidate-001.json
  specs/
    2026-07-19-frontier-model-workflow-optimization-design.md
  plans/
    2026-07-19-frontier-model-workflow-optimization.md
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

Every run must record the exact capability profile and use the same model deployment, reasoning configuration, harness and router hashes, repository snapshot, task prompt, toolchain, permissions, timeout, and judge version.

### 6.4 Stages

1. Static validation: contracts, schemas, routing fixtures, inbound references, and immutable SHAs.
2. Harness smoke: six runs confirming capture, timing, token, test, and judge pipelines.
3. Router pilot: positive, negative, override, collision, no-advisory, and high-risk cases before any downstream Skill rewrite.
4. Component pilot: at least three repeated forced-on/forced-off trials per selected component and task class.
5. Framework pilot: six tasks × three variants × three repetitions = 54 runs.
6. Held-out promotion: twelve unseen tasks × three variants × three repetitions = 108 runs.
7. Cross-configuration validation: repeat the relevant held-out set on a second independently approved frontier capability profile.

### 6.5 Task Mix and Metrics

Each formal set must include mechanical, bounded, complex, and high-risk tasks. At least one task in each class must contain a tempting but unsafe shortcut so that under-routing is observable.

Quality and safety metrics:

- acceptance criteria completed;
- build and relevant tests pass;
- root cause resolved when the task requires it;
- no unrelated or out-of-scope edits;
- no permission, data-loss, security, secret-leak, rollback, or false-completion violation;
- maintainability blind score;
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
- high-risk under-routing count.

### 6.6 Promotion Rules

Apply a lexicographic decision rule: safety, then required quality, then cost.

- Any catastrophic safety or destructive-action failure blocks promotion and is never averaged away.
- Frontier quality must be non-inferior to A on held-out tasks; a lower quality result cannot be offset by token savings.
- Mechanical and bounded tasks should reduce median total tokens or wall-clock time by at least 25% relative to A.
- High-risk tasks may cost the same as A; the optimization target is correct routing, not universal cost reduction.
- C is promoted for a task class only when it matches B on quality and safety while using less cost.
- An unstable component becomes conditional or opt-in rather than deleted.
- Conflicting results trigger component-level investigation; do not compress them into an opaque composite score.

## 7. Implementation Tasks

### Task 1: Freeze Baseline and Component Contracts

**Files:**

- Create: `docs/superpowers/specs/2026-07-19-frontier-model-workflow-optimization-design.md`
- Create: `docs/superpowers/evals/capability-profile.schema.json`
- Create: `docs/superpowers/evals/profiles/frontier-candidate-001.json`
- Create: `skills/using-superpowers/references/component-contracts.json`
- Create: `tests/frontier-routing/capability-profile.test.mjs`
- Create: `tests/frontier-routing/component-contracts.test.mjs`

**Interfaces:**

- Consumes: upstream v6.1.1 Skill text and the component taxonomy in this plan.
- Produces: stable component IDs and immutable capability-profile records used by router tests and evaluation reports.

- [ ] Record every instruction targeted by this initiative with layer, kind, lifecycle, activation, binding, enforcement, failure mode, authority, maintenance, and owner.
- [ ] Record the exact model, reasoning, harness, router, toolchain, permission, benchmark, and candidate SHA for each evaluated capability profile.
- [ ] Write Node built-in tests that reject duplicate IDs, missing purpose, invalid lifecycle, incomplete capability profiles, and mandatory prompt-only components incorrectly labeled as deterministic.
- [ ] Run `node --test tests/frontier-routing/component-contracts.test.mjs tests/frontier-routing/capability-profile.test.mjs`; expect all schema tests to pass.
- [ ] Commit only contracts, schema tests, and the reviewed design with message `docs: define frontier workflow component contracts`.

### Task 2: Implement the Thin Central Router

**Files:**

- Modify: `skills/using-superpowers/SKILL.md`
- Create: `skills/using-superpowers/references/frontier-routing.md`
- Create: `tests/frontier-routing/routing-cases.json`
- Create: `tests/frontier-routing/routing-policy.test.mjs`

**Interfaces:**

- Consumes: component IDs and precedence from Task 1.
- Produces: profile, task class, required component set, and advisory component set.

- [ ] Replace the universal skill-invocation rule with explicit precedence and a compact task-class decision table.
- [ ] Preserve user instruction precedence and make high-risk fail-closed behavior explicit.
- [ ] Add positive, negative, collision, override, and no-advisory routing cases.
- [ ] Run `node --test tests/frontier-routing/*.test.mjs`; expect zero failures.
- [ ] Run existing plugin loading tests under `tests/`; expect no bootstrap or packaging regression.
- [ ] Commit with message `feat: add component-aware frontier workflow routing`.

### Gate R0: Router-Only Decision

Do not begin Tasks 3–6 merely because Task 2 is implemented.

- [ ] Freeze the router commit, registry, candidate definitions, capability profile, and permissions.
- [ ] Run positive, negative, natural-language opt-out, override, collision, no-advisory, and adversarial high-risk cases.
- [ ] Confirm zero high-risk under-routing and acceptable no-advisory precision/recall.
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
- [ ] Run routing tests and a focused real-session evaluation for mechanical, bounded, and ambiguous prompts.
- [ ] Commit with message `feat: make design and planning proportional to task risk`.

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
- [ ] Run routing tests and TDD behavioral evals; require zero high-risk under-routing.
- [ ] Commit with message `feat: route testing strategy by behavioral risk`.

### Task 5: Unify Execution and Review Orchestration

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

### Task 6: Preserve the Reliability Floor

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

### Task 7: Run Pilot and Held-Out Evaluations

**Files:**

- Create: `docs/superpowers/evals/frontier-workflow-protocol.md`
- Create: `docs/superpowers/evals/frontier-workflow-pilot-results.md`
- Create: `docs/superpowers/evals/frontier-workflow-held-out-results.md`

**Interfaces:**

- Consumes: immutable branch SHAs for A, B, and C plus blinded task fixtures.
- Produces: per-task safety, quality, cost, routing, and human preference evidence.

- [ ] Run the six-run harness smoke before formal measurement.
- [ ] Pass operational-core preflight before comparing advisory behavior.
- [ ] Run component efficacy, routing, component non-interference, and framework non-interference as separate protocols.
- [ ] Run the 54-run pilot without changing prompts or judge criteria mid-run.
- [ ] Fix only component-level regressions, then freeze a new candidate SHA.
- [ ] Run the 108-run held-out promotion set with independent blind judging.
- [ ] Repeat held-out validation on a second independently approved capability profile.
- [ ] Commit raw result references and summarized evidence; do not claim improvement from selected examples.

### Task 8: Human Promotion Gate

**Files:**

- Modify: `README.md` only if the frontier profile is approved.
- Modify: `RELEASE-NOTES.md` only for a tagged fork release.

**Interfaces:**

- Consumes: complete diff, held-out results, regression list, and rollback SHA.
- Produces: approve, revise, quarantine, or reject decision.

- [ ] Present the complete branch diff and evaluation evidence to the human owner.
- [ ] Confirm which components become default, optional, or quarantined.
- [ ] Keep `full` available as a stable fallback for at least one release cycle.
- [ ] Do not open an upstream PR as part of this plan; upstream contribution requires a separate user decision and contributor-guideline audit.
- [ ] If approved, commit documentation with message `docs: publish frontier workflow profile evidence`.

## 8. Human Governance Gates

| Gate | Authorizes | Does not authorize |
|---|---|---|
| G0 Scope approval | read-only inventory, contracts, provenance, and baseline capture | canonical Skill edits |
| G1 Experiment approval | isolated candidate variants and measurement | canonical replacement, quarantine, or deletion |
| G2 Component quarantine | disable one measured candidate component in an isolated replacement and observe | deleting the enclosing Skill or changing the default profile |
| G3 Default promotion | make an evaluated profile the fork default with `full` retained as fallback | physical deletion or upstream PR |
| G4 Physical deletion | delete the exact component or legacy alias after dependency rescan, replacement verification, observation, and restore drill | any unlisted path |
| G5 Upstream proposal | prepare a separately reviewed PR against upstream `dev` | merging, force-pushing, or bypassing contributor requirements |

Every Gate requires the exact targets, immutable SHAs, evidence bundle, unresolved risks, and rollback artifact. Approval at one Gate cannot be reused as approval for the next.

## 9. Rollback Strategy

- Every behavior family lands in a separate commit.
- The `full` profile remains behaviorally equivalent to the v6.1.1 baseline until held-out promotion passes.
- A failed component is reverted or quarantined without reverting independent improvements.
- The fork branch is experimental; local installations must pin an immutable commit rather than follow the moving branch.
- Deleting legacy aliases, changing the default profile, or proposing upstream integration each requires a separate human approval.
- Quarantine disables only the measured candidate component; the enclosing Skill remains discoverable while any retained component remains.
- Physical deletion requires a fresh inbound-reference scan, replacement smoke test, observation record, matching backup hash, and successful restore drill.

## 10. Definition of Done

This initiative is complete only when:

- component contracts cover every changed instruction;
- every mandatory component states its real enforcement mechanism and authority model;
- every evaluation run is bound to an approved capability profile;
- routing tests include positive, negative, collision, override, and high-risk adversarial cases;
- invariant safety and completion evidence remain active in every profile;
- operational-core, component efficacy, routing, component non-interference, and framework non-interference results are reported separately;
- pilot and held-out evaluations are reproducible from immutable SHAs;
- frontier quality is non-inferior to full Superpowers;
- mechanical and bounded work meets the 25% median token or time reduction target;
- a second independently approved frontier capability profile validates the routing policy;
- the human owner reviews the complete diff and explicitly approves any default change.
