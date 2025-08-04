import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { PUBLIC_TAG_CATEGORIES } from "../../electron/publicTags";
import "../App.css";
import "../styles/BackgroundSelect.css";
import { createLogger } from "../util/uiLogger";
import { fileNameNoExt, parseAdvancedSearch } from "../util/uiUtil";
import BackgroundFilterPanel from "./BackgroundFilterPanel";
import ClearableInput from "./ClearableInput";
import { SafeImage } from "./SafeImage";
import { SubWindowHeader } from "./SubWindowHeader";

const logger = createLogger("BackgroundSelect.tsx");

const PAGE_SIZE = 40;
let includeTags: string[] = [];
const excludeTags: string[] = [];

const publicTagsFlat = PUBLIC_TAG_CATEGORIES.flatMap((cat) => cat.tags);

const BackgroundSelect: React.FC = () => {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const initialId = params.get("id") || undefined;

  const [backgroundType, setBackgroundType] = useState<string>("image");
  const [summaries, setSummaries] = useState<BackgroundSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedBg, setSelectedBg] = useState<BackgroundSummary | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    backgroundId: string;
  } | null>(null);
  const [pendingJump, setPendingJump] = useState(false);
  const fetching = useRef(false);

  const [isDragging, setIsDragging] = useState(false);
  const [page, setPage] = useState(-1);
  const [reloadKey, setReloadKey] = useState(0); // force reload for fetchPage useEffect
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const dragCounter = useRef(0);

  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInputValue, setPageInputValue] = useState("");

  const [showFilterPanel, setShowFilterPanel] = useState(false);
  const [filterOptions, setFilterOptions] = useState(() =>
    Object.fromEntries(publicTagsFlat.map((tag) => [tag, false]))
  );

  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [suggestionIndex, setSuggestionIndex] = useState(0);

  const [localTags, setLocalTags] = useState<LocalTag[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  const [scrollToId, setScrollToId] = useState<string | null>(null);
  const didAttemptScrollRef = useRef(false);

  const contextMenuRef = useRef<HTMLDivElement>(null);
  const gridItemRefs = useRef<{ [id: string]: HTMLDivElement | null }>({});

  // Volume Slider references
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSaveRef = useRef(false);
  const currentVolumeRef = useRef(selectedBg?.localVolume ?? 0.5); // keep up to date volume
  const [showVideoControls, setShowVideoControls] = useState(false);

  const [showDisplayDropdown, setShowDisplayDropdown] = useState(false);
  const displayDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updateRendererStates = async () => {
      const rendererStates = await window.electron.getRendererStates();
      setShowVideoControls(rendererStates.showVideoControls || false);
    };
    updateRendererStates();
  }, []);

  // Sets up allTags reference for all tags, public and local.
  useEffect(() => {
    (async () => {
      const tags = await window.electron.getSetting("localTags");
      if (Array.isArray(tags)) {
        setLocalTags(tags);
        setAllTags(
          Array.from(
            new Set([...publicTagsFlat, ...tags.map((t: LocalTag) => t.name)])
          )
        );
      } else {
        setAllTags([...publicTagsFlat]);
      }
    })();
  }, []);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageNumbers: (number | string)[] = [];

  const sidePages = 2;

  if (totalPages <= 9) {
    for (let i = 0; i < totalPages; i++) pageNumbers.push(i);
  } else {
    pageNumbers.push(0);

    if (page > 3) {
      pageNumbers.push("...");
    }
    // Show sidePages before current page
    for (let i = Math.max(1, page - sidePages); i < page; i++) {
      if (i !== 0 && i !== totalPages - 1) pageNumbers.push(i);
    }
    // Show current page
    if (page !== 0 && page !== totalPages - 1) pageNumbers.push(page);
    // Show sidePages after current page
    for (
      let i = page + 1;
      i <= Math.min(totalPages - sidePages, page + sidePages);
      i++
    ) {
      if (i !== 0 && i !== totalPages - 1) pageNumbers.push(i);
    }
    if (page < totalPages - 4) {
      pageNumbers.push("...");
    }

    pageNumbers.push(totalPages - 1);
  }

  const fetchPage = async () => {
    if (page === -1) return; // Prevent fetching page before initial page load.
    logger.info(`Fetching page ${page + 1} with search "${search}"`);
    const offset = page * PAGE_SIZE;

    // Parse search string for tags and terms
    const { addTags, removeTags, searchTerms } = parseAdvancedSearch(search);

    const newTags = Array.from(new Set([...includeTags, ...addTags]));
    const newExcludeTags = Array.from(new Set([...excludeTags, ...removeTags]));

    const { results, total } = await window.electron.getBackgroundSummaries({
      offset,
      limit: PAGE_SIZE,
      search: searchTerms.join(" "), // Only the free text terms
      includeTags: newTags,
      excludeTags: newExcludeTags,
    });
    setSummaries(results);
    setTotal(total);
    fetching.current = false;
  };

  const getBackgroundPage = async (id: string) => {
    const { addTags, removeTags, searchTerms } = parseAdvancedSearch(search);

    const newTags = Array.from(new Set([...includeTags, ...addTags]));
    const newExcludeTags = Array.from(new Set([...excludeTags, ...removeTags]));
    const { page: bgPage, summary } =
      await window.electron.getBackgroundPageForId({
        id: id,
        pageSize: PAGE_SIZE,
        search: searchTerms.join(" "),
        includeTags: newTags,
        excludeTags: newExcludeTags,
      });

    return { page: bgPage, summary };
  };
  // Handle scrolling after summaries are updated
  useEffect(() => {
    if (
      !scrollToId ||
      !summaries.length ||
      !gridItemRefs.current[scrollToId] ||
      fetching.current // Bounce if still fetching page
    )
      return;

    if (didAttemptScrollRef.current) return;
    didAttemptScrollRef.current = true;
    logger.info("Scrolling to ID:", scrollToId);

    requestAnimationFrame(() => {
      const selectedElement = gridItemRefs.current[scrollToId];
      if (selectedElement) {
        selectedElement.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
      setScrollToId(null);
      didAttemptScrollRef.current = false;
    });
  }, [summaries, scrollToId, gridItemRefs]);

  useEffect(() => {
    const loadInitialBackground = async () => {
      if (initialId) {
        logger.info("Passed with id to scrollTo on launch:", initialId);

        const { page: bgPage } = await getBackgroundPage(initialId);

        if (bgPage !== -1) {
          setScrollToId(initialId);
          setPage(bgPage);
          return;
        } else {
          logger.info("Initial ID not found in backgrounds list");
        }
      }

      // Fall back to saved background if no initialId
      const savedBackground = await window.electron.getSetting("background");
      if (savedBackground) {
        const { page: bgPage } = await getBackgroundPage(savedBackground);
        if (bgPage !== -1) {
          setScrollToId(savedBackground);
          setPage(bgPage);
          setSelectedIds([savedBackground]);
          return;
        } else {
          logger.info("Saved background not found in backgrounds list");
        }
      } else {
        logger.info("No saved background found");
      }

      // Fallback show page 0
      setPage(0);
      setSelectedIds([]);
      setSelectedBg(null);
    };

    const init = async () => {
      if (initialId) {
        logger.info("Passed with id to scrollTo on launch:", initialId);
      }
      await loadInitialBackground();
      const [newBgs, remBgs] = await window.electron.indexBackgrounds(); // Re-index backgrounds
      // If new or removed backgrounds, reload backgrounds and scroll to selectedBg
      if (newBgs || remBgs) {
        fetching.current = true;
        await loadInitialBackground(); // Load from initialID or saved backgrounds.json
        setReloadKey((k) => k + 1);
        setPendingJump(true); // Jump to background (when selectedBg is available)
      }
    };

    init();
  }, []);

  useEffect(() => {
    if (pendingJump && selectedBg) {
      logger.info("Jumping to background:", selectedBg.id);
      handleJumpToClick();
      setPendingJump(false);
    }
  }, [pendingJump, selectedBg]);

  useEffect(() => {
    if (page === -1) return; // prevent OnMount call.
    fetchPage();
  }, [page, search, reloadKey]);

  useEffect(() => {
    window.electron.on("backgrounds-updated", fetchPage);
    return () => {
      window.electron.off("backgrounds-updated", fetchPage);
    };
  }, []);

  useEffect(() => {
    if (page === -1) return; // prevent OnMount call.
    includeTags = Object.entries(filterOptions)
      .filter(([, checked]) => checked)
      .map(([tag]) => tag);
    if (page !== 0) {
      setPage(0); // useEffect above calls fetchPage
    } else {
      fetchPage();
    }
  }, [filterOptions]);

  const handleClose = async () => {
    logger.info("BackgroundSelect window closed");
    await window.electron.saveSettingsData({ background: selectedIds[0] });
    await window.electron.reloadBackground();
    window.electron.sendSubWindowAction("CLOSE_SUBWINDOW");
  };

  useEffect(() => {
    (async () => {
      const savedBackground = await window.electron.getSetting("background");
      if (savedBackground) {
        handleSelect(savedBackground);
      } else {
        logger.info("No saved background found");
      }
    })();
  }, []);

  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(null);
    };

    if (contextMenu) {
      document.addEventListener("click", handleClickOutside);
      return () => document.removeEventListener("click", handleClickOutside);
    }
  }, [contextMenu]);

  const handleSelect = async (id: string, e?: React.MouseEvent) => {
    // Used for selecting multiple files, not sure if this will be allowed or what to do with this.
    if (e && (e.ctrlKey || e.metaKey)) {
      setSelectedIds((prev) => {
        let next;
        if (prev.includes(id)) {
          next = prev.filter((x) => x !== id);
        } else {
          next = [...prev, id];
        }
        // If the next selection is empty, preview fallback.
        if (next.length === 0) {
          window.electron.previewBackgroundUpdate({ id: "fallback" });
          setSelectedBg(null);
        } else if (
          // If the selection just went from 0 to 1, or selectedBg is not in next
          prev.length === 0 ||
          (selectedBg && !next.includes(selectedBg.id))
        ) {
          const newBg = summaries.find((bg) => bg.id === next[0]);
          window.electron.previewBackgroundUpdate({
            id: newBg?.id ?? "fallback",
          });
          setSelectedBg(newBg ?? null);
        }
        return next;
      });
      return;
    }

    // Find the selected background, select it, and update the preview
    // DO NOT APPLY FILTER to fetch, or you break the background on closing.
    const bg = summaries.find((bg) => bg.id === id);
    logger.info("Selected background:", bg);
    setSelectedIds([id]);
    if (bg) {
      setSelectedBg(bg);
    } else {
      // If not in current page, fetch directly
      const response = await window.electron.getBackgroundSummaries({
        offset: 0,
        limit: 1,
        search: "id:" + id,
        includeTags: [],
        excludeTags: [],
      });
      if (response.results.length > 0) setSelectedBg(response.results[0]);
      else setSelectedBg(null);
    }
    if (id) {
      await window.electron.previewBackgroundUpdate({ id: id });
    }
  };

  const handleEditBackground = async (backgroundId?: string) => {
    if (!backgroundId) {
      await window.electron.openEditBackground({} as BackgroundSummary);
      return;
    }
    const bg = summaries.find((bg) => bg.id === backgroundId);
    logger.info("background = ", bg);
    if (bg) {
      await window.electron.openEditBackground(bg);
    } else {
      logger.warn(`Background with id ${backgroundId} not found in summaries`);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, backgroundId: string) => {
    e.preventDefault();
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      backgroundId,
    });
  };

  const handleOpenFolder = async (backgroundId: string) => {
    if (selectedIds.includes(backgroundId)) {
      // Open all other selected IDs except the one right-clicked
      for (const id of selectedIds) {
        if (id !== backgroundId) {
          logger.info(
            `Multiple backgrounds selected, opening folder for ${id}`
          );
          await window.electron.openInExplorer("background", id);
        }
      }
    }
    // Open the one that was right-clicked
    logger.info(`Opening folder for background ${backgroundId}`);
    await window.electron.openInExplorer("background", backgroundId);
    setContextMenu(null);
  };

  useEffect(() => {
    const getBackgroundType = async () => {
      if (!selectedBg?.id) {
        logger.warn("No selected background to determine type");
        setBackgroundType("image");
        return;
      }
      const type = await window.electron.getInfoFromID(
        selectedBg?.id || "",
        "fileType"
      );
      if (type) {
        setBackgroundType(type);
      } else {
        logger.error(
          "Failed to get background type for selectedBg: ",
          selectedBg?.id || "none"
        );
        setBackgroundType("image");
      }
    };
    getBackgroundType();
  }, [selectedBg]);

  // TODO fix this for recently in use larger files (video/maybe images).
  // Problem is that recently in use cannot be moved to trash. and attempting shows 2 admin
  // permission windows (which does not solve the issue of the folder being locked due to use).
  const handleDeleteBackground = async (backgroundId: string) => {
    const bg = summaries.find((bg) => bg.id === backgroundId);
    const displayName = bg?.name
      ? `${bg.name} (${backgroundId})`
      : backgroundId;

    const result = await window.electron.showSmallWindow(
      "Delete Background",
      `Are you sure you want to delete background:\n${displayName}`,
      ["Delete", "Cancel"]
    );
    if (result === "Delete") {
      logger.info(`Attempting to delete background ${backgroundId}`);

      // If the background is selected, unselect and preview fallback background
      if (selectedIds.includes(backgroundId)) {
        setSelectedIds((prev) => prev.filter((id) => id !== backgroundId));

        if (selectedBg && selectedBg.id === backgroundId) {
          setSelectedBg(null);
          await window.electron.previewBackgroundUpdate({
            id: "fallback",
          });
        }
      }

      // Attempt deletion
      try {
        const success = await window.electron.deleteBackground(backgroundId);
        if (success) {
          logger.info(`Successfully deleted background ${backgroundId}`);
          fetchPage();
        } else {
          logger.error(`Failed to delete background ${backgroundId}`);
          // Show file in use to user.
          await window.electron.showSmallWindow(
            "Delete Failed",
            `Failed to delete background: \n${displayName}\nThe file may still be in use. Try waiting a few seconds then delete it again.`,
            ["OK"]
          );
        }
      } catch (error) {
        logger.error(`Error deleting background ${backgroundId}:`, error);
        await window.electron.showSmallWindow(
          "Delete Error",
          `Error deleting background: ${displayName}\n\n${error}`,
          ["OK"]
        );
      }
    }

    setContextMenu(null);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleFileDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    const files = event.dataTransfer.files;
    if (!files || files.length === 0) return;

    if (files.length > 1) {
      logger.warn("Please drop only one file at a time.");
      await window.electron.showSmallWindow(
        "Drop File",
        "Please only drop 1 file at a time",
        ["OK"]
      );
      return;
    }

    const filePath = window.electron.getFilePath(files[0]);
    logger.info("Dropped file path:", filePath);
    logger.info(await window.electron.getFileType(filePath));

    await window.electron.openEditBackground({
      id: "",
      name: fileNameNoExt(filePath),
      bgFile: filePath,
    });
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    dragCounter.current++;
    if (dragCounter.current === 1) {
      setIsDragging(true);
    }
  };

  const handleFilterClick = () => {
    setShowFilterPanel((prev) => !prev);
  };

  const handleAddBackgroundClick = () => {
    window.electron.openEditBackground({} as BackgroundSummary);
  };

  const handleJumpToClick = async () => {
    if (!selectedBg) return;
    // Get the page and position for the currently selected background

    const { page: bgPage } = await getBackgroundPage(selectedBg.id);
    if (bgPage !== -1) {
      setScrollToId(selectedBg.id);
      setPage(bgPage);
      setSelectedIds([selectedBg.id]);
    } else {
      // TODO fix this when excluding is eventually added. No set in stone idea for what it does when
      // it is not in the current filter yet. Either discard filter, show regardless, or show a message.
      logger.info("Selected background not found in backgrounds list");
    }
  };

  function getDisplayName(bg: BackgroundSummary) {
    if (bg.name) return bg.name;
    if (bg.id && bg.id.startsWith("ext::")) {
      // Remove "ext::<num>::" prefix for external paths backgrounds
      const match = bg.id.match(/^ext::\d+::(.+)$/);
      if (match) return match[1];
    }
    return bg.id;
  }

  useLayoutEffect(() => {
    if (contextMenu) {
      // Use requestAnimationFrame to ensure the menu is rendered
      requestAnimationFrame(adjustContextMenuPosition);
    }
  }, [contextMenu]);

  const adjustContextMenuPosition = () => {
    // Only run if context menu exists
    if (!contextMenuRef.current) return;

    const menuElement = contextMenuRef.current;
    const menuRect = menuElement.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Get current position from style
    const currentX = parseFloat(menuElement.style.left);
    const currentY = parseFloat(menuElement.style.top);

    // Adjust if needed to prevent overflow
    if (currentX + menuRect.width > viewportWidth) {
      menuElement.style.left = `${currentX - menuRect.width}px`;
    }

    if (currentY + menuRect.height > viewportHeight) {
      menuElement.style.top = `${currentY - menuRect.height}px`;
    }

    const submenuWidth = 120; // Approximate width submenu
    const shouldShowSubmenuLeft =
      currentX + menuRect.width + submenuWidth > viewportWidth;
    menuElement.setAttribute(
      "data-submenu-direction",
      shouldShowSubmenuLeft ? "left" : "right"
    );
  };

  const handleTagClick = async (tag: string) => {
    logger.info("Tag clicked:", tag);
    setSearch((prev) => {
      // If tag is already in search, do nothing
      if (prev.includes(`tag:${tag}`)) return prev;

      setPage(0);
      // Otherwise, add it to the search
      return `${prev} tag:${tag}`.trim();
    });
  };

  const updateSummary = (id: string, updates: Partial<BackgroundSummary>) => {
    if (selectedBg) {
      setSelectedBg((prevSelectedBg) => ({
        ...prevSelectedBg,
        id,
        ...updates,
      }));
    }
    // Update the summaries list with the new values
    setSummaries((prevSummaries) =>
      prevSummaries.map((bg) => (bg.id === id ? { ...bg, ...updates } : bg))
    );
  };

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      // If dropdown is open and click is outside dropdown and button, close it
      if (
        showDisplayDropdown &&
        displayDropdownRef.current &&
        !displayDropdownRef.current.contains(e.target as Node)
      ) {
        const button = document.getElementById("display-btn");
        if (button && button.contains(e.target as Node)) {
          return;
        }
        setShowDisplayDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showDisplayDropdown]);

  return (
    <div
      className="background-select-root"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleFileDrop}
    >
      <SubWindowHeader title="Background Select" onClose={handleClose} />
      <div className="background-main-content">
        {/* Left side: search, grid, paging */}
        <div className="background-left-panel">
          <div className="search-menu">
            <ClearableInput
              value={search}
              placeholder="Search backgrounds..."
              onChange={(e) => {
                const value = e.target.value;
                setPage(0);
                setSearch(value);
                // This only works for adding tag: at the current end of a message.
                const tagMatch = value.match(/(?:^|\s)(-?)tag:([^\s]*)$/i);
                if (tagMatch) {
                  const partial = tagMatch[2].toLowerCase();
                  const matches = allTags
                    .filter((tag) => tag.toLowerCase().startsWith(partial))
                    .slice(0, 5);
                  setTagSuggestions(matches);
                  setShowTagSuggestions(matches.length > 0);
                  setSuggestionIndex(0);
                } else {
                  setShowTagSuggestions(false);
                  setTagSuggestions([]);
                }
              }}
              onKeyDown={(e) => {
                if (showTagSuggestions && tagSuggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    setSuggestionIndex((i) => (i + 1) % tagSuggestions.length);
                    e.preventDefault();
                  } else if (e.key === "ArrowUp") {
                    setSuggestionIndex(
                      (i) =>
                        (i - 1 + tagSuggestions.length) % tagSuggestions.length
                    );
                    e.preventDefault();
                  } else if (e.key === "Tab" || e.key === "Enter") {
                    const value = search.replace(
                      /(?:^|\s)(-?)tag:[^\s]*$/i,
                      (m, neg) => {
                        const prefix = m.match(/^\s/) ? " " : "";
                        return (
                          prefix +
                          (neg || "") +
                          "tag:" +
                          tagSuggestions[suggestionIndex]
                        );
                      }
                    );
                    setSearch(value + " ");
                    setShowTagSuggestions(false);
                    setTagSuggestions([]);
                    e.preventDefault();
                  } else if (e.key === "Escape") {
                    setShowTagSuggestions(false);
                  }
                }
              }}
            />

            <button className="filter-button" onClick={handleFilterClick}>
              Filter Search
            </button>
            <button className="button" onClick={handleAddBackgroundClick}>
              +
            </button>
            {showTagSuggestions && (
              <div className="tag-suggestion-dropdown">
                {tagSuggestions.map((tag, idx) => (
                  <div
                    key={tag}
                    className={
                      "tag-suggestion-item" +
                      (idx === suggestionIndex ? " selected" : "")
                    }
                    onMouseDown={() => {
                      const value = search.replace(
                        /(?:^|\s)tag:[^\s]*$/i,
                        (m) => {
                          const prefix = m.match(/^\s/) ? " " : "";
                          return prefix + "tag:" + tag;
                        }
                      );
                      setSearch(value + " ");
                      setShowTagSuggestions(false);
                      setTagSuggestions([]);
                    }}
                  >
                    {"tag:" + tag}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="background-select-content">
            <div className="background-grid">
              {summaries.map((bg) => (
                <div
                  key={bg.id}
                  ref={(selectedElement) => {
                    gridItemRefs.current[bg.id] = selectedElement;
                  }}
                  className={
                    "background-grid-item" +
                    (selectedIds.includes(bg.id) ? " selected" : "")
                  }
                  onClick={(e) => handleSelect(bg.id, e)}
                  onContextMenu={(e) => handleContextMenu(e, bg.id)}
                  tabIndex={0}
                >
                  <SafeImage
                    imagePath={bg.iconPath ?? ""}
                    className="background-icon"
                  />
                  <h4>{getDisplayName(bg)}</h4>
                </div>
              ))}
            </div>
          </div>
          <div className="background-paging-bar">
            <button
              className={`paging-nav${page === 0 ? " inactive" : ""}`}
              onClick={() => page > 0 && setPage((p) => Math.max(0, p - 1))}
              tabIndex={0}
            >
              Prev
            </button>
            {pageNumbers.map((num, idx) =>
              num === "..." ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="paging-ellipsis"
                  onClick={() => setShowPageInput(true)}
                  title="Jump to page"
                >
                  ...
                </span>
              ) : (
                <button
                  key={num}
                  className={num === page ? "paging-current" : ""}
                  onClick={() => setPage(Number(num))}
                  disabled={num === page}
                  style={{
                    fontWeight: num === page ? "bold" : undefined,
                    margin: "0 2px",
                  }}
                >
                  {Number(num) + 1}
                </button>
              )
            )}
            {showPageInput && (
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageInputValue}
                autoFocus
                onChange={(e) =>
                  setPageInputValue(e.target.value.replace(/\D/, ""))
                }
                onBlur={() => setShowPageInput(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = Math.max(
                      1,
                      Math.min(totalPages, Number(pageInputValue))
                    );
                    setPage(val - 1);
                    setShowPageInput(false);
                  }
                  if (e.key === "Escape") setShowPageInput(false);
                }}
              />
            )}
            <button
              className={`paging-nav${page + 1 >= totalPages ? " inactive" : ""}`}
              onClick={() => page + 1 < totalPages && setPage((p) => p + 1)}
              tabIndex={0}
            >
              Next
            </button>
          </div>
        </div>
        {/* Right side: details or filter */}
        <div className="background-right-panel">
          {showFilterPanel ? (
            <BackgroundFilterPanel
              filterOptions={filterOptions}
              setFilterOptions={setFilterOptions}
              localTags={localTags}
              onClose={() => setShowFilterPanel(false)}
            />
          ) : selectedBg ? (
            <div className="background-details-panel" key={selectedBg.id}>
              <div key={selectedBg.id} className="background-details">
                <div className="button-center" style={{ position: "relative" }}>
                  <button
                    className="button"
                    onClick={() => setShowDisplayDropdown((prev) => !prev)}
                    title="Options to better view backgrounds"
                    id="display-btn"
                    style={{ position: "relative" }}
                  >
                    Display
                  </button>
                  {showDisplayDropdown && (
                    <div className="display-dropdown" ref={displayDropdownRef}>
                      <label className="display-checkbox">
                        Show icons
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => logger.info("Icon names clicked")}
                        />
                      </label>
                      <label className="display-checkbox">
                        Show icon names
                        <input
                          type="checkbox"
                          checked={true}
                          onChange={() => logger.info("Icon names clicked")}
                        />
                      </label>
                      <label className="display-checkbox">
                        Show video controls
                        <input
                          type="checkbox"
                          checked={showVideoControls}
                          onChange={() => {
                            setShowVideoControls((prev) => !prev);
                          }}
                        />
                      </label>
                    </div>
                  )}
                </div>
                {selectedBg.iconPath && (
                  <div className="details-row">
                    <SafeImage
                      imagePath={selectedBg.iconPath}
                      width={128}
                      height={128}
                      className="panel-icon"
                    />
                  </div>
                )}
                <div className="button-center">
                  <button
                    className="button"
                    onClick={() => handleEditBackground(selectedBg.id)}
                  >
                    Edit
                  </button>
                  <button
                    className="button"
                    onClick={() => setPendingJump(true)}
                  >
                    Jump to
                  </button>
                </div>
                <h3>{getDisplayName(selectedBg)}</h3>
                {backgroundType.startsWith("video") && (
                  <div className="details-row">
                    <label htmlFor="volume-slider">Volume</label>
                    <div className="details-value">
                      <input
                        id="volume-slider"
                        className={`volume-slider ${showVideoControls ? "red-slider" : ""}`}
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={selectedBg.localVolume ?? 0.5}
                        style={
                          {
                            "--progress": `${(selectedBg.localVolume ?? 0.5) * 100}%`,
                          } as React.CSSProperties
                        }
                        onChange={async (e) => {
                          const newVolume = parseFloat(e.target.value);
                          currentVolumeRef.current = newVolume;

                          setSelectedBg({
                            ...selectedBg,
                            localVolume: newVolume,
                          });
                          updateSummary(selectedBg.id, {
                            localVolume: newVolume,
                          });
                          await window.electron.previewBackgroundUpdate({
                            volume: newVolume,
                          });

                          if (!pendingSaveRef.current) {
                            pendingSaveRef.current = true;

                            if (timeoutRef.current) {
                              clearTimeout(timeoutRef.current);
                            }

                            timeoutRef.current = setTimeout(async () => {
                              await window.electron.saveBgJson({
                                id: selectedBg.id,
                                localVolume: currentVolumeRef.current,
                              });
                              pendingSaveRef.current = false;
                            }, 400);
                          }
                        }}
                      />
                      <span>
                        {Math.round((selectedBg.localVolume ?? 0.5) * 100)}%
                      </span>
                    </div>
                  </div>
                )}
                <div className="details-row">
                  <label>Description</label>
                  <div className="details-value">
                    {selectedBg.description || <em>No description</em>}
                  </div>
                </div>
                <div className="details-row">
                  <label>Tags</label>
                  <div className="details-value">
                    {selectedBg.tags && selectedBg.tags.length > 0 ? (
                      selectedBg.tags.map((tag, index) => (
                        <span
                          key={index}
                          onClick={() => handleTagClick(tag)}
                          style={{
                            cursor: "pointer",
                          }}
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <em>None</em>
                    )}
                  </div>
                </div>
                <div className="details-row">
                  <label>Local Tags</label>
                  <div className="details-value">
                    {selectedBg.localTags && selectedBg.localTags.length > 0 ? (
                      selectedBg.localTags.map((tag, index) => (
                        <span
                          key={index}
                          onClick={() => handleTagClick(tag)}
                          style={{
                            cursor: "pointer",
                          }}
                        >
                          {tag}
                        </span>
                      ))
                    ) : (
                      <em>None</em>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="background-empty-panel">
              <div>
                Drag and drop an image or video onto this window to create a new
                background. Or click the button below.
                <br />
                <br />
                <button
                  className="button"
                  onClick={() => handleEditBackground()}
                >
                  Create Background
                </button>
                <br />
                <br />
                Then select a background by clicking on it.
              </div>
            </div>
          )}
        </div>
      </div>
      {isDragging && (
        <div className="drag-overlay">
          <div className="drag-content">
            <div className="drag-icon">+</div>
            <div className="drag-text">Drop Image/Video here.</div>
          </div>
        </div>
      )}
      {contextMenu && (
        <div
          className="context-menu"
          ref={contextMenuRef}
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="menu-item"
            onClick={() => handleEditBackground(contextMenu.backgroundId)}
          >
            Edit Background
          </div>
          <div className="menu-separator" />
          <div
            className="menu-item"
            onClick={() => handleOpenFolder(contextMenu.backgroundId)}
          >
            Open Folder
          </div>
          <div className="menu-separator" />
          <div
            className="menu-item"
            onClick={() => handleDeleteBackground(contextMenu.backgroundId)}
          >
            Delete Background
          </div>
        </div>
      )}
    </div>
  );
};

export default BackgroundSelect;
