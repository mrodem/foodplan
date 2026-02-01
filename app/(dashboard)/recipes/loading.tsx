export default function Loading() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="animate-pulse">
        <div className="flex items-center justify-between mb-6">
          <div className="h-8 bg-gray-200 rounded w-32" />
          <div className="h-10 bg-gray-200 rounded w-40" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
