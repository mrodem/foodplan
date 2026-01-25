'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { getWeekDates, toDateString, formatDate } from '@/lib/utils';

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
  const [recipeCount, setRecipeCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const weekDates = getWeekDates();

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

    // Get recipe count
    const { count } = await supabase
      .from('recipes')
      .select('*', { count: 'exact', head: true })
      .eq('household_id', householdId);

    setRecipeCount(count || 0);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="h-24 bg-gray-200 rounded-xl" />
            <div className="h-24 bg-gray-200 rounded-xl" />
            <div className="h-24 bg-gray-200 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Oversikt</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard
          title="Oppskrifter"
          value={recipeCount || 0}
          href="/recipes"
          icon={<BookIcon />}
        />
        <StatCard
          title="Denne ukens middager"
          value={mealPlans?.length || 0}
          subtitle="planlagt"
          href="/meal-plan"
          icon={<CalendarIcon />}
        />
        <StatCard
          title="Aktive lister"
          value={shoppingLists?.length || 0}
          href="/shopping"
          icon={<CartIcon />}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Denne uken</CardTitle>
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

function StatCard({
  title,
  value,
  subtitle,
  href,
  icon,
}: {
  title: string;
  value: number;
  subtitle?: string;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="pt-6">
          <div className="flex items-center">
            <div className="p-2 bg-green-100 rounded-lg text-green-600">
              {icon}
            </div>
            <div className="ml-4">
              <p className="text-sm text-gray-500">{title}</p>
              <p className="text-2xl font-bold text-gray-900">
                {value}
                {subtitle && <span className="text-sm font-normal text-gray-500 ml-1">{subtitle}</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function BookIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}
