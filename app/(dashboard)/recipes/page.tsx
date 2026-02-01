import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent, EmptyState } from '@/components/ui';

export default async function RecipesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    redirect('/settings');
  }

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, recipe_ingredients(id, name, category)')
    .eq('household_id', membership.household_id)
    .order('name');

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Oppskrifter</h1>
        <Link href="/recipes/new">
          <Button>Legg til oppskrift</Button>
        </Link>
      </div>

      {recipes && recipes.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recipes.map((recipe) => (
            <Link key={recipe.id} href={`/recipes/${recipe.id}`}>
              <Card className="h-full hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {recipe.name}
                  </h3>
                  {recipe.description && (
                    <p className="text-sm text-gray-500 mb-3 line-clamp-2">
                      {recipe.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">
                      {recipe.recipe_ingredients.length} ingredienser
                    </span>
                    <span className="text-sm text-gray-500">
                      {recipe.servings} porsjoner
                    </span>
                  </div>
                  {recipe.last_used_at && (
                    <p className="text-xs text-gray-400 mt-2">
                      Sist laget: {new Date(recipe.last_used_at).toLocaleDateString('nb-NO')}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              }
              title="Ingen oppskrifter ennå"
              description="Begynn å bygge familiens oppskriftssamling"
              action={
                <Link href="/recipes/new">
                  <Button>Legg til din første oppskrift</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
