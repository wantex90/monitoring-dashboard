import { useState } from 'react';
import { X, Copy, Check, Wifi, Terminal } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface AddServerModalProps {
  onClose: () => void;
  onServerAdded: () => void;
}

export function AddServerModal({ onClose, onServerAdded }: AddServerModalProps) {
  const [installMode, setInstallMode] = useState<'auto' | 'manual'>('auto');
  const [step, setStep] = useState<'form' | 'setup' | 'installing'>('form');
  const [name, setName] = useState('');
  const [hostname, setHostname] = useState('');
  const [provider, setProvider] = useState('');
  const [sshPort, setSshPort] = useState('22');
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [serverId, setServerId] = useState('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [installLog, setInstallLog] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !hostname) return;

    if (installMode === 'auto') {
      if (!sshPassword) {
        alert('SSH password is required for automatic installation');
        return;
      }
      await handleAutoInstall();
    } else {
      await handleManualSetup();
    }
  };

  const handleAutoInstall = async () => {
    setIsLoading(true);
    setStep('installing');
    setInstallLog('🔄 Starting remote installation...\n');

    try {
      const installerUrl = import.meta.env.VITE_SSH_INSTALLER_URL || 'http://localhost:5000/install';

      setInstallLog(prev => prev + `📡 Connecting to installer service at ${installerUrl}...\n`);

      const response = await fetch(installerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hostname,
          port: parseInt(sshPort),
          username: sshUser,
          password: sshPassword,
        }),
      });

      if (!response.ok) {
        throw new Error(`Service responded with ${response.status}`);
      }

      const data = await response.json();

      setInstallLog(prev => prev + data.log + '\n');

      if (data.success) {
        setInstallLog(prev => prev + '\n✅ Installation completed successfully!\n');
        setTimeout(() => {
          onServerAdded();
          onClose();
        }, 2000);
      } else {
        throw new Error(data.error || 'Installation failed');
      }
    } catch (error: any) {
      console.error('Auto-install error:', error);

      const errorMsg = error.message.includes('fetch')
        ? '⚠️  SSH Installer Service is not running!\n\n' +
          '📋 Please either:\n' +
          '1. Start the installer service (see INSTALLER_SERVICE.md)\n' +
          '2. Or switch to "Manual" tab for manual installation\n'
        : `❌ Error: ${error.message}`;

      setInstallLog(prev => prev + '\n' + errorMsg);

      setTimeout(() => {
        if (confirm('SSH Installer Service unavailable. Switch to Manual mode?')) {
          setInstallMode('manual');
          setStep('form');
        }
      }, 1000);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSetup = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('servers')
        .insert({
          name,
          hostname,
          provider,
          status: 'offline',
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      setServerId(data.id);
      setStep('setup');
    } catch (error: any) {
      console.error('Error adding server:', error);
      alert(`Error: ${error.message || 'Failed to add server'}`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-gray-950 rounded-xl border border-gray-700/50 w-full max-w-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-700 sticky top-0 bg-gray-900/95 backdrop-blur">
          <h3 className="text-xl font-semibold text-white">
            {step === 'form' ? 'Add New Server' : step === 'installing' ? 'Installing Agent...' : 'Setup Instructions'}
          </h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {step === 'form' ? (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="flex gap-2 p-1 bg-gray-800/50 rounded-lg mb-4">
              <button
                type="button"
                onClick={() => setInstallMode('auto')}
                className={`flex-1 px-4 py-2 rounded-md transition-all flex items-center justify-center gap-2 ${
                  installMode === 'auto'
                    ? 'bg-emerald-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Wifi className="w-4 h-4" />
                Automatic (SSH)
              </button>
              <button
                type="button"
                onClick={() => setInstallMode('manual')}
                className={`flex-1 px-4 py-2 rounded-md transition-all flex items-center justify-center gap-2 ${
                  installMode === 'manual'
                    ? 'bg-blue-500 text-white shadow-lg'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Terminal className="w-4 h-4" />
                Manual
              </button>
            </div>

            <div className={`p-3 rounded-lg ${installMode === 'auto' ? 'bg-emerald-500/10 border border-emerald-500/30' : 'bg-blue-500/10 border border-blue-500/30'}`}>
              <p className={`text-sm font-medium ${installMode === 'auto' ? 'text-emerald-400' : 'text-blue-400'}`}>
                {installMode === 'auto'
                  ? '🚀 Automatic: Agent will be installed remotely via SSH'
                  : '📋 Manual: You will run the installation command yourself'}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Server Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Production Server 1"
                required
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Hostname / IP Address *
              </label>
              <input
                type="text"
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="192.168.1.100 or server.example.com"
                required
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>

            {installMode === 'auto' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      SSH Port *
                    </label>
                    <input
                      type="number"
                      value={sshPort}
                      onChange={(e) => setSshPort(e.target.value)}
                      placeholder="22"
                      required
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      SSH Username *
                    </label>
                    <input
                      type="text"
                      value={sshUser}
                      onChange={(e) => setSshUser(e.target.value)}
                      placeholder="root"
                      required
                      className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    SSH Password *
                  </label>
                  <input
                    type="password"
                    value={sshPassword}
                    onChange={(e) => setSshPassword(e.target.value)}
                    placeholder="Enter SSH password"
                    required
                    className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Password is not stored. Used only for installation.
                  </p>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Cloud Provider (Optional)
              </label>
              <input
                type="text"
                value={provider}
                onChange={(e) => setProvider(e.target.value)}
                placeholder="AWS, DigitalOcean, IDCloudHost, etc."
                className="w-full px-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-800/50 hover:bg-gray-700/50 text-white rounded-lg transition-all border border-gray-700/50 hover:border-gray-600/50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className={`flex-1 px-4 py-2 ${
                  installMode === 'auto'
                    ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600'
                    : 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600'
                } disabled:from-gray-700 disabled:to-gray-700 text-white rounded-lg transition-all shadow-lg`}
              >
                {isLoading ? 'Processing...' : installMode === 'auto' ? 'Install Now' : 'Continue'}
              </button>
            </div>
          </form>
        ) : step === 'installing' ? (
          <div className="p-6 space-y-4">
            <div className="bg-gray-800/50 rounded-lg p-4 font-mono text-xs overflow-auto max-h-96 whitespace-pre-wrap">
              {installLog}
              {isLoading && (
                <div className="flex items-center gap-2 mt-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                  <span className="text-gray-400">Installing...</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            <div className="bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/30 rounded-lg p-4">
              <p className="text-green-400 font-medium">Ready to install monitoring agent!</p>
              <p className="text-gray-400 text-sm mt-1">
                Run the command below on your server. The agent will automatically register and start monitoring.
              </p>
            </div>

            <div>
              <h4 className="font-medium text-white mb-3">One-Line Installation Command</h4>
              <p className="text-sm text-gray-400 mb-3">
                SSH to your server and run this command. The agent will automatically register itself:
              </p>
              <div className="relative">
                <div className="bg-black/50 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                  <code className="text-green-400 break-all">
                    {`curl -sSL ${window.location.origin}/install-agent.sh?v=${Date.now()} | sudo bash -s -- "${supabaseUrl}" "${import.meta.env.VITE_SUPABASE_ANON_KEY}"`}
                  </code>
                </div>
                <button
                  onClick={() => copyToClipboard(`curl -sSL ${window.location.origin}/install-agent.sh?v=${Date.now()} | sudo bash -s -- "${supabaseUrl}" "${import.meta.env.VITE_SUPABASE_ANON_KEY}"`)}
                  className="absolute top-2 right-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-white rounded transition-colors flex items-center gap-2 text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      Copy
                    </>
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                onServerAdded();
                onClose();
              }}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
