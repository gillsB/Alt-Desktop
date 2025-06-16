import React, { useState } from "react";
import { Route, HashRouter as Router, Routes } from "react-router-dom";
import "./App.css";
import Background from "./components/Background";
import BackgroundSelect from "./components/BackgroundSelect";
import DesktopGrid from "./components/DesktopGrid";
import EditBackground from "./components/EditBackground";
import EditIcon from "./components/EditIcon";
import EditTagsWindow from "./components/EditTags";
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
              <div className="main">
                <HoverOpacityItem setVideoOpacity={setVideoOpacity} />
                <Header />
                <DesktopGrid />
                <Background opacity={videoOpacity} />
              </div>
            </div>
          }
        />
        {/* Route for other windows */}
        <Route path="/edit-icon" element={<EditIcon />} />
        <Route path="/small-window" element={<SmallWindow />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/select-icon" element={<SelectIconWindow />} />
        <Route path="/background-select" element={<BackgroundSelect />} />
        <Route path="/edit-background" element={<EditBackground />} />
        <Route path="/edit-tags" element={<EditTagsWindow />} />
      </Routes>
    </Router>
  );
};

export default App;
