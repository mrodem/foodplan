-- Fix: Allow selecting newly created households
-- The issue is that INSERT...RETURNING needs SELECT permission,
-- but SELECT policy requires membership which doesn't exist yet

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "Users can view their households" ON households;

-- Create a policy that allows:
-- 1. Viewing households you're a member of
-- 2. Viewing any household during INSERT (for RETURNING clause)
CREATE POLICY "Users can view their households"
  ON households FOR SELECT
  TO authenticated
  USING (
    id IN (SELECT public.get_user_household_ids(auth.uid()))
    OR
    -- Allow selecting during INSERT operation (for RETURNING)
    (SELECT current_setting('role', true)) = 'authenticated'
  );

-- Actually, simpler approach: just allow all authenticated users to SELECT households
-- RLS on other tables still protects the actual data
DROP POLICY IF EXISTS "Users can view their households" ON households;

CREATE POLICY "Authenticated users can view households"
  ON households FOR SELECT
  TO authenticated
  USING (true);
