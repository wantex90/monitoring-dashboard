import { Server, ServerMetrics } from '../lib/supabase';
import { Activity, AlertTriangle, CheckCircle, XCircle, Server as ServerIcon } from 'lucide-react';

interface DashboardProps {
  servers: Server[];
  metrics: Record<string, ServerMetrics>;
}

export function Dashboard({ servers, metrics }: DashboardProps) {
  const onlineServers = servers.filter(s => s.status === 'online').length;
  const offlineServers = servers.filter(s => s.status === 'offline').length;
  const warningServers = servers.filter(s => s.status === 'warning').length;

  const avgCPU = servers.length > 0
    ? servers.reduce((acc, s) => {
        const metric = metrics[s.id];
        return acc + (metric?.cpu_usage || 0);
      }, 0) / servers.length
    : 0;

  const avgMemory = servers.length > 0
    ? servers.reduce((acc, s) => {
        const metric = metrics[s.id];
        return acc + (metric?.memory_percent || 0);
      }, 0) / servers.length
    : 0;

  const avgDisk = servers.length > 0
    ? servers.reduce((acc, s) => {
        const metric = metrics[s.id];
        return acc + (metric?.disk_percent || 0);
      }, 0) / servers.length
    : 0;

  const stats = [
    {
      label: 'Total Servers',
      value: servers.length,
      icon: ServerIcon,
      color: 'from-blue-500 to-cyan-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      label: 'Online',
      value: onlineServers,
      icon: CheckCircle,
      color: 'from-green-500 to-emerald-500',
      bgColor: 'bg-green-500/10',
    },
    {
      label: 'Warning',
      value: warningServers,
      icon: AlertTriangle,
      color: 'from-yellow-500 to-orange-500',
      bgColor: 'bg-yellow-500/10',
    },
    {
      label: 'Offline',
      value: offlineServers,
      icon: XCircle,
      color: 'from-red-500 to-rose-500',
      bgColor: 'bg-red-500/10',
    },
  ];

  const metrics_stats = [
    {
      label: 'Avg CPU Usage',
      value: `${avgCPU.toFixed(1)}%`,
      icon: Activity,
      color: avgCPU > 80 ? 'text-red-400' : avgCPU > 60 ? 'text-yellow-400' : 'text-green-400',
    },
    {
      label: 'Avg Memory',
      value: `${avgMemory.toFixed(1)}%`,
      icon: Activity,
      color: avgMemory > 80 ? 'text-red-400' : avgMemory > 60 ? 'text-yellow-400' : 'text-green-400',
    },
    {
      label: 'Avg Disk',
      value: `${avgDisk.toFixed(1)}%`,
      icon: Activity,
      color: avgDisk > 80 ? 'text-red-400' : avgDisk > 60 ? 'text-yellow-400' : 'text-green-400',
    },
  ];

  return (
    <div className="space-y-6 mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-6 hover:border-gray-600/50 transition-all"
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`w-6 h-6 bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`} style={{ WebkitTextFillColor: 'transparent' }} />
                </div>
                <div className={`text-3xl font-bold bg-gradient-to-r ${stat.color} bg-clip-text text-transparent`}>
                  {stat.value}
                </div>
              </div>
              <div className="text-gray-400 text-sm font-medium">{stat.label}</div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {metrics_stats.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 hover:border-gray-600/50 transition-all"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Icon className={`w-5 h-5 ${metric.color}`} />
                  <span className="text-gray-400 text-sm">{metric.label}</span>
                </div>
                <span className={`text-xl font-bold ${metric.color}`}>
                  {metric.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
