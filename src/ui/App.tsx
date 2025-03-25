import "./App.css";
import DesktopGrid from "./components/DesktopGrid";
import { Header } from "./components/Header";
import VideoBackground from "./components/VideoBackground";

function App() {
  return (
    <>
      <div className="App">
        <Header />
        <div className="main">
          <VideoBackground testMode={false} opacity={0.8} />
          <DesktopGrid />
        </div>
      </div>
    </>
  );
}

export default App;
