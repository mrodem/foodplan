'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardHeader, CardTitle, CardContent, Modal, Input, Select, Badge } from '@/components/ui';
import { CATEGORY_LABELS, DEFAULT_CATEGORIES, type IngredientCategory, type ShoppingList, type ShoppingListItem, type CommonItem } from '@/lib/types';
import { groupBy } from '@/lib/utils';

export default function ShoppingListDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const listId = params.id as string;

  const [list, setList] = useState<ShoppingList | null>(null);
  const [items, setItems] = useState<ShoppingListItem[]>([]);
  const [categoryOrders, setCategoryOrders] = useState<{ category: IngredientCategory; sort_order: number }[]>([]);
  const [commonItems, setCommonItems] = useState<CommonItem[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Add item modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemQuantity, setNewItemQuantity] = useState('');
  const [newItemUnit, setNewItemUnit] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<IngredientCategory>('other');

  // Complete list modal
  const [showCompleteModal, setShowCompleteModal] = useState(false);

  useEffect(() => {
    loadData();
    setupRealtimeSubscription();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId]);

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

    // Load common items for quick add
    const { data: common } = await supabase
      .from('common_items')
      .select('*')
      .eq('household_id', membership.household_id)
      .order('purchase_count', { ascending: false })
      .limit(20);

    if (common) {
      setCommonItems(common);
    }

    setLoading(false);
  }

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel(`shopping-list-${listId}`)
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
            setItems((prev) => [...prev, payload.new as ShoppingListItem]);
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
    await supabase
      .from('shopping_list_items')
      .update({ is_purchased: !isPurchased })
      .eq('id', itemId);
  };

  const addItem = async () => {
    if (!newItemName.trim() || !userId) return;

    await supabase.from('shopping_list_items').insert({
      list_id: listId,
      name: newItemName.trim(),
      quantity: newItemQuantity ? parseFloat(newItemQuantity) : null,
      unit: newItemUnit.trim() || null,
      category: newItemCategory,
      added_by: userId,
    });

    setNewItemName('');
    setNewItemQuantity('');
    setNewItemUnit('');
    setNewItemCategory('other');
    setShowAddModal(false);
  };

  const addCommonItem = async (item: CommonItem) => {
    if (!userId) return;

    // Check if already in list
    const exists = items.some(
      (i) => i.name.toLowerCase() === item.name.toLowerCase() && i.category === item.category
    );
    if (exists) return;

    await supabase.from('shopping_list_items').insert({
      list_id: listId,
      name: item.name,
      quantity: item.default_quantity,
      unit: item.default_unit,
      category: item.category,
      added_by: userId,
    });
  };

  const deleteItem = async (itemId: string) => {
    await supabase.from('shopping_list_items').delete().eq('id', itemId);
  };

  const completeList = async () => {
    await supabase
      .from('shopping_lists')
      .update({ status: 'completed' })
      .eq('id', listId);

    setShowCompleteModal(false);
    router.push('/shopping');
  };

  const deleteList = async () => {
    await supabase.from('shopping_lists').delete().eq('id', listId);
    router.push('/shopping');
  };

  const sortedCategories = categoryOrders.length > 0
    ? categoryOrders.map((o) => o.category)
    : DEFAULT_CATEGORIES;

  const groupedItems = groupBy(items, (item) => item.category);
  const totalItems = items.length;
  const purchasedItems = items.filter((i) => i.is_purchased).length;
  const progress = totalItems > 0 ? (purchasedItems / totalItems) * 100 : 0;

  const categoryOptions = DEFAULT_CATEGORIES.map((cat) => ({
    value: cat,
    label: CATEGORY_LABELS[cat],
  }));

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

  const isCompleted = list.status === 'completed';

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={() => router.push('/shopping')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        {!isCompleted && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
              Add Item
            </Button>
            <Button size="sm" onClick={() => setShowCompleteModal(true)} disabled={purchasedItems !== totalItems}>
              Complete
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
          <p className="text-sm text-gray-500">
            {purchasedItems} of {totalItems} items checked
          </p>
        </div>
        {isCompleted && <Badge variant="success">Completed</Badge>}
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Quick add from common items */}
      {!isCompleted && commonItems.length > 0 && (
        <Card className="mb-4">
          <CardContent className="py-3">
            <p className="text-xs text-gray-500 mb-2">Quick add:</p>
            <div className="flex flex-wrap gap-2">
              {commonItems.slice(0, 8).map((item) => {
                const isInList = items.some(
                  (i) => i.name.toLowerCase() === item.name.toLowerCase()
                );
                return (
                  <button
                    key={item.id}
                    onClick={() => !isInList && addCommonItem(item)}
                    disabled={isInList}
                    className={`px-2 py-1 rounded text-xs transition-colors ${
                      isInList
                        ? 'bg-gray-100 text-gray-400'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    + {item.name}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items by category */}
      <div className="space-y-4">
        {sortedCategories.map((category) => {
          const categoryItems = groupedItems[category];
          if (!categoryItems || categoryItems.length === 0) return null;

          const allPurchased = categoryItems.every((i) => i.is_purchased);

          return (
            <Card key={category} className={allPurchased ? 'opacity-60' : ''}>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{CATEGORY_LABELS[category]}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-gray-100">
                  {categoryItems.map((item) => (
                    <div
                      key={item.id}
                      className={`flex items-center px-6 py-3 ${
                        item.is_purchased ? 'bg-gray-50' : ''
                      }`}
                    >
                      <button
                        onClick={() => !isCompleted && toggleItemPurchased(item.id, item.is_purchased)}
                        disabled={isCompleted}
                        className={`flex-shrink-0 w-6 h-6 rounded-full border-2 mr-3 flex items-center justify-center transition-colors ${
                          item.is_purchased
                            ? 'bg-green-500 border-green-500'
                            : 'border-gray-300 hover:border-green-500'
                        }`}
                      >
                        {item.is_purchased && (
                          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span
                        className={`flex-1 ${
                          item.is_purchased ? 'text-gray-400 line-through' : 'text-gray-900'
                        }`}
                      >
                        {item.quantity && `${item.quantity} `}
                        {item.unit && `${item.unit} `}
                        {item.name}
                      </span>
                      {!isCompleted && (
                        <button
                          onClick={() => deleteItem(item.id)}
                          className="text-gray-400 hover:text-red-500 ml-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">No items in this list yet</p>
            {!isCompleted && (
              <Button onClick={() => setShowAddModal(true)}>Add your first item</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      {!isCompleted && (
        <div className="mt-8 pt-8 border-t">
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={deleteList}>
            Delete this list
          </Button>
        </div>
      )}

      {/* Add Item Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add Item">
        <div className="space-y-4">
          <Input
            label="Item Name"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="e.g., Bread"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Quantity (optional)"
              type="number"
              step="0.1"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              placeholder="1"
            />
            <Input
              label="Unit (optional)"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              placeholder="loaf"
            />
          </div>
          <Select
            label="Category"
            options={categoryOptions}
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value as IngredientCategory)}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Cancel
            </Button>
            <Button onClick={addItem} disabled={!newItemName.trim()}>
              Add Item
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete List Modal */}
      <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Complete Shopping List">
        <p className="text-gray-600 mb-4">
          Mark this shopping list as complete? You won&apos;t be able to edit it after.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
            Cancel
          </Button>
          <Button onClick={completeList}>Complete List</Button>
        </div>
      </Modal>
    </div>
  );
}
