import type { Metadata } from 'next';
import { Hero } from '@/components/landing/Hero';
import { Features } from '@/components/landing/Features';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { Categories } from '@/components/landing/Categories';
import { Resources } from '@/components/landing/Resources';
import { CtaBanner } from '@/components/landing/CtaBanner';

export const metadata: Metadata = {
  title: 'CampusAwaz — Your Voice. Your Safety. Your Rights.',
  description:
    'A trusted platform for university students to report problems, seek support, and track real action — safely and confidentially.',
};

export default function LandingPage() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Categories />
      <Resources />
      <CtaBanner />
    </>
  );
}
