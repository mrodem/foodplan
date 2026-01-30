'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { CATEGORY_LABELS, DEFAULT_CATEGORIES, type IngredientCategory, type ShoppingList, type ShoppingListItem } from '@/lib/types';
import { groupBy } from '@/lib/utils';

export default function ShoppingModePage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const listId = params.id as string;

  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [categoryOrders, setCategoryOrders] = useState<{ category: IngredientCategory; sort_order: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    setupRealtimeSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) return;

    // Load shopping list
    const { data: listData, error: listError } = await supabase
      .from('shopping_lists')
      .select('*')
      .eq('id', listId)
      .single();

    if (listError || !listData) {
      router.push('/shopping');
      return;
    }
    setList(listData);

    // Load items
    const { data: itemsData } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('list_id', listId)
      .order('created_at');

    if (itemsData) {
      setItems(itemsData);
    }

    // Load category orders
    const { data: orders } = await supabase
      .from('category_orders')
      .select('category, sort_order')
      .eq('household_id', membership.household_id)
      .order('sort_order');

    if (orders) {
      setCategoryOrders(orders);
    }

    setLoading(false);
  }

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel(`shopping-mode-${listId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shopping_list_items',
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setItems((prev) => {
              const exists = prev.some((item) => item.id === payload.new.id);
              if (exists) return prev;
              return [...prev, payload.new as ShoppingListItem];
            });
          } else if (payload.eventType === 'UPDATE') {
            setItems((prev) =>
              prev.map((item) =>
                item.id === payload.new.id ? (payload.new as ShoppingListItem) : item
              )
            );
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((item) => item.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  const toggleItemPurchased = async (itemId: string, isPurchased: boolean) => {
    // Optimistic update
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, is_purchased: !isPurchased } : item
      )
    );

    await supabase
      .from('shopping_list_items')
      .update({ is_purchased: !isPurchased })
      .eq('id', itemId);
  };

  const completeList = async () => {
    setList((prev) => prev ? { ...prev, status: 'completed' } : prev);

    await supabase
      .from('shopping_lists')
      .update({ status: 'completed' })
      .eq('id', listId);

    router.push('/shopping');
  };

  const sortedCategories = categoryOrders.length > 0
    ? categoryOrders.map((o) => o.category)
    : DEFAULT_CATEGORIES;

  const groupedItems = groupBy(items, (item) => item.category);
  const totalItems = items.length;
  const purchasedItems = items.filter((i) => i.is_purchased).length;
  const progress = totalItems > 0 ? (purchasedItems / totalItems) * 100 : 0;

  if (loading || !list) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  const allDone = purchasedItems === totalItems && totalItems > 0;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white z-10 pb-4 -mx-4 px-4 pt-2">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => router.push(`/shopping/${listId}`)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            ← Rediger liste
          </button>
          <span className="text-sm font-medium text-gray-600">
            {purchasedItems} / {totalItems}
          </span>
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-3">{list.name}</h1>

        {/* Progress bar */}
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Items by category */}
      <div className="space-y-4 mt-4">
        {sortedCategories.map((category) => {
          const categoryItems = groupedItems[category] || [];
          if (categoryItems.length === 0) return null;

          const allCategoryPurchased = categoryItems.every((i) => i.is_purchased);

          return (
            <Card key={category} className={allCategoryPurchased ? 'opacity-50' : ''}>
              <CardHeader className="py-2 px-4">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {CATEGORY_LABELS[category]}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {categoryItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => toggleItemPurchased(item.id, item.is_purchased)}
                      className={`w-full flex items-center px-4 py-3 text-left transition-colors ${
                        item.is_purchased ? 'bg-gray-50' : 'active:bg-gray-50'
                      }`}
                    >
                      <div
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${
                          item.is_purchased
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {item.is_purchased && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span
                        className={`flex-1 ${
                          item.is_purchased ? 'text-gray-400 line-through' : 'text-gray-900'
                        }`}
                      >
                        {item.quantity ?? 1}{item.unit ? ` ${item.unit}` : ''} {item.name}
                      </span>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Complete button */}
      <div className="mt-6">
        <Button
          className="w-full"
          onClick={completeList}
          disabled={!allDone}
        >
          Fullfør handleturen
        </Button>
      </div>
    </div>
  );
}
