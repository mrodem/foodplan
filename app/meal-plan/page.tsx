'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardContent, Modal, EmptyState } from '@/components/ui';
import { getWeekDates, toDateString, formatDate } from '@/lib/utils';
import { type Recipe, type MealPlan } from '@/lib/types';

interface MealPlanWithRecipe extends MealPlan {
  recipes: { id: string; name: string } | null;
}

export default function MealPlanPage() {
  const supabase = createClient();

  const [weekOffset, setWeekOffset] = useState(0);
  const [mealPlans, setMealPlans] = useState<MealPlanWithRecipe[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showRecipePicker, setShowRecipePicker] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'least_used'>('least_used');

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(baseDate);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset]);

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

    // Load meal plans for this week
    const { data: plans } = await supabase
      .from('meal_plans')
      .select('*, recipes(id, name)')
      .eq('household_id', membership.household_id)
      .gte('date', toDateString(weekDates[0]))
      .lte('date', toDateString(weekDates[6]));

    if (plans) {
      setMealPlans(plans);
    }

    // Load all recipes
    const { data: recipesData } = await supabase
      .from('recipes')
      .select('*')
      .eq('household_id', membership.household_id)
      .order('name');

    if (recipesData) {
      setRecipes(recipesData);
    }

    setLoading(false);
  }

  const getMealForDate = (date: Date) => {
    const dateStr = toDateString(date);
    return mealPlans.find((p) => p.date === dateStr);
  };

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    setShowRecipePicker(true);
  };

  const handleSelectRecipe = async (recipeId: string) => {
    if (!selectedDate || !householdId || !userId) return;

    const dateStr = toDateString(selectedDate);
    const existingPlan = getMealForDate(selectedDate);

    if (existingPlan) {
      // Update existing plan
      await supabase
        .from('meal_plans')
        .update({ recipe_id: recipeId })
        .eq('id', existingPlan.id);
    } else {
      // Create new plan
      await supabase.from('meal_plans').insert({
        household_id: householdId,
        date: dateStr,
        recipe_id: recipeId,
        created_by: userId,
      });
    }

    setShowRecipePicker(false);
    setSelectedDate(null);
    loadData();
  };

  const handleRemoveMeal = async (planId: string) => {
    await supabase.from('meal_plans').delete().eq('id', planId);
    loadData();
  };

  const sortedRecipes = [...recipes].sort((a, b) => {
    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    }
    // Sort by least recently used (null dates first)
    if (!a.last_used_at && !b.last_used_at) return a.name.localeCompare(b.name);
    if (!a.last_used_at) return -1;
    if (!b.last_used_at) return 1;
    return new Date(a.last_used_at).getTime() - new Date(b.last_used_at).getTime();
  });

  const isToday = (date: Date) => toDateString(date) === toDateString(new Date());
  const isPast = (date: Date) => date < new Date(new Date().setHours(0, 0, 0, 0));

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-96 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Meal Plan</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(weekOffset - 1)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(0)}
            disabled={weekOffset === 0}
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWeekOffset(weekOffset + 1)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Button>
        </div>
      </div>

      <p className="text-gray-500 mb-4">
        Week of {formatDate(weekDates[0])} - {formatDate(weekDates[6])}
      </p>

      <Card>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-200">
            {weekDates.map((date) => {
              const meal = getMealForDate(date);
              const today = isToday(date);
              const past = isPast(date);

              return (
                <div
                  key={toDateString(date)}
                  className={`flex items-center justify-between p-4 ${
                    today ? 'bg-green-50' : past ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-20 ${today ? 'text-green-700' : past ? 'text-gray-400' : 'text-gray-600'}`}>
                      <p className="font-medium">{date.toLocaleDateString('en-US', { weekday: 'short' })}</p>
                      <p className="text-sm">{date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <div>
                      {meal ? (
                        <p className={`font-medium ${past ? 'text-gray-500' : 'text-gray-900'}`}>
                          {meal.recipes?.name}
                        </p>
                      ) : (
                        <p className="text-gray-400 italic">No meal planned</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {meal && (
                      <button
                        onClick={() => handleRemoveMeal(meal.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                    <Button
                      variant={meal ? 'outline' : 'primary'}
                      size="sm"
                      onClick={() => handleDateClick(date)}
                    >
                      {meal ? 'Change' : 'Add'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recipe Picker Modal */}
      <Modal
        isOpen={showRecipePicker}
        onClose={() => {
          setShowRecipePicker(false);
          setSelectedDate(null);
        }}
        title={selectedDate ? `Pick a meal for ${formatDate(selectedDate)}` : 'Pick a meal'}
        className="max-w-lg"
      >
        {recipes.length > 0 ? (
          <>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-gray-500">{recipes.length} recipes</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'name' | 'least_used')}
                className="text-sm border border-gray-300 rounded-lg px-2 py-1"
              >
                <option value="least_used">Least recently made</option>
                <option value="name">Alphabetical</option>
              </select>
            </div>
            <div className="max-h-80 overflow-y-auto space-y-2">
              {sortedRecipes.map((recipe) => (
                <button
                  key={recipe.id}
                  onClick={() => handleSelectRecipe(recipe.id)}
                  className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <p className="font-medium text-gray-900">{recipe.name}</p>
                  <p className="text-sm text-gray-500">
                    {recipe.last_used_at
                      ? `Last made: ${new Date(recipe.last_used_at).toLocaleDateString()}`
                      : 'Never made'}
                  </p>
                </button>
              ))}
            </div>
          </>
        ) : (
          <EmptyState
            title="No recipes yet"
            description="Add some recipes first to start planning meals"
            action={
              <Button onClick={() => (window.location.href = '/recipes/new')}>
                Add Recipe
              </Button>
            }
          />
        )}
      </Modal>
    </div>
  );
}
