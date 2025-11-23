import { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, Send, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface TerminalProps {
  serverId: string;
  onClose: () => void;
}

export function Terminal({ serverId, onClose }: TerminalProps) {
  const [command, setCommand] = useState('');
  const [output, setOutput] = useState<Array<{ type: 'command' | 'output' | 'error'; text: string }>>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const executeCommand = async () => {
    if (!command.trim() || isExecuting) return;

    const cmd = command.trim();
    setOutput((prev) => [...prev, { type: 'command', text: `$ ${cmd}` }]);
    setCommand('');
    setIsExecuting(true);

    try {
      const { data: serverData } = await supabase
        .from('servers')
        .select('*')
        .eq('id', serverId)
        .maybeSingle();

      if (!serverData) {
        setOutput((prev) => [...prev, {
          type: 'error',
          text: '⚠️  Server not found. Please add a server first.\n\nTo use terminal:\n1. Add a server with SSH credentials\n2. Install agent on the server: python3 server-agent.py\n3. Agent will process commands automatically'
        }]);
        setIsExecuting(false);
        return;
      }

      const { data, error } = await supabase
        .from('server_commands')
        .insert({
          server_id: serverId,
          command_type: 'execute',
          command: cmd,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      setOutput((prev) => [...prev, {
        type: 'output',
        text: '📤 Command sent to server agent...'
      }]);

      let attempts = 0;
      const maxAttempts = 30;

      const checkResult = setInterval(async () => {
        attempts++;

        const { data: cmdData } = await supabase
          .from('server_commands')
          .select('*')
          .eq('id', data.id)
          .maybeSingle();

        if (cmdData && cmdData.status === 'completed') {
          clearInterval(checkResult);
          const outputText = cmdData.output || 'Command completed successfully';
          setOutput((prev) => {
            const withoutWaiting = prev.filter(item => !item.text.includes('Command sent to server'));
            return [...withoutWaiting, { type: 'output', text: outputText }];
          });
          setIsExecuting(false);
        } else if (cmdData && cmdData.status === 'failed') {
          clearInterval(checkResult);
          const errorText = cmdData.output || 'Command failed';
          setOutput((prev) => {
            const withoutWaiting = prev.filter(item => !item.text.includes('Command sent to server'));
            return [...withoutWaiting, { type: 'error', text: errorText }];
          });
          setIsExecuting(false);
        } else if (attempts >= maxAttempts) {
          clearInterval(checkResult);
          setOutput((prev) => {
            const withoutWaiting = prev.filter(item => !item.text.includes('Command sent to server'));
            return [...withoutWaiting, {
              type: 'error',
              text: '⏱️  Command timeout - no response from server agent\n\n' +
                   '🔧 Troubleshooting:\n' +
                   '1. Check if server agent is running: python3 server-agent.py\n' +
                   '2. Verify SSH credentials are correct\n' +
                   '3. Check server network connectivity\n' +
                   '4. View agent logs for errors\n\n' +
                   'The agent file is located at: /tmp/cc-agent/60574685/project/server-agent.py'
            }];
          });
          setIsExecuting(false);
        }
      }, 1000);
    } catch (error: any) {
      setOutput((prev) => [...prev, {
        type: 'error',
        text: `❌ Error: ${error.message}\n\n` +
             '💡 Make sure:\n' +
             '• Server is added to the system\n' +
             '• SSH credentials are configured\n' +
             '• Agent is running on the remote server'
      }]);
      setIsExecuting(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      executeCommand();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-4xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <TerminalIcon className="w-5 h-5 text-green-500" />
            <h3 className="font-semibold text-white">Terminal</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div
          ref={outputRef}
          className="flex-1 p-4 font-mono text-sm overflow-y-auto bg-black/50 min-h-[300px] max-h-[500px]"
        >
          {output.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <TerminalIcon className="w-12 h-12 text-gray-600 mb-3" />
              <p className="text-gray-500">Enter a command to execute on the server...</p>
              <p className="text-gray-600 text-xs mt-2">Try commands like: ls, pwd, df -h, free -h</p>
            </div>
          ) : (
            <div className="space-y-1">
              {output.map((line, index) => (
                <div
                  key={index}
                  className={`whitespace-pre-wrap break-words ${
                    line.type === 'command'
                      ? 'text-green-400 font-semibold'
                      : line.type === 'error'
                      ? 'text-red-400'
                      : 'text-gray-200'
                  }`}
                >
                  {line.text}
                </div>
              ))}
              {isExecuting && (
                <div className="flex items-center gap-2 text-yellow-400">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse"></div>
                  <span>Waiting for response...</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 bg-black/50 rounded-lg px-3 py-2 border border-gray-700">
              <span className="text-green-500 font-mono">$</span>
              <input
                type="text"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Enter command..."
                disabled={isExecuting}
                className="flex-1 bg-transparent text-white outline-none font-mono placeholder:text-gray-600"
              />
            </div>
            <button
              onClick={executeCommand}
              disabled={!command.trim() || isExecuting}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              {isExecuting ? 'Executing...' : 'Execute'}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Press Enter to execute. Commands are run on the remote server.
          </p>
        </div>
      </div>
    </div>
  );
}
