-- Add sun_exposure to gardens and sun_requirement to plants
-- (Already applied via Management API; this file documents it)
ALTER TABLE gardens
  ADD COLUMN IF NOT EXISTS sun_exposure text NOT NULL DEFAULT 'full_sun'
    CHECK (sun_exposure IN ('full_sun', 'partial_sun', 'shade'));

ALTER TABLE plants
  ADD COLUMN IF NOT EXISTS sun_requirement text DEFAULT 'full_sun'
    CHECK (sun_requirement IN ('full_sun', 'partial_sun', 'shade'));
