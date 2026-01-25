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

  // Quick add modal (for common items)
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddItem, setQuickAddItem] = useState<CommonItem | null>(null);
  const [quickAddQuantity, setQuickAddQuantity] = useState('');
  const [quickAddUnit, setQuickAddUnit] = useState('');

  // Edit item modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');

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
      .order('name');

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
            // Only add if not already in list (avoid duplicates from local updates)
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

  const addItem = async () => {
    if (!newItemName.trim() || !userId) return;

    const quantity = newItemQuantity ? parseFloat(newItemQuantity) : 1;
    const unit = newItemUnit.trim() || null;
    const name = newItemName.trim();

    // Check if item already exists in list (same name and category)
    const existingItem = items.find(
      (i) => i.name.toLowerCase() === name.toLowerCase() && i.category === newItemCategory
    );

    if (existingItem) {
      // Sum quantities
      const existingQty = existingItem.quantity ?? 1;
      const newQty = existingQty + quantity;

      const { data: updatedItem } = await supabase
        .from('shopping_list_items')
        .update({ quantity: newQty, unit: unit || existingItem.unit })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (updatedItem) {
        setItems((prev) =>
          prev.map((i) => (i.id === existingItem.id ? updatedItem : i))
        );
      }
    } else {
      const { data: newItem } = await supabase
        .from('shopping_list_items')
        .insert({
          list_id: listId,
          name: name,
          quantity: quantity,
          unit: unit,
          category: newItemCategory,
          added_by: userId,
        })
        .select()
        .single();

      if (newItem) {
        setItems((prev) => {
          // Prevent duplicates (in case realtime also fires)
          if (prev.some((i) => i.id === newItem.id)) return prev;
          return [...prev, newItem];
        });
      }
    }

    setNewItemName('');
    setNewItemQuantity('');
    setNewItemUnit('');
    setNewItemCategory('other');
    setShowAddModal(false);
  };

  const openQuickAddModal = (item: CommonItem) => {
    setQuickAddItem(item);
    setQuickAddQuantity(item.default_quantity?.toString() || '1');
    setQuickAddUnit(item.default_unit || '');
    setShowQuickAddModal(true);
  };

  const confirmQuickAdd = async () => {
    if (!quickAddItem || !userId) return;

    const quantity = quickAddQuantity ? parseFloat(quickAddQuantity) : 1;
    const unit = quickAddUnit.trim() || null;

    // Check if item already exists in list
    const existingItem = items.find(
      (i) => i.name.toLowerCase() === quickAddItem.name.toLowerCase() && i.category === quickAddItem.category
    );

    if (existingItem) {
      // Sum quantities
      const existingQty = existingItem.quantity ?? 1;
      const newQty = existingQty + quantity;

      const { data: updatedItem } = await supabase
        .from('shopping_list_items')
        .update({ quantity: newQty, unit: unit || existingItem.unit })
        .eq('id', existingItem.id)
        .select()
        .single();

      if (updatedItem) {
        setItems((prev) =>
          prev.map((i) => (i.id === existingItem.id ? updatedItem : i))
        );
      }
    } else {
      const { data: newItem } = await supabase
        .from('shopping_list_items')
        .insert({
          list_id: listId,
          name: quickAddItem.name,
          quantity: quantity,
          unit: unit,
          category: quickAddItem.category,
          added_by: userId,
        })
        .select()
        .single();

      if (newItem) {
        setItems((prev) => {
          // Prevent duplicates (in case realtime also fires)
          if (prev.some((i) => i.id === newItem.id)) return prev;
          return [...prev, newItem];
        });
      }
    }

    setShowQuickAddModal(false);
    setQuickAddItem(null);
    setQuickAddQuantity('');
    setQuickAddUnit('');
  };

  const openEditModal = (item: ShoppingListItem) => {
    setEditingItem(item);
    setEditQuantity(item.quantity?.toString() || '1');
    setEditUnit(item.unit || '');
    setShowEditModal(true);
  };

  const saveItemEdit = async () => {
    if (!editingItem) return;

    const quantity = editQuantity ? parseFloat(editQuantity) : 1;
    const unit = editUnit.trim() || null;

    const { data: updatedItem } = await supabase
      .from('shopping_list_items')
      .update({ quantity, unit })
      .eq('id', editingItem.id)
      .select()
      .single();

    if (updatedItem) {
      setItems((prev) =>
        prev.map((i) => (i.id === editingItem.id ? updatedItem : i))
      );
    }

    setShowEditModal(false);
    setEditingItem(null);
    setEditQuantity('');
    setEditUnit('');
  };

  const deleteItem = async (itemId: string) => {
    // Optimistic update
    setItems((prev) => prev.filter((item) => item.id !== itemId));

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
          Tilbake
        </button>
        {!isCompleted && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowAddModal(true)}>
              Legg til vare
            </Button>
            <Button size="sm" onClick={() => setShowCompleteModal(true)} disabled={purchasedItems !== totalItems}>
              Fullfør
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
          <p className="text-sm text-gray-500">
            {purchasedItems} av {totalItems} varer huket av
          </p>
        </div>
        {isCompleted && <Badge variant="success">Fullført</Badge>}
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-gray-200 rounded-full overflow-hidden mb-6">
        <div
          className="h-full bg-green-500 transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Items by category */}
      <div className="space-y-4">
        {sortedCategories.map((category) => {
          const categoryItems = groupedItems[category] || [];
          const categoryCommonItems = commonItems.filter((item) => item.category === category);

          // Skip category if no items and no common items to add
          if (categoryItems.length === 0 && (isCompleted || categoryCommonItems.length === 0)) return null;

          const allPurchased = categoryItems.length > 0 && categoryItems.every((i) => i.is_purchased);

          return (
            <Card key={category} className={allPurchased ? 'opacity-60' : ''}>
              <CardHeader className="py-3">
                <CardTitle className="text-base">{CATEGORY_LABELS[category]}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {/* Quick add section */}
                {!isCompleted && categoryCommonItems.length > 0 && (
                  <div className="px-6 py-2 bg-gray-50 border-b border-gray-100">
                    <div className="flex flex-wrap gap-1.5">
                      {categoryCommonItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => openQuickAddModal(item)}
                          className="px-2 py-0.5 rounded text-xs transition-colors bg-white border border-gray-200 text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700"
                        >
                          + {item.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {/* Items list */}
                {categoryItems.length > 0 && (
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
                          {item.quantity ?? 1}{item.unit ? ` ${item.unit}` : ''} {item.name}
                        </span>
                        {!isCompleted && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEditModal(item)}
                              className="text-gray-400 hover:text-blue-500 p-1"
                              title="Rediger"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => deleteItem(item.id)}
                              className="text-gray-400 hover:text-red-500 p-1"
                              title="Slett"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {items.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 mb-4">Ingen varer i denne listen ennå</p>
            {!isCompleted && (
              <Button onClick={() => setShowAddModal(true)}>Legg til din første vare</Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Danger zone */}
      {!isCompleted && (
        <div className="mt-8 pt-8 border-t">
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={deleteList}>
            Slett denne listen
          </Button>
        </div>
      )}

      {/* Add Item Modal */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Legg til vare">
        <div className="space-y-4">
          <Input
            label="Varenavn"
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            placeholder="f.eks. Brød"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Antall (valgfritt)"
              type="number"
              step="0.1"
              value={newItemQuantity}
              onChange={(e) => setNewItemQuantity(e.target.value)}
              placeholder="1"
            />
            <Input
              label="Enhet (valgfritt)"
              value={newItemUnit}
              onChange={(e) => setNewItemUnit(e.target.value)}
              placeholder="stk"
            />
          </div>
          <Select
            label="Kategori"
            options={categoryOptions}
            value={newItemCategory}
            onChange={(e) => setNewItemCategory(e.target.value as IngredientCategory)}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Avbryt
            </Button>
            <Button onClick={addItem} disabled={!newItemName.trim()}>
              Legg til vare
            </Button>
          </div>
        </div>
      </Modal>

      {/* Complete List Modal */}
      <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Fullfør handleliste">
        <p className="text-gray-600 mb-4">
          Marker denne handlelisten som fullført? Du kan ikke redigere den etterpå.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setShowCompleteModal(false)}>
            Avbryt
          </Button>
          <Button onClick={completeList}>Fullfør liste</Button>
        </div>
      </Modal>

      {/* Quick Add Modal */}
      <Modal
        isOpen={showQuickAddModal}
        onClose={() => {
          setShowQuickAddModal(false);
          setQuickAddItem(null);
        }}
        title={`Legg til ${quickAddItem?.name || ''}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Antall"
              type="number"
              step="0.1"
              min="0.1"
              value={quickAddQuantity}
              onChange={(e) => setQuickAddQuantity(e.target.value)}
              placeholder="1"
            />
            <Input
              label="Enhet (valgfritt)"
              value={quickAddUnit}
              onChange={(e) => setQuickAddUnit(e.target.value)}
              placeholder="stk, kg, l..."
            />
          </div>
          {items.some(
            (i) => quickAddItem && i.name.toLowerCase() === quickAddItem.name.toLowerCase() && i.category === quickAddItem.category
          ) && (
            <p className="text-sm text-amber-600">
              Denne varen finnes allerede i listen. Antallet blir lagt til eksisterende mengde.
            </p>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowQuickAddModal(false)}>
              Avbryt
            </Button>
            <Button onClick={confirmQuickAdd}>
              Legg til
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit Item Modal */}
      <Modal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingItem(null);
        }}
        title={`Rediger ${editingItem?.name || ''}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Antall"
              type="number"
              step="0.1"
              min="0.1"
              value={editQuantity}
              onChange={(e) => setEditQuantity(e.target.value)}
              placeholder="1"
            />
            <Input
              label="Enhet (valgfritt)"
              value={editUnit}
              onChange={(e) => setEditUnit(e.target.value)}
              placeholder="stk, kg, l..."
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Avbryt
            </Button>
            <Button onClick={saveItemEdit}>
              Lagre
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
