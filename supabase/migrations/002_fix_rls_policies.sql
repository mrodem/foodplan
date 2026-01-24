-- Fix infinite recursion in RLS policies
-- The issue is that household_members policies reference household_members

-- Drop all existing policies that cause recursion
DROP POLICY IF EXISTS "Users can view their households" ON households;
DROP POLICY IF EXISTS "Users can create households" ON households;
DROP POLICY IF EXISTS "Admins can update their households" ON households;
DROP POLICY IF EXISTS "Users can view household members" ON household_members;
DROP POLICY IF EXISTS "Users can join households" ON household_members;
DROP POLICY IF EXISTS "Admins can manage household members" ON household_members;

-- Create a security definer function to check household membership
-- This bypasses RLS and prevents recursion
CREATE OR REPLACE FUNCTION public.get_user_household_ids(user_uuid UUID)
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT household_id FROM public.household_members WHERE user_id = user_uuid;
$$;

CREATE OR REPLACE FUNCTION public.is_household_admin(user_uuid UUID, h_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE user_id = user_uuid AND household_id = h_id AND role = 'admin'
  );
$$;

-- Households policies (fixed)
CREATE POLICY "Users can view their households"
  ON households FOR SELECT
  USING (id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can create households"
  ON households FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update their households"
  ON households FOR UPDATE
  USING (public.is_household_admin(auth.uid(), id));

-- Household members policies (fixed)
CREATE POLICY "Users can view household members"
  ON household_members FOR SELECT
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can insert themselves as members"
  ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can delete household members"
  ON household_members FOR DELETE
  USING (public.is_household_admin(auth.uid(), household_id));

-- Fix other policies that reference household_members

-- Household invites
DROP POLICY IF EXISTS "Users can view invites for their households" ON household_invites;
DROP POLICY IF EXISTS "Admins can create invites" ON household_invites;
DROP POLICY IF EXISTS "Admins can delete invites" ON household_invites;

CREATE POLICY "Users can view invites for their households"
  ON household_invites FOR SELECT
  USING (
    household_id IN (SELECT public.get_user_household_ids(auth.uid()))
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can create invites"
  ON household_invites FOR INSERT
  WITH CHECK (public.is_household_admin(auth.uid(), household_id));

CREATE POLICY "Admins can delete invites"
  ON household_invites FOR DELETE
  USING (public.is_household_admin(auth.uid(), household_id));

-- Recipes
DROP POLICY IF EXISTS "Users can view household recipes" ON recipes;
DROP POLICY IF EXISTS "Users can create recipes" ON recipes;
DROP POLICY IF EXISTS "Users can update household recipes" ON recipes;
DROP POLICY IF EXISTS "Users can delete household recipes" ON recipes;

CREATE POLICY "Users can view household recipes"
  ON recipes FOR SELECT
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can create recipes"
  ON recipes FOR INSERT
  WITH CHECK (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can update household recipes"
  ON recipes FOR UPDATE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can delete household recipes"
  ON recipes FOR DELETE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

-- Recipe ingredients
DROP POLICY IF EXISTS "Users can view recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Users can manage recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Users can update recipe ingredients" ON recipe_ingredients;
DROP POLICY IF EXISTS "Users can delete recipe ingredients" ON recipe_ingredients;

CREATE POLICY "Users can view recipe ingredients"
  ON recipe_ingredients FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE household_id IN (SELECT public.get_user_household_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can manage recipe ingredients"
  ON recipe_ingredients FOR INSERT
  WITH CHECK (
    recipe_id IN (
      SELECT id FROM recipes WHERE household_id IN (SELECT public.get_user_household_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can update recipe ingredients"
  ON recipe_ingredients FOR UPDATE
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE household_id IN (SELECT public.get_user_household_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can delete recipe ingredients"
  ON recipe_ingredients FOR DELETE
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE household_id IN (SELECT public.get_user_household_ids(auth.uid()))
    )
  );

-- Meal plans
DROP POLICY IF EXISTS "Users can view household meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can create meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can update meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can delete meal plans" ON meal_plans;

CREATE POLICY "Users can view household meal plans"
  ON meal_plans FOR SELECT
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can create meal plans"
  ON meal_plans FOR INSERT
  WITH CHECK (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can update meal plans"
  ON meal_plans FOR UPDATE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can delete meal plans"
  ON meal_plans FOR DELETE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

-- Shopping lists
DROP POLICY IF EXISTS "Users can view household shopping lists" ON shopping_lists;
DROP POLICY IF EXISTS "Users can create shopping lists" ON shopping_lists;
DROP POLICY IF EXISTS "Users can update shopping lists" ON shopping_lists;
DROP POLICY IF EXISTS "Users can delete shopping lists" ON shopping_lists;

CREATE POLICY "Users can view household shopping lists"
  ON shopping_lists FOR SELECT
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can create shopping lists"
  ON shopping_lists FOR INSERT
  WITH CHECK (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can update shopping lists"
  ON shopping_lists FOR UPDATE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can delete shopping lists"
  ON shopping_lists FOR DELETE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

-- Shopping list items
DROP POLICY IF EXISTS "Users can view shopping list items" ON shopping_list_items;
DROP POLICY IF EXISTS "Users can add shopping list items" ON shopping_list_items;
DROP POLICY IF EXISTS "Users can update shopping list items" ON shopping_list_items;
DROP POLICY IF EXISTS "Users can delete shopping list items" ON shopping_list_items;

CREATE POLICY "Users can view shopping list items"
  ON shopping_list_items FOR SELECT
  USING (
    list_id IN (
      SELECT id FROM shopping_lists WHERE household_id IN (SELECT public.get_user_household_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can add shopping list items"
  ON shopping_list_items FOR INSERT
  WITH CHECK (
    list_id IN (
      SELECT id FROM shopping_lists WHERE household_id IN (SELECT public.get_user_household_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can update shopping list items"
  ON shopping_list_items FOR UPDATE
  USING (
    list_id IN (
      SELECT id FROM shopping_lists WHERE household_id IN (SELECT public.get_user_household_ids(auth.uid()))
    )
  );

CREATE POLICY "Users can delete shopping list items"
  ON shopping_list_items FOR DELETE
  USING (
    list_id IN (
      SELECT id FROM shopping_lists WHERE household_id IN (SELECT public.get_user_household_ids(auth.uid()))
    )
  );

-- Category orders
DROP POLICY IF EXISTS "Users can view category orders" ON category_orders;
DROP POLICY IF EXISTS "Users can manage category orders" ON category_orders;
DROP POLICY IF EXISTS "Users can update category orders" ON category_orders;
DROP POLICY IF EXISTS "Users can delete category orders" ON category_orders;

CREATE POLICY "Users can view category orders"
  ON category_orders FOR SELECT
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can manage category orders"
  ON category_orders FOR INSERT
  WITH CHECK (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can update category orders"
  ON category_orders FOR UPDATE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can delete category orders"
  ON category_orders FOR DELETE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

-- Common items
DROP POLICY IF EXISTS "Users can view common items" ON common_items;
DROP POLICY IF EXISTS "Users can create common items" ON common_items;
DROP POLICY IF EXISTS "Users can update common items" ON common_items;
DROP POLICY IF EXISTS "Users can delete common items" ON common_items;

CREATE POLICY "Users can view common items"
  ON common_items FOR SELECT
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can create common items"
  ON common_items FOR INSERT
  WITH CHECK (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can update common items"
  ON common_items FOR UPDATE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));

CREATE POLICY "Users can delete common items"
  ON common_items FOR DELETE
  USING (household_id IN (SELECT public.get_user_household_ids(auth.uid())));
