import { useEffect, useMemo, useState } from "react";
import "./App.css";
import { Chart } from "./Chart";
import { useStatistics } from "./useStatistics";

function App() {
  const staticData = useStaticData();
  const statistics = useStatistics(10);
  const [activeView, setActiveView] = useState<View>("CPU");
  const cpuUsages = useMemo(
    () => statistics.map((stat) => stat.cpuUsage),
    [statistics]
  );
  const ramUsages = useMemo(
    () => statistics.map((stat) => stat.ramUsage),
    [statistics]
  );
  const storageUsages = useMemo(
    () => statistics.map((stat) => stat.storageUsage),
    [statistics]
  );

  const activeUsages = useMemo(() => {
    switch (activeView) {
      case "CPU":
        return cpuUsages;
      case "RAM":
        return ramUsages;
      case "STORAGE":
        return storageUsages;
    }
  }, [activeView, cpuUsages, ramUsages, storageUsages]);

  useEffect(() => {
    return window.electron.subscribeChangeView((view) => setActiveView(view));
  }, []);

  return (
    <>
      <div className="App">
        <Header />
        <div className="main">
          <div>
            <SelectOption
              title="CPU"
              subTitle={staticData?.cpuModel ?? ""}
              data={cpuUsages}
              view="CPU"
              onClick={() => setActiveView("CPU")}
            />
            <SelectOption
              title="RAM"
              subTitle={staticData?.totalMemoryGB.toString() + " GB"}
              data={ramUsages}
              view="RAM"
              onClick={() => setActiveView("RAM")}
            />
            <SelectOption
              title="STORAGE"
              subTitle={staticData?.totalStorage.toString() + " GB"}
              data={storageUsages}
              view="STORAGE"
              onClick={() => setActiveView("STORAGE")}
            />
          </div>
          <div className="mainGrid">
            <Chart
              selectedView={activeView}
              data={activeUsages}
              maxDataPoints={10}
            ></Chart>
          </div>
        </div>
      </div>
    </>
  );
}

function SelectOption(props: {
  title: string;
  view: View;
  subTitle: string;
  data: number[];
  onClick: () => void;
}) {
  return (
    <button className="selectOption" onClick={props.onClick}>
      <div className="selectOptionTitle">
        <div>{props.title}</div>
        <div>{props.subTitle}</div>
      </div>
      <div className="selectOptionChart">
        {" "}
        <Chart selectedView={props.view} data={props.data} maxDataPoints={10} />
      </div>
    </button>
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
                onClick={() => window.electron.sendFrameAction("SHOW_DEVTOOLS")}
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
          onClick={() => window.electron.sendFrameAction("MINIMIZE")}
        >
          ─
        </button>
        <button
          id="maximize"
          onClick={() => window.electron.sendFrameAction("MAXIMIZE")}
        >
          <span className="maximize-icon"></span>
        </button>
        <button
          id="close"
          onClick={() => window.electron.sendFrameAction("CLOSE")}
        >
          ✕
        </button>
      </div>
    </header>
  );
}
function useStaticData() {
  const [staticData, setStaticData] = useState<StaticData | null>(null);

  useEffect(() => {
    (async () => {
      setStaticData(await window.electron.getStaticData());
    })();
  }, []);

  return staticData;
}

export default App;
