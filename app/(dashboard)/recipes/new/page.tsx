'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Textarea, Select, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import { CATEGORY_LABELS, DEFAULT_CATEGORIES, type IngredientCategory } from '@/lib/types';

interface Ingredient {
  id: string;
  name: string;
  quantity: string;
  unit: string;
  category: IngredientCategory;
}

export default function NewRecipePage() {
  const router = useRouter();
  const supabase = createClient();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [servings, setServings] = useState('4');
  const [instructions, setInstructions] = useState('');
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: '1', name: '', quantity: '', unit: '', category: 'other' },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const addIngredient = () => {
    setIngredients([
      ...ingredients,
      { id: Date.now().toString(), name: '', quantity: '', unit: '', category: 'other' },
    ]);
  };

  const removeIngredient = (id: string) => {
    if (ingredients.length === 1) return;
    setIngredients(ingredients.filter((i) => i.id !== id));
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setIngredients(
      ingredients.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setIsLoading(true);

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

    // Create recipe
    const { data: recipe, error: recipeError } = await supabase
      .from('recipes')
      .insert({
        household_id: membership.household_id,
        name: name.trim(),
        description: description.trim() || null,
        servings: parseInt(servings) || 4,
        instructions: instructions.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (recipeError) {
      setError(recipeError.message);
      setIsLoading(false);
      return;
    }

    // Add ingredients
    const ingredientInserts = validIngredients.map((i) => ({
      recipe_id: recipe.id,
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
      setIsLoading(false);
      return;
    }

    router.push('/recipes');
    router.refresh();
  };

  const categoryOptions = DEFAULT_CATEGORIES.map((cat) => ({
    value: cat,
    label: CATEGORY_LABELS[cat],
  }));

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Legg til oppskrift</h1>

      <form onSubmit={handleSubmit}>
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
              placeholder="f.eks. Spaghetti Bolognese"
              required
            />

            <Textarea
              id="description"
              label="Beskrivelse (valgfritt)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="En kort beskrivelse av retten"
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
              placeholder="Steg-for-steg beskrivelse"
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
                      disabled={ingredients.length === 1}
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
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Avbryt
          </Button>
          <Button type="submit" isLoading={isLoading}>
            Lagre oppskrift
          </Button>
        </div>
      </form>
    </div>
  );
}
