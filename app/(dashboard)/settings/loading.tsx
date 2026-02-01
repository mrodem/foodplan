export default function Loading() {
  return (
    <div className="max-w-2xl mx-auto">
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-32 mb-6" />
        <div className="space-y-6">
          <div className="h-32 bg-gray-200 rounded-xl" />
          <div className="h-48 bg-gray-200 rounded-xl" />
        </div>
      </div>
    </div>
  );
}
