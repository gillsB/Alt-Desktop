import React, { useEffect, useState } from "react";
import "../styles/AddTag.css";
import "../styles/EditCategories.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";

const logger = createLogger("EditCategories.tsx");

const EditCategories: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [categoryInput, setCategoryInput] = useState("");
  const [categories, setCategories] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const cats: string[] = await window.electron.getTagCategories();
        logger.info(`Categories: ${cats}`);
        setCategories(cats);
      } catch (e) {
        logger.error("Failed to fetch categories", e);
      }
    })();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCategoryInput(e.target.value);
  };

  const handleAddCategory = async () => {
    if (!categoryInput) {
      await showSmallWindow(
        "Invalid Category",
        "Please enter a category name.",
        ["Okay"]
      );
      return;
    } // todo make this case insensitive
    if (categories.includes(categoryInput)) {
      await showSmallWindow(
        "Duplicate Category",
        "A category with that name already exists.",
        ["Okay"]
      );
      return;
    }
    try {
      // todo ipc handler to add category.
      setCategories([categoryInput, ...categories]);
      setCategoryInput("");
      logger.info(`Category added: ${categoryInput}`);
    } catch (error) {
      logger.error("Failed to add category", error);
    }
  };

  return (
    <div className="modal-window-content">
      <div className="modal-content">
        <h2>Edit Categories</h2>
        <div className="subwindow-field">
          <label>Category Name:</label>
          <input
            type="text"
            value={categoryInput}
            onChange={handleInputChange}
            placeholder="Enter new category"
            className="create-tag-input"
          />
        </div>
        <button className="button" onClick={handleAddCategory}>
          Add Category
        </button>
        <div className="edit-categories-list">
          <h3>Existing Categories</h3>
          <ul>
            {categories.map((cat) => (
              <li key={cat}>{cat}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="modal-window-footer">
        <button className="button" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default EditCategories;
