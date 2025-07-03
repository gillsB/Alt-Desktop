import React from "react";
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

  const localCategories = Object.keys(groupedLocalTags);

  return (
    <div className="filter-search-panel">
      <h3>Filter Backgrounds</h3>
      {/* Public tags */}
      {PUBLIC_TAG_CATEGORIES.map((cat) => (
        <div key={cat.name} className="filter-category-block">
          <div className="filter-category-title">{cat.name}</div>
          {cat.tags.map((tag) => (
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
      {localCategories.map((category) => (
        <div key={category} className="filter-category-block">
          <div className="filter-category-title">
            {category || "Uncategorized"}
          </div>
          {(groupedLocalTags[category] || []).map((tag) => (
            <label key={tag.name} className="filter-tag-label">
              <input
                type="checkbox"
                checked={!!filterOptions[tag.name]}
                onChange={() => {
                  setFilterOptions((prev) => {
                    const updated = { ...prev, [tag.name]: !prev[tag.name] };
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
