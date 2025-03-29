interface SubWindowHeaderProps {
  onClose: () => void;
}

export function SubWindowHeader({ onClose }: SubWindowHeaderProps) {
  return (
    <header>
      <div className="window-controls">
        <button id="close" onClick={onClose}>
          ✕
        </button>
      </div>
    </header>
  );
}
