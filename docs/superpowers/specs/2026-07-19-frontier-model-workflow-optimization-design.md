# Frontier-Model Workflow Optimization: Task 1 Design Baseline

> Status: Task 2 router candidate
> Captured: 2026-07-20
> Fork branch: `feat/frontier-model-workflow-optimization`
> Fork baseline: `e221c35624d9082c6984a92e6c5c7b9db259c5d0`
> Upstream baseline: `d884ae04edebef577e82ff7c4e143debd0bbec99`

## 1. Purpose

This document fixes the evidence and governance boundary for optimizing Superpowers under frontier-model capability. It translates the Floor, Not Ceiling proposal into repository-level contracts before any runtime behavior changes.

The default unit of analysis and retirement is a **component inside a Skill**, not the whole Skill. The work distinguishes:

1. invariant operational controls that remain valuable as models improve;
2. intentional shaping that encodes an explicit workflow preference;
3. compensatory shells that may have been needed for weaker model capability;
4. harness entrypoints that determine what text is actually loaded;
5. capability profiles that bind conclusions to the evaluated model, reasoning configuration, router, tools, permissions, benchmark suite, and commit.

## 2. Scope and non-goals

Task 1 creates only governance and evaluation artifacts:

- source provenance;
- bootstrap and native-discovery entrypoint inventory;
- component contracts;
- a zero-dependency capability-profile schema and an honest unmeasured candidate;
- deterministic tests for these artifacts.

Task 1 does **not**:

- modify any existing `SKILL.md` behavior;
- replace `using-superpowers` routing;
- enable a frontier profile;
- claim that a model or workflow has been evaluated;
- promote any harness entrypoint to live-E2E status;
- delete, rename, or retire a Skill or component.

## 3. Design basis and provenance

The canonical conceptual source is the published Gist `Floor, Not Ceiling — Building Agent Skill Systems for Stronger Models`, proposal v0.2, revision `d283da2e45f04363bc70734f88abed8a69c437eb`.

`docs/superpowers/evals/source-provenance.json` records the Gist revision and hash, repository baselines, and the disposition of known local mirrors. The published Gist is canonical. Local English and Chinese v0.1 copies require a separately approved, backup-first synchronization; an edited workspace derivative remains deliberately unmanaged.

## 4. Component contracts

`skills/using-superpowers/references/component-contracts.json` binds every baseline component to current source bytes and a text selector. A component contract states:

- the failure prevented or capability enabled;
- activation or mandatory conditions;
- advisory versus mandatory intent;
- enforcement mechanism and the strength of its claim;
- fail-open, fail-closed, or report-only behavior;
- policy owner and satisfier;
- freshness, compatibility, and evaluation obligations;
- component-scoped Phase 1 action.

Prompt text can only claim best-effort enforcement. A mandatory rule expressed only in a prompt is therefore recorded as fail-open, not as a deterministic fail-closed boundary.

The first experimental slice is intentionally limited to three compensatory-shell candidates:

- `brainstorming.universal_design_gate`;
- `writing-plans.micro_step_granularity`;
- `test-driven-development.unconditional_tdd`.

Each target has an explicitly retained neighboring capability. No whole Skill is a deletion candidate in Task 1.

## 5. Proposed routing controls

Task 1 recorded three proposed router components; Task 2 implements them in the candidate branch:

- `using-superpowers.explicit_profile_override` — an explicit, auditable profile selection outranks inferred model identity;
- `using-superpowers.mandatory_risk_floor` — irreversible or high-risk work cannot be routed below its required controls;
- `using-superpowers.no_advisory_workflow` — loading no advisory workflow is a legitimate outcome for bounded low-risk work.

These controls were implemented after G1 approval. The precedence under test is mandatory risk floor, explicit user profile and Skill instructions, task evidence, approved configured capability profile, then conservative `full` fallback. User instructions can raise intensity or disable advisory components, but cannot silently remove host permissions or policy-owned gates.

## 6. Capability profile lifecycle

`docs/superpowers/evals/capability-profile.schema.json` defines four states:

- `not_evaluated` — bindings are incomplete and approval is pending;
- `evaluated` — the bound configuration has evidence but is not approved for default use;
- `approved` — all bindings are resolved and approval identity and time are recorded;
- `invalidated` — a binding changed or evidence expired.

The candidate at `docs/superpowers/evals/profiles/frontier-candidate-001.json` is deliberately `not_evaluated`. It does not infer the active model and does not claim frontier behavior. All seven required bindings are null and listed as missing.

## 7. Bootstrap and native entrypoints

`docs/superpowers/evals/bootstrap-entrypoints.json` enumerates the real loading surfaces for Claude Code, Cursor, Copilot CLI, Factory Droid, Antigravity, OpenCode, Pi, Kimi, Codex, and legacy Gemini.

The inventory separates:

- registration mode;
- files that form the entrypoint;
- full-Skill, body-only, native-loading, and native-discovery shapes;
- injection events, caching, deduplication, and missing-source behavior;
- enforcement boundary and failure mode;
- static, shared-script, live-E2E, and legacy evidence levels.

No supported harness is selected for promotion in Task 1 because none has live-E2E evidence for the proposed routing behavior. Codex's explicit empty `hooks` object remains a negative control: Codex uses native Skill discovery and must not fall back to the Claude bootstrap.

## 8. Known evidence gaps

The baseline explicitly records missing mapping references for Claude Code, Copilot, and Gemini, and a missing Antigravity installer path still referenced by documentation. Missing files are evidence gaps, not implicit entrypoints.

The existing shared hook tests exercise the session-start script. OpenCode and Pi have implementation-level tests, and Kimi and Codex have manifest tests. These do not yet establish live harness-level behavior for component-aware routing.

On the captured Windows baseline, the shared SessionStart suite passes all five checks, the Kimi and Codex manifest checks pass, and OpenCode's separate caching and reused-message deduplication checks pass. The OpenCode plugin-registration check depends on POSIX-compatible symlink behavior and fails in the current Windows/MSYS temporary directory. Pi passes five lifecycle checks when Node 22 experimental TypeScript stripping is enabled, then fails its existing tool-mapping assertion because the unchanged reference lacks the expected lowercase `write` mapping. The unchanged Antigravity static mapping test fails because its reference does not document `view_file`; no live Antigravity test exists. The Codex package-archive test could not be completed because the available Windows Python cannot resolve the MSYS `/d` repository path embedded by that shell test, while the Codex manifest negative control passes. These are disclosed baseline or local-environment gaps and are not attributed to the Task 2 router.

## 9. Deterministic Task 1 checks

The zero-dependency Node tests under `tests/frontier-routing/` verify:

- component IDs, lifecycle and enforcement claims;
- exact source hashes and selectors;
- retained neighbors for each Phase 1 target;
- capability-profile state and unresolved bindings;
- entrypoint registration, loading shape, hashes, gaps, and evidence status;
- Codex empty-hook and legacy Gemini reference controls.

These tests validate the governance baseline. They do not measure model behavior.

## 10. Gate boundary

Task 1 completes at G1 when:

- all governance artifacts parse and pass deterministic tests;
- the working diff contains no modification to existing Skill behavior;
- provenance and hashes match the pinned baselines;
- the exact Phase 1 component slice is visible;
- no profile or entrypoint is represented as evaluated or promoted.

G1 approval authorizes design-baseline acceptance only. It cannot be reused as authorization for Task 2 runtime changes, experiments, quarantine, deletion, or publication beyond the already authorized branch push.
