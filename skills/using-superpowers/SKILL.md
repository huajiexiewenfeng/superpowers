---
name: using-superpowers
description: Use at conversation start to route Skills by explicit profile, task risk, and expected benefit while preserving mandatory safety and completion evidence
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, ignore this skill.
</SUBAGENT-STOP>

## Route Before Acting

Resolve the workflow route before the first response or action that depends on it. The route has five fields:

- `requested_profile`: `full`, `frontier`, or `off`
- `effective_profile`: the profile after applying the mandatory risk floor
- `task_class`: `mechanical`, `bounded`, `complex`, or `high_risk`
- `mandatory_components`: non-waivable controls, operational Skills, and evidence requirements
- `advisory_components`: optional workflow Skills whose expected benefit is positive

Read `references/frontier-routing.md` when the route is not immediately clear, when directives conflict, or when the task may be high risk. Do not infer a model identity or capability tier from a model name.

## Mandatory Floor First

The mandatory floor is independent of the advisory profile:

- obey host permissions and approval boundaries;
- obtain action-specific confirmation for destructive or irreversible operations;
- load applicable operational Skills that contain required facts, procedures, tools, state, or policy gates;
- keep fresh completion evidence active in every profile;
- treat authentication, authorization, secrets, security, release, migration, destructive data changes, and data-loss or rollback exposure as `high_risk`.

For `high_risk`, or when high-risk classification cannot be ruled out, set `effective_profile=full`. Required safety, testing, review, and verification controls fail closed at their real enforcement boundary: if permission, action-specific approval, or required evidence cannot be obtained, stop before the affected action and report the blocker. Prompt text alone is best-effort and is not a deterministic permission boundary.

## Select the Advisory Profile

Apply these rules after fixing the mandatory floor:

1. Honor an explicit `superpowers=full`, `superpowers=frontier`, or `superpowers=off` directive.
2. Otherwise, a natural-language request to skip the framework selects `off` for advisory components.
3. Otherwise, use a configured `frontier` default only when its complete capability profile is approved and current.
4. Fall back to `full` when configuration or capability evidence is unknown.

`off` disables inferred advisory workflow only. It cannot remove the mandatory floor. A specifically requested Skill remains selected unless the user explicitly retracts that request.

## Classify the Task

Use the highest applicable class:

| Class | Evidence | Frontier advisory behavior |
|---|---|---|
| `mechanical` | Exact scope, no behavioral change, one local transformation | `no_advisory_workflow` unless a Skill is explicitly requested |
| `bounded` | Isolated behavior change with clear acceptance criteria | Select only directly useful domain or process Skills |
| `complex` | Material ambiguity, cross-module ownership, or multi-stage integration | Select relevant design, planning, debugging, and domain Skills |
| `high_risk` | Security, release, migration, destructive data, or rollback exposure | Force `effective_profile=full` and the complete risk floor |

When classification is materially uncertain, choose the higher class. `no_advisory_workflow` is a valid result, not a routing failure: execute directly, run the smallest relevant check, and report fresh evidence.

## Invoke the Selected Set

- Load all `mandatory_components` before the action they constrain.
- Load explicitly requested Skills.
- Under `full`, use the fixed v6.1.1 compatibility rules in `references/frontier-routing.md`.
- Under `frontier`, load only the selected advisory components; process Skills precede implementation Skills when both are selected.
- Under `off`, do not infer advisory components.
- Do not announce or create workflow artifacts when the advisory set is empty. When a Skill is selected, state its purpose briefly and follow its current instructions.

## Platform Adaptation

If your harness appears here, read its reference file for special instructions:

- Codex: `references/codex-tools.md`
- Pi: `references/pi-tools.md`
- Antigravity: `references/antigravity-tools.md`

## User Instructions

User instructions (CLAUDE.md, AGENTS.md, GEMINI.md, etc, and direct requests) take precedence over skills. They may raise workflow intensity or disable advisory components, but they do not silently rewrite host permissions or policy-owned mandatory gates.
