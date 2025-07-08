import React from "react";
import { createLogger } from "../util/uiLogger";

const logger = createLogger("Background.tsx");

type ClearableInputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onClear?: () => void;
  placeholder?: string;
  inputClassName?: string;
  className?: string;
};

const ClearableInput: React.FC<ClearableInputProps> = ({
  value,
  onChange,
  onClear,
  placeholder = "",
  className = "",
  inputClassName = "",
  ...props
}) => {
  const [internalValue, setInternalValue] = React.useState("");

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
    if (!isControlled) {
      logger.info("Clearing input value by default function");
      setInternalValue("");
    } else {
      logger.info("Clearing input value by onChange callback");
      onChange?.({
        target: { value: "" },
      } as React.ChangeEvent<HTMLInputElement>);
    }
  };

  return (
    <div className={`clearable-input-wrapper ${className}`}>
      <input
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
          onClick={handleClear}
          aria-label="Clear input"
        >
          ×
        </button>
      )}
    </div>
  );
};

export default ClearableInput;
