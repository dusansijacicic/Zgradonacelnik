-- Add mapbox_id for canonical address deduplication via Mapbox Places
ALTER TABLE public.buildings ADD COLUMN IF NOT EXISTS mapbox_id text;
CREATE UNIQUE INDEX IF NOT EXISTS buildings_mapbox_id_idx
  ON public.buildings (mapbox_id)
  WHERE mapbox_id IS NOT NULL;

-- Also allow lat/lng to be passed directly on insert (remove best-effort geocoding from API)
-- No schema change needed; latitude/longitude columns already exist
