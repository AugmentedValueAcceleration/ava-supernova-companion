'use client';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive = false,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm bg-ava-surface border border-ava-border rounded-2xl p-6 space-y-4">
        <h3 className="text-white font-semibold text-lg">{title}</h3>
        <p className="text-sm text-gray-300 leading-relaxed">{message}</p>
        <div className="flex gap-2 pt-1">
          <button
            onClick={onConfirm}
            className={`flex-1 font-medium py-2.5 rounded-xl transition text-sm ${
              destructive
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-ava-purple text-white hover:bg-ava-purple-dark'
            }`}
          >
            {confirmLabel}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 bg-ava-border text-gray-300 font-medium py-2.5 rounded-xl hover:bg-gray-600 transition text-sm"
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
