-- Add new categories: toppings (Pålegg) and baked_goods (Bakevarer)

-- 1. Drop existing CHECK constraints
ALTER TABLE recipe_ingredients DROP CONSTRAINT IF EXISTS recipe_ingredients_category_check;
ALTER TABLE shopping_list_items DROP CONSTRAINT IF EXISTS shopping_list_items_category_check;
ALTER TABLE category_orders DROP CONSTRAINT IF EXISTS category_orders_category_check;
ALTER TABLE common_items DROP CONSTRAINT IF EXISTS common_items_category_check;

-- 2. Add updated CHECK constraints with new categories
ALTER TABLE recipe_ingredients ADD CONSTRAINT recipe_ingredients_category_check
  CHECK (category IN ('produce', 'dairy', 'meat', 'pantry', 'frozen', 'toppings', 'baked_goods', 'other'));

ALTER TABLE shopping_list_items ADD CONSTRAINT shopping_list_items_category_check
  CHECK (category IN ('produce', 'dairy', 'meat', 'pantry', 'frozen', 'toppings', 'baked_goods', 'other'));

ALTER TABLE category_orders ADD CONSTRAINT category_orders_category_check
  CHECK (category IN ('produce', 'dairy', 'meat', 'pantry', 'frozen', 'toppings', 'baked_goods', 'other'));

ALTER TABLE common_items ADD CONSTRAINT common_items_category_check
  CHECK (category IN ('produce', 'dairy', 'meat', 'pantry', 'frozen', 'toppings', 'baked_goods', 'other'));

-- 3. Update the trigger function to include new categories for new households
CREATE OR REPLACE FUNCTION create_default_category_orders()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO category_orders (household_id, category, sort_order) VALUES
    (NEW.id, 'produce', 1),
    (NEW.id, 'dairy', 2),
    (NEW.id, 'meat', 3),
    (NEW.id, 'frozen', 4),
    (NEW.id, 'pantry', 5),
    (NEW.id, 'toppings', 6),
    (NEW.id, 'baked_goods', 7),
    (NEW.id, 'other', 8);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Add new categories to existing households' category_orders
-- Insert only if not already present
INSERT INTO category_orders (household_id, category, sort_order)
SELECT h.id, 'toppings', 6
FROM households h
WHERE NOT EXISTS (
  SELECT 1 FROM category_orders co
  WHERE co.household_id = h.id AND co.category = 'toppings'
);

INSERT INTO category_orders (household_id, category, sort_order)
SELECT h.id, 'baked_goods', 7
FROM households h
WHERE NOT EXISTS (
  SELECT 1 FROM category_orders co
  WHERE co.household_id = h.id AND co.category = 'baked_goods'
);

-- Update 'other' to be last (sort_order = 8) for existing households
UPDATE category_orders SET sort_order = 8 WHERE category = 'other';
