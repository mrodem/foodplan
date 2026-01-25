import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { Sidebar } from '@/components/ui/sidebar';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user's profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('name')
    .eq('user_id', user.id)
    .single();

  // Check if user has a household
  const { data: membership } = await supabase
    .from('household_members')
    .select('household_id, households(id, name)')
    .eq('user_id', user.id)
    .single();

  const needsHousehold = !membership;

  // Extract household info (Supabase returns joined data as an object for single relations)
  const household = membership?.households as unknown as { id: string; name: string } | null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar
        userName={profile?.name || 'Bruker'}
        userEmail={user.email!}
        householdName={household?.name}
        needsHousehold={needsHousehold}
      />
      <main className="lg:pl-64">
        <div className="px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}
