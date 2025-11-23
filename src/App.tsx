import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Activity, Users, LogOut, Search, Filter, Download, User as UserIcon } from 'lucide-react';
import { supabase, Server, ServerMetrics, UserProfile } from './lib/supabase';
import { ServerCard } from './components/ServerCard';
import { ServerDetail } from './components/ServerDetail';
import { AddServerModal } from './components/AddServerModal';
import { UserManagement } from './components/UserManagement';
import { Dashboard } from './components/Dashboard';
import { AlertPanel } from './components/AlertPanel';
import { EditServerModal } from './components/EditServerModal';
import { AuthModal } from './components/AuthModal';
import { DashboardSkeleton, ServerCardSkeleton } from './components/LoadingSkeleton';
import type { User } from '@supabase/supabase-js';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [servers, setServers] = useState<Server[]>([]);
  const [filteredServers, setFilteredServers] = useState<Server[]>([]);
  const [metrics, setMetrics] = useState<Record<string, ServerMetrics>>({});
  const [selectedServer, setSelectedServer] = useState<Server | null>(null);
  const [editingServer, setEditingServer] = useState<Server | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterTag, setFilterTag] = useState<string>('all');

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
        loadServers();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [servers, searchQuery, filterStatus, filterTag]);

  useEffect(() => {
    if (!user) return;

    loadServers();
    const interval = setInterval(loadServers, 10000);

    const channel = supabase
      .channel('servers-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'servers',
        },
        () => {
          loadServers();
        }
      )
      .subscribe();

    return () => {
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [user]);

  const loadUserProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      setUserProfile(data);
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const checkAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);
        loadUserProfile(session.user.id);
      } else {
        setShowAuthModal(true);
      }
    } catch (error) {
      console.error('Auth error:', error);
      setShowAuthModal(true);
    } finally {
      setIsAuthChecking(false);
      setIsLoading(false);
    }
  };

  const handleAuthenticated = () => {
    checkAuth();
    setShowAuthModal(false);
  };

  const loadServers = async () => {
    try {
      const { data: serversData, error: serversError } = await supabase
        .from('servers')
        .select('*')
        .order('created_at', { ascending: false });

      if (serversError) throw serversError;

      setServers(serversData || []);

      const metricsData: Record<string, ServerMetrics> = {};
      for (const server of serversData || []) {
        const { data: latestMetric } = await supabase
          .from('server_metrics')
          .select('*')
          .eq('server_id', server.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (latestMetric) {
          metricsData[server.id] = latestMetric;
        }
      }
      setMetrics(metricsData);
    } catch (error) {
      console.error('Error loading servers:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    setIsLoading(true);
    loadServers();
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserProfile(null);
    setServers([]);
    setMetrics({});
    setShowAuthModal(true);
  };

  const applyFilters = () => {
    let filtered = [...servers];

    if (searchQuery) {
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.hostname.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.provider?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter((s) => s.status === filterStatus);
    }

    if (filterTag !== 'all') {
      filtered = filtered.filter((s) => s.tags?.includes(filterTag));
    }

    setFilteredServers(filtered);
  };

  const handleExportData = () => {
    const data = filteredServers.map((server) => {
      const metric = metrics[server.id];
      return {
        Name: server.name,
        Hostname: server.hostname,
        Provider: server.provider,
        Status: server.status,
        CPU: metric ? `${metric.cpu_usage}%` : 'N/A',
        Memory: metric ? `${metric.memory_percent}%` : 'N/A',
        Disk: metric ? `${metric.disk_percent}%` : 'N/A',
        'Last Seen': server.last_seen ? new Date(server.last_seen).toLocaleString() : 'Never',
      };
    });

    const csv = [
      Object.keys(data[0] || {}).join(','),
      ...data.map((row) => Object.values(row).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `servers-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const allTags = Array.from(
    new Set(servers.flatMap((s) => s.tags || []))
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <img src="/sign.png" alt="NMS Logo" className="h-14 object-contain" />
            <div>
              <h1 className="text-2xl font-bold text-white">NMS Node Watch</h1>
              <p className="text-gray-400">Netizen Media Solusindo</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <AlertPanel servers={servers} />

            {userProfile && (
              <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 rounded-lg border border-gray-700/50">
                <UserIcon className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-300">{userProfile.full_name || user?.email}</span>
                {userProfile.role === 'admin' && (
                  <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-xs rounded-full">
                    Admin
                  </span>
                )}
              </div>
            )}

            <button
              onClick={() => setShowUserManagement(true)}
              disabled={!user}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 disabled:bg-gray-800/30 disabled:cursor-not-allowed text-white rounded-lg transition-all border border-gray-700/50 hover:border-gray-600/50"
            >
              <Users className="w-4 h-4" />
              Users
            </button>
            <button
              onClick={handleRefresh}
              disabled={isLoading || !user}
              className="flex items-center gap-2 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 disabled:bg-gray-800/30 disabled:cursor-not-allowed text-white rounded-lg transition-all border border-gray-700/50 hover:border-gray-600/50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              disabled={!user}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-all shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-4 h-4" />
              Add Server
            </button>
            <button
              onClick={handleLogout}
              disabled={!user}
              className="flex items-center gap-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 disabled:bg-gray-800/30 disabled:cursor-not-allowed text-red-400 hover:text-red-300 rounded-lg transition-all border border-red-600/50 hover:border-red-500/50"
            >
              <LogOut className="w-4 h-4" />
              Logout
            </button>
          </div>
        </div>

        {isAuthChecking ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-gray-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Authenticating...</p>
            </div>
          </div>
        ) : !user ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <img src="/gambar copy.png" alt="NMS Logo" className="w-24 h-24 mx-auto mb-4 object-contain" />
              <h2 className="text-3xl font-bold text-white mb-2">NMS Node Watch</h2>
              <p className="text-gray-400 mb-6">Please sign in to access your server dashboard</p>
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg font-semibold shadow-lg"
              >
                Sign In
              </button>
            </div>
          </div>
        ) : isLoading && servers.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-gray-600 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading servers...</p>
            </div>
          </div>
        ) : servers.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Activity className="w-10 h-10 text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">No Servers Yet</h2>
            <p className="text-gray-500 mb-6">
              Add your first server to start monitoring infrastructure
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-lg transition-all shadow-lg shadow-emerald-500/20"
            >
              <Plus className="w-5 h-5" />
              Add Your First Server
            </button>
          </div>
        ) : (
          <>
            {isLoading && servers.length > 0 ? (
              <DashboardSkeleton />
            ) : (
              <Dashboard servers={servers} metrics={metrics} />
            )}

            <div className="bg-gray-900/50 border border-gray-700/50 rounded-lg p-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search servers..."
                      className="w-full pl-10 pr-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-5 h-5 text-gray-400" />
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="all">All Status</option>
                    <option value="online">Online</option>
                    <option value="offline">Offline</option>
                    <option value="warning">Warning</option>
                  </select>

                  {allTags.length > 0 && (
                    <select
                      value={filterTag}
                      onChange={(e) => setFilterTag(e.target.value)}
                      className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="all">All Tags</option>
                      {allTags.map((tag) => (
                        <option key={tag} value={tag}>
                          {tag}
                        </option>
                      ))}
                    </select>
                  )}

                  <button
                    onClick={handleExportData}
                    disabled={filteredServers.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-800/50 disabled:cursor-not-allowed text-white rounded-lg transition-colors border border-gray-700"
                  >
                    <Download className="w-4 h-4" />
                    Export
                  </button>
                </div>
              </div>

              {(searchQuery || filterStatus !== 'all' || filterTag !== 'all') && (
                <div className="mt-3 text-sm text-gray-400">
                  Showing {filteredServers.length} of {servers.length} servers
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 mb-6 hidden">
              <div className="bg-gradient-to-br from-gray-800/40 to-gray-900/40 rounded-xl p-6 border border-gray-700/50 shadow-xl">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="text-gray-400 text-sm font-medium">Total Servers</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-100 to-gray-300 bg-clip-text text-transparent">{servers.length}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 text-sm font-medium">Online</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-green-400 bg-clip-text text-transparent">
                      {servers.filter((s) => s.status === 'online').length}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 text-sm font-medium">Offline</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-gray-400 to-gray-500 bg-clip-text text-transparent">
                      {servers.filter((s) => s.status === 'offline').length}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-gray-400 text-sm font-medium">Warning</p>
                    <p className="text-3xl font-bold bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                      {servers.filter((s) => s.status === 'warning').length}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {isLoading && servers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <ServerCardSkeleton key={i} />
                ))}
              </div>
            ) : filteredServers.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No servers match your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredServers.map((server) => (
                  <div key={server.id} className="relative group">
                    <ServerCard
                      server={server}
                      metrics={metrics[server.id]}
                      onClick={() => setSelectedServer(server)}
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingServer(server);
                      }}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-2 bg-gray-800/90 hover:bg-gray-700/90 rounded-lg border border-gray-600"
                      title="Edit Server"
                    >
                      <svg className="w-4 h-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showAddModal && (
        <AddServerModal
          onClose={() => setShowAddModal(false)}
          onServerAdded={loadServers}
        />
      )}

      {selectedServer && (
        <ServerDetail
          server={selectedServer}
          onClose={() => setSelectedServer(null)}
          onServerDeleted={loadServers}
        />
      )}

      {editingServer && (
        <EditServerModal
          server={editingServer}
          onClose={() => setEditingServer(null)}
          onServerUpdated={() => {
            loadServers();
            setEditingServer(null);
          }}
        />
      )}

      {showUserManagement && user && (
        <UserManagement
          onClose={() => setShowUserManagement(false)}
          currentUserId={user.id}
        />
      )}

      {showAuthModal && (
        <AuthModal
          onClose={() => {
            if (!user) {
              setShowAuthModal(false);
            }
          }}
          onAuthenticated={handleAuthenticated}
        />
      )}
    </div>
  );
}

export default App;
