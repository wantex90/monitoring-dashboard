import { useState, useEffect } from 'react';
import { X, UserPlus, Trash2, Shield, User as UserIcon, Send, Bell, BellOff, Edit2, Key, Mail } from 'lucide-react';
import { supabase, UserProfile } from '../lib/supabase';
import { ConfirmDialog } from './ConfirmDialog';

interface UserManagementProps {
  onClose: () => void;
  currentUserId: string;
}

interface TelegramConfig {
  id: string;
  bot_token: string;
  chat_id: string;
  enabled: boolean;
  alert_on_offline: boolean;
  alert_on_high_cpu: boolean;
  alert_on_high_memory: boolean;
  alert_on_high_disk: boolean;
  cpu_threshold: number;
  memory_threshold: number;
  disk_threshold: number;
}

const ROLE_OPTIONS = [
  { value: 'superadmin', label: 'Super Admin', description: 'Full system access including user management', color: 'text-purple-400 bg-purple-500/20' },
  { value: 'admin', label: 'Admin', description: 'Full access to monitoring and servers', color: 'text-emerald-400 bg-emerald-500/20' },
  { value: 'maintainer', label: 'Maintainer', description: 'Can manage servers but not delete', color: 'text-blue-400 bg-blue-500/20' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only access', color: 'text-gray-400 bg-gray-700' },
];

export function UserManagement({ onClose, currentUserId }: UserManagementProps) {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<UserProfile | null>(null);
  const [showAddUser, setShowAddUser] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editUserEmail, setEditUserEmail] = useState('');
  const [editUserName, setEditUserName] = useState('');
  const [editUserPassword, setEditUserPassword] = useState('');
  const [showTelegramConfig, setShowTelegramConfig] = useState(false);
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [newUserRole, setNewUserRole] = useState('viewer');
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const [telegramConfig, setTelegramConfig] = useState<TelegramConfig>({
    id: '',
    bot_token: '',
    chat_id: '',
    enabled: false,
    alert_on_offline: true,
    alert_on_high_cpu: true,
    alert_on_high_memory: true,
    alert_on_high_disk: true,
    cpu_threshold: 80,
    memory_threshold: 80,
    disk_threshold: 80,
  });

  useEffect(() => {
    loadCurrentUserProfile();
    loadUsers();
    loadTelegramConfig();
  }, []);

  const loadCurrentUserProfile = async () => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', currentUserId)
        .maybeSingle();

      setCurrentUserProfile(data);
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (profiles) {
        setUsers(profiles);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadTelegramConfig = async () => {
    try {
      const { data } = await supabase
        .from('telegram_config')
        .select('*')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (data) {
        setTelegramConfig(data);
      }
    } catch (error) {
      console.error('Error loading telegram config:', error);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            email: newUserEmail,
            password: newUserPassword,
            full_name: newUserName,
            role: newUserRole,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Failed to create user');
      }

      alert('User created successfully!');
      setShowAddUser(false);
      setNewUserEmail('');
      setNewUserPassword('');
      setNewUserName('');
      setNewUserRole('viewer');
      loadUsers();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteUserId) return;

    try {
      const { error } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', deleteUserId);

      if (error) throw error;

      alert('User deleted successfully');
      setDeleteUserId(null);
      loadUsers();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ role: newRole })
        .eq('id', userId);

      if (error) throw error;
      loadUsers();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleStartEdit = (user: UserProfile) => {
    setEditUserId(user.id);
    setEditUserEmail(user.email);
    setEditUserName(user.full_name || '');
    setEditUserPassword('');
  };

  const handleCancelEdit = () => {
    setEditUserId(null);
    setEditUserEmail('');
    setEditUserName('');
    setEditUserPassword('');
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUserId) return;

    setIsLoading(true);
    try {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({
          email: editUserEmail,
          full_name: editUserName
        })
        .eq('id', editUserId);

      if (profileError) throw profileError;

      if (editUserPassword) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-user-password`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            },
            body: JSON.stringify({
              user_id: editUserId,
              new_password: editUserPassword,
            }),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to update password');
        }
      }

      alert('User updated successfully!');
      handleCancelEdit();
      loadUsers();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveTelegramConfig = async () => {
    setIsLoading(true);
    try {
      const configData = {
        user_id: currentUserId,
        bot_token: telegramConfig.bot_token,
        chat_id: telegramConfig.chat_id,
        enabled: telegramConfig.enabled,
        alert_on_offline: telegramConfig.alert_on_offline,
        alert_on_high_cpu: telegramConfig.alert_on_high_cpu,
        alert_on_high_memory: telegramConfig.alert_on_high_memory,
        alert_on_high_disk: telegramConfig.alert_on_high_disk,
        cpu_threshold: telegramConfig.cpu_threshold,
        memory_threshold: telegramConfig.memory_threshold,
        disk_threshold: telegramConfig.disk_threshold,
      };

      const { error } = await supabase
        .from('telegram_config')
        .upsert(configData, { onConflict: 'user_id' });

      if (error) throw error;

      alert('Telegram configuration saved successfully!');
      loadTelegramConfig();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramConfig.bot_token || !telegramConfig.chat_id) {
      alert('Please enter bot token and chat ID first');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(
        `https://api.telegram.org/bot${telegramConfig.bot_token}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: telegramConfig.chat_id,
            text: '🔔 Test notification from Server Monitoring System\n\nYour Telegram alerts are configured correctly!',
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to send test message');
      }

      alert('Test message sent successfully! Check your Telegram.');
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const isSuperAdmin = currentUserProfile?.role === 'superadmin';
  const canManageUsers = isSuperAdmin;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
        <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-700">
            <div>
              <h2 className="text-2xl font-bold text-white">User Management</h2>
              <p className="text-gray-400 text-sm mt-1">Manage system users, permissions and notifications</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          <div className="p-6 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-white">Users</h3>
                    {canManageUsers && !showAddUser && (
                      <button
                        onClick={() => setShowAddUser(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white rounded-lg transition-all text-sm"
                      >
                        <UserPlus className="w-4 h-4" />
                        Add User
                      </button>
                    )}
                  </div>

                  {canManageUsers && showAddUser && (
                    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 mb-4">
                      <h4 className="text-white font-semibold mb-4">Create New User</h4>
                      <form onSubmit={handleAddUser} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              Full Name
                            </label>
                            <input
                              type="text"
                              value={newUserName}
                              onChange={(e) => setNewUserName(e.target.value)}
                              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              Email
                            </label>
                            <input
                              type="email"
                              value={newUserEmail}
                              onChange={(e) => setNewUserEmail(e.target.value)}
                              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              Password
                            </label>
                            <input
                              type="password"
                              value={newUserPassword}
                              onChange={(e) => setNewUserPassword(e.target.value)}
                              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                              required
                              minLength={6}
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-400 mb-2">
                              Role
                            </label>
                            <select
                              value={newUserRole}
                              onChange={(e) => setNewUserRole(e.target.value)}
                              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                            >
                              {ROLE_OPTIONS.map((role) => (
                                <option key={role.value} value={role.value}>
                                  {role.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-3">
                          <button
                            type="button"
                            onClick={() => setShowAddUser(false)}
                            className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isLoading}
                            className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 text-white rounded-lg transition-colors"
                          >
                            {isLoading ? 'Creating...' : 'Create User'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  <div className="space-y-3">
                    {users.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <UserIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No users found</p>
                      </div>
                    ) : (
                      users.map((user) => {
                        const roleInfo = ROLE_OPTIONS.find(r => r.value === user.role) || ROLE_OPTIONS[3];
                        const isEditing = editUserId === user.id;

                        return (
                          <div
                            key={user.id}
                            className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 hover:border-gray-600 transition-all"
                          >
                            {isEditing ? (
                              <form onSubmit={handleUpdateUser} className="space-y-4">
                                <div className="flex items-center justify-between mb-4">
                                  <h4 className="text-white font-semibold flex items-center gap-2">
                                    <Edit2 className="w-4 h-4" />
                                    Edit User
                                  </h4>
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="text-gray-400 hover:text-white"
                                  >
                                    <X className="w-5 h-5" />
                                  </button>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                      Full Name
                                    </label>
                                    <input
                                      type="text"
                                      value={editUserName}
                                      onChange={(e) => setEditUserName(e.target.value)}
                                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                      required
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-2">
                                      Email
                                    </label>
                                    <input
                                      type="email"
                                      value={editUserEmail}
                                      onChange={(e) => setEditUserEmail(e.target.value)}
                                      className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                      required
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="block text-sm font-medium text-gray-400 mb-2">
                                    New Password (leave empty to keep current)
                                  </label>
                                  <input
                                    type="password"
                                    value={editUserPassword}
                                    onChange={(e) => setEditUserPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                                    minLength={6}
                                  />
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={handleCancelEdit}
                                    className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                                  >
                                    {isLoading ? 'Saving...' : 'Save Changes'}
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="p-3 bg-gray-700 rounded-lg">
                                    {user.role === 'superadmin' || user.role === 'admin' ? (
                                      <Shield className="w-6 h-6 text-emerald-400" />
                                    ) : (
                                      <UserIcon className="w-6 h-6 text-gray-400" />
                                    )}
                                  </div>
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h3 className="text-white font-semibold">
                                        {user.full_name || 'No Name'}
                                      </h3>
                                      {user.id === currentUserId && (
                                        <span className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded-full">
                                          You
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-gray-400 text-sm">{user.email}</p>
                                    <div className="flex items-center gap-2 mt-2">
                                      {canManageUsers && user.id !== currentUserId ? (
                                        <select
                                          value={user.role}
                                          onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                                          className={`px-3 py-1 text-xs rounded-full ${roleInfo.color} border-0 focus:outline-none focus:ring-2 focus:ring-emerald-500`}
                                        >
                                          {ROLE_OPTIONS.map((role) => (
                                            <option key={role.value} value={role.value}>
                                              {role.label}
                                            </option>
                                          ))}
                                        </select>
                                      ) : (
                                        <span className={`px-3 py-1 text-xs rounded-full ${roleInfo.color}`}>
                                          {roleInfo.label}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex gap-2">
                                  {canManageUsers && (
                                    <button
                                      onClick={() => handleStartEdit(user)}
                                      className="p-2 hover:bg-cyan-600/20 rounded-lg transition-colors group"
                                      title="Edit user"
                                    >
                                      <Edit2 className="w-5 h-5 text-gray-400 group-hover:text-cyan-400" />
                                    </button>
                                  )}
                                  {canManageUsers && user.id !== currentUserId && (
                                    <button
                                      onClick={() => setDeleteUserId(user.id)}
                                      className="p-2 hover:bg-red-600/20 rounded-lg transition-colors group"
                                      title="Delete user"
                                    >
                                      <Trash2 className="w-5 h-5 text-gray-400 group-hover:text-red-400" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Send className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-lg font-semibold text-white">Telegram Alerts</h3>
                    </div>
                    <button
                      onClick={() => setTelegramConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                      className={`p-2 rounded-lg transition-colors ${
                        telegramConfig.enabled
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {telegramConfig.enabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Bot Token
                      </label>
                      <input
                        type="text"
                        value={telegramConfig.bot_token}
                        onChange={(e) => setTelegramConfig(prev => ({ ...prev, bot_token: e.target.value }))}
                        placeholder="123456:ABC-DEF..."
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-400 mb-2">
                        Chat ID
                      </label>
                      <input
                        type="text"
                        value={telegramConfig.chat_id}
                        onChange={(e) => setTelegramConfig(prev => ({ ...prev, chat_id: e.target.value }))}
                        placeholder="123456789"
                        className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-gray-400">
                        Alert Triggers
                      </label>
                      {[
                        { key: 'alert_on_offline', label: 'Server Offline' },
                        { key: 'alert_on_high_cpu', label: 'High CPU Usage' },
                        { key: 'alert_on_high_memory', label: 'High Memory Usage' },
                        { key: 'alert_on_high_disk', label: 'High Disk Usage' },
                      ].map((alert) => (
                        <label key={alert.key} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={telegramConfig[alert.key as keyof TelegramConfig] as boolean}
                            onChange={(e) => setTelegramConfig(prev => ({ ...prev, [alert.key]: e.target.checked }))}
                            className="w-4 h-4 bg-gray-900 border-gray-700 rounded text-cyan-600 focus:ring-cyan-500"
                          />
                          <span className="text-sm text-gray-300">{alert.label}</span>
                        </label>
                      ))}
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { key: 'cpu_threshold', label: 'CPU %' },
                        { key: 'memory_threshold', label: 'RAM %' },
                        { key: 'disk_threshold', label: 'Disk %' },
                      ].map((threshold) => (
                        <div key={threshold.key}>
                          <label className="block text-xs text-gray-400 mb-1">
                            {threshold.label}
                          </label>
                          <input
                            type="number"
                            value={telegramConfig[threshold.key as keyof TelegramConfig] as number}
                            onChange={(e) => setTelegramConfig(prev => ({ ...prev, [threshold.key]: Number(e.target.value) }))}
                            min="0"
                            max="100"
                            className="w-full px-2 py-1 bg-gray-900 border border-gray-700 rounded text-white text-sm focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={handleTestTelegram}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                      >
                        Test
                      </button>
                      <button
                        onClick={handleSaveTelegramConfig}
                        disabled={isLoading}
                        className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                      >
                        {isLoading ? 'Saving...' : 'Save'}
                      </button>
                    </div>

                    <div className="text-xs text-gray-500 space-y-1 pt-2 border-t border-gray-700">
                      <p>1. Create bot via @BotFather on Telegram</p>
                      <p>2. Get your Chat ID via @userinfobot</p>
                      <p>3. Start your bot to receive alerts</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {deleteUserId && (
        <ConfirmDialog
          title="Delete User"
          message="Are you sure you want to delete this user? This action cannot be undone."
          onConfirm={handleDeleteUser}
          onCancel={() => setDeleteUserId(null)}
        />
      )}
    </>
  );
}
