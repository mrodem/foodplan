'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Select, Card, CardHeader, CardTitle, CardContent, Modal, EmptyState } from '@/components/ui';
import { CATEGORY_LABELS, DEFAULT_CATEGORIES, type IngredientCategory, type CommonItem } from '@/lib/types';
import { groupBy } from '@/lib/utils';

export default function CommonItemsPage() {
  const supabase = createClient();

  const [items, setItems] = useState<CommonItem[]>([]);
  const [categoryOrders, setCategoryOrders] = useState<{ category: IngredientCategory; sort_order: number }[]>([]);
  const [householdId, setHouseholdId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<CommonItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState<IngredientCategory>('other');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id')
      .eq('user_id', user.id)
      .single();

    if (!membership) return;
    setHouseholdId(membership.household_id);

    // Load common items
    const { data: itemsData } = await supabase
      .from('common_items')
      .select('*')
      .eq('household_id', membership.household_id)
      .order('name');

    if (itemsData) {
      setItems(itemsData);
    }

    // Load category orders
    const { data: ordersData } = await supabase
      .from('category_orders')
      .select('category, sort_order')
      .eq('household_id', membership.household_id)
      .order('sort_order');

    if (ordersData) {
      setCategoryOrders(ordersData);
    }

    setLoading(false);
  }

  const handleSave = async () => {
    if (!itemName.trim() || !householdId) return;

    setIsSaving(true);

    if (editingItem) {
      await supabase
        .from('common_items')
        .update({
          name: itemName.trim(),
          category: itemCategory,
        })
        .eq('id', editingItem.id);
    } else {
      await supabase.from('common_items').insert({
        household_id: householdId,
        name: itemName.trim(),
        category: itemCategory,
      });
    }

    resetForm();
    loadData();
    setIsSaving(false);
  };

  const handleDelete = async (id: string) => {
    await supabase.from('common_items').delete().eq('id', id);
    loadData();
  };

  const resetForm = () => {
    setShowAddModal(false);
    setEditingItem(null);
    setItemName('');
    setItemCategory('other');
  };

  const openEditModal = (item: CommonItem) => {
    setEditingItem(item);
    setItemName(item.name);
    setItemCategory(item.category);
    setShowAddModal(true);
  };

  const categoryOptions = DEFAULT_CATEGORIES.map((cat) => ({
    value: cat,
    label: CATEGORY_LABELS[cat],
  }));

  // Group items by category in custom order
  const sortedCategories = categoryOrders.length > 0
    ? categoryOrders.map((o) => o.category)
    : DEFAULT_CATEGORIES;

  const groupedItems = groupBy(items, (item) => item.category);

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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Faste varer</h1>
          <p className="text-gray-500 text-sm mt-1">
            Varer du kjøper ofte
          </p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>Legg til vare</Button>
      </div>

      {items.length > 0 ? (
        <div className="space-y-6">
          {sortedCategories.map((category) => {
            const categoryItems = groupedItems[category];
            if (!categoryItems || categoryItems.length === 0) return null;

            return (
              <Card key={category}>
                <CardHeader>
                  <CardTitle>{CATEGORY_LABELS[category]}</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-gray-100">
                    {categoryItems
                      .sort((a, b) => b.purchase_count - a.purchase_count)
                      .map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between px-6 py-3 hover:bg-gray-50"
                        >
                          <div>
                            <span className="font-medium text-gray-900">{item.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => openEditModal(item)}
                              className="p-1 text-gray-400 hover:text-gray-600"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                </svg>
              }
              title="Ingen faste varer ennå"
              description="Legg til varer du ofte kjøper for rask oppretting av handlelister"
              action={<Button onClick={() => setShowAddModal(true)}>Legg til din første vare</Button>}
            />
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={resetForm}
        title={editingItem ? 'Rediger vare' : 'Legg til fast vare'}
      >
        <div className="space-y-4">
          <Input
            label="Varenavn"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="f.eks. Melk"
          />
          <Select
            label="Kategori"
            options={categoryOptions}
            value={itemCategory}
            onChange={(e) => setItemCategory(e.target.value as IngredientCategory)}
          />
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={resetForm}>
              Avbryt
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              {editingItem ? 'Lagre endringer' : 'Legg til vare'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
