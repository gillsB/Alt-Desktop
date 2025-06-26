import React, { useEffect, useState } from "react";
import "../styles/AddTag.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";

const logger = createLogger("AddTag.tsx");

const STATIC_OPTIONS = [
  { value: "", label: "No category" },
  { value: "new", label: "New category  ➕" },
];

const AddTagWindow: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [categoryOptions, setCategoryOptions] = useState(STATIC_OPTIONS);

  useEffect(() => {
    (async () => {
      try {
        const categories: string[] = await window.electron.getTagCategories();
        logger.info(`Categories: ${categories}`);
        const dynamicOptions = categories
          .filter((cat) => cat && cat !== "" && cat !== "new")
          .map((cat) => ({ value: cat, label: cat }));
        setCategoryOptions([...STATIC_OPTIONS, ...dynamicOptions]);
      } catch (e) {
        logger.error("Failed to fetch tag categories", e);
      }
    })();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow lowercase, replace spaces with "-"
    const value = e.target.value.toLowerCase().replace(/\s+/g, "-");
    setTagInput(value);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
  };

  const handleNewCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewCategory(e.target.value);
  };

  const handleCreateTag = async () => {
    if (
      category === "new" &&
      (!newCategory ||
        categoryOptions.some((opt) => opt.value === newCategory.toLowerCase()))
    ) {
      await showSmallWindow(
        "Invalid Category",
        !newCategory
          ? "Please enter a new category name."
          : "A category with that name already exists. Please select it from the dropdown.",
        ["Okay"]
      );
      return;
    } else {
      try {
        const saved = await window.electron.addLocalTag({
          name: tagInput,
          category: category === "new" ? newCategory : category,
          favorite: false,
        });
        if (saved) {
          logger.info(`Tag created: ${tagInput} in category ${category}`);
          onClose?.();
          return;
        }
      } catch (error) {
        logger.error("Failed to save tag", error);
      }
    }
    logger.info(
      `Create Tag clicked, but failed to save with value: ${tagInput}, category: ${category}` +
        (category === "new" ? `, new category: ${newCategory}` : "")
    );
  };

  return (
    <div className="modal-window-content">
      <div className="modal-content">
        <div className="subwindow-field">
          <label>Tag Name:</label>
          <input
            type="text"
            value={tagInput}
            onChange={handleInputChange}
            placeholder="Enter new tag"
            className="create-tag-input"
          />
        </div>
        <div className="subwindow-field">
          <label>Category:</label>
          <div className="dropdown-container" style={{ width: "100%" }}>
            <select
              value={category}
              onChange={handleCategoryChange}
              className="create-tag-input"
              style={{ width: "100%" }}
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {category === "new" && (
          <div className="subwindow-field">
            <label>Category Name:</label>
            <input
              type="text"
              value={newCategory}
              onChange={handleNewCategoryChange}
              placeholder="Enter new category"
              className="create-tag-input"
            />
          </div>
        )}
      </div>
      <div className="modal-window-footer">
        <button className="button" onClick={handleCreateTag}>
          Create Tag
        </button>
        <button className="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export const RenameTagModal: React.FC<{
  initialName: string;
  existingNames: string[];
  onRename: (newName: string) => void;
  onCancel: () => void;
}> = ({ initialName, existingNames, onRename, onCancel }) => {
  const [value, setValue] = useState(initialName);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow lowercase, replace spaces with "-"
    const val = e.target.value.toLowerCase().replace(/\s+/g, "-");
    setValue(val);
  };

  const handleSubmit = async () => {
    if (!value) {
      await showSmallWindow("Invalid Tag Name", "Tag name cannot be empty.", [
        "Okay",
      ]);
      return;
    }
    if (value !== initialName && existingNames.includes(value)) {
      await showSmallWindow(
        "Duplicate Tag",
        "A tag with that name already exists.",
        ["Okay"]
      );
      return;
    }
    onRename(value);
  };

  return (
    <div className="modal-window-content">
      <div className="modal-content">
        <div className="subwindow-field">
          <label>Rename Tag:</label>
          <input
            type="text"
            value={value}
            onChange={handleInputChange}
            autoFocus
            className="create-tag-input"
            onKeyDown={async (e) => {
              if (e.key === "Escape") onCancel();
            }}
          />
        </div>
      </div>
      <div className="modal-window-footer">
        <button className="button" onClick={handleSubmit}>
          Rename
        </button>
        <button className="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default AddTagWindow;
