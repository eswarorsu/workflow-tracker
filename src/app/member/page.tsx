import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, updateProgress, markBlocked, signOut } from '@/app/actions/actions';
import { redirect } from 'next/navigation';

export default async function MemberDashboard() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const supabase = await createClient();

  // Fetch tasks assigned to this member (or all for demo)
  const { data: allItems } = await supabase
    .from('work_items')
    .select('*')
    .order('created_at', { ascending: false });

  // Filter: show assigned tasks + any tasks to demonstrate
  const myItems = allItems?.filter((i: any) => i.assigned_user_id === user.id) || [];
  const otherItems = allItems?.filter((i: any) => i.assigned_user_id !== user.id) || [];

  // Fetch dependencies to find what THIS user's tasks are blocking
  const { data: dependencies } = await supabase.from('dependencies').select('*');

  // Calculate downstream impact for each of user's tasks
  function getDownstreamTasks(itemId: string) {
    return (dependencies || [])
      .filter((d: any) => d.predecessor_id === itemId)
      .map((d: any) => {
        const successor = allItems?.find((i: any) => i.id === d.successor_id);
        return successor ? { ...successor, depType: d.type, threshold: d.threshold } : null;
      })
      .filter(Boolean);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Nav */}
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">⚡ Work Process Tracker</h1>
          <div className="flex items-center gap-4">
            <span className="text-blue-300 text-sm">{user.email} ({user.role})</span>
            {user.role === 'admin' && (
              <a href="/admin" className="text-sm text-blue-300 hover:text-white transition">Admin View</a>
            )}
            <form action={signOut}>
              <button type="submit" className="text-sm text-red-300 hover:text-red-100 transition">Sign Out</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        <h2 className="text-2xl font-bold text-white">My Assigned Tasks</h2>

        {myItems.length === 0 && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-8 border border-white/10 text-center">
            <p className="text-blue-300">No tasks assigned to you yet.</p>
          </div>
        )}

        {myItems.map((item: any) => {
          const downstream = getDownstreamTasks(item.id);
          return (
            <div key={item.id} className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xl font-bold text-white">{item.title}</h3>
                  <p className="text-blue-300/70 text-sm mt-1">{item.description}</p>
                </div>
                <div className="flex gap-2">
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    item.priority === 'critical' ? 'bg-red-500/20 text-red-300' :
                    item.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                    item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-gray-500/20 text-gray-300'
                  }`}>{item.priority}</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                    item.status === 'done' ? 'bg-green-500/20 text-green-300' :
                    item.status === 'in-progress' ? 'bg-blue-500/20 text-blue-300' :
                    'bg-red-500/20 text-red-300'
                  }`}>{item.status}</span>
                </div>
              </div>

              {item.blocked_reason && item.status === 'blocked' && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 text-red-300 text-sm">
                  <strong>Blocked:</strong> {item.blocked_reason}
                </div>
              )}

              {/* Progress Update */}
              <form action={updateProgress} className="space-y-2">
                <input type="hidden" name="item_id" value={item.id} />
                <label className="text-sm text-blue-200 font-medium">Progress: {item.progress}%</label>
                <div className="flex items-center gap-4">
                  <input
                    name="progress"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    defaultValue={item.progress}
                    disabled={item.status === 'blocked'}
                    className="flex-1 accent-blue-500"
                  />
                  <button
                    type="submit"
                    disabled={item.status === 'blocked'}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Save
                  </button>
                </div>
                {item.status === 'blocked' && (
                  <p className="text-xs text-red-300/60">This task is blocked — its dependencies haven&apos;t been met yet.</p>
                )}
              </form>

              {/* Mark Blocked */}
              {item.status !== 'blocked' && item.status !== 'done' && (
                <form action={markBlocked} className="flex gap-2">
                  <input type="hidden" name="item_id" value={item.id} />
                  <input name="reason" placeholder="Reason for blocking..." required className="flex-1 px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-300/40 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
                  <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-semibold transition">
                    Mark Blocked
                  </button>
                </form>
              )}

              {/* Downstream Impact */}
              {downstream.length > 0 && (
                <div className="mt-2 pt-3 border-t border-white/10">
                  <p className="text-xs text-orange-300 font-semibold mb-2">⚡ Your task is blocking {downstream.length} other task(s):</p>
                  <div className="flex flex-wrap gap-2">
                    {downstream.map((d: any) => (
                      <span key={d.id} className="bg-orange-500/10 border border-orange-500/20 text-orange-200 px-3 py-1 rounded-full text-xs">
                        {d.title} ({d.depType} @ {d.threshold}%)
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {/* Show other tasks for demo visibility */}
        {otherItems.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-bold text-white mb-4">All Tasks Overview</h2>
            <div className="space-y-3">
              {otherItems.map((item: any) => (
                <div key={item.id} className="bg-white/5 rounded-lg p-4 border border-white/5 flex justify-between items-center">
                  <div>
                    <span className="text-white font-medium text-sm">{item.title}</span>
                    <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                      item.status === 'done' ? 'bg-green-500/20 text-green-300' :
                      item.status === 'in-progress' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>{item.status}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div className="h-full bg-blue-400 rounded-full" style={{ width: `${item.progress}%` }} />
                    </div>
                    <span className="text-blue-300 text-xs">{item.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
