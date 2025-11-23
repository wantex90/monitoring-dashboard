import { useState, useEffect } from 'react';
import { Bell, CheckCircle, AlertTriangle, XCircle, X } from 'lucide-react';
import { supabase, ServerAlert, Server } from '../lib/supabase';

interface AlertPanelProps {
  servers: Server[];
}

export function AlertPanel({ servers }: AlertPanelProps) {
  const [alerts, setAlerts] = useState<(ServerAlert & { server_name: string })[]>([]);
  const [showAlerts, setShowAlerts] = useState(false);

  useEffect(() => {
    loadAlerts();
    const interval = setInterval(loadAlerts, 30000);
    return () => clearInterval(interval);
  }, [servers]);

  const loadAlerts = async () => {
    try {
      const { data } = await supabase
        .from('server_alerts')
        .select('*')
        .eq('acknowledged', false)
        .order('created_at', { ascending: false })
        .limit(20);

      if (data) {
        const alertsWithServerName = data.map((alert) => {
          const server = servers.find((s) => s.id === alert.server_id);
          return {
            ...alert,
            server_name: server?.name || 'Unknown',
          };
        });
        setAlerts(alertsWithServerName);
      }
    } catch (error) {
      console.error('Error loading alerts:', error);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    try {
      await supabase
        .from('server_alerts')
        .update({
          acknowledged: true,
          acknowledged_at: new Date().toISOString(),
        })
        .eq('id', alertId);

      loadAlerts();
    } catch (error) {
      console.error('Error acknowledging alert:', error);
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      default:
        return <AlertTriangle className="w-5 h-5 text-blue-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'border-red-500/50 bg-red-500/10';
      case 'warning':
        return 'border-yellow-500/50 bg-yellow-500/10';
      default:
        return 'border-blue-500/50 bg-blue-500/10';
    }
  };

  const unacknowledgedCount = alerts.length;

  return (
    <>
      <button
        onClick={() => setShowAlerts(!showAlerts)}
        className="relative p-2 hover:bg-gray-800 rounded-lg transition-colors"
      >
        <Bell className="w-5 h-5 text-gray-400" />
        {unacknowledgedCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
            {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
          </span>
        )}
      </button>

      {showAlerts && (
        <div className="fixed top-20 right-4 w-96 max-h-[600px] bg-gray-900 rounded-lg border border-gray-700 shadow-2xl z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-400" />
              <h3 className="text-white font-semibold">Alerts</h3>
              {unacknowledgedCount > 0 && (
                <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-full">
                  {unacknowledgedCount}
                </span>
              )}
            </div>
            <button
              onClick={() => setShowAlerts(false)}
              className="p-1 hover:bg-gray-800 rounded transition-colors"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 p-4 space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No active alerts</p>
              </div>
            ) : (
              alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-4 rounded-lg border ${getSeverityColor(alert.severity)}`}
                >
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(alert.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white text-sm">
                          {alert.server_name}
                        </span>
                        <span className="text-xs text-gray-400">
                          {new Date(alert.created_at).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-gray-300 text-sm mb-2">{alert.message}</p>
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        Acknowledge
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
