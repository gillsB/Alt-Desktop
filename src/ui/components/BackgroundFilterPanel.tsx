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
  // Group localTags by category
  const groupedLocalTags: Record<string, LocalTag[]> = React.useMemo(() => {
    const grouped: Record<string, LocalTag[]> = {};
    for (const tag of localTags) {
      if (!grouped[tag.category]) grouped[tag.category] = [];
      grouped[tag.category].push(tag);
    }
    return grouped;
  }, [localTags]);

  // Fetch category order
  const [categoryOrder, setCategoryOrder] = useState<string[]>([]);
  useEffect(() => {
    (async () => {
      const categories: string[] = await window.electron.getTagCategories();
      setCategoryOrder(categories);
    })();
  }, []);

  // Collapsed state for local categories
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(
    new Set()
  );
  const toggleCategory = (category: string) => {
    setCollapsedCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Collapsed state for public categories
  const [collapsedPublicCategories, setCollapsedPublicCategories] = useState<
    Set<string>
  >(new Set());
  const togglePublicCategory = (category: string) => {
    setCollapsedPublicCategories((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(category)) {
        newSet.delete(category);
      } else {
        newSet.add(category);
      }
      return newSet;
    });
  };

  // Collapse categories based on settings
  useEffect(() => {
    (async () => {
      const categoriesObj: Record<string, boolean> =
        (await window.electron.getSetting("categories")) ?? {};
      const collapsed = Object.entries(categoriesObj)
        .filter(([, expanded]) => !expanded)
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
      {/* Public tags */}
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
              style={{ marginLeft: 8 }}
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
                      logger?.info?.(`Filter ${tag} set to ${updated[tag]}`);
                      return updated;
                    });
                  }}
                />
                {tag}
              </label>
            ))}
        </div>
      ))}
      {/* Local tags grouped by category */}
      {sortedCategoryOrder
        .filter((category) => groupedLocalTags[category])
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
                style={{ marginLeft: 8 }}
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
