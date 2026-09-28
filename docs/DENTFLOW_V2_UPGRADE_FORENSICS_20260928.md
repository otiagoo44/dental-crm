# Upgrade forensics — 2026-09-28

## Historical discrepancy

Local migration `20260904201956_contact_opportunity_model.sql` first appears in commit `aae35c0b4643cce601b74ed4bd140b68911f8e61` (2026-09-04 20:25:58 -0300). Its parent is `bb894bd5a9a1a1360133094843063b7109c645c3`. `git log --all --follow` found one creation; no Git file/rename with version 20260904203022 was found. The previous commit's 19 migrations match current historical files without changes.

Read-only query of Staging `supabase_migrations.schema_migrations`: version 20260904203022, name contact_opportunity_model, one stored statement. Version 20260904201956 is absent. The timestamp-like IDs are not reliable deployment audit times; the actor/tool that assigned the remote ID is not proved. Separate local generation and remote application is consistent with the evidence, but remains an inference.

Compared the stored Staging SQL against the local UTF-8 file line by line: only two empty final lines differed after trimming the file for transport. Normalized line endings/trailing whitespace MD5 for both is `3f4a1079c000a1dc1df890f8bcfaa45d`. No changed statement, table, column, constraint, function, policy, index or data transformation was found. MD5 here is an equality diagnostic, not a cryptographic provenance claim.

Classification: **A — same SQL and same specified effect**, ignoring non-semantic trailing whitespace. Byte-for-byte file equality is not claimed. Full current Staging schema equality to a historical schema is not claimed: later migrations legitimately modify functions. Database-from-zero and executed Gate A contracts validate current objects separately.

No migration file renamed, historical SQL edited, migration history repaired/updated/deleted, or Staging reset.

## Reproducible isolated upgrade

Baseline: pinned pre-contact commit bb894bd, its 19 migrations applied to a disposable database. Synthetic fixtures committed before V2 migrations: Clinic A/B, Owner/Reception in each, three opportunities (two treatments sharing one phone in A; same phone in B), task, appointment, quote, administrative event, settings and authorized public form. Contacts did not exist before this release; the migration must backfill two tenant-isolated contacts while preserving all three opportunities.

Full pre-upgrade rows are captured in a test-only `upgrade_test` schema. After forward migrations, compare every existing row/ID/value including timestamps and FKs (only the newly added contact_id is excluded from the old-row equality check). Verify contact dedupe, tenant separation, Contact 360, timeline history, bounded Search/Work, new Saved Views functionality and legacy appointment/quote reads. Run domain/intake regression suites on the upgraded schema.

Local PGlite execution passed baseline + forward migrations + upgrade integrity/projection tests; this is not equivalent to real Supabase hosted CI. `.github/workflows/03-upgrade.yml` reconstructs the same pinned baseline in an isolated Supabase Docker database, inserts fixtures, copies unchanged forward SQL and runs `supabase migration up --local`. It never links a remote project, repairs history or renames applied migrations. Hosted result must be recorded for the exact commit after execution.

This certifies a specific previous-release-like baseline, not arbitrary historical databases, external drift, production recovery or capacity. Public HTTP Edge runtime is tested separately from SQL intake regression.

## Remaining migration-history decision

Staging still has a different migration identifier. **Do not run blind `db push` against Staging**. This investigation does not authorize history mutation. A release operator must choose and review how deployments represent the already-applied equivalent migration across environments. Until that mapping is resolved through an explicitly approved procedure, automatic linked upgrade/deployment remains **BLOCKED — MANUAL MIGRATION HISTORY DECISION** even if the isolated upgrade passes. Subsequent new Staging migrations must be individually reviewed, forward-only, and exclude replaying this historical migration.

Production modified: NO.
