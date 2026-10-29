import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown at once when moving between CRM pages, while the page checks the
 * session and loads its data (Next.js instant navigation). The sidebar stays.
 */
export default function CrmLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-3 h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-96 max-w-full" />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="mt-6 h-64 w-full" />
    </div>
  );
}
