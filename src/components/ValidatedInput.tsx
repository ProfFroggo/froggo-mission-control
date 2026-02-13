/**
 * ValidatedInput - Input components with built-in validation
 * Provides real-time feedback and error states
 */

import { useState, useEffect, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { validate, ValidationRule, ValidationResult } from '../utils/validation';

interface BaseValidatedInputProps {
  label?: string;
  rules?: ValidationRule[];
  onValidation?: (result: ValidationResult) => void;
  showValidation?: boolean;
  helpText?: string;
}

// Text Input
interface ValidatedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'>, BaseValidatedInputProps {
  onChange?: (value: string, valid: boolean) => void;
}

export function ValidatedInput({
  label,
  rules = [],
  onValidation,
  onChange,
  showValidation = true,
  helpText,
  className = '',
  ...inputProps
}: ValidatedInputProps) {
  const [value, setValue] = useState(inputProps.value as string || '');
  const [touched, setTouched] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ valid: true });

  useEffect(() => {
    if (touched && rules.length > 0) {
      const result = validate(value, rules);
      setValidationResult(result);
      onValidation?.(result);
    }
  }, [value, touched, rules, onValidation]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue, validationResult.valid);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const hasError = touched && !validationResult.valid;
  const isValid = touched && validationResult.valid && value.length > 0;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-clawd-text">
          {label}
          {rules.some(r => r.type === 'required') && (
            <span className="text-error ml-1">*</span>
          )}
        </label>
      )}

      <div className="relative">
        <input
          {...inputProps}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          className={`
            w-full px-3 py-2 bg-clawd-bg border rounded-lg text-clawd-text placeholder-clawd-text-dim
            focus:outline-none focus:ring-2 transition-all
            ${hasError 
              ? 'border-red-500 focus:ring-red-500/50' 
              : isValid && showValidation
                ? 'border-green-500 focus:ring-green-500/50'
                : 'border-clawd-border focus:ring-clawd-accent'
            }
            ${className}
          `}
        />

        {showValidation && touched && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {hasError && <AlertCircle size={16} className="text-error" />}
            {isValid && <Check size={16} className="text-success" />}
          </div>
        )}
      </div>

      {helpText && !hasError && (
        <p className="text-xs text-clawd-text-dim">{helpText}</p>
      )}

      {hasError && validationResult.error && (
        <div className="flex items-center gap-1 text-xs text-error">
          <AlertCircle size={14} />
          <span>{validationResult.error}</span>
        </div>
      )}
    </div>
  );
}

// Textarea
interface ValidatedTextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'>, BaseValidatedInputProps {
  onChange?: (value: string, valid: boolean) => void;
  maxLength?: number;
  showCharCount?: boolean;
}

export function ValidatedTextarea({
  label,
  rules = [],
  onValidation,
  onChange,
  showValidation = true,
  helpText,
  maxLength,
  showCharCount = true,
  className = '',
  ...textareaProps
}: ValidatedTextareaProps) {
  const [value, setValue] = useState(textareaProps.value as string || '');
  const [touched, setTouched] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ valid: true });

  useEffect(() => {
    if (touched && rules.length > 0) {
      const result = validate(value, rules);
      setValidationResult(result);
      onValidation?.(result);
    }
  }, [value, touched, rules, onValidation]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue, validationResult.valid);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const hasError = touched && !validationResult.valid;
  const charCount = value.length;
  const isNearLimit = maxLength && charCount >= maxLength * 0.9;

  return (
    <div className="space-y-1">
      {label && (
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-clawd-text">
            {label}
            {rules.some(r => r.type === 'required') && (
              <span className="text-error ml-1">*</span>
            )}
          </label>
          {showCharCount && maxLength && (
            <span className={`text-xs ${isNearLimit ? 'text-warning' : 'text-clawd-text-dim'}`}>
              {charCount} / {maxLength}
            </span>
          )}
        </div>
      )}

      <textarea
        {...textareaProps}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={maxLength}
        className={`
          w-full px-3 py-2 bg-clawd-bg border rounded-lg text-clawd-text placeholder-clawd-text-dim
          focus:outline-none focus:ring-2 transition-all resize-vertical
          ${hasError 
            ? 'border-red-500 focus:ring-red-500/50' 
            : 'border-clawd-border focus:ring-clawd-accent'
          }
          ${className}
        `}
      />

      {helpText && !hasError && (
        <p className="text-xs text-clawd-text-dim">{helpText}</p>
      )}

      {hasError && validationResult.error && (
        <div className="flex items-center gap-1 text-xs text-error">
          <AlertCircle size={14} />
          <span>{validationResult.error}</span>
        </div>
      )}
    </div>
  );
}

// Select
interface ValidatedSelectProps extends Omit<InputHTMLAttributes<HTMLSelectElement>, 'onChange'>, BaseValidatedInputProps {
  options: { value: string; label: string }[];
  onChange?: (value: string, valid: boolean) => void;
}

export function ValidatedSelect({
  label,
  options,
  rules = [],
  onValidation,
  onChange,
  helpText,
  className = '',
  ...selectProps
}: ValidatedSelectProps) {
  const [value, setValue] = useState(selectProps.value as string || '');
  const [touched, setTouched] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult>({ valid: true });

  useEffect(() => {
    if (touched && rules.length > 0) {
      const result = validate(value, rules);
      setValidationResult(result);
      onValidation?.(result);
    }
  }, [value, touched, rules, onValidation]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    onChange?.(newValue, validationResult.valid);
  };

  const handleBlur = () => {
    setTouched(true);
  };

  const hasError = touched && !validationResult.valid;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-clawd-text">
          {label}
          {rules.some(r => r.type === 'required') && (
            <span className="text-error ml-1">*</span>
          )}
        </label>
      )}

      <select
        {...selectProps}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        className={`
          w-full px-3 py-2 bg-clawd-bg border rounded-lg text-clawd-text
          focus:outline-none focus:ring-2 transition-all cursor-pointer
          ${hasError 
            ? 'border-red-500 focus:ring-red-500/50' 
            : 'border-clawd-border focus:ring-clawd-accent'
          }
          ${className}
        `}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {helpText && !hasError && (
        <p className="text-xs text-clawd-text-dim">{helpText}</p>
      )}

      {hasError && validationResult.error && (
        <div className="flex items-center gap-1 text-xs text-error">
          <AlertCircle size={14} />
          <span>{validationResult.error}</span>
        </div>
      )}
    </div>
  );
}
