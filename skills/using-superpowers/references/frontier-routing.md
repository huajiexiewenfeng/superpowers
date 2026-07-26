# Frontier Workflow Routing Contract

This reference is normative for the Task 2 router. It defines policy-table behavior, not a claim that a prompt can deterministically control a model.

## Enforcement Boundary

The router separates two sets:

1. **mandatory floor** — host permissions, action-specific destructive confirmation, required operational facts/procedures/tools/state, policy gates, and fresh completion evidence;
2. **advisory set** — design, planning, debugging, testing style, review style, and other workflow shaping selected for expected benefit.

Prompt text is best-effort. A mandatory component can **fail closed** only at its named real boundary, such as a tool permission, runtime policy, action-specific human approval, or deterministic evidence check. If a required boundary is absent or unsatisfied, the agent stops before the affected action and reports the blocker. It must not describe persuasive wording as fail-closed enforcement.

## Route Record

Resolve these fields before the first route-dependent action:

```text
requested_profile: full | frontier | off
effective_profile: full | frontier | off
profile_source: explicit_directive | natural_language_off_ramp | project_trial | global_owner_default | approved_capability_default | conservative_fallback
task_class: mechanical | bounded | complex | high_risk
mandatory_components: component IDs and required operational Skills
advisory_components: exact discoverable identifiers of selected optional workflow Skills
outcome: full_v6_1_1 | selected_advisory_workflow | no_advisory_workflow
```

`mandatory_components` may use internal component-contract IDs. `advisory_components` must not: each value is copied verbatim from the active Skill registry, including any namespace required by that registry. For example, use `brainstorming`, not `brainstorming.universal_design_gate`. This distinction is part of the route schema, not a presentation preference.

The route record may stay internal for routine work. Record it explicitly in evaluation runs, conflict cases, high-risk work, or when the user asks.

## Decision Order

### 1. Build the mandatory floor

Always retain:

- `using-superpowers.user_instruction_precedence`;
- host tool permissions;
- destructive-action confirmation when applicable;
- applicable operational Skills that contain non-public facts, procedures, tools, state, or policy gates;
- `verification-before-completion.completion_evidence` with scope proportional to the claim.

Add the complete high-risk floor when any plausible path affects authentication/authorization, security or secrets, release, migration, destructive data changes, data loss, backup integrity, or rollback capability. The high-risk floor includes design, plan, behavioral test evidence, material-change review, and full completion verification. Classification uncertainty elevates the task; it never lowers this floor.

### 2. Select `requested_profile`

Use the first matching rule:

1. exact `superpowers=full`, `superpowers=frontier`, or `superpowers=off`;
2. a natural-language advisory off-ramp such as “skip the framework this time” selects `off`;
3. an explicitly activated local trial default for an eligible non-high-risk task;
4. a validated user-level `owner_default`;
5. an approved and non-invalidated configured default;
6. conservative `full` fallback.

An explicit frontier directive is auditable user control; it does not make an unmeasured capability profile approved. The project trial and user-level owner default are also explicit owner preferences, not capability approval. Only a capability-derived automatic default requires an approved profile. Never infer approval from a provider name, model family, or wildcard.

An owner-authorized local dogfood configuration at `.superpowers/frontier-trial.config.json` is active only when `mode=trial`, `status=active`, and its expiry has not passed. It may automatically select `frontier` for the task classes listed in `routing.frontier_eligible_task_classes`. It never changes the high-risk floor, never marks a capability profile approved, and never supplies formal promotion evidence. Missing, invalid, inactive, expired, or ineligible trial configuration is ignored before continuing to the owner default.

The user-level owner default is separate from project dogfood. Discover it from `SUPERPOWERS_CONFIG` when that variable names an absolute file, otherwise from `${XDG_CONFIG_HOME}/superpowers/config.json`, falling back to `~/.config/superpowers/config.json`. Validate the strict `owner_default` schema in `global-config.md`. It applies across ordinary projects and does not require a local trial file. It records user preference only and never marks a capability profile approved. An invalid or unreadable owner config is ignored with a diagnostic before continuing to the approved default or conservative `full`.

### 3. Classify the task

Apply the first matching row:

| Priority | `task_class` | Classification evidence |
|---|---|---|
| 1 | `high_risk` | Any security, secret, release, migration, destructive-data, data-loss, recovery, or rollback exposure |
| 2 | `complex` | Material ambiguity, cross-module behavior, unclear ownership, or multi-stage integration |
| 3 | `bounded` | Isolated behavioral change or one module with clear acceptance criteria |
| 4 | `mechanical` | Exact local transformation with no intended behavioral change |

When evidence straddles classes, choose the higher class. A user calling risky work “mechanical” does not change its classification.

### 4. Derive `effective_profile`

- `high_risk` always yields `effective_profile=full`.
- Otherwise use `requested_profile`.
- If the selected profile cannot be resolved or its automatic-use evidence is invalid, use `full` without claiming that the model is weak.

### 5. Build the advisory set

- A specifically requested Skill remains selected even under `off`; the specific request scopes the otherwise-disabled advisory set.
- `full`: select every applicable Skill using the fixed v6.1.1 compatibility behavior below.
- `frontier` + `mechanical`: select only explicitly requested advisory Skills; an empty set yields `no_advisory_workflow`.
- `frontier` + `bounded`: select only directly useful domain or process Skills.
- `frontier` + `complex`: select relevant design, planning, debugging, and domain Skills; process Skills come before implementation Skills.
- `off`: select no inferred advisory Skills.

`no_advisory_workflow` does not disable operational Skills, permissions, confirmation, or verification. It means that no additional reasoning workflow has positive expected value for this task.

## Explicit Conflict Rules

- A direct request for one named Skill plus `superpowers=off` selects that named Skill and disables other inferred advisory Skills.
- A natural-language off-ramp plus a high-risk task still yields `effective_profile=full`.
- A repository or organization policy can impose a mandatory component. Chat instructions cannot remove it; only the named policy authority can change the policy through an intentional configuration change.
- If two same-authority directives genuinely conflict and ordering cannot resolve them, ask one focused question before acting. Do not use clarification to defer facts discoverable from the repository.

## Fixed `full` Compatibility Path

`superpowers=full` preserves the pinned v6.1.1 `using-superpowers` behavior. This is a compatibility contract, not the default for an approved frontier profile.

The following rules retain their original meaning:

If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

**Invoke relevant or requested skills BEFORE any response or action** — including clarifying questions, exploring the codebase, or checking files. If it turns out wrong for the situation, you don't have to use it.

**Before entering plan mode:** if you haven't already brainstormed, invoke the brainstorming skill first.

Then announce "Using [skill] to [purpose]" and follow the skill exactly. If it has a checklist, create a todo per item.

When multiple skills apply, process skills come first — they set the approach, then implementation skills (frontend-design, etc.) carry it out. Brainstorming and systematic-debugging are Superpowers' most common process skills, but the rule holds for any of them.

Representative v6.1.1 routes remain:

| Trigger | Ordered route |
|---|---|
| `Let's build X` | `brainstorming` → `implementation-skill` |
| `Fix this bug` | `systematic-debugging` → `domain-skill` |
| `Enter plan mode without prior design` | `brainstorming` → `writing-plans` |
| `Claim the implementation is complete` | `verification-before-completion` |
| `Implement approved behavior under full` | `test-driven-development` → `requesting-code-review` → `verification-before-completion` |

The pinned source fixture is `tests/frontier-routing/fixtures/using-superpowers-v6.1.1.md`. Any intentional change to `full` requires separate approval and a new compatibility baseline; it cannot be hidden inside frontier routing.

## Evidence Limits

The JSON routing cases and Node tests prove only that this deterministic policy table is self-consistent. They do not prove that a stochastic model will classify natural-language tasks correctly. R0 therefore uses fresh route-only model sessions and reports observed misses plus uncertainty bounds before any downstream Skill experiment.

Local trial records are directional dogfood evidence. They may generate a focused hypothesis or justify a rollback, but they do not replace a preregistered held-out evaluation. The trial logger records route fields and coarse outcome labels only; it must not record prompts, code, repository paths, secrets, or user content.
