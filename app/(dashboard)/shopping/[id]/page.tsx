'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Card, CardHeader, CardTitle, CardContent, Modal, Input, Select, Badge } from '@/components/ui';
import { CATEGORY_LABELS, DEFAULT_CATEGORIES, type IngredientCategory, type ShoppingList, type ShoppingListItem, type CommonItem, type Recipe, type RecipeIngredient } from '@/lib/types';
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

  // Edit item modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<ShoppingListItem | null>(null);
  const [editQuantity, setEditQuantity] = useState('');
  const [editUnit, setEditUnit] = useState('');

  // Delete list modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Add recipe modal
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipes, setRecipes] = useState<(Recipe & { recipe_ingredients: RecipeIngredient[] })[]>([]);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState('');

  // Edit list name
  const [isEditingName, setIsEditingName] = useState(false);
  const [editListName, setEditListName] = useState('');

  // Confirm add recipe
  const [selectedRecipe, setSelectedRecipe] = useState<(Recipe & { recipe_ingredients: RecipeIngredient[] }) | null>(null);


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

    // Load recipes for adding to list
    const { data: recipesData } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .eq('household_id', membership.household_id)
      .order('name');

    if (recipesData) {
      setRecipes(recipesData);
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

  const openAddModalForCategory = (category: IngredientCategory) => {
    setNewItemCategory(category);
    setShowAddModal(true);
  };

  const quickAddItem = async (item: CommonItem) => {
    if (!userId) return;

    const quantity = 1;

    // Check if item already exists in list
    const existingItem = items.find(
      (i) => i.name.toLowerCase() === item.name.toLowerCase() && i.category === item.category
    );

    if (existingItem) {
      // Sum quantities
      const existingQty = existingItem.quantity ?? 1;
      const newQty = existingQty + quantity;

      const { data: updatedItem } = await supabase
        .from('shopping_list_items')
        .update({ quantity: newQty })
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
          name: item.name,
          quantity: quantity,
          unit: null,
          category: item.category,
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
  };

  const selectRecipeForConfirmation = (recipe: Recipe & { recipe_ingredients: RecipeIngredient[] }) => {
    setSelectedRecipe(recipe);
    setShowRecipeModal(false);
  };

  const confirmAddRecipe = async () => {
    if (!userId || !selectedRecipe?.recipe_ingredients) return;

    for (const ingredient of selectedRecipe.recipe_ingredients) {
      const quantity = ingredient.quantity ?? 1;

      // Check if item already exists in list
      const existingItem = items.find(
        (i) => i.name.toLowerCase() === ingredient.name.toLowerCase() && i.category === ingredient.category
      );

      if (existingItem) {
        // Sum quantities
        const existingQty = existingItem.quantity ?? 1;
        const newQty = existingQty + quantity;

        const { data: updatedItem } = await supabase
          .from('shopping_list_items')
          .update({ quantity: newQty, unit: ingredient.unit || existingItem.unit })
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
            name: ingredient.name,
            quantity: quantity,
            unit: ingredient.unit,
            category: ingredient.category,
            added_by: userId,
          })
          .select()
          .single();

        if (newItem) {
          setItems((prev) => {
            if (prev.some((i) => i.id === newItem.id)) return prev;
            return [...prev, newItem];
          });
        }
      }
    }

    setSelectedRecipe(null);
    setRecipeSearchQuery('');
  };

  const cancelAddRecipe = () => {
    setSelectedRecipe(null);
    setShowRecipeModal(true);
  };

  const filteredRecipes = recipes.filter((recipe) =>
    recipeSearchQuery === '' || recipe.name.toLowerCase().includes(recipeSearchQuery.toLowerCase())
  );

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

  const deleteList = async () => {
    await supabase.from('shopping_lists').delete().eq('id', listId);
    router.push('/shopping');
  };

  const startEditingName = () => {
    setEditListName(list?.name || '');
    setIsEditingName(true);
  };

  const saveListName = async () => {
    if (!editListName.trim() || !list) return;

    const newName = editListName.trim();

    // Optimistic update
    setList((prev) => prev ? { ...prev, name: newName } : prev);
    setIsEditingName(false);

    await supabase
      .from('shopping_lists')
      .update({ name: newName })
      .eq('id', listId);
  };

  const cancelEditingName = () => {
    setIsEditingName(false);
    setEditListName('');
  };

  const sortedCategories = categoryOrders.length > 0
    ? categoryOrders.map((o) => o.category)
    : DEFAULT_CATEGORIES;

  const groupedItems = groupBy(items, (item) => item.category);
  const totalItems = items.length;

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
      </div>

      <div className="flex items-center justify-between mb-4">
        <div>
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editListName}
                onChange={(e) => setEditListName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveListName();
                  if (e.key === 'Escape') cancelEditingName();
                }}
                className="text-2xl font-bold text-gray-900 border-b-2 border-green-500 focus:outline-none bg-transparent"
                autoFocus
              />
              <button
                onClick={saveListName}
                className="text-green-600 hover:text-green-700 p-1"
                title="Lagre"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </button>
              <button
                onClick={cancelEditingName}
                className="text-gray-400 hover:text-gray-600 p-1"
                title="Avbryt"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-gray-900">{list.name}</h1>
              {!isCompleted && (
                <button
                  onClick={startEditingName}
                  className="text-gray-400 hover:text-gray-600 p-1"
                  title="Rediger navn"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}
            </div>
          )}
          <p className="text-sm text-gray-500">
            {totalItems} {totalItems === 1 ? 'vare' : 'varer'}
          </p>
        </div>
        {isCompleted && <Badge variant="success">Fullført</Badge>}
        {!isCompleted && (
          <Button variant="outline" size="sm" onClick={() => setShowRecipeModal(true)}>
            + Legg til oppskrift
          </Button>
        )}
      </div>

      {/* Items by category */}
      <div className="space-y-4">
        {sortedCategories.map((category) => {
          const categoryItems = groupedItems[category] || [];
          const categoryCommonItems = commonItems.filter((item) => item.category === category);

          // Skip category if no items and no common items to add
          if (categoryItems.length === 0 && (isCompleted || categoryCommonItems.length === 0)) return null;

          return (
            <Card key={category}>
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{CATEGORY_LABELS[category]}</CardTitle>
                  {!isCompleted && (
                    <button
                      onClick={() => openAddModalForCategory(category)}
                      className="text-sm text-green-600 hover:text-green-700 font-medium"
                    >
                      + Legg til vare
                    </button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {/* Quick add section */}
                {!isCompleted && categoryCommonItems.length > 0 && (
                  <div className="px-6 py-2 bg-gray-50 border-b border-gray-100">
                    <div className="flex flex-wrap gap-1.5">
                      {categoryCommonItems.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => quickAddItem(item)}
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
                        className="flex items-center px-6 py-3"
                      >
                        <span className="flex-1 text-gray-900">
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

      {!isCompleted && items.length > 0 && (
        <div className="py-6">
          <Button onClick={() => router.push(`/shopping/${listId}/shop`)}>
            Start handleturen
          </Button>
        </div>
      )}

      {/* Danger zone */}
      {!isCompleted && (
        <div className="mt-8 pt-8 border-t">
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setShowDeleteModal(true)}>
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

      {/* Delete List Modal */}
      <Modal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} title="Slett handleliste">
        <p className="text-gray-600 mb-4">
          Er du sikker på at du vil slette denne handlelisten? Dette kan ikke angres.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setShowDeleteModal(false)}>
            Avbryt
          </Button>
          <Button variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={deleteList}>
            Slett liste
          </Button>
        </div>
      </Modal>

      {/* Add Recipe Modal */}
      <Modal
        isOpen={showRecipeModal}
        onClose={() => {
          setShowRecipeModal(false);
          setRecipeSearchQuery('');
        }}
        title="Legg til oppskrift"
        className="max-w-lg"
      >
        {recipes.length > 0 ? (
          <>
            <div className="mb-3">
              <input
                type="text"
                placeholder="Søk etter oppskrift..."
                value={recipeSearchQuery}
                onChange={(e) => setRecipeSearchQuery(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 mb-3">
              {filteredRecipes.length} av {recipes.length} oppskrifter
            </p>
            <div className="max-h-72 overflow-y-auto space-y-2">
              {filteredRecipes.length > 0 ? (
                filteredRecipes.map((recipe) => (
                  <button
                    key={recipe.id}
                    onClick={() => selectRecipeForConfirmation(recipe)}
                    className="w-full text-left p-3 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <p className="font-medium text-gray-900">{recipe.name}</p>
                    <p className="text-sm text-gray-500">
                      {recipe.recipe_ingredients?.length || 0} ingredienser
                    </p>
                  </button>
                ))
              ) : (
                <p className="text-center text-gray-500 py-4">
                  Ingen oppskrifter matcher &quot;{recipeSearchQuery}&quot;
                </p>
              )}
            </div>
          </>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 mb-4">Ingen oppskrifter ennå</p>
            <Button onClick={() => router.push('/recipes/new')}>
              Legg til oppskrift
            </Button>
          </div>
        )}
      </Modal>

      {/* Confirm Add Recipe Modal */}
      <Modal
        isOpen={selectedRecipe !== null}
        onClose={cancelAddRecipe}
        title={`Legg til "${selectedRecipe?.name || ''}"`}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Følgende varer vil bli lagt til i handlelisten:
          </p>
          <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
            {selectedRecipe?.recipe_ingredients?.map((ingredient, index) => {
              const existingItem = items.find(
                (i) => i.name.toLowerCase() === ingredient.name.toLowerCase() && i.category === ingredient.category
              );
              return (
                <div key={index} className="px-3 py-2 flex items-center justify-between">
                  <span className="text-gray-900">
                    {ingredient.quantity ?? 1}{ingredient.unit ? ` ${ingredient.unit}` : ''} {ingredient.name}
                  </span>
                  {existingItem && (
                    <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                      +{ingredient.quantity ?? 1} til eksisterende
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="outline" onClick={cancelAddRecipe}>
              Tilbake
            </Button>
            <Button onClick={confirmAddRecipe}>
              Legg til {selectedRecipe?.recipe_ingredients?.length || 0} varer
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
