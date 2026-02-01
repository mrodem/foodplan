'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { getNextDays, toDateString, formatDate } from '@/lib/utils';

interface MealPlan {
  id: string;
  date: string;
  recipes: { name: string };
}

interface ShoppingList {
  id: string;
  name: string;
  shopping_list_items: { is_purchased: boolean }[];
}

export default function DashboardPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [shoppingLists, setShoppingLists] = useState<ShoppingList[]>([]);
  const [loading, setLoading] = useState(true);

  const weekDates = getNextDays(7);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/auth/login');
      return;
    }

    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) {
      router.push('/settings');
      return;
    }

    const householdId = membership.household_id;

    // Get this week's meal plans
    const { data: plans } = await supabase
      .from('meal_plans')
      .select('*, recipes(name)')
      .eq('household_id', householdId)
      .gte('date', toDateString(weekDates[0]))
      .lte('date', toDateString(weekDates[6]))
      .order('date');

    if (plans) {
      setMealPlans(plans);
    }

    // Get active shopping lists
    const { data: lists } = await supabase
      .from('shopping_lists')
      .select('*, shopping_list_items(is_purchased)')
      .eq('household_id', householdId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(3);

    if (lists) {
      setShoppingLists(lists);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-xl" />
            <div className="h-64 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Oversikt</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Kommende middager</CardTitle>
            <Link href="/meal-plan" className="text-sm text-green-600 hover:text-green-700">
              Se alle
            </Link>
          </CardHeader>
          <CardContent>
            {mealPlans && mealPlans.length > 0 ? (
              <div className="space-y-3">
                {weekDates.map((date) => {
                  const plan = mealPlans.find(p => p.date === toDateString(date));
                  const isToday = toDateString(date) === toDateString(new Date());
                  return (
                    <div
                      key={toDateString(date)}
                      className={`flex items-center gap-4 py-2 px-3 rounded-lg ${
                        isToday ? 'bg-green-50' : 'bg-gray-50'
                      }`}
                    >
                      <span className={`text-sm font-medium w-24 shrink-0 ${isToday ? 'text-green-700' : 'text-gray-600'}`}>
                        {formatDate(date)}
                        {isToday && <span className="ml-1 text-xs">(I dag)</span>}
                      </span>
                      <span className={`text-sm text-left ${plan ? 'text-gray-900' : 'text-gray-400'}`}>
                        {plan ? plan.recipes.name : 'Ingen middag planlagt'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">Ingen middager planlagt denne uken</p>
                <Link
                  href="/meal-plan"
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Planlegg uken
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Aktive handlelister</CardTitle>
            <Link href="/shopping" className="text-sm text-green-600 hover:text-green-700">
              Se alle
            </Link>
          </CardHeader>
          <CardContent>
            {shoppingLists && shoppingLists.length > 0 ? (
              <div className="space-y-3">
                {shoppingLists.map((list) => {
                  const total = list.shopping_list_items.length;
                  const purchased = list.shopping_list_items.filter((i: { is_purchased: boolean }) => i.is_purchased).length;
                  const progress = total > 0 ? (purchased / total) * 100 : 0;
                  return (
                    <Link
                      key={list.id}
                      href={`/shopping/${list.id}`}
                      className="block p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium text-gray-900">{list.name}</span>
                        <span className="text-sm text-gray-500">
                          {purchased}/{total} varer
                        </span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">Ingen aktive handlelister</p>
                <Link
                  href="/shopping/new"
                  className="text-green-600 hover:text-green-700 font-medium"
                >
                  Opprett en liste
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
