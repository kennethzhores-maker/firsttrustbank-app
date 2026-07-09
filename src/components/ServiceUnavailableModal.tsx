import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle } from "lucide-react";

interface ServiceUnavailableModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ServiceUnavailableModal({ open, onClose }: ServiceUnavailableModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="glass-card-elevated border-border/50 max-w-sm sm:rounded-2xl">
        <DialogHeader className="items-center text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15">
            <AlertTriangle className="h-6 w-6 text-amber-500" />
          </div>
          <DialogTitle className="text-lg font-bold">Service Unavailable</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Please activate your card to use this service.
          </DialogDescription>
        </DialogHeader>
        <button
          onClick={onClose}
          className="mt-2 w-full rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground
                     hover:brightness-110 transition-all active:scale-[0.98]"
        >
          Close
        </button>
      </DialogContent>
    </Dialog>
  );
}
