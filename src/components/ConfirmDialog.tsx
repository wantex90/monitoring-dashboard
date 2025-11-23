import { AlertTriangle, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  type?: 'danger' | 'warning' | 'info';
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  type = 'warning',
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const colorClasses = {
    danger: 'bg-red-600 hover:bg-red-700',
    warning: 'bg-yellow-600 hover:bg-yellow-700',
    info: 'bg-blue-600 hover:bg-blue-700',
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-500" />
            <h3 className="text-xl font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-gray-800 rounded transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-300">{message}</p>
        </div>

        <div className="flex gap-3 p-6 border-t border-gray-700">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 px-4 py-2 ${colorClasses[type]} text-white rounded-lg transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
