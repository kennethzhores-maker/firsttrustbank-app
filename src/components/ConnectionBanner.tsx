import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

interface ConnectionBannerProps {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export default function ConnectionBanner({ message, onRetry, retrying }: ConnectionBannerProps) {
  return (
    <div className="mx-4 md:mx-8 mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 animate-fade-scale">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-foreground/90">{message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            disabled={retrying}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground
                       hover:brightness-110 transition-all active:scale-[0.98] disabled:opacity-50 shrink-0"
          >
            {retrying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Retry
          </button>
        )}
      </div>
    </div>
  );
}
