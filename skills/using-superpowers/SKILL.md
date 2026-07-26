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
- `profile_source`: the explicit directive or validated configuration source that selected the requested profile
- `task_class`: `mechanical`, `bounded`, `complex`, or `high_risk`
- `mandatory_components`: non-waivable controls, operational Skills, and evidence requirements
- `advisory_components`: exact discoverable Skill identifiers for optional workflows whose expected benefit is positive

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
3. Otherwise, an explicitly activated local `trial` configuration may select its default for eligible non-high-risk tasks. Trial activation is reversible dogfood, not capability approval.
4. Otherwise, a validated user-level `owner_default` configuration selects its `default_profile`. Owner preference is not capability approval.
5. Otherwise, use a configured `frontier` default only when its complete capability profile is approved and current.
6. Fall back to `full` when configuration or capability evidence is unknown.

`off` disables inferred advisory workflow only. It cannot remove the mandatory floor. A specifically requested Skill remains selected unless the user explicitly retracts that request.

The canonical user-level configuration is `${XDG_CONFIG_HOME}/superpowers/config.json`, falling back to `~/.config/superpowers/config.json` when XDG is unset. `SUPERPOWERS_CONFIG` may override only the discovery path and must be an absolute file path. Accept only the strict schema documented in `references/global-config.md`; never infer fields from a model name or reasoning level.

Some bootstrap integrations inject a validated `<superpowers_global_config>` record. Use that record as the global owner source. When no record is injected and no higher-priority directive already decides the route, run `scripts/resolve-config.mjs` from this Skill directory with the current task class and project directory, or read the canonical file using available host tools. Invalid or unreadable global configuration never partially applies: continue to an approved capability default, then conservative `full`, and report the diagnostic without exposing file contents.

During local dogfood, the project trial configuration lives at `.superpowers/frontier-trial.config.json` in the working repository. Apply it only when `mode=trial`, `status=active`, unexpired, and eligible for the current task class; ignore missing, malformed, inactive, expired, or ineligible trial configuration and continue to the global owner default. Explicit profile directives still win, and `high_risk` still forces `effective_profile=full`. If the active trial checkout provides `scripts/frontier-trial-log.mjs`, record one coarse completion event per real task without prompt, code, path, secret, or user-content fields.

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
- Copy every `advisory_components` value verbatim from the discoverable Skill registry. Never substitute an internal component-contract ID such as `brainstorming.universal_design_gate` for the discoverable Skill identifier `brainstorming`.
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
