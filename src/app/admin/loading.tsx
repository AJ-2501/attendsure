export default function AdminLoading() {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading admin content…">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 bg-[#dce7e5] rounded-xl" />
          <div className="h-4 w-60 bg-[#e4eeec] rounded-lg" />
        </div>
        <div className="h-9 w-28 bg-[#dce7e5] rounded-xl" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="h-20 bg-white rounded-2xl border border-[#dce7e5]" />
        <div className="h-20 bg-white rounded-2xl border border-[#dce7e5]" />
        <div className="h-20 bg-white rounded-2xl border border-[#dce7e5]" />
        <div className="h-20 bg-white rounded-2xl border border-[#dce7e5]" />
      </div>

      <div className="card p-6 h-64 bg-white border border-[#dce7e5]" />
    </div>
  );
}
