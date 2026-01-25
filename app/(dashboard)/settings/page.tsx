'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Modal, Badge } from '@/components/ui';
import { CATEGORY_LABELS, type IngredientCategory } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [user, setUser] = useState<{ id: string; email: string; name: string } | null>(null);
  const [household, setHousehold] = useState<{ id: string; name: string } | null>(null);
  const [members, setMembers] = useState<{ id: string; user_id: string; role: string; name: string }[]>([]);
  const [invites, setInvites] = useState<{ id: string; email: string; created_at: string }[]>([]);
  const [pendingInvites, setPendingInvites] = useState<{ id: string; household_id: string; households: { name: string } }[]>([]);
  const [categoryOrders, setCategoryOrders] = useState<{ category: IngredientCategory; sort_order: number }[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  // Modal states
  const [showCreateHousehold, setShowCreateHousehold] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [householdName, setHouseholdName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get current user's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('name')
      .eq('user_id', user.id)
      .single();

    setUser({ id: user.id, email: user.email!, name: profile?.name || 'Ukjent' });

    // Get user's household membership
    const { data: membership } = await supabase
      .from('household_members')
      .select('household_id, role, households(id, name)')
      .eq('user_id', user.id)
      .single();

    if (membership?.households) {
      const householdData = membership.households as unknown as { id: string; name: string };
      setHousehold({ id: householdData.id, name: householdData.name });
      setIsAdmin(membership.role === 'admin');

      // Get members
      const { data: membersData } = await supabase
        .from('household_members')
        .select('id, user_id, role')
        .eq('household_id', membership.household_id);

      if (membersData) {
        // Get profiles for all members
        const userIds = membersData.map((m) => m.user_id);
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);

        const profileMap = new Map(
          (profilesData || []).map((p) => [p.user_id, p.name])
        );

        const membersWithNames = membersData.map((m) => ({
          id: m.id,
          user_id: m.user_id,
          role: m.role,
          name: profileMap.get(m.user_id) || 'Ukjent',
        }));
        setMembers(membersWithNames);
      }

      // Get invites
      const { data: invitesData } = await supabase
        .from('household_invites')
        .select('id, email, created_at')
        .eq('household_id', membership.household_id)
        .gt('expires_at', new Date().toISOString());

      if (invitesData) {
        setInvites(invitesData);
      }

      // Get category orders
      const { data: ordersData } = await supabase
        .from('category_orders')
        .select('category, sort_order')
        .eq('household_id', membership.household_id)
        .order('sort_order');

      if (ordersData) {
        setCategoryOrders(ordersData);
      }
    }

    // Check for pending invites to this user
    const { data: pendingData } = await supabase
      .from('household_invites')
      .select('id, household_id, households(name)')
      .eq('email', user.email!)
      .gt('expires_at', new Date().toISOString());

    if (pendingData) {
      setPendingInvites(pendingData as unknown as typeof pendingInvites);
    }

    setLoading(false);
  }

  async function createHousehold() {
    if (!householdName.trim()) {
      setError('Vennligst skriv inn et husstandsnavn');
      return;
    }

    setActionLoading(true);
    setError(null);

    // Create household
    const { data: newHousehold, error: householdError } = await supabase
      .from('households')
      .insert({ name: householdName })
      .select()
      .single();

    if (householdError) {
      setError(householdError.message);
      setActionLoading(false);
      return;
    }

    // Add user as admin
    const { error: memberError } = await supabase
      .from('household_members')
      .insert({
        household_id: newHousehold.id,
        user_id: user!.id,
        role: 'admin',
      });

    if (memberError) {
      setError(memberError.message);
      setActionLoading(false);
      return;
    }

    setShowCreateHousehold(false);
    setHouseholdName('');
    router.refresh();
    loadData();
    setActionLoading(false);
  }

  async function acceptInvite(inviteId: string, householdId: string) {
    setActionLoading(true);

    // Add user to household
    const { error: memberError } = await supabase
      .from('household_members')
      .insert({
        household_id: householdId,
        user_id: user!.id,
        role: 'member',
      });

    if (memberError) {
      setError(memberError.message);
      setActionLoading(false);
      return;
    }

    // Delete the invite
    await supabase.from('household_invites').delete().eq('id', inviteId);

    router.refresh();
    loadData();
    setActionLoading(false);
  }

  async function sendInvite() {
    if (!inviteEmail.trim()) {
      setError('Vennligst skriv inn en e-postadresse');
      return;
    }

    setActionLoading(true);
    setError(null);

    const { error: inviteError } = await supabase
      .from('household_invites')
      .insert({
        household_id: household!.id,
        email: inviteEmail,
        invited_by: user!.id,
      });

    if (inviteError) {
      setError(inviteError.message);
      setActionLoading(false);
      return;
    }

    setShowInvite(false);
    setInviteEmail('');
    loadData();
    setActionLoading(false);
  }

  async function cancelInvite(inviteId: string) {
    await supabase.from('household_invites').delete().eq('id', inviteId);
    loadData();
  }

  async function moveCategoryUp(index: number) {
    if (index === 0) return;
    const newOrders = [...categoryOrders];
    [newOrders[index - 1], newOrders[index]] = [newOrders[index], newOrders[index - 1]];
    await updateCategoryOrders(newOrders);
  }

  async function moveCategoryDown(index: number) {
    if (index === categoryOrders.length - 1) return;
    const newOrders = [...categoryOrders];
    [newOrders[index], newOrders[index + 1]] = [newOrders[index + 1], newOrders[index]];
    await updateCategoryOrders(newOrders);
  }

  async function updateCategoryOrders(newOrders: typeof categoryOrders) {
    setCategoryOrders(newOrders);

    const updates = newOrders.map((order, index) => ({
      household_id: household!.id,
      category: order.category,
      sort_order: index + 1,
    }));

    for (const update of updates) {
      await supabase
        .from('category_orders')
        .update({ sort_order: update.sort_order })
        .eq('household_id', update.household_id)
        .eq('category', update.category);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Innstillinger</h1>
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Innstillinger</h1>

      {/* Pending invites */}
      {pendingInvites.length > 0 && !household && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle>Ventende invitasjoner</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex items-center justify-between p-3 bg-white rounded-lg">
                  <span className="font-medium">{invite.households.name}</span>
                  <Button
                    size="sm"
                    onClick={() => acceptInvite(invite.id, invite.household_id)}
                    isLoading={actionLoading}
                  >
                    Godta
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Household section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Husstand</CardTitle>
        </CardHeader>
        <CardContent>
          {household ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="font-semibold text-lg">{household.name}</p>
                  <p className="text-sm text-gray-500">{members.length} medlem(mer)</p>
                </div>
                {isAdmin && (
                  <Badge variant="success">Administrator</Badge>
                )}
              </div>

              <div className="border-t pt-4">
                <h4 className="font-medium mb-3">Medlemmer</h4>
                <div className="space-y-2">
                  {members.map((member) => (
                    <div key={member.id} className="flex items-center justify-between py-2">
                      <span className="text-sm">{member.name}</span>
                      <Badge>{member.role === 'admin' ? 'Admin' : 'Medlem'}</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {isAdmin && (
                <>
                  <div className="border-t pt-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">Ventende invitasjoner</h4>
                      <Button size="sm" variant="outline" onClick={() => setShowInvite(true)}>
                        Inviter medlem
                      </Button>
                    </div>
                    {invites.length > 0 ? (
                      <div className="space-y-2">
                        {invites.map((invite) => (
                          <div key={invite.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg">
                            <span className="text-sm">{invite.email}</span>
                            <button
                              onClick={() => cancelInvite(invite.id)}
                              className="text-sm text-red-600 hover:text-red-700"
                            >
                              Avbryt
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">Ingen ventende invitasjoner</p>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-500 mb-4">
                Du er ikke del av en husstand ennå. Opprett en eller vent på en invitasjon.
              </p>
              <Button onClick={() => setShowCreateHousehold(true)}>
                Opprett husstand
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Category order */}
      {household && (
        <Card>
          <CardHeader>
            <CardTitle>Kategorirekkefølge</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-500 mb-4">
              Endre rekkefølgen på kategoriene så de matcher butikken din. Handlelister grupperes i denne rekkefølgen.
            </p>
            <div className="space-y-2">
              {categoryOrders.map((order, index) => (
                <div
                  key={order.category}
                  className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded-lg"
                >
                  <span className="font-medium">{CATEGORY_LABELS[order.category]}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveCategoryUp(index)}
                      disabled={index === 0}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveCategoryDown(index)}
                      disabled={index === categoryOrders.length - 1}
                      className="p-1 text-gray-400 hover:text-gray-600 disabled:opacity-30"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create household modal */}
      <Modal
        isOpen={showCreateHousehold}
        onClose={() => setShowCreateHousehold(false)}
        title="Opprett husstand"
      >
        <div className="space-y-4">
          <Input
            label="Husstandsnavn"
            value={householdName}
            onChange={(e) => setHouseholdName(e.target.value)}
            placeholder="f.eks. Familien Hansen"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowCreateHousehold(false)}>
              Avbryt
            </Button>
            <Button onClick={createHousehold} isLoading={actionLoading}>
              Opprett
            </Button>
          </div>
        </div>
      </Modal>

      {/* Invite modal */}
      <Modal
        isOpen={showInvite}
        onClose={() => setShowInvite(false)}
        title="Inviter medlem"
      >
        <div className="space-y-4">
          <Input
            label="E-postadresse"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="familie@eksempel.no"
          />
          <p className="text-sm text-gray-500">
            De vil se invitasjonen når de registrerer seg eller logger inn med denne e-posten.
          </p>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setShowInvite(false)}>
              Avbryt
            </Button>
            <Button onClick={sendInvite} isLoading={actionLoading}>
              Send invitasjon
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
