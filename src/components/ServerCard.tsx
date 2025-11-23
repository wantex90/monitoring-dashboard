import { Server, ServerMetrics } from '../lib/supabase';
import { Cpu, HardDrive, Activity, Clock, Circle } from 'lucide-react';

interface ServerCardProps {
  server: Server;
  metrics?: ServerMetrics;
  onClick: () => void;
}

export function ServerCard({ server, metrics, onClick }: ServerCardProps) {
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'online':
        return 'text-emerald-400';
      case 'offline':
        return 'text-gray-400';
      case 'warning':
        return 'text-amber-400';
      default:
        return 'text-gray-400';
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'online':
        return 'bg-gradient-to-br from-emerald-500/5 to-green-500/5 border-emerald-500/30 hover:border-emerald-500/50';
      case 'offline':
        return 'bg-gradient-to-br from-gray-800/40 to-gray-900/40 border-gray-700/30 hover:border-gray-600/50';
      case 'warning':
        return 'bg-gradient-to-br from-amber-500/5 to-orange-500/5 border-amber-500/30 hover:border-amber-500/50';
      default:
        return 'bg-gradient-to-br from-gray-800/40 to-gray-900/40 border-gray-700/30 hover:border-gray-600/50';
    }
  };

  const lastSeenDate = server.last_seen ? new Date(server.last_seen) : null;
  const lastSeenText = lastSeenDate
    ? `${Math.floor((Date.now() - lastSeenDate.getTime()) / 1000)}s ago`
    : 'Never';

  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-xl border ${getStatusBg(
        server.status
      )} p-6 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-2xl backdrop-blur-sm`}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">{server.name}</h3>
          <p className="text-sm text-gray-400">{server.hostname}</p>
          {server.provider && (
            <p className="text-xs text-gray-500 mt-1">{server.provider}</p>
          )}
          {server.tags && server.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {server.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-xs rounded-full"
                >
                  {tag}
                </span>
              ))}
              {server.tags.length > 3 && (
                <span className="px-2 py-0.5 bg-gray-700 text-gray-400 text-xs rounded-full">
                  +{server.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Circle
            className={`w-3 h-3 ${getStatusColor(server.status)} fill-current`}
          />
          <span className="text-sm text-gray-300 capitalize">{server.status}</span>
        </div>
      </div>

      {metrics && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-cyan-400" />
              <span className="text-sm text-gray-300">CPU</span>
            </div>
            <span className="text-sm font-medium text-white">
              {metrics.cpu_usage.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-violet-400" />
              <span className="text-sm text-gray-300">Memory</span>
            </div>
            <span className="text-sm font-medium text-white">
              {metrics.memory_percent.toFixed(1)}%
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span className="text-sm text-gray-300">Disk</span>
            </div>
            <span className="text-sm font-medium text-white">
              {metrics.disk_percent.toFixed(1)}%
            </span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-700/50">
        <Clock className="w-3 h-3 text-gray-500" />
        <span className="text-xs text-gray-500">Last seen: {lastSeenText}</span>
      </div>
    </div>
  );
}
