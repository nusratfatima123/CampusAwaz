import { LoadingBlock } from '@/components/ui/Spinner';

export default function ComplaintsLoading() {
  return (
    <div className="container-page max-w-4xl py-10 md:py-14">
      <LoadingBlock label="Loading complaint…" />
    </div>
  );
}
