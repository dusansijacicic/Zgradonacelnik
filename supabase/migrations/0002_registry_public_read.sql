-- Javno čitanje državnog registra (imenik); upis i dalje samo admin.
create policy "pm_registry: select public read"
on public.professional_manager_registry
for select
using (true);
