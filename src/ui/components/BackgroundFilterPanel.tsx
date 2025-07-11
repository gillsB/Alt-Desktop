import React, { useEffect, useState } from "react";
import { PUBLIC_TAG_CATEGORIES } from "../../electron/publicTags";
import "../styles/BackgroundFilterPanel.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("BackgroundFilterPanel.tsx");

interface BackgroundFilterPanelProps {
  filterOptions: Record<string, boolean>;
  setFilterOptions: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  localTags: LocalTag[];
  onClose: () => void;
}

const BackgroundFilterPanel: React.FC<BackgroundFilterPanelProps> = ({
  filterOptions,
  setFilterOptions,
  localTags,
  onClose,
}) => {
  const [collapsedPublicTags, setCollapsedPublicTags] = useState(false);
  const [collapsedPublicCategories, setCollapsedPublicCategories] = useState<
    Set<string>
  >(new Set());
  const [collapsedLocalTags, setCollapsedLocalTags] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);

  // Group localTags by category
  const groupedLocalTags: Record<string, LocalTag[]> = React.useMemo(() => {
    const grouped: Record<string, LocalTag[]> = {};
    for (const tag of localTags) {
      if (!grouped[tag.category]) grouped[tag.category] = [];
      grouped[tag.category].push(tag);
    }
    return grouped;
  }, [localTags]); // localTags must be updated in BackgroundSelect to trigger this dependency.

  // Fetch category order
  useEffect(() => {
    (async () => {
      let categories: string[] = await window.electron.getLocalCategories();
      // Ensure "" is included if there are tags with no category
      const hasNoCategory = localTags.some((tag) => !tag.category);
      if (hasNoCategory && !categories.includes("")) {
        categories = [""].concat(categories);
      }
      setCategoryOrder(categories);
    })();
  }, [localTags]);

  const togglePublicCategory = (category: string) => {
    setCollapsedPublicCategories((prev) => {
      const newSet = new Set(prev);
      let expanded = true;
      if (newSet.has(category)) {
        newSet.delete(category);
        expanded = true;
      } else {
        newSet.add(category);
        expanded = false;
      }
      window.electron
        .getSetting("publicCategories")
        .then(
          (
            publicCategoriesObj:
              | (Record<string, boolean> & { show?: boolean })
              | undefined
          ) => {
            if (
              publicCategoriesObj &&
              typeof publicCategoriesObj === "object"
            ) {
              publicCategoriesObj[category] = expanded;
              window.electron.saveSettingsData({
                publicCategories: publicCategoriesObj,
              });
            }
          }
        );
      return newSet;
    });
  };
  const togglePublicTagsSection = () => {
    setCollapsedPublicTags((prev) => {
      const newVal = !prev;
      window.electron
        .getSetting("publicCategories")
        .then(
          (
            publicCategoriesObj:
              | (Record<string, boolean> & { show?: boolean })
              | undefined
          ) => {
            if (
              publicCategoriesObj &&
              typeof publicCategoriesObj === "object"
            ) {
              publicCategoriesObj.show = !newVal;
              window.electron.saveSettingsData({
                publicCategories: publicCategoriesObj,
              });
            }
          }
        );
      return newVal;
    });
  };

  // Collapse public categories based on settings
  useEffect(() => {
    (async () => {
      const publicCategoriesObj: Record<string, boolean> & { show?: boolean } =
        (await window.electron.getSetting("publicCategories")) ?? {};
      if (typeof publicCategoriesObj.show === "boolean") {
        setCollapsedPublicTags(!publicCategoriesObj.show);
      }
      const collapsed = Object.entries(publicCategoriesObj)
        .filter(([cat, expanded]) => cat !== "show" && !expanded)
        .map(([cat]) => cat);
      setCollapsedPublicCategories(new Set(collapsed));
    })();
  }, []);

  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      let expanded = true;
      if (newSet.has(category)) {
        newSet.delete(category);
        expanded = true;
      } else {
        newSet.add(category);
        expanded = false;
      }
      window.electron
        .getSetting("localCategories")
        .then(
          (
            categoriesObj:
              | (Record<string, boolean> & { show?: boolean })
              | undefined
          ) => {
            if (categoriesObj && typeof categoriesObj === "object") {
              categoriesObj[category] = expanded;
              window.electron.saveSettingsData({
                localCategories: categoriesObj,
              });
            }
          }
        );
      return newSet;
    });
  };

  const toggleLocalTagsSection = () => {
    setCollapsedLocalTags((prev) => {
      const newVal = !prev;
      window.electron
        .getSetting("localCategories")
        .then(
          (
            categoriesObj:
              | (Record<string, boolean> & { show?: boolean })
              | undefined
          ) => {
            if (categoriesObj && typeof categoriesObj === "object") {
              categoriesObj.show = !newVal;
              window.electron.saveSettingsData({
                localCategories: categoriesObj,
              });
            }
          }
        );
      return newVal;
    });
    return;
  };
  // Collapse categories based on settings
  useEffect(() => {
    (async () => {
      const categoriesObj: Record<string, boolean> & { show?: boolean } =
        (await window.electron.getSetting("localCategories")) ?? {};
      if (typeof categoriesObj.show === "boolean") {
        setCollapsedLocalTags(!categoriesObj.show);
      }
      const collapsed = Object.entries(categoriesObj)
        .filter(([cat, expanded]) => cat !== "show" && !expanded)
        .map(([cat]) => cat);
      setCollapsedCategories(new Set(collapsed));
    })();
  }, []);

  // "" category on top
  const sortedCategoryOrder = [
    ...categoryOrder.filter((c) => !c || c.trim() === ""),
    ...categoryOrder.filter((c) => c && c.trim() !== ""),
  ];

  return (
    <div className="bgfilter-search-panel">
      {/* Public tags section header */}
      <div
        className={
          "bgfilter-section-header" + (collapsedPublicTags ? "" : " expanded")
        }
        style={{ cursor: "pointer" }}
        onClick={togglePublicTagsSection}
      >
        <label className="bgfilter-section-label" style={{ marginBottom: 0 }}>
          Public Tags:
        </label>
        <button
          className="bgfilter-tag-toggle-button"
          onClick={(e) => {
            e.stopPropagation();
            togglePublicTagsSection();
          }}
        >
          {collapsedPublicTags ? "▸" : "▾"}
        </button>
      </div>
      {/* Public tag categories */}
      {!collapsedPublicTags && (
        <div>
          {PUBLIC_TAG_CATEGORIES.map((cat) => (
            <div key={cat.name} className="bgfilter-category-block">
              <div
                className="bgfilter-category-title"
                style={{ cursor: "pointer" }}
                onClick={() => togglePublicCategory(cat.name)}
              >
                {cat.name}
                <button
                  className="bgfilter-tag-toggle-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePublicCategory(cat.name);
                  }}
                >
                  {collapsedPublicCategories.has(cat.name) ? "▸" : "▾"}
                </button>
              </div>
              {!collapsedPublicCategories.has(cat.name) &&
                cat.tags.map((tag) => (
                  <label key={tag} className="bgfilter-tag-label">
                    <input
                      type="checkbox"
                      checked={!!filterOptions[tag]}
                      onChange={() => {
                        setFilterOptions((prev) => {
                          const updated = { ...prev, [tag]: !prev[tag] };
                          logger?.info?.(
                            `Filter ${tag} set to ${updated[tag]}`
                          );
                          return updated;
                        });
                      }}
                    />
                    {tag}
                  </label>
                ))}
            </div>
          ))}
        </div>
      )}
      {/* Local tags grouped by category */}
      <div
        className={
          "bgfilter-section-header" + (collapsedLocalTags ? "" : " expanded")
        }
        style={{ cursor: "pointer", marginBottom: 4 }}
        onClick={toggleLocalTagsSection}
      >
        <label className="bgfilter-section-label">Local Tags:</label>
        <button
          className="bgfilter-tag-toggle-button"
          onClick={(e) => {
            e.stopPropagation();
            toggleLocalTagsSection();
          }}
        >
          {collapsedLocalTags ? "▸" : "▾"}
        </button>
      </div>
      {!collapsedLocalTags &&
        sortedCategoryOrder
          .filter(
            (category) =>
              groupedLocalTags[category] &&
              groupedLocalTags[category].length > 0
          )
          .map((category) => (
            <div key={category} className="bgfilter-category-block">
              <div
                className="bgfilter-category-title"
                style={{ cursor: "pointer" }}
                onClick={() => toggleCategory(category)}
              >
                {category || "No Category"}
                <button
                  className="bgfilter-tag-toggle-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCategory(category);
                  }}
                >
                  {collapsedCategories.has(category) ? "▸" : "▾"}
                </button>
              </div>
              {!collapsedCategories.has(category) &&
                (groupedLocalTags[category] || []).map((tag) => (
                  <label key={tag.name} className="bgfilter-tag-label">
                    <input
                      type="checkbox"
                      checked={!!filterOptions[tag.name]}
                      onChange={() => {
                        setFilterOptions((prev) => {
                          const updated = {
                            ...prev,
                            [tag.name]: !prev[tag.name],
                          };
                          logger?.info?.(
                            `Filter ${tag.name} set to ${updated[tag.name]}`
                          );
                          return updated;
                        });
                      }}
                    />
                    {tag.name}
                  </label>
                ))}
            </div>
          ))}
      <button className="bgfilter-close-btn" onClick={onClose}>
        Close
      </button>
    </div>
  );
};

export default BackgroundFilterPanel;
