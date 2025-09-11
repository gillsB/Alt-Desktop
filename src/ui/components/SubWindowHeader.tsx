interface SubWindowHeaderProps {
  title: string;
  onClose?: () => void;
}

export function SubWindowHeader({ title, onClose }: SubWindowHeaderProps) {
  return (
    <header className="subwindow-header">
      <div className="header-title">{title}</div>
      <div className="window-controls">
        <button
          id="close"
          onClick={() => {
            if (onClose) {
              onClose();
            } else {
              window.electron.sendSubWindowAction("CLOSE_SUBWINDOW", title);
            }
          }}
        >
          ✕
        </button>
      </div>
    </header>
  );
}
