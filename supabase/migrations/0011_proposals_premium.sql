-- Migration 0011: Predlozi radova, komentari i glasanje su Premium funkcija.
-- Upis je dozvoljen samo kad zgrada ima aktivan Premium (is_building_premium iz 0010),
-- da se plaćeni modul ne bi zaobišao direktnim API pozivom. Čitanje ostaje za članove zgrade.

drop policy if exists "proposals: insert by verified member" on public.building_proposals;
create policy "proposals: insert by verified member"
on public.building_proposals
for insert
with check (
  created_by = auth.uid()
  and public.is_verified_member(building_id)
  and public.is_building_premium(building_id)
);

drop policy if exists "proposal_comments: insert by verified member" on public.proposal_comments;
create policy "proposal_comments: insert by verified member"
on public.proposal_comments
for insert
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.building_proposals p
    where p.id = proposal_id
      and public.is_verified_member(p.building_id)
      and public.is_building_premium(p.building_id)
  )
);

-- Glas: povlačenje sopstvenog glasa je uvek dozvoljeno, novi glas samo uz Premium.
drop policy if exists "pvotes: insert/update own vote as verified member" on public.proposal_votes;
create policy "pvotes: insert/update own vote as verified member"
on public.proposal_votes
for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.building_proposals p
    where p.id = proposal_id
      and public.is_verified_member(p.building_id)
      and public.is_building_premium(p.building_id)
  )
);
