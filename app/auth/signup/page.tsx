'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button, Input, Card, CardContent } from '@/components/ui';

export default function SignUpPage() {
  const supabase = createClient();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [signUpComplete, setSignUpComplete] = useState(false);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError('Passordene er ikke like');
      return;
    }

    if (password.length < 6) {
      setError('Passordet må være minst 6 tegn');
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
      return;
    }

    setSignUpComplete(true);
    setIsLoading(false);
  };

  if (signUpComplete) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Sjekk e-posten din</h2>
            <p className="text-gray-500 mb-4">
              Vi har sendt en bekreftelseslenke til <strong>{email}</strong>
            </p>
            <p className="text-sm text-gray-400">
              Klikk på lenken i e-posten for å aktivere kontoen din.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <Card className="w-full max-w-md">
        <CardContent className="py-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Opprett en konto</h1>
            <p className="text-gray-500 mt-1">Start med å planlegge familiens måltider</p>
          </div>

          <form onSubmit={handleSignUp} className="space-y-4">
            <Input
              id="email"
              type="email"
              label="E-post"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="deg@eksempel.no"
              required
            />

            <Input
              id="password"
              type="password"
              label="Passord"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minst 6 tegn"
              required
            />

            <Input
              id="confirmPassword"
              type="password"
              label="Bekreft passord"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Bekreft passordet ditt"
              required
            />

            {error && (
              <p className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</p>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              Opprett konto
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Har du allerede en konto?{' '}
            <Link href="/auth/login" className="text-green-600 hover:text-green-700 font-medium">
              Logg inn
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
