import { createClient } from '@/lib/supabase/server';
import { getCurrentUser, addWorkItem, addDependency, assignMember, signOut } from '@/app/actions/actions';
import { redirect } from 'next/navigation';
import DependencyGraph from '@/components/DependencyGraph';

export default async function AdminDashboard() {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') redirect('/login');

  const supabase = await createClient();
  const { data: items } = await supabase.from('work_items').select('*, users(email)').order('created_at', { ascending: false });
  const { data: dependencies } = await supabase.from('dependencies').select('*');
  const { data: members } = await supabase.from('users').select('*');

  // ── Stats ──
  const totalTasks = items?.length || 0;
  const blockedTasks = items?.filter((i: any) => i.status === 'blocked') || [];
  const inProgressTasks = items?.filter((i: any) => i.status === 'in-progress') || [];
  const doneTasks = items?.filter((i: any) => i.status === 'done') || [];

  // Bottleneck: tasks that are blocking the most downstream tasks
  const blockingCount: Record<string, number> = {};
  (dependencies || []).forEach((d: any) => {
    blockingCount[d.predecessor_id] = (blockingCount[d.predecessor_id] || 0) + 1;
  });
  const bottlenecks = Object.entries(blockingCount)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id, count]) => ({
      item: items?.find((i: any) => i.id === id),
      count,
    }))
    .filter(b => b.item);

  // Member workload
  const workload: Record<string, { email: string; count: number; blocked: number }> = {};
  (items || []).forEach((item: any) => {
    if (item.assigned_user_id) {
      if (!workload[item.assigned_user_id]) {
        const m = members?.find((u: any) => u.id === item.assigned_user_id);
        workload[item.assigned_user_id] = { email: m?.email || 'Unknown', count: 0, blocked: 0 };
      }
      workload[item.assigned_user_id].count++;
      if (item.status === 'blocked') workload[item.assigned_user_id].blocked++;
    }
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Nav */}
      <nav className="border-b border-white/10 bg-black/20 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-white">⚡ Work Process Tracker</h1>
          <div className="flex items-center gap-4">
            <span className="text-blue-300 text-sm">{user.email} (admin)</span>
            <form action={signOut}>
              <button type="submit" className="text-sm text-red-300 hover:text-red-100 transition">Sign Out</button>
            </form>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* ── Stats Cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/10">
            <div className="text-3xl font-bold text-white">{totalTasks}</div>
            <div className="text-blue-300 text-sm">Total Tasks</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/10">
            <div className="text-3xl font-bold text-blue-400">{inProgressTasks.length}</div>
            <div className="text-blue-300 text-sm">In Progress</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/10">
            <div className="text-3xl font-bold text-red-400">{blockedTasks.length}</div>
            <div className="text-blue-300 text-sm">Blocked</div>
          </div>
          <div className="bg-white/10 backdrop-blur rounded-xl p-5 border border-white/10">
            <div className="text-3xl font-bold text-green-400">{doneTasks.length}</div>
            <div className="text-blue-300 text-sm">Done</div>
          </div>
        </div>

        {/* ── Create Work Item + Create Dependency ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Create Work Item</h2>
            <form action={addWorkItem} className="space-y-3">
              <input name="title" placeholder="Title" required className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <textarea name="description" placeholder="Description" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-blue-400" rows={2} />
              <select name="priority" defaultValue="medium" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
              <input name="required_skills" placeholder="Required Skills (comma separated)" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <select name="assigned_user_id" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Unassigned</option>
                {members?.filter((m: any) => m.role === 'member').map((m: any) => (
                  <option key={m.id} value={m.id}>{m.email} — {(m.skills || []).join(', ') || 'No skills'}</option>
                ))}
              </select>
              <button type="submit" className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold transition">Create Task</button>
            </form>
          </div>

          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">Create Dependency</h2>
            <form action={addDependency} className="space-y-3">
              <select name="predecessor_id" required className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Select Predecessor (must finish first)</option>
                {items?.map((item: any) => <option key={item.id} value={item.id}>{item.title} ({item.status})</option>)}
              </select>
              <select name="successor_id" required className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Select Successor (depends on above)</option>
                {items?.map((item: any) => <option key={item.id} value={item.id}>{item.title} ({item.status})</option>)}
              </select>
              <select name="type" className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                <option value="full">Full (100% completion required)</option>
                <option value="partial">Partial (custom threshold)</option>
              </select>
              <input name="threshold" type="number" min={1} max={100} defaultValue={100} placeholder="Threshold %" className="w-full px-3 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-blue-300/40 focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <p className="text-xs text-blue-300/60">Cycle detection will reject circular dependencies automatically.</p>
              <button type="submit" className="w-full py-2 rounded-lg bg-green-600 hover:bg-green-500 text-white font-semibold transition">Add Dependency</button>
            </form>
          </div>
        </div>

        {/* ── Dependency Graph ── */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">📊 Process Flow — Dependency Graph</h2>
          <DependencyGraph items={items || []} dependencies={dependencies || []} />
        </div>

        {/* ── All Work Items Table ── */}
        <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10 overflow-x-auto">
          <h2 className="text-lg font-semibold text-white mb-4">All Work Items</h2>
          <table className="w-full text-sm text-left">
            <thead className="text-blue-300/70 border-b border-white/10">
              <tr>
                <th className="py-2 px-3">Title</th>
                <th className="py-2 px-3">Priority</th>
                <th className="py-2 px-3">Status</th>
                <th className="py-2 px-3">Progress</th>
                <th className="py-2 px-3">Assigned To</th>
                <th className="py-2 px-3">Skills</th>
              </tr>
            </thead>
            <tbody className="text-white/90">
              {items?.map((item: any) => (
                <tr key={item.id} className="border-b border-white/5 hover:bg-white/5">
                  <td className="py-3 px-3 font-medium">{item.title}</td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      item.priority === 'critical' ? 'bg-red-500/20 text-red-300' :
                      item.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                      item.priority === 'medium' ? 'bg-yellow-500/20 text-yellow-300' :
                      'bg-gray-500/20 text-gray-300'
                    }`}>{item.priority}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      item.status === 'done' ? 'bg-green-500/20 text-green-300' :
                      item.status === 'in-progress' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>{item.status}</span>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2">
                      <div className="w-20 h-2 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-blue-400 rounded-full" style={{ width: `${item.progress}%` }} />
                      </div>
                      <span className="text-xs">{item.progress}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3 text-xs">{(item as any).users?.email || '—'}</td>
                  <td className="py-3 px-3 text-xs">{(item.required_skills || []).join(', ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Bottlenecks ── */}
        {bottlenecks.length > 0 && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">🚧 Bottleneck Tasks</h2>
            <p className="text-blue-300/60 text-sm mb-3">Tasks that are blocking the most downstream work items.</p>
            <div className="space-y-2">
              {bottlenecks.map(({ item, count }: any) => (
                <div key={item.id} className="flex items-center justify-between bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                  <div>
                    <span className="text-white font-medium">{item.title}</span>
                    <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                      item.status === 'done' ? 'bg-green-500/20 text-green-300' :
                      item.status === 'in-progress' ? 'bg-blue-500/20 text-blue-300' :
                      'bg-red-500/20 text-red-300'
                    }`}>{item.status} ({item.progress}%)</span>
                  </div>
                  <span className="text-red-300 font-bold text-sm">Blocking {count} task{count > 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Member Workload ── */}
        {Object.keys(workload).length > 0 && (
          <div className="bg-white/10 backdrop-blur rounded-xl p-6 border border-white/10">
            <h2 className="text-lg font-semibold text-white mb-4">👥 Member Workload</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(workload).map(([uid, data]: any) => (
                <div key={uid} className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-white font-medium text-sm">{data.email}</div>
                  <div className="text-blue-300 text-xs mt-1">{data.count} tasks assigned · {data.blocked} blocked</div>
                  {data.count > 5 && (
                    <div className="mt-2 text-xs text-orange-300 font-semibold">⚠ Overloaded</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
