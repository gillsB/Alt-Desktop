import React, { useState } from "react";
import { Route, HashRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import VideoBackground from "./components/Background";
import DesktopGrid from "./components/DesktopGrid";
import EditIcon from "./components/EditIcon";
import { Header } from "./components/Header";
import HoverOpacityItem from "./components/HoverOpacityItem";
import SelectIconWindow from "./components/SelectIconWindow";
import Settings from "./components/Settings";
import SmallWindow from "./components/SmallWindow";

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
                <VideoBackground opacity={videoOpacity} />
                <DesktopGrid />
              </div>
            </div>
          }
        />
        {/* Route for the EditIcon and SmallWindow */}
        <Route path="/edit-icon" element={<EditIcon />} />
        <Route path="/small-window" element={<SmallWindow />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/select-icon" element={<SelectIconWindow />} />
      </Routes>
    </Router>
  );
};

export default App;
