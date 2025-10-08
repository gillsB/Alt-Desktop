import { useEffect, useState } from "react";
import { createLogger } from "../util/uiLogger";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("IconsProfile.tsx");

const IconsProfile: React.FC = () => {
  const [uniqueFiles, setUniqueFiles] = useState<desktopFile[]>([]);
  const [profile, setProfile] = useState<string>("default");
  const handleClose = () => {
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW", "IconsProfile");
  };

  useEffect(() => {
    const fetchRendererStates = async () => {
      const rendererStates = await window.electron.getRendererStates();
      setProfile(rendererStates.profile || "");
    };
    fetchRendererStates();
  }, []);

  useEffect(() => {
    const updateStates = (...args: unknown[]) => {
      const state = args[1] as Partial<RendererStates>;
      if ("profile" in state) {
        setProfile(state.profile || "default");
      }
    };
    window.electron.on("renderer-state-updated", updateStates);
    return () => {
      window.electron.off("renderer-state-updated", updateStates);
    };
  }, []);

  useEffect(() => {
    const fetchUniqueFiles = async () => {
      try {
        setUniqueFiles(await window.electron.getDesktopUniqueFiles(profile));
      } catch (error) {
        logger.error("Error fetching unique desktop files:", error);
      }
    };
    fetchUniqueFiles();
  }, [profile]);

  logger.info("Rendering IconsProfile component");

  return (
    <div className="subwindow-container">
      <SubWindowHeader title={`Icons Profile`} onClose={handleClose} />
      <div>Total unique DesktopFiles found: {uniqueFiles.length}</div>

      <div
        style={{
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        {uniqueFiles.map((file, index) => (
          <div key={index}>{JSON.stringify(file)}</div>
        ))}
      </div>
    </div>
  );
};

export default IconsProfile;
