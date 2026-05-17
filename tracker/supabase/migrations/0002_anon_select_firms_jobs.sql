-- Phase 1 has no auth gate yet (see CLAUDE.md). The initial schema gated
-- firms/jobs SELECT to the `authenticated` role, which means the public
-- /jobs page silently returns 0 rows when no user is signed in.
--
-- Until Phase 2 ships auth, allow `anon` to SELECT firms and jobs. These
-- are public-catalog data: every firm publishes the same roles on its own
-- careers site. We are not exposing any user-owned data here.
--
-- documents / applications / alert_preferences stay strictly owner-only.
--
-- TODO(phase2): drop both policies once /jobs is gated behind an auth wall
-- and detection-latency is no longer trivially scrapable via the anon key.

drop policy if exists firms_select_anon on firms;
create policy firms_select_anon
  on firms for select
  to anon
  using (true);

drop policy if exists jobs_select_anon on jobs;
create policy jobs_select_anon
  on jobs for select
  to anon
  using (true);
