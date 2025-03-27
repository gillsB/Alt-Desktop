import React, { useState } from "react";
import { HashRouter as Router, Route, Routes } from "react-router-dom";
import "./App.css";
import DesktopGrid from "./components/DesktopGrid";
import { Header } from "./components/Header";
import HoverOpacityItem from "./components/HoverOpacityItem";
import VideoBackground from "./components/VideoBackground";
import EditIcon from "./components/EditIcon";

const App: React.FC = () => {
  const [videoOpacity, setVideoOpacity] = useState(1);

  return (
    <Router>
      <Routes>
        {/* Route for the main app layout */}
        <Route
          path="/"
          element={
            <div className="App">
              <Header />
              <div className="main">
                <HoverOpacityItem setVideoOpacity={setVideoOpacity} />
                <VideoBackground testMode={false} opacity={videoOpacity} />
                <DesktopGrid />
              </div>
            </div>
          }
        />
        {/* Route for the EditIcon component only */}
        <Route
          path="/edit-icon"
          element={<EditIcon iconName="Sample Icon" onClose={() => window.close()} />}
        />
      </Routes>
    </Router>
  );
};

export default App;
