'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { toDateString, formatDate, groupBy } from '@/lib/utils';
import { DEFAULT_CATEGORIES, CATEGORY_LABELS, type MealPlan, type Recipe, type RecipeIngredient, type CommonItem } from '@/lib/types';

interface MealPlanWithRecipe extends MealPlan {
  recipes: Recipe & { recipe_ingredients: RecipeIngredient[] };
}

interface GeneratedItem extends RecipeIngredient {
  sourceRecipes: string[];
}

export default function NewShoppingListPage() {
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<'meals' | 'add'>('meals');
  const [listName, setListName] = useState('');
  const [mealPlans, setMealPlans] = useState<MealPlanWithRecipe[]>([]);
  const [selectedMeals, setSelectedMeals] = useState<Set<string>>(new Set());
  const [generatedItems, setGeneratedItems] = useState<Map<string, GeneratedItem>>(new Map());
  const [commonItems, setCommonItems] = useState<CommonItem[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  const today = toDateString(new Date());

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) return;
    setHouseholdId(membership.household_id);

    const { data: plans } = await supabase
      .from('meal_plans')
      .select('*, recipes(*, recipe_ingredients(*))')
      .eq('household_id', membership.household_id)
      .gte('date', today)
      .order('date');

    if (plans) {
      setMealPlans(plans as MealPlanWithRecipe[]);
    }

    const { data: items } = await supabase
      .from('common_items')
      .select('*')
      .eq('household_id', membership.household_id)
      .order('purchase_count', { ascending: false });

    if (items) {
      setCommonItems(items);
    }

    setListName(`Handling ${new Date().toLocaleDateString('nb-NO')}`);
    setLoading(false);
  }

  const toggleMeal = (mealId: string) => {
    const newSelected = new Set(selectedMeals);
    if (newSelected.has(mealId)) {
      newSelected.delete(mealId);
    } else {
      newSelected.add(mealId);
    }
    setSelectedMeals(newSelected);
  };

  const buildItemsFromMeals = () => {
    const items = new Map<string, GeneratedItem>();

    selectedMeals.forEach((mealId) => {
      const meal = mealPlans.find((m) => m.id === mealId);
      if (meal?.recipes?.recipe_ingredients) {
        meal.recipes.recipe_ingredients.forEach((ingredient) => {
          const key = `${ingredient.name.toLowerCase()}-${ingredient.category}`;
          const ingredientQty = ingredient.quantity ?? 1;

          if (items.has(key)) {
            const existing = items.get(key)!;
            existing.quantity = (existing.quantity ?? 1) + ingredientQty;
            if (!existing.unit && ingredient.unit) {
              existing.unit = ingredient.unit;
            }
            if (!existing.sourceRecipes.includes(meal.recipes.name)) {
              existing.sourceRecipes.push(meal.recipes.name);
            }
          } else {
            items.set(key, { ...ingredient, quantity: ingredientQty, sourceRecipes: [meal.recipes.name] });
          }
        });
      }
    });

    return items;
  };

  const addCommonItem = (item: CommonItem) => {
    const key = `${item.name.toLowerCase()}-${item.category}`;
    const newItems = new Map(generatedItems);
    const itemQty = item.default_quantity ?? 1;

    if (newItems.has(key)) {
      const existing = newItems.get(key)!;
      existing.quantity = (existing.quantity ?? 1) + itemQty;
      if (!existing.unit && item.default_unit) {
        existing.unit = item.default_unit;
      }
    } else {
      newItems.set(key, {
        id: `common-${item.id}`,
        recipe_id: '',
        name: item.name,
        quantity: itemQty,
        unit: item.default_unit,
        category: item.category,
        sourceRecipes: [],
      });
    }
    setGeneratedItems(newItems);
  };

  const removeItem = (key: string) => {
    const newItems = new Map(generatedItems);
    newItems.delete(key);
    setGeneratedItems(newItems);
  };

  const createList = async (items: Map<string, GeneratedItem>) => {
    if (!householdId || !userId) return;

    setIsCreating(true);

    const { data: list, error: listError } = await supabase
      .from('shopping_lists')
      .insert({
        household_id: householdId,
        name: listName || `Handling ${new Date().toLocaleDateString('nb-NO')}`,
      })
      .select()
      .single();

    if (listError || !list) {
      setIsCreating(false);
      return;
    }

    if (items.size > 0) {
      const itemsToInsert = Array.from(items.values()).map((item) => ({
        list_id: list.id,
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        category: item.category,
        added_by: userId,
        source_recipes: item.sourceRecipes,
      }));

      await supabase.from('shopping_list_items').insert(itemsToInsert);
    }

    router.push(`/shopping/${list.id}`);
  };

  const groupedCommonItems = groupBy(commonItems, (item) => item.category);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Opprett handleliste</h1>

      {step === 'meals' && (
        <div>
          <Input
            label="Listenavn"
            value={listName}
            onChange={(e) => setListName(e.target.value)}
            placeholder="f.eks. Ukeshandling"
            className="mb-6"
          />

          <Card>
            <CardHeader>
              <CardTitle>Velg middager å handle for</CardTitle>
            </CardHeader>
            <CardContent>
              {mealPlans.length > 0 ? (
                <div className="space-y-2">
                  {mealPlans.map((plan) => (
                    <label
                      key={plan.id}
                      className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedMeals.has(plan.id)
                          ? 'bg-green-50 border border-green-200'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedMeals.has(plan.id)}
                          onChange={() => toggleMeal(plan.id)}
                          className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500 mr-3"
                        />
                        <div>
                          <p className="font-medium text-gray-900">{plan.recipes.name}</p>
                          <p className="text-sm text-gray-500">{formatDate(plan.date)}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-400">
                        {plan.recipes.recipe_ingredients?.length || 0} varer
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  Ingen kommende middager planlagt. Du kan fortsatt opprette en liste og legge til varer manuelt.
                </p>
              )}
            </CardContent>
          </Card>

          <div className="flex gap-3 mt-6">
            <Button variant="outline" onClick={() => router.back()}>
              Avbryt
            </Button>
            {selectedMeals.size > 0 ? (
              <Button
                onClick={() => {
                  const items = buildItemsFromMeals();
                  createList(items);
                }}
                isLoading={isCreating}
              >
                {`Opprett liste fra ${selectedMeals.size} middag(er)`}
              </Button>
            ) : (
              <Button onClick={() => setStep('add')}>
                Legg til varer manuelt
              </Button>
            )}
          </div>
        </div>
      )}

      {step === 'add' && (
        <div>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Legg til varer per kategori</CardTitle>
            </CardHeader>
            <CardContent>
              {DEFAULT_CATEGORIES.map((category) => {
                const categoryCommonItems = groupedCommonItems[category];
                if (!categoryCommonItems || categoryCommonItems.length === 0) return null;

                return (
                  <div key={category} className="mb-4 last:mb-0">
                    <h4 className="font-medium text-gray-700 mb-2">{CATEGORY_LABELS[category]}</h4>
                    <div className="flex flex-wrap gap-2">
                      {categoryCommonItems.map((item) => {
                        const key = `${item.name.toLowerCase()}-${item.category}`;
                        const isAdded = generatedItems.has(key);

                        return (
                          <button
                            key={item.id}
                            onClick={() => !isAdded && addCommonItem(item)}
                            disabled={isAdded}
                            className={`px-3 py-1.5 rounded-full text-sm transition-colors ${
                              isAdded
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                          >
                            {isAdded && (
                              <svg className="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                            {item.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
              {commonItems.length === 0 && (
                <p className="text-gray-500 text-center py-4">
                  Ingen faste varer ennå. Legg til noen på Faste varer-siden.
                </p>
              )}
            </CardContent>
          </Card>

          {generatedItems.size > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Nåværende liste ({generatedItems.size} varer)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-48 overflow-y-auto px-6 py-3">
                  {Array.from(generatedItems.entries()).map(([key, item]) => (
                    <div key={key} className="flex items-center justify-between py-1">
                      <span className="text-gray-900 text-sm">
                        {item.quantity ?? 1}{item.unit ? ` ${item.unit}` : ''} {item.name}
                      </span>
                      <button onClick={() => removeItem(key)} className="text-gray-400 hover:text-red-500">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep('meals')}>
              Tilbake
            </Button>
            <Button onClick={() => createList(generatedItems)} isLoading={isCreating}>
              {generatedItems.size > 0 ? `Opprett liste (${generatedItems.size} varer)` : 'Opprett tom liste'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
