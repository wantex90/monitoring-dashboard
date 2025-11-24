import { useState, useEffect } from 'react';
import { X, Power, RotateCw, Terminal as TerminalIcon, Trash2, AlertTriangle, ArrowLeft, Monitor, HardDrive, Cpu, Server as ServerIcon, Activity, Globe, Wifi, Clock, Calendar, MemoryStick, Layers } from 'lucide-react';
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

  const handleUpdateAgent = async () => {
    if (!confirm('Update agent to latest version? This will:\n- Download latest agent\n- Restart monitoring service\n- Enable services monitoring\n\nThis takes about 1-2 minutes.')) return;

    try {
      const response = await fetch(`${supabase.supabaseUrl}/functions/v1/update-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.supabaseKey}`,
        },
        body: JSON.stringify({ serverId: server.id }),
      });

      const result = await response.json();

      if (response.ok) {
        alert(result.message + '\n\nRefresh the page after 2 minutes to see services.');
      } else {
        throw new Error(result.error);
      }
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

  const formatUptime = (seconds: number) => {
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
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Monitor className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-base sm:text-lg font-semibold text-white">System Information</h3>
                  </div>
                  <button
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 rounded-lg transition-all text-xs font-medium border border-cyan-600/30"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Refresh
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                  {/* OS Information */}
                  {server.os_info?.system && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Monitor className="w-4 h-4 text-blue-400" />
                        <p className="text-gray-400 text-xs">Operating System</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm break-words">
                        {server.os_info.system} {server.os_info.release || ''}
                      </p>
                    </div>
                  )}

                  {/* Kernel Version */}
                  {server.kernel_version && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Layers className="w-4 h-4 text-purple-400" />
                        <p className="text-gray-400 text-xs">Kernel Version</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm break-words">{server.kernel_version}</p>
                    </div>
                  )}

                  {/* Architecture */}
                  {server.architecture && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="w-4 h-4 text-orange-400" />
                        <p className="text-gray-400 text-xs">Architecture</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm">{server.architecture}</p>
                    </div>
                  )}

                  {/* Hostname */}
                  <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                    <div className="flex items-center gap-2 mb-2">
                      <ServerIcon className="w-4 h-4 text-cyan-400" />
                      <p className="text-gray-400 text-xs">Hostname</p>
                    </div>
                    <p className="text-white font-semibold text-xs sm:text-sm break-words">{server.hostname}</p>
                  </div>

                  {/* CPU Model */}
                  {server.cpu_model && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all sm:col-span-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Cpu className="w-4 h-4 text-red-400" />
                        <p className="text-gray-400 text-xs">CPU Model</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm break-words">{server.cpu_model}</p>
                    </div>
                  )}

                  {/* CPU Cores */}
                  {server.cpu_cores && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-yellow-400" />
                        <p className="text-gray-400 text-xs">CPU Cores</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm">{server.cpu_cores} cores</p>
                    </div>
                  )}

                  {/* Total RAM */}
                  {server.total_ram && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <MemoryStick className="w-4 h-4 text-green-400" />
                        <p className="text-gray-400 text-xs">Total RAM</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm">{formatBytes(server.total_ram)}</p>
                      {latestMetric && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Used</span>
                            <span className="text-gray-400">{latestMetric.memory_percent.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-green-500 to-green-400 rounded-full transition-all duration-300"
                              style={{ width: `${latestMetric.memory_percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Total Disk */}
                  {server.total_disk && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <HardDrive className="w-4 h-4 text-blue-400" />
                        <p className="text-gray-400 text-xs">Total Disk</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm">{formatBytes(server.total_disk)}</p>
                      {latestMetric && (
                        <div className="mt-2">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-gray-500">Used</span>
                            <span className="text-gray-400">{latestMetric.disk_percent.toFixed(1)}%</span>
                          </div>
                          <div className="w-full bg-gray-700/50 rounded-full h-1.5 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-300 ${
                                latestMetric.disk_percent > 90 ? 'bg-gradient-to-r from-red-500 to-red-400' :
                                latestMetric.disk_percent > 75 ? 'bg-gradient-to-r from-yellow-500 to-yellow-400' :
                                'bg-gradient-to-r from-blue-500 to-blue-400'
                              }`}
                              style={{ width: `${latestMetric.disk_percent}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Public IP */}
                  {server.public_ip && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Globe className="w-4 h-4 text-emerald-400" />
                        <p className="text-gray-400 text-xs">Public IP</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm font-mono">{server.public_ip}</p>
                    </div>
                  )}

                  {/* Private IP */}
                  {server.private_ip && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Wifi className="w-4 h-4 text-teal-400" />
                        <p className="text-gray-400 text-xs">Private IP</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm font-mono">{server.private_ip}</p>
                    </div>
                  )}

                  {/* Uptime */}
                  {server.uptime_seconds && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="w-4 h-4 text-pink-400" />
                        <p className="text-gray-400 text-xs">Uptime</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm">{formatUptime(server.uptime_seconds)}</p>
                    </div>
                  )}

                  {/* Boot Time */}
                  {server.boot_time && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Calendar className="w-4 h-4 text-violet-400" />
                        <p className="text-gray-400 text-xs">Last Boot</p>
                      </div>
                      <p className="text-white font-semibold text-xs sm:text-sm">{new Date(server.boot_time).toLocaleString()}</p>
                    </div>
                  )}

                  {/* Load Average */}
                  {latestMetric?.load_average && (
                    <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700/30 hover:border-gray-600/50 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Activity className="w-4 h-4 text-amber-400" />
                        <p className="text-gray-400 text-xs">Load Average</p>
                      </div>
                      <div className="flex gap-2 items-baseline">
                        <div className="text-center">
                          <p className="text-white font-semibold text-xs sm:text-sm">{latestMetric.load_average[0]?.toFixed(2) || '0.00'}</p>
                          <p className="text-gray-500 text-xs">1m</p>
                        </div>
                        <span className="text-gray-600">|</span>
                        <div className="text-center">
                          <p className="text-white font-semibold text-xs sm:text-sm">{latestMetric.load_average[1]?.toFixed(2) || '0.00'}</p>
                          <p className="text-gray-500 text-xs">5m</p>
                        </div>
                        <span className="text-gray-600">|</span>
                        <div className="text-center">
                          <p className="text-white font-semibold text-xs sm:text-sm">{latestMetric.load_average[2]?.toFixed(2) || '0.00'}</p>
                          <p className="text-gray-500 text-xs">15m</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
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
                  onClick={handleUpdateAgent}
                  className="flex items-center gap-2 px-4 sm:px-6 py-2 sm:py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg transition-all shadow-lg shadow-cyan-600/20 font-semibold text-sm"
                >
                  <RotateCw className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden lg:inline">Update Agent</span>
                  <span className="lg:hidden">Update</span>
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
