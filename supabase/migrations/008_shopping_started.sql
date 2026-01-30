-- Add shopping_started flag to shopping_lists
-- When true, opening the list will go directly to shop mode

ALTER TABLE shopping_lists ADD COLUMN shopping_started BOOLEAN DEFAULT FALSE NOT NULL;
