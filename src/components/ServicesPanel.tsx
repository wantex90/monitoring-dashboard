import { useState } from 'react';
import { supabase, ServerService } from '../lib/supabase';
import { Circle, CheckCircle, XCircle, AlertCircle, Play, Square, RotateCw, Loader2 } from 'lucide-react';

interface ServicesPanelProps {
  services: ServerService[];
  serverId: string;
  onServiceUpdate: () => void;
}

export function ServicesPanel({ services, serverId, onServiceUpdate }: ServicesPanelProps) {
  const [loadingService, setLoadingService] = useState<string | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'stopped':
        return <XCircle className="w-5 h-5 text-gray-400" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Circle className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'text-green-500';
      case 'stopped':
        return 'text-gray-400';
      case 'failed':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const handleServiceAction = async (service: ServerService, action: 'start' | 'stop' | 'restart') => {
    setLoadingService(service.id);

    try {
      const commandMap = {
        start: `sudo systemctl start ${service.service_name}`,
        stop: `sudo systemctl stop ${service.service_name}`,
        restart: `sudo systemctl restart ${service.service_name}`,
      };

      const { error } = await supabase.from('server_commands').insert({
        server_id: serverId,
        command_type: 'execute',
        command: commandMap[action],
        status: 'pending',
        output: '',
      });

      if (error) throw error;

      setTimeout(() => {
        onServiceUpdate();
        setLoadingService(null);
      }, 2000);
    } catch (error) {
      console.error(`Error ${action} service:`, error);
      alert(`Failed to ${action} service`);
      setLoadingService(null);
    }
  };

  const canControlService = (serviceName: string) => {
    const controllableServices = ['apache2', 'nginx', 'httpd', 'mysql', 'postgresql', 'redis', 'docker', 'ssh'];
    return controllableServices.some((name) => serviceName.toLowerCase().includes(name));
  };

  const sortedServices = [...services].sort((a, b) => {
    const statusOrder = { running: 0, failed: 1, stopped: 2, unknown: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });

  return (
    <div className="bg-gray-800/50 rounded-lg p-6 border border-gray-700/50">
      <h3 className="text-lg font-semibold text-white mb-4">Services Status</h3>

      {services.length === 0 ? (
        <p className="text-gray-400 text-center py-8">No services data available</p>
      ) : (
        <div className="space-y-3">
          {sortedServices.map((service) => {
            const isControllable = canControlService(service.service_name);
            const isLoading = loadingService === service.id;

            return (
              <div
                key={service.id}
                className="flex items-center justify-between p-4 bg-gray-900/50 rounded-lg border border-gray-700/30 hover:border-gray-600/50 transition-all"
              >
                <div className="flex items-center gap-3">
                  {getStatusIcon(service.status)}
                  <div>
                    <p className="font-medium text-white">{service.service_name}</p>
                    {service.port && (
                      <p className="text-xs text-gray-500">Port: {service.port}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {service.enabled && (
                    <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20">
                      Auto-start
                    </span>
                  )}
                  <span className={`text-sm font-medium ${getStatusColor(service.status)} capitalize min-w-[70px]`}>
                    {service.status}
                  </span>

                  {isControllable && (
                    <div className="flex gap-2">
                      {service.status === 'stopped' && (
                        <button
                          onClick={() => handleServiceAction(service, 'start')}
                          disabled={isLoading}
                          className="p-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Start service"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </button>
                      )}

                      {service.status === 'running' && (
                        <>
                          <button
                            onClick={() => handleServiceAction(service, 'restart')}
                            disabled={isLoading}
                            className="p-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Restart service"
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <RotateCw className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            onClick={() => handleServiceAction(service, 'stop')}
                            disabled={isLoading}
                            className="p-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Stop service"
                          >
                            {isLoading ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </>
                      )}

                      {service.status === 'failed' && (
                        <button
                          onClick={() => handleServiceAction(service, 'restart')}
                          disabled={isLoading}
                          className="p-2 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          title="Restart service"
                        >
                          {isLoading ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <RotateCw className="w-4 h-4" />
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
        <p className="text-sm text-blue-400">
          💡 Service controls are available for: Apache, Nginx, MySQL, PostgreSQL, Redis, Docker, SSH
        </p>
      </div>
    </div>
  );
}
