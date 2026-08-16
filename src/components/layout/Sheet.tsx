import type { ReactNode } from "react";

export function Sheet({
  children,
  onDismiss,
}: {
  children: ReactNode;
  onDismiss?: () => void;
}) {
  return (
    <div className="sheet-backdrop" onClick={onDismiss}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <span className="grab" />
        {children}
      </div>
    </div>
  );
}
