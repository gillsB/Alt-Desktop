import React, { useEffect, useState } from "react";
import "../styles/AddTag.css";
import "../styles/EditCategories.css";
import { createLogger } from "../util/uiLogger";
import { showSmallWindow } from "../util/uiUtil";

const logger = createLogger("EditCategories.tsx");

interface DragState {
  draggedIndex: number | null;
  draggedOverIndex: number | null;
  insertPosition: "above" | "below" | null;
}

const EditCategories: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [categoryInput, setCategoryInput] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [dragState, setDragState] = useState<DragState>({
    draggedIndex: null,
    draggedOverIndex: null,
    insertPosition: null,
  });

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
    }
    const lowercasedCategoryInput = categoryInput.toLowerCase();
    if (
      categories.some(
        (category) => category.toLowerCase() === lowercasedCategoryInput
      )
    ) {
      await showSmallWindow(
        "Duplicate Category",
        "A category with that name already exists.",
        ["Okay"]
      );
      return;
    }

    try {
      await window.electron.saveSettingsData({
        categories: [categoryInput, ...categories],
      });
      setCategories([categoryInput, ...categories]);
      setCategoryInput("");
      logger.info(`Category added: ${categoryInput}`);
    } catch (error) {
      logger.error("Failed to add category", error);
    }
  };

  const handleDragStart = (
    e: React.DragEvent<HTMLLIElement>,
    index: number
  ) => {
    setDragState({
      draggedIndex: index,
      draggedOverIndex: null,
      insertPosition: null,
    });
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/html", e.currentTarget.outerHTML);
  };

  const handleDragEnd = () => {
    // Clear all drag state
    setDragState({
      draggedIndex: null,
      draggedOverIndex: null,
      insertPosition: null,
    });
  };

  const handleDragOver = (e: React.DragEvent<HTMLLIElement>, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";

    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const height = rect.height;

    // Determine if bottom or top half of category
    const insertPosition = y < height / 2 ? "above" : "below";

    setDragState({
      draggedIndex: dragState.draggedIndex,
      draggedOverIndex: index,
      insertPosition: insertPosition,
    });
  };

  const handleDragEnter = (e: React.DragEvent<HTMLLIElement>) => {
    e.preventDefault();
  };

  const handleDragLeave = (e: React.DragEvent<HTMLLIElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;

    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
      setDragState({
        ...dragState,
        draggedOverIndex: null,
        insertPosition: null,
      });
    }
  };

  const handleDrop = async (
    e: React.DragEvent<HTMLLIElement>,
    dropIndex: number
  ) => {
    e.preventDefault();

    if (dragState.draggedIndex === null || dragState.insertPosition === null) {
      return;
    }

    const draggedIndex = dragState.draggedIndex;
    const newCategories = [...categories];
    const draggedItem = newCategories[draggedIndex];

    // Calculate the final insert position
    let insertIndex;
    if (dragState.insertPosition === "above") {
      insertIndex = dropIndex;
    } else {
      insertIndex = dropIndex + 1;
    }

    // Adjust for the removal of the dragged item
    if (draggedIndex < insertIndex) {
      insertIndex--;
    }

    // Remove the dragged item
    newCategories.splice(draggedIndex, 1);

    // Insert it at the new position
    newCategories.splice(insertIndex, 0, draggedItem);

    setCategories(newCategories);
    logger.info(`Category moved from ${draggedIndex} to ${insertIndex}`);

    // Clear drag state immediately
    setDragState({
      draggedIndex: null,
      draggedOverIndex: null,
      insertPosition: null,
    });

    await window.electron.saveSettingsData({ categories: newCategories });
  };

  const getCategoryItemClass = (index: number) => {
    let className = "category-item";

    if (dragState.draggedIndex === index) {
      className += " dragging";
    }

    if (
      dragState.draggedOverIndex === index &&
      dragState.draggedIndex !== index
    ) {
      if (dragState.insertPosition === "above") {
        className += " drag-over-above";
      } else if (dragState.insertPosition === "below") {
        className += " drag-over-below";
      }
    }

    return className;
  };

  return (
    <div className="modal-window-content">
      <div className="modal-content">
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
          <ul className="draggable-list">
            {categories.map((cat, index) => (
              <li
                key={`${cat}-${index}`}
                className={getCategoryItemClass(index)}
                draggable
                onDragStart={(e) => handleDragStart(e, index)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, index)}
              >
                <span className="drag-handle">⋮⋮</span>
                <span className="category-text">{cat}</span>
              </li>
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
