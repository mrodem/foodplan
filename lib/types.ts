// Database types

export type Role = 'admin' | 'member';
export type IngredientCategory = 'produce' | 'dairy' | 'meat' | 'pantry' | 'frozen' | 'other';
export type ShoppingListStatus = 'active' | 'completed';

export interface Household {
  id: string;
  name: string;
  created_at: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: Role;
  joined_at: string;
}

export interface HouseholdInvite {
  id: string;
  household_id: string;
  email: string;
  invited_by: string;
  created_at: string;
  expires_at: string;
}

export interface Recipe {
  id: string;
  household_id: string;
  name: string;
  description: string | null;
  servings: number;
  instructions: string | null;
  created_by: string;
  created_at: string;
  last_used_at: string | null;
}

export interface RecipeIngredient {
  id: string;
  recipe_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: IngredientCategory;
}

export interface MealPlan {
  id: string;
  household_id: string;
  date: string;
  recipe_id: string;
  created_by: string;
  recipe?: Recipe;
}

export interface ShoppingList {
  id: string;
  household_id: string;
  name: string;
  status: ShoppingListStatus;
  created_at: string;
}

export interface ShoppingListItem {
  id: string;
  list_id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  category: IngredientCategory;
  is_purchased: boolean;
  added_by: string;
  created_at: string;
}

export interface CategoryOrder {
  id: string;
  household_id: string;
  category: IngredientCategory;
  sort_order: number;
}

export interface CommonItem {
  id: string;
  household_id: string;
  name: string;
  category: IngredientCategory;
  default_quantity: number | null;
  default_unit: string | null;
  purchase_count: number;
}

// Utility types
export interface HouseholdWithMembers extends Household {
  household_members: (HouseholdMember & { user: { email: string } })[];
}

export interface RecipeWithIngredients extends Recipe {
  recipe_ingredients: RecipeIngredient[];
}

export interface ShoppingListWithItems extends ShoppingList {
  shopping_list_items: ShoppingListItem[];
}

export interface MealPlanWithRecipe extends MealPlan {
  recipes: Recipe;
}

// Default category order
export const DEFAULT_CATEGORIES: IngredientCategory[] = [
  'produce',
  'dairy',
  'meat',
  'frozen',
  'pantry',
  'other',
];

export const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  produce: 'Frukt og gr\u00f8nt',
  dairy: 'Meieri',
  meat: 'Kj\u00f8tt og fisk',
  frozen: 'Frysevarer',
  pantry: 'T\u00f8rrvarer',
  other: 'Annet',
};
