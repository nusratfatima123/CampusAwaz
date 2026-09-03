import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { LoginForm } from '@/components/auth/LoginForm';
import { LoadingBlock } from '@/components/ui/Spinner';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your CampusAwaz student account.',
};

export default function LoginPage() {
  return (
    <div className="bg-gray-50 py-16 md:py-24">
      <div className="container-page">
        <div className="mx-auto max-w-md">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Welcome back
            </h1>
            <p className="mt-3 text-base text-slate-600">
              Sign in to track your complaints and support requests.
            </p>
          </div>

          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
            <Suspense fallback={<LoadingBlock label="Preparing sign in…" />}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            New to CampusAwaz?{' '}
            <Link
              href="/register"
              className="rounded font-semibold text-blue-900 hover:underline"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
