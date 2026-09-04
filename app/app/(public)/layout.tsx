import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/landing/Footer';

/** Shell for all public (unauthenticated) pages. */
export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
