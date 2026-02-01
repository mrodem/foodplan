import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function LandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-green-100">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <nav className="flex items-center justify-between mb-16">
          <div className="flex items-center">
            <LogoIcon className="h-9 w-9 text-green-600 mr-2" />
            <span className="text-2xl font-bold text-green-600">MatPlan</span>
          </div>
          <Link
            href="/auth/login"
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
          >
            Logg inn
          </Link>
        </nav>

        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Enkel middagsplanlegging for familien
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Planlegg ukens middager og lag handlelister automatisk basert på neste dagers meny.
          </p>
          <Link
            href="/auth/login"
            className="inline-block px-8 py-4 bg-green-600 text-white text-lg rounded-xl hover:bg-green-700 font-medium shadow-lg hover:shadow-xl transition-all"
          >
            Logg inn
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<RecipeIcon />}
            title="Oppskriftsbibliotek"
            description="Bygg familiens oppskriftsbibliotek med nødvendige ingredienser."
          />
          <FeatureCard
            icon={<CalendarIcon />}
            title="Ukesmeny"
            description="Planlegg ukens middager med en enkel kalendervisning. Se hva dere ikke har laget på lenge."
          />
          <FeatureCard
            icon={<CartIcon />}
            title="Smart handletur"
            description="Generer handlelister fra ukesmenyen. Legg til flere varer etter behov."
          />
        </div>

        <div className="mt-24 bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            Slik fungerer det
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <Step number={1} title="Opprett husstand" description="Sett opp familiegruppen og inviter medlemmer" />
            <Step number={2} title="Legg til oppskrifter" description="Bygg oppskriftsbibliotek med ingredienser" />
            <Step number={3} title="Planlegg middager" description="Fordel middager utover ukedagene" />
            <Step number={4} title="Lag handleliste" description="Lag handleliste sortert etter hyllene i butikken." />
          </div>
        </div>
      </div>

      <footer className="border-t border-green-200 mt-24 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500">
          <p>Bygget med Next.js, Supabase og Tailwind CSS</p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-white rounded-xl p-6 shadow-sm">
      <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center text-green-600 mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="text-center">
      <div className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold mx-auto mb-3">
        {number}
      </div>
      <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
      <p className="text-sm text-gray-600">{description}</p>
    </div>
  );
}

function RecipeIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function CartIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function LogoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor">
      {/* Bowl */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4 11c0 4.418 3.582 8 8 8s8-3.582 8-8H4z"
      />
      {/* Leaf/steam */}
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4c-1.5 0-3 1-3 3 0 1.5 1.5 2 3 2s3-.5 3-2c0-2-1.5-3-3-3z"
        fill="currentColor"
        fillOpacity={0.2}
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M12 9v2"
      />
    </svg>
  );
}
