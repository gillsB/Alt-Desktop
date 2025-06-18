import React, { useState } from "react";
import "../styles/EditTags.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("EditTags.tsx");

const CATEGORY_OPTIONS = [
  { value: "none", label: "No category" },
  { value: "new", label: "New category  ➕" },
  { value: "cat1", label: "Cat1" },
  { value: "cat2", label: "Cat2" },
  { value: "cat3", label: "Cat3" },
];

const EditTagsWindow: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [tagInput, setTagInput] = useState("");
  const [category, setCategory] = useState("none");
  const [newCategory, setNewCategory] = useState("");

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow lowercase, replace spaces with "-"
    const value = e.target.value.toLowerCase().replace(/\s+/g, "-");
    setTagInput(value);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCategory(e.target.value);
  };

  const handleNewCategoryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setNewCategory(value);
  };

  const handleCreateTag = () => {
    logger.info(
      `Create Tag clicked with value: ${tagInput}, category: ${category}` +
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
              {CATEGORY_OPTIONS.map((opt) => (
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

export default EditTagsWindow;
