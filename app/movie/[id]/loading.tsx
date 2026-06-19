// app/movie/[id]/loading.tsx

export default function MovieLoading() {
  return (
    <div className="animate-pulse">
      {/* Hero skeleton */}
      <div className="relative h-[60vh] bg-surface-800">
        <div className="absolute bottom-0 left-0 right-0 p-8 max-w-7xl mx-auto">
          <div className="flex gap-6 items-end">
            <div className="hidden sm:block w-44 h-64 skeleton rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="flex gap-2">
                <div className="skeleton h-6 w-20 rounded-full" />
                <div className="skeleton h-6 w-16 rounded-full" />
              </div>
              <div className="skeleton h-10 w-3/4 rounded-lg" />
              <div className="skeleton h-4 w-1/2 rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
            </div>
          </div>
        </div>
      </div>

      {/* Content skeleton */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            {/* Cast */}
            <div className="skeleton h-6 w-32 rounded" />
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="text-center">
                  <div className="skeleton w-16 h-16 rounded-full mx-auto mb-2" />
                  <div className="skeleton h-3 w-full rounded" />
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="card p-5">
              <div className="skeleton h-6 w-36 rounded mb-4" />
              <div className="skeleton h-12 w-full rounded-xl mb-2" />
              <div className="skeleton h-12 w-full rounded-xl mb-3" />
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="skeleton h-14 w-full rounded-xl mb-2" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
