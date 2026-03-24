/**
 * ValidatedInput - Input components with built-in validation
 * Provides real-time feedback and error states
 */

import { useState, useEffect, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AlertCircle, Check } from 'lucide-react';
import { TextField, TextArea, Select } from '@radix-ui/themes';
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
        <label className="block text-sm font-medium text-mission-control-text">
          {label}
          {rules.some(r => r.type === 'required') && (
            <span className="text-error ml-1">*</span>
          )}
        </label>
      )}

      <div className="relative">
        <TextField.Root
          {...(inputProps as any)}
          value={value}
          onChange={handleChange}
          onBlur={handleBlur}
          color={hasError ? 'red' : isValid && showValidation ? 'green' : undefined}
          className={className}
        >
          {showValidation && touched && (
            <TextField.Slot side="right">
              {hasError && <AlertCircle size={16} className="text-error" />}
              {isValid && <Check size={16} className="text-success" />}
            </TextField.Slot>
          )}
        </TextField.Root>
      </div>

      {helpText && !hasError && (
        <p className="text-xs text-mission-control-text-dim">{helpText}</p>
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
          <label className="block text-sm font-medium text-mission-control-text">
            {label}
            {rules.some(r => r.type === 'required') && (
              <span className="text-error ml-1">*</span>
            )}
          </label>
          {showCharCount && maxLength && (
            <span className={`text-xs ${isNearLimit ? 'text-warning' : 'text-mission-control-text-dim'}`}>
              {charCount} / {maxLength}
            </span>
          )}
        </div>
      )}

      <TextArea
        {...(textareaProps as any)}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        maxLength={maxLength}
        color={hasError ? 'red' : undefined}
        className={className}
      />

      {helpText && !hasError && (
        <p className="text-xs text-mission-control-text-dim">{helpText}</p>
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

  const handleValueChange = (newValue: string) => {
    setValue(newValue);
    setTouched(true);
    onChange?.(newValue, validationResult.valid);
  };

  const hasError = touched && !validationResult.valid;

  return (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-mission-control-text">
          {label}
          {rules.some(r => r.type === 'required') && (
            <span className="text-error ml-1">*</span>
          )}
        </label>
      )}

      <Select.Root value={value} onValueChange={handleValueChange}>
        <Select.Trigger className={`w-full ${className}`} color={hasError ? 'red' : undefined} />
        <Select.Content>
          {options.map((option) => (
            <Select.Item key={option.value} value={option.value}>
              {option.label}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>

      {helpText && !hasError && (
        <p className="text-xs text-mission-control-text-dim">{helpText}</p>
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
