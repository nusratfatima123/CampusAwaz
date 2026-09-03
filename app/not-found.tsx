import { FileQuestion } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';
import { Logo } from '@/components/ui/Logo';

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-5 py-16 text-center"
    >
      <Logo className="mb-10" />

      <span
        className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50"
        aria-hidden="true"
      >
        <FileQuestion className="h-8 w-8 text-blue-900" />
      </span>

      <p className="text-sm font-semibold uppercase tracking-wide text-blue-900">
        Error 404
      </p>
      <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
        Page not found
      </h1>
      <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600">
        The page you are looking for does not exist, or it may have moved.
      </p>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <ButtonLink href="/">Back to home</ButtonLink>
        <ButtonLink href="/login" variant="secondary">
          Sign in
        </ButtonLink>
      </div>
    </main>
  );
}
