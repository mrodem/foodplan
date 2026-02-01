export default function Loading() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-24 mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-64 bg-gray-200 rounded-xl" />
          <div className="h-64 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
