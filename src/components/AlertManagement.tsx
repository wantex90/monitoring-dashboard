import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, Power, PowerOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AlertRule {
  id: string;
  server_id: string | null;
  name: string;
  metric_type: 'cpu' | 'memory' | 'disk' | 'service' | 'network';
  condition: 'greater_than' | 'less_than' | 'equals';
  threshold: number;
  duration: number;
  enabled: boolean;
  notification_channels: string[];
  created_at: string;
}

interface AlertIncident {
  id: string;
  alert_rule_id: string;
  server_id: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
  message: string;
  metric_value: number;
  triggered_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  alert_rule: {
    name: string;
  };
  server: {
    name: string;
  };
}

interface Server {
  id: string;
  name: string;
}

export default function AlertManagement() {
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [incidents, setIncidents] = useState<AlertIncident[]>([]);
  const [servers, setServers] = useState<Server[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRule, setNewRule] = useState({
    name: '',
    server_id: '',
    metric_type: 'cpu',
    condition: 'greater_than',
    threshold: 80,
    duration: 300,
    notification_channels: ['email']
  });

  useEffect(() => {
    loadRules();
    loadIncidents();
    loadServers();

    const incidentSubscription = supabase
      .channel('alert_incidents_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alert_incidents' }, () => {
        loadIncidents();
      })
      .subscribe();

    return () => {
      incidentSubscription.unsubscribe();
    };
  }, []);

  const loadRules = async () => {
    const { data, error } = await supabase
      .from('alert_rules')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setRules(data);
    }
  };

  const loadIncidents = async () => {
    const { data, error } = await supabase
      .from('alert_incidents')
      .select(`
        *,
        alert_rule:alert_rules(name),
        server:servers(name)
      `)
      .order('triggered_at', { ascending: false })
      .limit(50);

    if (!error && data) {
      setIncidents(data as any);
    }
  };

  const loadServers = async () => {
    const { data, error } = await supabase
      .from('servers')
      .select('id, name')
      .order('name');

    if (!error && data) {
      setServers(data);
    }
  };

  const createRule = async () => {
    const { error } = await supabase
      .from('alert_rules')
      .insert([{
        ...newRule,
        server_id: newRule.server_id || null
      }]);

    if (!error) {
      setShowAddModal(false);
      setNewRule({
        name: '',
        server_id: '',
        metric_type: 'cpu',
        condition: 'greater_than',
        threshold: 80,
        duration: 300,
        notification_channels: ['email']
      });
      loadRules();
    }
  };

  const toggleRule = async (ruleId: string, currentEnabled: boolean) => {
    await supabase
      .from('alert_rules')
      .update({ enabled: !currentEnabled })
      .eq('id', ruleId);

    loadRules();
  };

  const deleteRule = async (ruleId: string) => {
    if (!confirm('Delete this alert rule?')) return;

    await supabase
      .from('alert_rules')
      .delete()
      .eq('id', ruleId);

    loadRules();
  };

  const acknowledgeIncident = async (incidentId: string) => {
    await supabase
      .from('alert_incidents')
      .update({
        status: 'acknowledged',
        acknowledged_at: new Date().toISOString()
      })
      .eq('id', incidentId);

    loadIncidents();
  };

  const resolveIncident = async (incidentId: string) => {
    await supabase
      .from('alert_incidents')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', incidentId);

    loadIncidents();
  };

  const getMetricLabel = (type: string) => {
    const labels: Record<string, string> = {
      cpu: 'CPU Usage',
      memory: 'Memory Usage',
      disk: 'Disk Usage',
      service: 'Service Status',
      network: 'Network'
    };
    return labels[type] || type;
  };

  const getConditionLabel = (condition: string) => {
    const labels: Record<string, string> = {
      greater_than: '>',
      less_than: '<',
      equals: '='
    };
    return labels[condition] || condition;
  };

  const activeIncidents = incidents.filter(i => i.status === 'triggered');
  const acknowledgedIncidents = incidents.filter(i => i.status === 'acknowledged');
  const resolvedIncidents = incidents.filter(i => i.status === 'resolved');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold text-gray-800">Alert Management</h2>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Alert Rule
        </button>
      </div>

      {activeIncidents.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 mb-3">
            Active Alerts ({activeIncidents.length})
          </h3>
          <div className="space-y-2">
            {activeIncidents.map(incident => (
              <div key={incident.id} className="bg-white p-3 rounded border border-red-300">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {incident.alert_rule.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      Server: {incident.server.name}
                    </div>
                    <div className="text-sm text-gray-600">
                      {incident.message}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {new Date(incident.triggered_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acknowledgeIncident(incident.id)}
                      className="px-3 py-1 text-sm bg-yellow-600 text-white rounded hover:bg-yellow-700"
                    >
                      Acknowledge
                    </button>
                    <button
                      onClick={() => resolveIncident(incident.id)}
                      className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Resolve
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <h3 className="font-semibold text-gray-900">Alert Rules</h3>
        </div>
        <div className="divide-y divide-gray-200">
          {rules.map(rule => (
            <div key={rule.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900">{rule.name}</span>
                    {rule.enabled ? (
                      <span className="px-2 py-0.5 text-xs bg-green-100 text-green-800 rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-800 rounded">
                        Disabled
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    {getMetricLabel(rule.metric_type)} {getConditionLabel(rule.condition)} {rule.threshold}%
                    {rule.duration > 0 && ` for ${rule.duration}s`}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Notify via: {rule.notification_channels.join(', ')}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id, rule.enabled)}
                    className={`p-2 rounded hover:bg-gray-100 ${
                      rule.enabled ? 'text-green-600' : 'text-gray-400'
                    }`}
                    title={rule.enabled ? 'Disable' : 'Enable'}
                  >
                    {rule.enabled ? <Power className="w-4 h-4" /> : <PowerOff className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <div className="p-8 text-center text-gray-500">
              No alert rules configured. Create one to get started.
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">New Alert Rule</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={newRule.name}
                  onChange={(e) => setNewRule({ ...newRule, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="High CPU Usage"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Server (optional - leave empty for all servers)
                </label>
                <select
                  value={newRule.server_id}
                  onChange={(e) => setNewRule({ ...newRule, server_id: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Servers</option>
                  {servers.map(server => (
                    <option key={server.id} value={server.id}>{server.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Metric Type
                </label>
                <select
                  value={newRule.metric_type}
                  onChange={(e) => setNewRule({ ...newRule, metric_type: e.target.value as any })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="cpu">CPU Usage</option>
                  <option value="memory">Memory Usage</option>
                  <option value="disk">Disk Usage</option>
                  <option value="network">Network</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Condition
                  </label>
                  <select
                    value={newRule.condition}
                    onChange={(e) => setNewRule({ ...newRule, condition: e.target.value as any })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="greater_than">Greater than</option>
                    <option value="less_than">Less than</option>
                    <option value="equals">Equals</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Threshold (%)
                  </label>
                  <input
                    type="number"
                    value={newRule.threshold}
                    onChange={(e) => setNewRule({ ...newRule, threshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Duration (seconds)
                </label>
                <input
                  type="number"
                  value={newRule.duration}
                  onChange={(e) => setNewRule({ ...newRule, duration: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={createRule}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create Rule
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
