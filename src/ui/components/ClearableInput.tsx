import React, { useRef } from "react";
import "../styles/ClearableInput.css";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("Background.tsx");

type ClearableInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  placeholder?: string;
  inputClassName?: string;
  className?: string;
  flex?: boolean;
};

const ClearableInput: React.FC<ClearableInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = "",
  className = "",
  inputClassName = "",
  flex = false,
  ...props
}) => {
  if (flex) inputClassName += " flex-input";

  const [internalValue, setInternalValue] = React.useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const isControlled = value !== undefined;

  const inputValue = isControlled ? value : internalValue;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setInternalValue(e.target.value);
    }
    onChange?.(e);
  };

  const handleClear = () => {
    onClear?.();

    if (inputRef.current && inputValue) {
      inputRef.current.focus();

      inputRef.current.select();

      setTimeout(() => {
        if (inputRef.current) {
          document.execCommand("delete"); // deprecated but still works in electron
          logger.info("Cleared input value");
        }
      }, 0);
    }
  };

  return (
    <div
      className={flex ? "search-input-wrapper-flex" : "search-input-wrapper"}
    >
      <div className={`clearable-input-wrapper ${className}`}>
        <input
          ref={inputRef}
          type="text"
          className={`clearable-input ${inputClassName}`}
          value={inputValue}
          onChange={handleChange}
          placeholder={placeholder}
          {...props}
        />
        {inputValue && (
          <button
            type="button"
            className="clear-input-button"
            onMouseDown={(e) => e.preventDefault()}
            tabIndex={-1}
            onClick={handleClear}
            aria-label="Clear input"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default ClearableInput;
