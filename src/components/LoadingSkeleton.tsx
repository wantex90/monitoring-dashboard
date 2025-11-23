export function ServerCardSkeleton() {
  return (
    <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-6 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <div className="h-6 bg-gray-700 rounded w-1/2 mb-2"></div>
          <div className="h-4 bg-gray-700 rounded w-2/3"></div>
        </div>
        <div className="h-8 w-20 bg-gray-700 rounded-full"></div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="h-3 bg-gray-700 rounded w-16 mb-2"></div>
          <div className="h-5 bg-gray-700 rounded w-20"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-700 rounded w-16 mb-2"></div>
          <div className="h-5 bg-gray-700 rounded w-20"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-700 rounded w-16 mb-2"></div>
          <div className="h-5 bg-gray-700 rounded w-20"></div>
        </div>
        <div>
          <div className="h-3 bg-gray-700 rounded w-16 mb-2"></div>
          <div className="h-5 bg-gray-700 rounded w-20"></div>
        </div>
      </div>

      <div className="h-4 bg-gray-700 rounded w-3/4"></div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 mb-8 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-gray-700 rounded-lg"></div>
              <div className="h-8 w-16 bg-gray-700 rounded"></div>
            </div>
            <div className="h-4 bg-gray-700 rounded w-24"></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 bg-gray-700 rounded"></div>
                <div className="h-4 bg-gray-700 rounded w-24"></div>
              </div>
              <div className="h-6 w-16 bg-gray-700 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
