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
  const [categoriesObj, setCategoriesObj] = useState<Record<string, boolean>>(
    {}
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [dragState, setDragState] = useState<DragState>({
    draggedIndex: null,
    draggedOverIndex: null,
    insertPosition: null,
  });

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");
  const [duplicateErrorIndex, setDuplicateErrorIndex] = useState<number | null>(
    null
  );
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<number | null>(
    null
  );
  const [emptyCategory, setEmptyCategory] = useState<boolean>(false);

  const fetchCategories = async () => {
    try {
      const catsObj: Record<string, boolean> =
        (await window.electron.getSetting("categories")) ?? {};
      setCategoriesObj(catsObj);
      // Separate out "" category for appending on save
      setEmptyCategory(Object.prototype.hasOwnProperty.call(catsObj, ""));
      setCategories(
        Object.keys(catsObj).filter((name) => name !== "" && name !== "show")
      );
      logger.info(`Categories: ${Object.keys(catsObj)}`);
    } catch (e) {
      logger.error("Failed to fetch categories", e);
    }
  };
  useEffect(() => {
    fetchCategories();
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
      const newObj = { [categoryInput]: true, ...categoriesObj };
      await saveCategories(newObj);
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

  // Re-attach the empty ("") category and save
  const saveCategories = async (newObj: Record<string, boolean>) => {
    if (emptyCategory) {
      newObj[""] = categoriesObj[""];
    }
    await window.electron.saveSettingsData({ categories: newObj });
    setCategoriesObj(newObj);
    setCategories(Object.keys(newObj).filter((name) => name !== ""));
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

    let insertIndex =
      dragState.insertPosition === "above" ? dropIndex : dropIndex + 1;
    if (draggedIndex < insertIndex) {
      insertIndex--;
    }
    if (draggedIndex === insertIndex) {
      logger.info(`Category dropped at the same position: ${draggedIndex}`);
      setDragState({
        draggedIndex: null,
        draggedOverIndex: null,
        insertPosition: null,
      });
      return;
    }

    // Reorder the keys, but keep the expanded/collapsed state
    const newOrder = [...categories];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(insertIndex, 0, removed);

    // Rebuild the object in the new order
    const newObj: Record<string, boolean> = {};
    for (const key of newOrder) {
      newObj[key] = categoriesObj[key];
    }

    logger.info(`Category moved from ${draggedIndex} to ${insertIndex}`);

    // Clear drag state immediately
    setDragState({
      draggedIndex: null,
      draggedOverIndex: null,
      insertPosition: null,
    });

    await saveCategories(newObj);
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

  const handleCategoryDoubleClick = (index: number) => {
    setEditingIndex(index);
    setEditingValue(categories[index]);
  };

  // Rename category
  const finishEditing = async (index: number) => {
    if (editingIndex === null) return;
    const oldName = categories[editingIndex];
    const newName = editingValue.trim();
    setEditingIndex(null);
    setEditingValue("");
    if (
      newName &&
      newName !== oldName &&
      categories.some(
        (cat, i) =>
          i !== editingIndex && cat.toLowerCase() === newName.toLowerCase()
      )
    ) {
      setDuplicateErrorIndex(index);
      setTimeout(() => setDuplicateErrorIndex(null), 1800);
      return;
    }
    if (newName && newName !== oldName) {
      logger.info(`Category renamed from "${oldName}" to "${newName}"`);
      const added = await window.electron.renameCategory(oldName, newName);
      logger.info("result for renameCategory:", added);
      if (added) {
        // Update local state
        const newObj: Record<string, boolean> = {};
        for (const key of categories) {
          if (key === oldName) {
            newObj[newName] = categoriesObj[oldName];
          } else {
            newObj[key] = categoriesObj[key];
          }
        }
        setCategoriesObj(newObj);
        setCategories(Object.keys(newObj));
        fetchCategories();
      }
    }
  };

  const handleDeleteClick = (index: number) => {
    setPendingDeleteIndex(index);
  };

  const handleConfirmDelete = async () => {
    if (pendingDeleteIndex === null) return;
    const name = categories[pendingDeleteIndex];
    const ret = await window.electron.deleteCategory(name);
    if (ret) logger.info(`Category deleted: ${name}`);
    setPendingDeleteIndex(null);
    fetchCategories();
  };

  const handleCancelDelete = () => {
    setPendingDeleteIndex(null);
  };

  return (
    <div className="modal-window-content">
      <div className="modal-content">
        <div className="subwindow-field">
          <input
            type="text"
            value={categoryInput}
            onChange={handleInputChange}
            placeholder="Enter new category name"
            className="create-tag-input"
          />
          <button className="button" onClick={handleAddCategory}>
            Add Category
          </button>
        </div>

        <div className="edit-categories-list">
          <h3>Existing Categories</h3>
          {pendingDeleteIndex !== null && (
            <div
              className="category-delete-overlay"
              onClick={handleCancelDelete}
            />
          )}
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
                style={{ position: "relative" }}
              >
                <span className="drag-handle">⋮⋮</span>
                {editingIndex === index ? (
                  <input
                    className="category-edit-input"
                    value={editingValue}
                    autoFocus
                    onChange={(e) => setEditingValue(e.target.value)}
                    onBlur={() => finishEditing(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") finishEditing(index);
                      if (e.key === "Escape") {
                        setEditingIndex(null);
                        setEditingValue("");
                      }
                    }}
                  />
                ) : (
                  <span
                    className="category-text"
                    onDoubleClick={() => handleCategoryDoubleClick(index)}
                    title="Double-click to rename"
                    style={{ cursor: "pointer" }}
                  >
                    {cat}
                  </span>
                )}
                {/* Delete button */}
                <button
                  className="category-delete-btn"
                  title="Delete category"
                  onClick={() => handleDeleteClick(index)}
                >
                  ×
                </button>
                {/* Inline error */}
                {duplicateErrorIndex === index && (
                  <div className="category-inline-error">
                    That name already exists
                  </div>
                )}
                {/* Confirm dialog */}
                {pendingDeleteIndex === index && (
                  <div className="category-delete-confirm">
                    <span>Delete &quot;{cat || <em>(empty)</em>}&quot;?</span>
                    <button className="button" onClick={handleConfirmDelete}>
                      Delete
                    </button>
                    <button className="button" onClick={handleCancelDelete}>
                      Cancel
                    </button>
                  </div>
                )}
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
