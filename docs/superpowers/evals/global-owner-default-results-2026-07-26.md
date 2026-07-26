# Global Owner Default — Implementation and Smoke Results

> Date: 2026-07-26
>
> Scope: user-level global profile discovery, strict parsing, profile precedence, risk floor, bootstrap/native-loader integration, and local installation
>
> Explicitly excluded: PDC routing, `.llm-wiki` lifecycle, `bounded-delivery`, and downstream workflow component behavior

## Implemented behavior

- Canonical config: `${XDG_CONFIG_HOME}/superpowers/config.json`, falling back to `~/.config/superpowers/config.json`.
- Optional `SUPERPOWERS_CONFIG`: absolute discovery-path override only.
- Strict owner schema:

  ```json
  {
    "schema_version": 1,
    "mode": "owner_default",
    "default_profile": "frontier"
  }
  ```

- Requested-profile precedence:

  1. explicit `superpowers=full|frontier|off`;
  2. natural-language advisory off-ramp;
  3. active, unexpired, eligible project trial;
  4. validated global owner default;
  5. approved capability default;
  6. conservative `full`.

- `high_risk` always forces `effective_profile=full`.
- Invalid, expired, ineligible, unreadable, or missing inputs do not partially apply.
- Model ID and reasoning effort are not accepted by the owner config.

## Codex sandbox adapter

The current Codex sandbox returned `EPERM` for
`C:\Users\admin\.config\superpowers\config.json` even though Windows ACL inspection showed the current user had full control. A hard link remained blocked because the sandbox followed the same file identity.

The installed Codex Skill therefore uses a generated read-only snapshot only when the canonical read fails with `EACCES` or `EPERM`:

```text
C:\Users\admin\.agents\skills\using-superpowers\.runtime\owner-config.json
C:\Users\admin\.agents\skills\using-superpowers\.runtime\owner-config.provenance.json
```

The provenance record binds:

- canonical path;
- generation timestamp;
- canonical SHA-256;
- snapshot SHA-256.

The resolver rejects a modified snapshot. The canonical file remains authoritative and must be resynchronized after a user change.

## Deterministic verification

Command:

```text
node --test tests/frontier-routing/global-config.test.mjs
```

Result: `12 passed, 0 failed`.

Covered claims:

- ordinary workspace uses global Frontier without a project trial;
- active project trial still overrides the global default;
- missing, expired, malformed, and ineligible trials fall through;
- explicit Full, Frontier, and Off win;
- high-risk work becomes effective Full;
- missing global config uses approved default and then conservative Full;
- malformed or schema-invalid owner config never partially applies;
- environment, XDG, home fallback, Windows, and POSIX path behavior;
- access-blocked canonical config uses only a provenance-verified snapshot;
- bootstrap metadata excludes model identity, reasoning effort, task content, and paths;
- OpenCode bootstrap consumes the shared resolver.

Additional targeted suite:

```text
node --test \
  tests/frontier-routing/bootstrap-entrypoints.test.mjs \
  tests/frontier-routing/full-profile-equivalence.test.mjs \
  tests/frontier-routing/global-config.test.mjs \
  tests/frontier-routing/frontier-trial.test.mjs
```

Result: `30 passed, 0 failed`.

Full frontier-routing suite result: `62 passed, 1 failed`. The one failure is the previously frozen intentional A0 RED for exploratory brainstorming over-routing; it is unrelated to global config and remains preserved by design.

Pi entrypoint verification with Node 22 TypeScript stripping passed lifecycle, discovery, startup injection, global-config injection, and compaction checks. Its one remaining failure is the pre-existing lowercase `write` assertion in the unchanged `pi-tools.md`.

The shared Bash SessionStart suite could not run on this Windows host because no Bash distribution is installed (`/bin/bash: No such file or directory`). The resolver CLI, hook source binding, source hashes, and Node bootstrap integrations were verified, but this shell-specific test remains a cross-platform CI/manual item.

## Four fresh Codex route-only sessions

All sessions used `gpt-5.6-sol` with reasoning effort `high`. Prompts prohibited coding, file mutation, and external operations.

| Case | Thread | Requested | Effective | Source | Class | Outcome | Result |
|---|---|---|---|---|---|---|---|
| Ordinary project, no trial | `019f9d8e-bf11-79b3-93b9-fd5bc0251d3b` | frontier | frontier | global_owner_default | bounded | no_advisory_workflow | pass |
| Explicit Full | `019f9d8e-e2d6-75a1-b349-7292c099b7ed` | full | full | explicit_directive | bounded | full_v6_1_1 | pass |
| Explicit Off | `019f9d8f-0070-7d23-96f4-ac768784d15f` | off | off | explicit_directive | bounded | no_advisory_workflow | pass |
| High-risk secret rotation | `019f9d8f-24f0-7952-af54-917543af9f0a` | frontier | full | global_owner_default | high_risk | full_v6_1_1 | pass |

No session performed the described task or called an external system.

## Local installation

Canonical config:

```text
C:\Users\admin\.config\superpowers\config.json
```

Installed Skill:

```text
C:\Users\admin\.agents\skills\using-superpowers
```

Pre-change backup:

```text
D:\ai-discovery\skill-backups\20260726-global-frontier-using-superpowers
```

The installed resolver returned the following route in an ordinary directory with no project trial:

```json
{
  "requested_profile": "frontier",
  "source": "global_owner_default",
  "effective_profile": "frontier",
  "task_class": "bounded"
}
```

## Remaining manual/CI check

Run `bash tests/hooks/test-session-start.sh` on a host with Bash. Expected result: the Claude Code, Cursor, Copilot CLI, and wrapper cases pass, including the validated `default_profile: frontier` injection case.
