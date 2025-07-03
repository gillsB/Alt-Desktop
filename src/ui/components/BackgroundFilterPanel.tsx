import React from "react";
import { PUBLIC_TAG_CATEGORIES } from "../../electron/publicTags";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("BackgroundFilterPanel.tsx");

interface BackgroundFilterPanelProps {
  filterOptions: Record<string, boolean>;
  setFilterOptions: React.Dispatch<
    React.SetStateAction<Record<string, boolean>>
  >;
  localTags: string[];
  onClose: () => void;
}

const BackgroundFilterPanel: React.FC<BackgroundFilterPanelProps> = ({
  filterOptions,
  setFilterOptions,
  localTags,
  onClose,
}) => (
  <div className="filter-search-panel">
    <h3>Filter Backgrounds</h3>
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
    {localTags.map((tag) => (
      <label key={tag}>
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
    <button onClick={onClose}>Close</button>
  </div>
);

export default BackgroundFilterPanel;
