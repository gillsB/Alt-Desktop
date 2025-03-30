export function SubWindowHeader() {
  return (
    <header>
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
