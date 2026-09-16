-- The guarded leads UPDATE policy intentionally allows authenticated clinic
-- members to edit permitted columns. The open-opportunity expression index is
-- evaluated in their session, so its immutable text normalizer must be callable.
-- This helper reads no tables and does not bypass RLS.
grant execute on function app_private.normalize_domain_text(text) to authenticated;
