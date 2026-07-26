# User-Level Workflow Configuration

This reference defines the strict owner-default configuration used by `using-superpowers`. It records a user preference, not a measured capability claim.

## Canonical discovery

Use the first valid location rule:

1. `SUPERPOWERS_CONFIG`, when set to a non-empty absolute file path;
2. `${XDG_CONFIG_HOME}/superpowers/config.json`, when `XDG_CONFIG_HOME` is an absolute directory;
3. `~/.config/superpowers/config.json`.

`SUPERPOWERS_CONFIG` changes only where the owner config is read. It does not outrank an explicit `superpowers=...` directive, change project-trial precedence, or weaken the mandatory risk floor.

The bundled zero-dependency resolver is:

```text
scripts/resolve-config.mjs
```

Examples:

```bash
node scripts/resolve-config.mjs --format json --task-class bounded --project-dir /path/to/project
node scripts/resolve-config.mjs --format bootstrap
```

Harness bootstrap code may inject the resolver's `<superpowers_global_config>` output. Native Skill loaders may run the JSON form after the initial task classification.

Some sandboxed native loaders cannot read the canonical user config directly. An installer may create a read-only `.runtime/owner-config.json` snapshot beside this Skill, with `.runtime/owner-config.provenance.json` recording the canonical path, installation time, and matching canonical/snapshot SHA-256 values. The resolver uses that adapter only when the canonical path returns `EACCES` or `EPERM`, and only while the snapshot matches its provenance. It does not use an adapter when the canonical file is missing or schema-invalid. The canonical file remains authoritative; changing it requires regenerating the installed snapshot.

## Strict schema

```json
{
  "schema_version": 1,
  "mode": "owner_default",
  "default_profile": "frontier"
}
```

Rules:

- The object has exactly these three fields.
- `schema_version` is the number `1`.
- `mode` is exactly `owner_default`.
- `default_profile` is `full`, `frontier`, or `off`.
- Model IDs, provider names, reasoning levels, capability claims, and task content are not accepted.
- Missing configuration is not an error. Malformed, unreadable, or schema-invalid configuration produces one diagnostic and does not partially apply.

## Selection order

After preserving the mandatory controls, select the requested advisory profile from the first applicable source:

1. explicit `superpowers=full|frontier|off`;
2. natural-language advisory off-ramp;
3. active, unexpired project trial eligible for the current task class;
4. validated user-level owner default;
5. approved, current capability default;
6. conservative `full`.

Then apply the mandatory risk floor. `high_risk` always produces `effective_profile=full`, even when the requested profile is `frontier` or `off`.

An invalid, inactive, expired, or ineligible project trial does not shadow a valid owner default.
