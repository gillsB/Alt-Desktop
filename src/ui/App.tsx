import { useState } from "react";
import "./App.css";
import DesktopGrid from "./components/DesktopGrid";

function App() {
  return (
    <>
      <div className="App">
        <Header />
        <div className="main">
          <video id="video-bg" autoPlay loop muted>
            <source src="background.mp4" type="video/mp4" />
            Browser does not support the video tag.
          </video>
          <DesktopGrid />
        </div>
      </div>
    </>
  );
}

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const devMode = process.env.NODE_ENV === "development";
  return (
    <header>
      {devMode && (
        <div className="menu-container">
          <button
            className="menu-button"
            onClick={() => setMenuOpen(!menuOpen)}
          >
            Devtools
          </button>
          {menuOpen && (
            <div className="dropdown-menu">
              <button
                onClick={() =>
                  window.electron.sendHeaderAction("SHOW_DEVTOOLS")
                }
              >
                Show Devtools
              </button>
            </div>
          )}
        </div>
      )}
      <div className="window-controls">
        <button
          id="minimize"
          onClick={() => window.electron.sendHeaderAction("MINIMIZE")}
        >
          ─
        </button>
        <button
          id="maximize"
          onClick={() => window.electron.sendHeaderAction("MAXIMIZE")}
        >
          <span className="maximize-icon"></span>
        </button>
        <button
          id="close"
          onClick={() => window.electron.sendHeaderAction("CLOSE")}
        >
          ✕
        </button>
      </div>
    </header>
  );
}

export default App;
