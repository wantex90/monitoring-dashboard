import { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { supabase, Server } from '../lib/supabase';

interface EditServerModalProps {
  server: Server;
  onClose: () => void;
  onServerUpdated: () => void;
}

export function EditServerModal({ server, onClose, onServerUpdated }: EditServerModalProps) {
  const [name, setName] = useState(server.name);
  const [hostname, setHostname] = useState(server.hostname);
  const [provider, setProvider] = useState(server.provider);
  const [tags, setTags] = useState<string[]>(server.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [notes, setNotes] = useState(server.notes || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleAddTag = () => {
    if (tagInput.trim() && !tags.includes(tagInput.trim())) {
      setTags([...tags, tagInput.trim()]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('servers')
        .update({
          name,
          hostname,
          provider,
          tags,
          notes,
          updated_at: new Date().toISOString(),
        })
        .eq('id', server.id);

      if (error) throw error;

      onServerUpdated();
      onClose();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-2xl">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Edit Server</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Server Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Hostname/IP *
            </label>
            <input
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Provider
            </label>
            <input
              type="text"
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
              placeholder="e.g., AWS, DigitalOcean, Self-hosted"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Tags
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500"
                placeholder="Add tag and press Enter"
              />
              <button
                type="button"
                onClick={handleAddTag}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-full text-sm flex items-center gap-2"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-emerald-300"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-emerald-500 h-24 resize-none"
              placeholder="Add notes or documentation about this server..."
            />
          </div>

          <div className="flex gap-3 pt-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 disabled:from-gray-700 disabled:to-gray-700 text-white rounded-lg transition-all"
            >
              <Save className="w-4 h-4" />
              {isLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
