import { useState, useEffect } from 'react';
import { X, Power, RotateCw, Terminal as TerminalIcon, Trash2, AlertTriangle, ArrowLeft, Monitor, HardDrive, Cpu } from 'lucide-react';
import { supabase, Server, ServerMetrics, ServerService } from '../lib/supabase';
import { MetricsChart } from './MetricsChart';
import { ServicesPanel } from './ServicesPanel';
import { Terminal } from './Terminal';

interface ServerDetailProps {
  server: Server;
  onClose: () => void;
  onServerDeleted: () => void;
}

const formatUptime = (seconds: number): string => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  } else if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else {
    return `${minutes}m`;
  }
};

export function ServerDetail({ server, onClose, onServerDeleted }: ServerDetailProps) {
  const [metrics, setMetrics] = useState<ServerMetrics[]>([]);
  const [services, setServices] = useState<ServerService[]>([]);
  const [showTerminal, setShowTerminal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    loadMetrics();
    loadServices();

    const metricsInterval = setInterval(loadMetrics, 10000);
    const servicesInterval = setInterval(loadServices, 30000);

    const channel = supabase
      .channel(`server-${server.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'server_metrics',
          filter: `server_id=eq.${server.id}`,
        },
        () => {
          loadMetrics();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'server_services',
          filter: `server_id=eq.${server.id}`,
        },
        () => {
          loadServices();
        }
      )
      .subscribe();

    return () => {
      clearInterval(metricsInterval);
      clearInterval(servicesInterval);
      channel.unsubscribe();
    };
  }, [server.id]);

  const loadMetrics = async () => {
    const { data } = await supabase
      .from('server_metrics')
      .select('*')
      .eq('server_id', server.id)
      .order('timestamp', { ascending: false })
      .limit(50);

    if (data) {
      setMetrics(data.reverse());
    }
  };

  const loadServices = async () => {
    const { data } = await supabase
      .from('server_services')
      .select('*')
      .eq('server_id', server.id)
      .order('service_name');

    if (data) {
      setServices(data);
    }
  };

  const handleShutdown = async () => {
    if (!confirm('Are you sure you want to shutdown this server?')) return;

    try {
      await supabase.from('server_commands').insert({
        server_id: server.id,
        command_type: 'shutdown',
        command: 'shutdown -h now',
        status: 'pending',
      });
      alert('Shutdown command sent to server');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleRestart = async () => {
    if (!confirm('Are you sure you want to restart this server?')) return;

    try {
      await supabase.from('server_commands').insert({
        server_id: server.id,
        command_type: 'restart',
        command: 'reboot',
        status: 'pending',
      });
      alert('Restart command sent to server');
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from('servers').delete().eq('id', server.id);
      if (error) throw error;
      onServerDeleted();
      onClose();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const latestMetric = metrics[metrics.length - 1];

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 overflow-y-auto">
        <div className="min-h-screen flex items-start justify-center p-4 sm:p-6 lg:p-8">
          <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-7xl my-8 shadow-2xl">
            <div className="sticky top-0 z-10 bg-gray-900 flex items-center justify-between p-4 sm:p-6 border-b border-gray-700 rounded-t-lg">
              <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-3 py-2 sm:px-4 bg-gray-800/50 hover:bg-gray-700/50 text-white rounded-lg transition-all border border-gray-700/50 hover:border-gray-600/50 text-sm"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Back</span>
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-2xl font-bold text-white truncate">{server.name}</h2>
                  <p className="text-sm text-gray-400 truncate">{server.hostname}</p>
                  {server.provider && (
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">{server.provider}</p>
                  )}
                  {server.tags && server.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {server.tags.map((tag) => (
                        <span
                          key={tag}
                          className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-xs rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 hover:text-white" />
              </button>
            </div>

            <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 max-h-[calc(100vh-120px)] overflow-y-auto">
              <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 rounded-lg p-4 sm:p-6 border border-gray-700/50">
                <div className="flex items-center gap-3 mb-4">
                  <Monitor className="w-5 h-5 text-cyan-400" />
                  <h3 className="text-base sm:text-lg font-semibold text-white">System Information</h3>
                </div>
                {server.os_info ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {server.os_info.os && (
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-gray-400 text-xs mb-1">Operating System</p>
                        <p className="text-white font-semibold text-xs sm:text-sm break-words">{server.os_info.os}</p>
                      </div>
                    )}
                    {server.os_info.platform && (
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-gray-400 text-xs mb-1">Platform</p>
                        <p className="text-white font-semibold text-xs sm:text-sm break-words">{server.os_info.platform}</p>
                      </div>
                    )}
                    {server.os_info.version && (
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-gray-400 text-xs mb-1">Version</p>
                        <p className="text-white font-semibold text-xs sm:text-sm break-words">{server.os_info.version}</p>
                      </div>
                    )}
                    {server.os_info.architecture && (
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-gray-400 text-xs mb-1">Architecture</p>
                        <p className="text-white font-semibold text-xs sm:text-sm break-words">{server.os_info.architecture}</p>
                      </div>
                    )}
                    {server.os_info.hostname && (
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-gray-400 text-xs mb-1">Hostname</p>
                        <p className="text-white font-semibold text-xs sm:text-sm break-words">{server.os_info.hostname}</p>
                      </div>
                    )}
                    {server.os_info.kernel && (
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-gray-400 text-xs mb-1">Kernel</p>
                        <p className="text-white font-semibold text-xs sm:text-sm break-words">{server.os_info.kernel}</p>
                      </div>
                    )}
                    {server.os_info.uptime && (
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-gray-400 text-xs mb-1">Uptime</p>
                        <p className="text-white font-semibold text-xs sm:text-sm">{formatUptime(server.os_info.uptime)}</p>
                      </div>
                    )}
                    {server.os_info.cpu_count && (
                      <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30">
                        <p className="text-gray-400 text-xs mb-1">CPU Cores</p>
                        <p className="text-white font-semibold text-xs sm:text-sm">{server.os_info.cpu_count}</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Monitor className="w-12 h-12 text-gray-600 mb-3" />
                    <p className="text-gray-400 text-sm mb-2">No system information available</p>
                    <p className="text-gray-500 text-xs">
                      System info will appear once the monitoring agent sends data
                    </p>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 sm:gap-3">
                <button
                  onClick={() => setShowTerminal(true)}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-lg transition-all shadow-lg shadow-green-600/20 font-semibold text-sm"
                >
                  <TerminalIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Open Terminal</span>
                  <span className="sm:hidden">Terminal</span>
                </button>
                <button
                  onClick={handleRestart}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-yellow-600 to-orange-600 hover:from-yellow-700 hover:to-orange-700 text-white rounded-lg transition-all shadow-lg shadow-yellow-600/20 font-semibold text-sm"
                >
                  <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden lg:inline">Restart Server</span>
                  <span className="lg:hidden">Restart</span>
                </button>
                <button
                  onClick={handleShutdown}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white rounded-lg transition-all shadow-lg shadow-red-600/20 font-semibold text-sm"
                >
                  <Power className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">Shutdown</span>
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gray-800 hover:bg-gray-700 text-red-400 rounded-lg transition-colors sm:ml-auto border border-red-600/30 hover:border-red-600/50 text-sm"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">Delete Server</span>
                  <span className="sm:hidden">Delete</span>
                </button>
              </div>

              {server.notes && (
                <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-700/50">
                  <h3 className="text-sm font-semibold text-gray-400 mb-2">Notes</h3>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{server.notes}</p>
                </div>
              )}

              {latestMetric && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                  <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-700/50">
                    <p className="text-gray-400 text-xs sm:text-sm mb-1">Memory</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {formatBytes(latestMetric.memory_used)}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      of {formatBytes(latestMetric.memory_total)}
                    </p>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-700/50">
                    <p className="text-gray-400 text-xs sm:text-sm mb-1">Disk</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {formatBytes(latestMetric.disk_used)}
                    </p>
                    <p className="text-xs sm:text-sm text-gray-500">
                      of {formatBytes(latestMetric.disk_total)}
                    </p>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-700/50">
                    <p className="text-gray-400 text-xs sm:text-sm mb-1">Network Sent</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {formatBytes(latestMetric.network_sent)}
                    </p>
                  </div>

                  <div className="bg-gray-800/50 rounded-lg p-3 sm:p-4 border border-gray-700/50">
                    <p className="text-gray-400 text-xs sm:text-sm mb-1">Network Received</p>
                    <p className="text-lg sm:text-2xl font-bold text-white">
                      {formatBytes(latestMetric.network_recv)}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">
                <MetricsChart metrics={metrics} type="cpu" />
                <MetricsChart metrics={metrics} type="memory" />
                <MetricsChart metrics={metrics} type="disk" />
              </div>

              <ServicesPanel
                services={services}
                serverId={server.id}
                onServiceUpdate={loadServices}
              />
            </div>
          </div>
        </div>
      </div>

      {showTerminal && (
        <Terminal serverId={server.id} onClose={() => setShowTerminal(false)} />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-red-500/50 w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-red-500" />
              <h3 className="text-xl font-semibold text-white">Delete Server?</h3>
            </div>
            <p className="text-gray-400 mb-6">
              Are you sure you want to delete "{server.name}"? This will remove all metrics,
              logs, and service data. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Delete Server
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
