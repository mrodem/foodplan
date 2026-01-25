import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, CardContent, EmptyState, Badge } from '@/components/ui';

export default async function ShoppingListsPage() {
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

  const { data: lists } = await supabase
    .from('shopping_lists')
    .select('*, shopping_list_items(is_purchased)')
    .eq('household_id', membership.household_id)
    .order('created_at', { ascending: false });

  const activeLists = lists?.filter((l) => l.status === 'active') || [];
  const completedLists = lists?.filter((l) => l.status === 'completed') || [];

  return (
    <div className="max-w-4xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
      >
        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Oversikt
      </Link>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Handlelister</h1>
        <Link href="/shopping/new">
          <Button>Ny liste</Button>
        </Link>
      </div>

      {activeLists.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Aktive lister</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeLists.map((list) => {
              const total = list.shopping_list_items.length;
              const purchased = list.shopping_list_items.filter((i: { is_purchased: boolean }) => i.is_purchased).length;
              const progress = total > 0 ? (purchased / total) * 100 : 0;

              return (
                <Link key={list.id} href={`/shopping/${list.id}`}>
                  <Card className="h-full hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-gray-900">{list.name}</h3>
                          <p className="text-sm text-gray-500">
                            {purchased}/{total} varer huket av
                          </p>
                        </div>
                        <Badge variant="success">Aktiv</Badge>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-3">
                        Opprettet {new Date(list.created_at).toLocaleDateString('nb-NO')}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {completedLists.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Fullførte lister</h2>
          <div className="space-y-2">
            {completedLists.slice(0, 5).map((list) => (
              <Link key={list.id} href={`/shopping/${list.id}`}>
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div>
                    <span className="font-medium text-gray-700">{list.name}</span>
                    <span className="ml-3 text-sm text-gray-400">
                      {list.shopping_list_items.length} varer
                    </span>
                  </div>
                  <span className="text-sm text-gray-400">
                    {new Date(list.created_at).toLocaleDateString('nb-NO')}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {(!lists || lists.length === 0) && (
        <Card>
          <CardContent className="py-12">
            <EmptyState
              icon={
                <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              }
              title="Ingen handlelister ennå"
              description="Opprett en liste fra ukesmenyen eller start fra bunnen"
              action={
                <Link href="/shopping/new">
                  <Button>Opprett din første liste</Button>
                </Link>
              }
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
