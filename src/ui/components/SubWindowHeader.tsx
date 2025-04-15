interface SubWindowHeaderProps {
  title: string;
}

export function SubWindowHeader({ title }: SubWindowHeaderProps) {
  return (
    <header className="subwindow-header">
      <div className="header-title">{title}</div>
      <div className="window-controls">
        <button
          id="close"
          onClick={() => window.electron.sendSubWindowAction("CLOSE_SUBWINDOW")}
        >
          ✕
        </button>
      </div>
    </header>
  );
}
