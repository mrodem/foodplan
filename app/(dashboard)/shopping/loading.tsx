export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 bg-gray-200 rounded w-32" />
          <div className="h-10 bg-gray-200 rounded w-28" />
        </div>
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
