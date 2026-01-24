-- Households (family groups)
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Link users to households
CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin', 'member')) DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE(household_id, user_id)
);

-- Email invitations
CREATE TABLE household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days') NOT NULL
);

-- Recipe database
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  servings INTEGER DEFAULT 4 NOT NULL,
  instructions TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  last_used_at TIMESTAMPTZ
);

-- Recipe ingredients
CREATE TABLE recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL,
  unit TEXT,
  category TEXT NOT NULL CHECK (category IN ('produce', 'dairy', 'meat', 'pantry', 'frozen', 'other')) DEFAULT 'other'
);

-- Weekly meal planning (dinner only)
CREATE TABLE meal_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  recipe_id UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  UNIQUE(household_id, date)
);

-- Shopping lists
CREATE TABLE shopping_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'completed')) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Shopping list items (real-time sync)
CREATE TABLE shopping_list_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id UUID NOT NULL REFERENCES shopping_lists(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity DECIMAL,
  unit TEXT,
  category TEXT NOT NULL CHECK (category IN ('produce', 'dairy', 'meat', 'pantry', 'frozen', 'other')) DEFAULT 'other',
  is_purchased BOOLEAN DEFAULT FALSE NOT NULL,
  added_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Custom category ordering per household
CREATE TABLE category_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('produce', 'dairy', 'meat', 'pantry', 'frozen', 'other')),
  sort_order INTEGER NOT NULL,
  UNIQUE(household_id, category)
);

-- Common household items (quick-pick when creating lists)
CREATE TABLE common_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('produce', 'dairy', 'meat', 'pantry', 'frozen', 'other')) DEFAULT 'other',
  default_quantity DECIMAL,
  default_unit TEXT,
  purchase_count INTEGER DEFAULT 0 NOT NULL
);

-- Indexes for better query performance
CREATE INDEX idx_household_members_user_id ON household_members(user_id);
CREATE INDEX idx_household_members_household_id ON household_members(household_id);
CREATE INDEX idx_household_invites_email ON household_invites(email);
CREATE INDEX idx_recipes_household_id ON recipes(household_id);
CREATE INDEX idx_recipes_last_used_at ON recipes(last_used_at);
CREATE INDEX idx_recipe_ingredients_recipe_id ON recipe_ingredients(recipe_id);
CREATE INDEX idx_meal_plans_household_id ON meal_plans(household_id);
CREATE INDEX idx_meal_plans_date ON meal_plans(date);
CREATE INDEX idx_shopping_lists_household_id ON shopping_lists(household_id);
CREATE INDEX idx_shopping_list_items_list_id ON shopping_list_items(list_id);
CREATE INDEX idx_category_orders_household_id ON category_orders(household_id);
CREATE INDEX idx_common_items_household_id ON common_items(household_id);
CREATE INDEX idx_common_items_purchase_count ON common_items(purchase_count DESC);

-- Enable Row Level Security
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopping_list_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE common_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Households: Users can see households they're members of
CREATE POLICY "Users can view their households"
  ON households FOR SELECT
  USING (
    id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create households"
  ON households FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can update their households"
  ON households FOR UPDATE
  USING (
    id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Household members: Users can see members of their households
CREATE POLICY "Users can view household members"
  ON household_members FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can join households"
  ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can manage household members"
  ON household_members FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Household invites
CREATE POLICY "Users can view invites for their households"
  ON household_invites FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "Admins can create invites"
  ON household_invites FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete invites"
  ON household_invites FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Recipes: Users can manage recipes in their households
CREATE POLICY "Users can view household recipes"
  ON recipes FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create recipes"
  ON recipes FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update household recipes"
  ON recipes FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete household recipes"
  ON recipes FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Recipe ingredients
CREATE POLICY "Users can view recipe ingredients"
  ON recipe_ingredients FOR SELECT
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage recipe ingredients"
  ON recipe_ingredients FOR INSERT
  WITH CHECK (
    recipe_id IN (
      SELECT id FROM recipes WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update recipe ingredients"
  ON recipe_ingredients FOR UPDATE
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete recipe ingredients"
  ON recipe_ingredients FOR DELETE
  USING (
    recipe_id IN (
      SELECT id FROM recipes WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

-- Meal plans
CREATE POLICY "Users can view household meal plans"
  ON meal_plans FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create meal plans"
  ON meal_plans FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update meal plans"
  ON meal_plans FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete meal plans"
  ON meal_plans FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Shopping lists
CREATE POLICY "Users can view household shopping lists"
  ON shopping_lists FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create shopping lists"
  ON shopping_lists FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update shopping lists"
  ON shopping_lists FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete shopping lists"
  ON shopping_lists FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Shopping list items
CREATE POLICY "Users can view shopping list items"
  ON shopping_list_items FOR SELECT
  USING (
    list_id IN (
      SELECT id FROM shopping_lists WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can add shopping list items"
  ON shopping_list_items FOR INSERT
  WITH CHECK (
    list_id IN (
      SELECT id FROM shopping_lists WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update shopping list items"
  ON shopping_list_items FOR UPDATE
  USING (
    list_id IN (
      SELECT id FROM shopping_lists WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete shopping list items"
  ON shopping_list_items FOR DELETE
  USING (
    list_id IN (
      SELECT id FROM shopping_lists WHERE household_id IN (
        SELECT household_id FROM household_members WHERE user_id = auth.uid()
      )
    )
  );

-- Category orders
CREATE POLICY "Users can view category orders"
  ON category_orders FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage category orders"
  ON category_orders FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update category orders"
  ON category_orders FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete category orders"
  ON category_orders FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Common items
CREATE POLICY "Users can view common items"
  ON common_items FOR SELECT
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create common items"
  ON common_items FOR INSERT
  WITH CHECK (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update common items"
  ON common_items FOR UPDATE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete common items"
  ON common_items FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members WHERE user_id = auth.uid()
    )
  );

-- Function to update recipe's last_used_at when added to meal plan
CREATE OR REPLACE FUNCTION update_recipe_last_used()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE recipes SET last_used_at = NOW() WHERE id = NEW.recipe_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_recipe_last_used_trigger
  AFTER INSERT ON meal_plans
  FOR EACH ROW
  EXECUTE FUNCTION update_recipe_last_used();

-- Function to increment purchase_count when common item is added to shopping list
CREATE OR REPLACE FUNCTION increment_common_item_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE common_items
  SET purchase_count = purchase_count + 1
  WHERE household_id IN (
    SELECT household_id FROM shopping_lists WHERE id = NEW.list_id
  )
  AND name = NEW.name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER increment_common_item_count_trigger
  AFTER INSERT ON shopping_list_items
  FOR EACH ROW
  EXECUTE FUNCTION increment_common_item_count();

-- Function to create default category orders for new household
CREATE OR REPLACE FUNCTION create_default_category_orders()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO category_orders (household_id, category, sort_order) VALUES
    (NEW.id, 'produce', 1),
    (NEW.id, 'dairy', 2),
    (NEW.id, 'meat', 3),
    (NEW.id, 'frozen', 4),
    (NEW.id, 'pantry', 5),
    (NEW.id, 'other', 6);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_default_category_orders_trigger
  AFTER INSERT ON households
  FOR EACH ROW
  EXECUTE FUNCTION create_default_category_orders();

-- Enable realtime for shopping list items
ALTER PUBLICATION supabase_realtime ADD TABLE shopping_list_items;
