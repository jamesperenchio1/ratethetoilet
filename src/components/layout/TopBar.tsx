import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export function TopBar({
  title,
  meta,
  onClose,
  back,
  onBack,
  right,
}: {
  title: ReactNode;
  meta?: string;
  onClose?: boolean;
  back?: boolean;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="topbar">
      {back && (
        <span className="back" onClick={onBack ?? (() => navigate(-1))}>
          ←
        </span>
      )}
      {onClose && (
        <span className="close" onClick={() => navigate(-1)}>
          ✕
        </span>
      )}
      <span className="title">{title}</span>
      {meta && <span className="meta">{meta}</span>}
      {right}
    </div>
  );
}
