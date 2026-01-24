-- Fix INSERT policies for households and related tables

-- Drop and recreate households INSERT policy
DROP POLICY IF EXISTS "Users can create households" ON households;

CREATE POLICY "Authenticated users can create households"
  ON households FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Also ensure household_members INSERT works correctly
DROP POLICY IF EXISTS "Users can insert themselves as members" ON household_members;

CREATE POLICY "Users can insert themselves as members"
  ON household_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
