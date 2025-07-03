import React, { useEffect, useState } from "react";
import { PUBLIC_TAG_CATEGORIES } from "../../electron/publicTags";
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

  // "" category on top
  const sortedCategoryOrder = [
    ...categoryOrder.filter((c) => !c || c.trim() === ""),
    ...categoryOrder.filter((c) => c && c.trim() !== ""),
  ];

  return (
    <div className="filter-search-panel">
      <h3>Filter Backgrounds</h3>
      {/* Public tags */}
      {PUBLIC_TAG_CATEGORIES.map((cat) => (
        <div key={cat.name} className="filter-category-block">
          <div
            className="filter-category-title"
            style={{ cursor: "pointer" }}
            onClick={() => togglePublicCategory(cat.name)}
          >
            {cat.name}
            <button
              className="tag-toggle-button"
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
              <label key={tag} className="filter-tag-label">
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
          <div key={category} className="filter-category-block">
            <div
              className="filter-category-title"
              style={{ cursor: "pointer" }}
              onClick={() => toggleCategory(category)}
            >
              {category || "Uncategorized"}
              <button
                className="tag-toggle-button"
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
                <label key={tag.name} className="filter-tag-label">
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
      <button onClick={onClose}>Close</button>
    </div>
  );
};

export default BackgroundFilterPanel;
