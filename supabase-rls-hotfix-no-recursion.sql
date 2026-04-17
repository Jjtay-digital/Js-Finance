-- ==========================================
-- HOTFIX: remove family RLS recursion
-- ==========================================
-- Run this in Supabase SQL Editor.
-- This replaces only family_groups + family_group_members policies
-- with non-recursive versions.

begin;

alter table if exists public.family_groups enable row level security;
alter table if exists public.family_group_members enable row level security;

-- Drop old family policies (safe/idempotent)
drop policy if exists "family_groups_select_member" on public.family_groups;
drop policy if exists "family_groups_insert_creator" on public.family_groups;
drop policy if exists "family_groups_update_creator" on public.family_groups;
drop policy if exists "family_groups_delete_creator" on public.family_groups;

drop policy if exists "fgm_select_self_or_group_owner" on public.family_group_members;
drop policy if exists "fgm_insert_owner_or_inviter" on public.family_group_members;
drop policy if exists "fgm_update_self_or_group_owner" on public.family_group_members;
drop policy if exists "fgm_delete_group_owner" on public.family_group_members;

-- Family group members (NO reference back to family_groups)
create policy "fgm_select_self_or_inviter" on public.family_group_members
  for select
  using (user_id = auth.uid() or invited_by = auth.uid());

create policy "fgm_insert_self_or_inviter" on public.family_group_members
  for insert
  with check (user_id = auth.uid() or invited_by = auth.uid());

create policy "fgm_update_self_or_inviter" on public.family_group_members
  for update
  using (user_id = auth.uid() or invited_by = auth.uid())
  with check (user_id = auth.uid() or invited_by = auth.uid());

create policy "fgm_delete_self_or_inviter" on public.family_group_members
  for delete
  using (user_id = auth.uid() or invited_by = auth.uid());

-- Family groups (can reference family_group_members safely one-way)
create policy "family_groups_select_member" on public.family_groups
  for select
  using (
    created_by = auth.uid()
    or exists (
      select 1
      from public.family_group_members fgm
      where fgm.group_id = family_groups.id
        and fgm.user_id = auth.uid()
    )
  );

create policy "family_groups_insert_creator" on public.family_groups
  for insert
  with check (created_by = auth.uid());

create policy "family_groups_update_creator" on public.family_groups
  for update
  using (created_by = auth.uid())
  with check (created_by = auth.uid());

create policy "family_groups_delete_creator" on public.family_groups
  for delete
  using (created_by = auth.uid());

commit;
