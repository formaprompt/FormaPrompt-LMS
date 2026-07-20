import { CheckCircle2, RotateCcw, Trash2 } from 'lucide-react';

interface DraftNoticeProps {
  status: 'restored' | 'deleted' | null;
  onClear: () => void;
}

export function DraftNotice({ status, onClear }: DraftNoticeProps) {
  return (
    <div className="studio-draft-tools">
      <div className="studio-draft-status" aria-live="polite">
        {status === 'restored' && (
          <p><RotateCcw aria-hidden="true" /> Votre brouillon a été restauré depuis ce navigateur.</p>
        )}
        {status === 'deleted' && (
          <p><CheckCircle2 aria-hidden="true" /> Le brouillon a été supprimé de ce navigateur.</p>
        )}
      </div>
      <button type="button" className="studio-clear-draft" onClick={onClear}>
        <Trash2 aria-hidden="true" /> Effacer mon brouillon
      </button>
    </div>
  );
}
