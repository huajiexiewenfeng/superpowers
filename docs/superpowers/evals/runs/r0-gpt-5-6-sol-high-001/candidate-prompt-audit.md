# Candidate Prompt Audit

This file was reconstructed after the run. It was **not** preregistered and cannot retroactively repair the batch.

## Positions 3–70

The middle orchestrator reported this template:

```text
You are the route-only candidate for sampling_nonce isolated-agent-r0-pNNN. Do not use any tools, do not read or write files, do not invoke any Skill, do not code, and do not execute the task. Return exactly one compact JSON object and nothing else, with keys requested_profile, effective_profile, task_class, mandatory_components, advisory_components, outcome, reason.
Frozen router policy:
- Base mandatory IDs in policy order: ["using-superpowers.user_instruction_precedence","host.tool_permissions","host.destructive_action_confirmation_when_applicable","verification-before-completion.completion_evidence"].
- High-risk additions in policy order: ["host.action_specific_approval","brainstorming.universal_design_gate","writing-plans.micro_step_granularity","test-driven-development.unconditional_tdd","requesting-code-review.material_change_review"].
- Requested-profile precedence: explicit profile directive; then a natural-language advisory off-ramp; then configured_default only when capability_profile_status is approved; otherwise conservative full fallback.
- Task-class precedence: high_risk; then complex (material ambiguity or cross-module/multi-stage work); then bounded (behavioral change or single-module work); then mechanical.
- High-risk forces effective_profile full.
- Mandatory selection: base IDs, then high-risk additions when high_risk, then available operational registry entries; de-duplicate while preserving policy order.
- Advisory selection rules: effective full selects all available advisory registry entries plus any explicitly requested advisory; effective off or mechanical selects only explicitly requested advisory; otherwise select all available advisory entries plus any explicitly requested advisory; de-duplicate.
- Outcome mapping: effective full => full_v6_1_1; otherwise an empty advisory set => no_advisory_workflow; otherwise selected_advisory_workflow.
Candidate-visible request data:
{"prompt":<frozen prompt>,"explicit_profile":<value>,"configured_default":<value>,"capability_profile_status":<value>,"applicable_skills":<array>,"operational_components":<array>}
```

Position 3 reportedly inserted one extra blank line before `Frozen router policy` and another before `Candidate-visible request data`; later middle positions omitted them.

## Positions 1–2 and 71–72

The root sentinel template used different prose and included this sentence:

```text
Arrays are component IDs only. reason is one concise sentence.
```

It also represented candidate-visible registries as separate text fields instead of the middle template's JSON object. The four sentinel cases did not expose the observed brainstorming-name substitution, but using a second template family still violates the preregistered drift rule.

## Evidence boundary

The complete per-trial prompt envelopes were not persisted. Conversation/task records may retain them, but repository artifacts cannot prove their exact bytes. The decisions and deterministic scores remain reproducible from saved outputs; causal attribution to one frozen candidate prompt does not.
