'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Textarea, Select, Card, CardHeader, CardTitle, CardContent, Badge, Modal } from '@/components/ui';
import { CATEGORY_LABELS, DEFAULT_CATEGORIES, type IngredientCategory, type Recipe, type RecipeIngredient } from '@/lib/types';

interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: IngredientCategory;
  isNew?: boolean;
}

export default function RecipeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const supabase = createClient();
  const recipeId = params.id as string;

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(true);

  // Edit form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('4');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    loadRecipe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipeId]);

  async function loadRecipe() {
    const { data, error } = await supabase
      .from('recipes')
      .select('*, recipe_ingredients(*)')
      .eq('id', recipeId)
      .single();

    if (error || !data) {
      router.push('/recipes');
      return;
    }

    setRecipe(data);
    setName(data.name);
    setDescription(data.description || '');
    setServings(data.servings.toString());
    setInstructions(data.instructions || '');
    setIngredients(
      data.recipe_ingredients.map((i: RecipeIngredient) => ({
        id: i.id,
        name: i.name,
        quantity: i.quantity?.toString() || '',
        unit: i.unit || '',
        category: i.category,
      }))
    );
    setLoading(false);
  }

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      { id: `new-${Date.now()}`, name: '', quantity: '', unit: '', category: 'other', isNew: true },
    ]);
  };

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter((i) => i.id !== id));
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setIngredients(
      ingredients.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const handleSave = async () => {
    setError(null);

    if (!name.trim()) {
      setError('Vennligst skriv inn et oppskriftsnavn');
      return;
    }

    const validIngredients = ingredients.filter((i) => i.name.trim());
    if (validIngredients.length === 0) {
      setError('Vennligst legg til minst én ingrediens');
      return;
    }

    setIsSaving(true);

    // Update recipe
    const { error: recipeError } = await supabase
      .from('recipes')
      .update({
        name: name.trim(),
        description: description.trim() || null,
        servings: parseInt(servings) || 4,
        instructions: instructions.trim() || null,
      })
      .eq('id', recipeId);

    if (recipeError) {
      setError(recipeError.message);
      setIsSaving(false);
      return;
    }

    // Delete all existing ingredients and re-add
    await supabase.from('recipe_ingredients').delete().eq('recipe_id', recipeId);

    const ingredientInserts = validIngredients.map((i) => ({
      recipe_id: recipeId,
      name: i.name.trim(),
      quantity: i.quantity ? parseFloat(i.quantity) : null,
      unit: i.unit.trim() || null,
      category: i.category,
    }));

    const { error: ingredientError } = await supabase
      .from('recipe_ingredients')
      .insert(ingredientInserts);

    if (ingredientError) {
      setError(ingredientError.message);
      setIsSaving(false);
      return;
    }

    setIsEditing(false);
    loadRecipe();
    setIsSaving(false);
  };

  const handleDelete = async () => {
    await supabase.from('recipes').delete().eq('id', recipeId);
    router.push('/recipes');
    router.refresh();
  };

  const categoryOptions = DEFAULT_CATEGORIES.map((cat) => ({
    value: cat,
    label: CATEGORY_LABELS[cat],
  }));

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-48 bg-gray-200 rounded-xl" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!recipe) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => router.push('/recipes')}
          className="flex items-center text-gray-600 hover:text-gray-900"
        >
          <svg className="w-5 h-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Tilbake til oppskrifter
        </button>
        {!isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Rediger
            </Button>
            <Button variant="danger" onClick={() => setShowDeleteConfirm(true)}>
              Slett
            </Button>
          </div>
        )}
      </div>

      {isEditing ? (
        <>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Oppskriftsdetaljer</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                id="name"
                label="Navn på oppskrift"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Textarea
                id="description"
                label="Beskrivelse (valgfritt)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />

              <Input
                id="servings"
                label="Porsjoner"
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
              />

              <Textarea
                id="instructions"
                label="Fremgangsmåte (valgfritt)"
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
              />
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Ingredienser</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addIngredient}>
                Legg til ingrediens
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {ingredients.map((ingredient) => (
                  <div key={ingredient.id} className="p-3 bg-gray-50 rounded-lg space-y-3">
                    <div className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          label="Ingrediens"
                          placeholder="f.eks. Løk"
                          value={ingredient.name}
                          onChange={(e) => updateIngredient(ingredient.id, 'name', e.target.value)}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeIngredient(ingredient.id)}
                        className="p-2 text-gray-400 hover:text-red-500 transition-colors mt-6"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Input
                        label="Antall"
                        placeholder="1"
                        type="number"
                        step="0.1"
                        value={ingredient.quantity}
                        onChange={(e) => updateIngredient(ingredient.id, 'quantity', e.target.value)}
                      />
                      <Input
                        label="Enhet"
                        placeholder="stk"
                        value={ingredient.unit}
                        onChange={(e) => updateIngredient(ingredient.id, 'unit', e.target.value)}
                      />
                      <Select
                        label="Kategori"
                        options={categoryOptions}
                        value={ingredient.category}
                        onChange={(e) => updateIngredient(ingredient.id, 'category', e.target.value as IngredientCategory)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setIsEditing(false);
                loadRecipe();
              }}
            >
              Avbryt
            </Button>
            <Button onClick={handleSave} isLoading={isSaving}>
              Lagre endringer
            </Button>
          </div>
        </>
      ) : (
        <>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <h1 className="text-2xl font-bold text-gray-900 mb-2">{recipe.name}</h1>
              {recipe.description && (
                <p className="text-gray-600 mb-4">{recipe.description}</p>
              )}
              <div className="flex gap-4 text-sm text-gray-500">
                <span>{recipe.servings} porsjoner</span>
                {recipe.last_used_at && (
                  <span>Sist laget: {new Date(recipe.last_used_at).toLocaleDateString('nb-NO')}</span>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Ingredienser</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {ingredients.map((ingredient) => (
                  <li key={ingredient.id} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                    <span className="text-gray-900">
                      {ingredient.quantity && `${ingredient.quantity} `}
                      {ingredient.unit && `${ingredient.unit} `}
                      {ingredient.name}
                    </span>
                    <Badge>{CATEGORY_LABELS[ingredient.category]}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {recipe.instructions && (
            <Card>
              <CardHeader>
                <CardTitle>Fremgangsmåte</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 whitespace-pre-wrap">{recipe.instructions}</p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Slett oppskrift"
      >
        <p className="text-gray-600 mb-4">
          Er du sikker på at du vil slette &quot;{recipe.name}&quot;? Dette kan ikke angres.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
            Avbryt
          </Button>
          <Button variant="danger" onClick={handleDelete}>
            Slett
          </Button>
        </div>
      </Modal>
    </div>
  );
}
