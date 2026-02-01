export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 bg-gray-200 rounded w-32" />
          <div className="flex gap-2">
            <div className="h-9 w-9 bg-gray-200 rounded" />
            <div className="h-9 w-16 bg-gray-200 rounded" />
            <div className="h-9 w-9 bg-gray-200 rounded" />
          </div>
        </div>
        <div className="h-6 bg-gray-200 rounded w-48 mb-4" />
        <div className="bg-gray-200 rounded-xl h-96" />
      </div>
    </div>
  );
}
