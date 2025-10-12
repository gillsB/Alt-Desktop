import { useEffect, useState } from "react";
import { createLogger } from "../util/uiLogger";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("DesktopProfile.tsx");

const DesktopProfile: React.FC = () => {
  const [uniqueFiles, setUniqueFiles] = useState<desktopFile[]>([]);
  const [profile, setProfile] = useState<string>("default");
  const [profiles, setProfiles] = useState<string[]>([]);

  const handleClose = () => {
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW", "DesktopProfile");
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const profileList = await window.electron.getProfiles();
      if (!cancelled) {
        // Sort profiles: "default" first, then alphabetically
        const sortedProfiles = profileList.sort((a, b) => {
          if (a === "default") return -1;
          if (b === "default") return 1;
          return a.localeCompare(b);
        });
        setProfiles(sortedProfiles);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const handleProfileChange = async (
    e: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const newProfile = e.target.value;
    setProfile(newProfile);
    window.electron.setRendererStates({ profile: newProfile });

    // Save the current background with the new profile
    try {
      // Get the current background ID from settings
      const bgId = await window.electron.getSetting("background");
      if (bgId) {
        await window.electron.saveBgJson({
          id: bgId,
          localProfile: newProfile,
        });
      }
    } catch (err) {
      logger.error(
        "Failed to update background profile on profile change:",
        err
      );
    }
  };

  logger.info("Rendering DesktopProfile component");

  return (
    <div className="subwindow-container">
      <SubWindowHeader title={`Desktop Profile`} onClose={handleClose} />
      <div>
        <label>Profile:</label>
        <select value={profile} onChange={handleProfileChange}>
          {profiles.map((p) => (
            <option key={p} value={p}>
              {p === "default" ? "Default" : p}
            </option>
          ))}
        </select>
      </div>
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

export default DesktopProfile;
