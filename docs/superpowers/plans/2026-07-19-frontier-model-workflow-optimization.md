# Frontier-Model Workflow Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` in `serial` mode for policy changes and `delegated` mode only for independent evaluation runs. Do not edit multiple behavior-shaping skills in one unreviewed batch.

**Goal:** Adapt Superpowers for frontier reasoning models so that simple and bounded tasks avoid unnecessary workflow overhead while high-risk work retains strong safety, verification, and review guarantees.

**Architecture:** Replace the current all-or-nothing workflow with a component-aware router. The router selects `full`, `frontier`, or `off` advisory behavior from explicit user intent, task risk, task complexity, and declared model capability; invariant safety and verification components remain active in every profile. Changes are promoted only after held-out A/B/C evaluations show non-inferior quality and materially lower cost.

**Tech Stack:** Markdown skills, JSON evaluation fixtures, Node.js built-in test runner, shell-based plugin tests, and the external `superpowers-evals` harness for real agent sessions.

## Global Constraints

- Base repository: `obra/superpowers` v6.1.1, commit `d884ae04edebef577e82ff7c4e143debd0bbec99`.
- Working fork: `huajiexiewenfeng/superpowers`.
- Working branch: `feat/frontier-model-workflow-optimization`.
- Keep the project zero-dependency; do not add runtime packages.
- User override takes precedence over risk, complexity, model tier, and defaults.
- Irreversible, security-sensitive, migration, release, and data-loss risks always force the required invariant components.
- Verification is always enabled; profiles may change verification scope, never eliminate evidence.
- A profile named `off` disables advisory workflow components only; it cannot disable permissions, destructive-action gates, or completion evidence.
- Do not hardcode transient model product names in core policy. Harnesses may declare a capability tier; users may explicitly select a profile.
- Change one behavior family per commit so evaluation regressions can be attributed.
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
- failure prevented or capability enabled;
- activation condition;
- advisory or mandatory binding;
- enforcement mechanism;
- fail-open, fail-closed, or report-only behavior;
- owner and evaluation cases.

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
    component-contracts.test.mjs
    routing-cases.json
    routing-policy.test.mjs
docs/superpowers/
  specs/
    2026-07-19-frontier-model-workflow-optimization-design.md
  plans/
    2026-07-19-frontier-model-workflow-optimization.md
```

### External evaluation workspace

The real behavioral runs belong in a separate fork of `prime-radiant-inc/superpowers-evals`. This core branch records the evaluation protocol and result summaries, but does not vendor the eval harness or add it as a dependency.

## 6. Evaluation Design

### 6.1 Variants

- A: upstream Superpowers v6.1.1, full current workflow;
- B: this branch with `superpowers=frontier`;
- C: this branch with advisory workflow disabled.

Runs must use the same model build, reasoning setting, harness version, repository snapshot, task prompt, tool permissions, and timeout.

### 6.2 Stages

1. Harness smoke: six runs confirming capture, timing, token, test, and judge pipelines.
2. Pilot: six tasks × three variants × three repetitions = 54 runs.
3. Held-out promotion: twelve unseen tasks × three variants × three repetitions = 108 runs.
4. Cross-model validation: repeat the held-out set on a second frontier-model family before declaring the profile portable.

### 6.3 Task Mix

Each formal set must include mechanical, bounded, complex, and high-risk tasks. At least one task in each class must contain a tempting but unsafe shortcut so that under-routing is observable.

### 6.4 Metrics

Quality gates:

- acceptance criteria completed;
- build and relevant tests pass;
- root cause resolved when the task requires it;
- no unrelated or out-of-scope edits;
- no permission, data-loss, security, or false-completion violation;
- maintainability blind score.

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
- no-advisory precision;
- high-risk under-routing count.

### 6.5 Promotion Rules

Evaluate in this order: safety, quality, then cost.

- Any catastrophic safety or destructive-action failure blocks promotion.
- Frontier quality must be non-inferior to A on held-out tasks; a lower average cannot be offset by token savings.
- Mechanical and bounded tasks should reduce median total tokens or wall-clock time by at least 25% relative to A.
- High-risk tasks may cost the same as A; the optimization target is correct routing, not universal cost reduction.
- C is promoted for a task class only when it matches B on quality and safety while using less cost.
- Conflicting results trigger component-level investigation; do not average them into a single score.

## 7. Implementation Tasks

### Task 1: Freeze Baseline and Component Contracts

**Files:**

- Create: `docs/superpowers/specs/2026-07-19-frontier-model-workflow-optimization-design.md`
- Create: `skills/using-superpowers/references/component-contracts.json`
- Create: `tests/frontier-routing/component-contracts.test.mjs`

**Interfaces:**

- Consumes: upstream v6.1.1 Skill text and the component taxonomy in this plan.
- Produces: stable component IDs used by router tests and evaluation reports.

- [ ] Record every instruction targeted by this initiative with lifecycle, activation, binding, failure mode, and owner.
- [ ] Write a Node built-in test that rejects duplicate IDs, missing purpose, invalid lifecycle, and mandatory prompt-only components incorrectly labeled as deterministic.
- [ ] Run `node --test tests/frontier-routing/component-contracts.test.mjs`; expect all contract-schema tests to pass.
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
- [ ] Run the 54-run pilot without changing prompts or judge criteria mid-run.
- [ ] Fix only component-level regressions, then freeze a new candidate SHA.
- [ ] Run the 108-run held-out promotion set with independent blind judging.
- [ ] Repeat held-out validation on a second frontier-model family.
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

## 8. Rollback Strategy

- Every behavior family lands in a separate commit.
- The `full` profile remains behaviorally equivalent to the v6.1.1 baseline until held-out promotion passes.
- A failed component is reverted or quarantined without reverting independent improvements.
- The fork branch is experimental; local installations must pin an immutable commit rather than follow the moving branch.
- Deleting legacy aliases, changing the default profile, or proposing upstream integration each requires a separate human approval.

## 9. Definition of Done

This initiative is complete only when:

- component contracts cover every changed instruction;
- routing tests include positive, negative, collision, override, and high-risk adversarial cases;
- invariant safety and completion evidence remain active in every profile;
- pilot and held-out evaluations are reproducible from immutable SHAs;
- frontier quality is non-inferior to full Superpowers;
- mechanical and bounded work meets the 25% median token or time reduction target;
- a second frontier-model family validates the routing policy;
- the human owner reviews the complete diff and explicitly approves any default change.

