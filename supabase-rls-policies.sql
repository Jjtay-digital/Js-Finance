-- ==========================================
-- Family Finance RLS (API-managed sharing)
-- ==========================================
-- Assumes:
-- - assets/liabilities/transactions are own-data only
-- - family combining + shared API key logic is enforced in Next.js API routes
-- - owner email is jasontayzh@gmail.com
-- ==========================================

begin;

-- ---------- Ensure RLS enabled ----------
alter table if exists public.user_roles enable row level security;
alter table if exists public.family_groups enable row level security;
alter table if exists public.family_group_members enable row level security;
alter table if exists public.settings enable row level security;
alter table if exists public.assets enable row level security;
alter table if exists public.liabilities enable row level security;
alter table if exists public.transactions enable row level security;

-- ---------- Clean old policies (idempotent) ----------
drop policy if exists "Users see own assets" on public.assets;
drop policy if exists "Users see own liabilities" on public.liabilities;
drop policy if exists "Users see own transactions" on public.transactions;

drop policy if exists "users_roles_select_own_or_owner" on public.user_roles;
drop policy if exists "users_roles_insert_own" on public.user_roles;
drop policy if exists "users_roles_update_owner_or_self_last_seen" on public.user_roles;
drop policy if exists "users_roles_owner_delete" on public.user_roles;

drop policy if exists "family_groups_select_member" on public.family_groups;
drop policy if exists "family_groups_insert_creator" on public.family_groups;
drop policy if exists "family_groups_update_creator" on public.family_groups;
drop policy if exists "family_groups_delete_creator" on public.family_groups;

drop policy if exists "fgm_select_self_or_group_owner" on public.family_group_members;
drop policy if exists "fgm_insert_owner_or_inviter" on public.family_group_members;
drop policy if exists "fgm_update_self_or_group_owner" on public.family_group_members;
drop policy if exists "fgm_delete_group_owner" on public.family_group_members;

drop policy if exists "settings_select_own" on public.settings;
drop policy if exists "settings_insert_own" on public.settings;
drop policy if exists "settings_update_own" on public.settings;
drop policy if exists "settings_delete_own" on public.settings;

-- ---------- Own-data only policies ----------
create policy "Users see own assets" on public.assets
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users see own liabilities" on public.liabilities
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users see own transactions" on public.transactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- user_roles ----------
-- Owner can view all. Everyone can view own.
create policy "users_roles_select_own_or_owner" on public.user_roles
  for select
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email','')) = 'jasontayzh@gmail.com'
  );

-- User can insert only own role row on first login.
create policy "users_roles_insert_own" on public.user_roles
  for insert
  with check (auth.uid() = user_id);

-- Owner can update anyone. User can update own row (needed for last_seen).
create policy "users_roles_update_owner_or_self_last_seen" on public.user_roles
  for update
  using (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email','')) = 'jasontayzh@gmail.com'
  )
  with check (
    auth.uid() = user_id
    or lower(coalesce(auth.jwt() ->> 'email','')) = 'jasontayzh@gmail.com'
  );

-- Optional: only owner can delete roles
create policy "users_roles_owner_delete" on public.user_roles
  for delete
  using (lower(coalesce(auth.jwt() ->> 'email','')) = 'jasontayzh@gmail.com');

-- ---------- family_groups ----------
-- Read groups where current user is a member.
create policy "family_groups_select_member" on public.family_groups
  for select
  using (
    exists (
      select 1
      from public.family_group_members fgm
      where fgm.group_id = family_groups.id
        and fgm.user_id = auth.uid()
    )
  );

-- Create group only as self.
create policy "family_groups_insert_creator" on public.family_groups
  for insert
  with check (created_by = auth.uid());

-- Only creator can edit/delete group metadata.
create policy "family_groups_update_creator" on public.family_groups
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "family_groups_delete_creator" on public.family_groups
  for delete
  using (created_by = auth.uid());

-- ---------- family_group_members ----------
-- User can see own memberships; group creator can see all members in their group.
create policy "fgm_select_self_or_group_owner" on public.family_group_members
  for select
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.family_groups fg
      where fg.id = family_group_members.group_id
        and fg.created_by = auth.uid()
    )
  );

-- Insert membership:
-- 1) creator inserts self as owner OR
-- 2) group creator invites/adds others
create policy "fgm_insert_owner_or_inviter" on public.family_group_members
  for insert
  with check (
    (
      user_id = auth.uid()
      and role = 'owner'
      and exists (
        select 1
        from public.family_groups fg
        where fg.id = family_group_members.group_id
          and fg.created_by = auth.uid()
      )
    )
    or
    (
      invited_by = auth.uid()
      and exists (
        select 1
        from public.family_groups fg
        where fg.id = family_group_members.group_id
          and fg.created_by = auth.uid()
      )
    )
  );

-- Update membership:
-- 1) user can respond to own invite
-- 2) group creator can manage members
create policy "fgm_update_self_or_group_owner" on public.family_group_members
  for update
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.family_groups fg
      where fg.id = family_group_members.group_id
        and fg.created_by = auth.uid()
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1
      from public.family_groups fg
      where fg.id = family_group_members.group_id
        and fg.created_by = auth.uid()
    )
  );

-- Delete membership: group creator only
create policy "fgm_delete_group_owner" on public.family_group_members
  for delete
  using (
    exists (
      select 1
      from public.family_groups fg
      where fg.id = family_group_members.group_id
        and fg.created_by = auth.uid()
    )
  );

-- ---------- settings ----------
-- Own settings only (API does family key sharing server-side)
create policy "settings_select_own" on public.settings
  for select
  using (auth.uid() = user_id);

create policy "settings_insert_own" on public.settings
  for insert
  with check (auth.uid() = user_id);

create policy "settings_update_own" on public.settings
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "settings_delete_own" on public.settings
  for delete
  using (auth.uid() = user_id);

commit;
