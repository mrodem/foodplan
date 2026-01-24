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
          <span className="text-2xl font-bold text-green-600">GroceryApp</span>
          <div className="flex gap-4">
            <Link
              href="/auth/login"
              className="px-4 py-2 text-green-700 hover:text-green-800 font-medium"
            >
              Sign in
            </Link>
            <Link
              href="/auth/signup"
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium"
            >
              Get started
            </Link>
          </div>
        </nav>

        <div className="text-center max-w-3xl mx-auto">
          <h1 className="text-5xl font-bold text-gray-900 mb-6">
            Family meal planning made simple
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Plan your meals, share recipes, and shop together. Real-time shopping lists
            keep everyone in sync at the store.
          </p>
          <Link
            href="/auth/signup"
            className="inline-block px-8 py-4 bg-green-600 text-white text-lg rounded-xl hover:bg-green-700 font-medium shadow-lg hover:shadow-xl transition-all"
          >
            Start for free
          </Link>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<RecipeIcon />}
            title="Recipe Database"
            description="Build your family's recipe collection with ingredients organized by store aisle."
          />
          <FeatureCard
            icon={<CalendarIcon />}
            title="Meal Planning"
            description="Plan your week's dinners with an easy calendar view. See what you haven't had in a while."
          />
          <FeatureCard
            icon={<CartIcon />}
            title="Smart Shopping"
            description="Generate shopping lists from your meal plan. Check off items in real-time together."
          />
        </div>

        <div className="mt-24 bg-white rounded-2xl p-8 shadow-lg">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <Step number={1} title="Create household" description="Set up your family group and invite members" />
            <Step number={2} title="Add recipes" description="Build your recipe collection with ingredients" />
            <Step number={3} title="Plan meals" description="Assign dinners to days of the week" />
            <Step number={4} title="Shop together" description="Generate lists and check off items in real-time" />
          </div>
        </div>
      </div>

      <footer className="border-t border-green-200 mt-24 py-8">
        <div className="max-w-6xl mx-auto px-4 text-center text-gray-500">
          <p>Built with Next.js, Supabase, and Tailwind CSS</p>
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
