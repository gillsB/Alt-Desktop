import { useState } from "react";
import "./App.css";
import DesktopGrid from "./components/DesktopGrid";
import { Header } from "./components/Header";
import HoverOpacityItem from "./components/HoverOpacityItem";
import VideoBackground from "./components/VideoBackground";

const App: React.FC = () => {
  const [videoOpacity, setVideoOpacity] = useState(1);

  return (
    <div className="App">
      <Header />
      <div className="main">
        <HoverOpacityItem setVideoOpacity={setVideoOpacity} />
        <VideoBackground testMode={false} opacity={videoOpacity} />
        <DesktopGrid />
      </div>
    </div>
  );
};

export default App;
