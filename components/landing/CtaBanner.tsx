import { ArrowRight } from 'lucide-react';
import { ButtonLink } from '@/components/ui/Button';

export function CtaBanner() {
  return (
    <section className="bg-white pb-16 md:pb-24">
      <div className="container-page">
        <div className="overflow-hidden rounded-2xl bg-blue-900 px-6 py-14 text-center shadow-sm md:px-12 md:py-20">
          <h2 className="mx-auto max-w-2xl text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            Your experience matters. Your voice can create change.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-blue-100">
            Create your verified student account and be ready the moment you need to
            be heard.
          </p>
          <div className="mt-9 flex justify-center">
            <ButtonLink href="/register" variant="inverse" size="lg">
              Submit Your First Complaint
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  );
}
