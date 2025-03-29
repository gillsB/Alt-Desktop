import React, { useState } from "react";
import { Route, HashRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import DesktopGrid from "./components/DesktopGrid";
import EditIcon from "./components/EditIcon";
import { Header } from "./components/Header";
import HoverOpacityItem from "./components/HoverOpacityItem";
import VideoBackground from "./components/VideoBackground";

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
          element={<EditIcon onClose={() => window.close()} />}
        />
      </Routes>
    </Router>
  );
};

export default App;
