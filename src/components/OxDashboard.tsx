import { LayoutDashboard, Inbox, Bot, Clock, CheckCircle, TrendingUp } from 'lucide-react';
import { useStore } from '../store/store';

export default function OxDashboard() {
  const { tasks, connected } = useStore();
  
  // Filter tasks assigned to ox/worker
  const myTasks = tasks.filter(t => 
    t.assignedTo === 'ox' || 
    t.assignedTo === 'worker' || 
    t.assignedTo === 'onchain_worker'
  );
  
  const stats = {
    pending: myTasks.filter(t => t.status === 'todo').length,
    inProgress: myTasks.filter(t => t.status === 'in-progress').length,
    review: myTasks.filter(t => t.status === 'review').length,
    done: myTasks.filter(t => t.status === 'done').length,
  };

  const QuickStat = ({ icon: Icon, label, value, color }: {
    icon: any; label: string; value: number; color: string;
  }) => (
    <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 flex items-center gap-4">
      <div className={`p-3 rounded-lg ${color}`}>
        <Icon size={24} className="text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-sm text-slate-400">{label}</p>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-slate-900">
      {/* Header */}
      <div className="p-6 border-b border-slate-800">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-3xl">
            🐂
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Ox Lite Dashboard</h1>
            <p className="text-slate-400">Bitso Master Sub-Agent Control Center</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-slate-400">
              {connected ? 'Connected to Froggo' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="p-6">
        <h2 className="text-lg font-medium text-white mb-4">Quick Stats</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <QuickStat icon={Inbox} label="Pending Tasks" value={stats.pending} color="bg-slate-600" />
          <QuickStat icon={Clock} label="In Progress" value={stats.inProgress} color="bg-amber-600" />
          <QuickStat icon={Bot} label="In Review" value={stats.review} color="bg-purple-600" />
          <QuickStat icon={CheckCircle} label="Completed" value={stats.done} color="bg-green-600" />
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="flex-1 overflow-y-auto p-6 pt-0">
        <h2 className="text-lg font-medium text-white mb-4">Recent Tasks</h2>
        <div className="space-y-3">
          {myTasks.slice(0, 5).map(task => (
            <div
              key={task.id}
              className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 hover:border-amber-600/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${
                  task.status === 'done' ? 'bg-green-500' :
                  task.status === 'in-progress' ? 'bg-warning' :
                  task.status === 'review' ? 'bg-purple-500' : 'bg-slate-500'
                }`} />
                <h3 className="flex-1 font-medium text-white truncate">{task.title}</h3>
                <span className="text-xs text-slate-500 capitalize px-2 py-1 rounded bg-slate-700">
                  {task.status.replace('-', ' ')}
                </span>
              </div>
            </div>
          ))}
          {myTasks.length === 0 && (
            <div className="text-center py-12 text-slate-500">
              <Inbox size={48} className="mx-auto mb-4 opacity-50" />
              <p>No tasks assigned yet</p>
              <p className="text-sm">Tasks from Froggo will appear here</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-800 text-center text-xs text-slate-600">
        Ox Lite v1.0.0 • Bitso Onchain Worker • 🐂
      </div>
    </div>
  );
}
