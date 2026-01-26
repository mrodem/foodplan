-- Fix the household_invites SELECT policy to not query auth.users directly
-- Use auth.jwt() to get the email from the JWT token instead

DROP POLICY IF EXISTS "Users can view invites for their households" ON household_invites;

CREATE POLICY "Users can view invites for their households"
  ON household_invites FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
    OR email = (auth.jwt() ->> 'email')
  );
