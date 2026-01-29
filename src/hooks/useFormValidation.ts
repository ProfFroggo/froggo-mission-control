/**
 * React hook for form validation
 */

import { useState, useCallback } from 'react';
import { validate, ValidationRule } from '../utils/validation';

export function useFormValidation<T extends Record<string, string>>(
  initialValues: T,
  validationRules: Record<keyof T, ValidationRule[]>
) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Validate a single field
   */
  const validateField = useCallback((name: keyof T, value: string): string | null => {
    const rules = validationRules[name];
    if (!rules) return null;

    const result = validate(value, rules);
    return result.valid ? null : (result.error || null);
  }, [validationRules]);

  /**
   * Validate all fields
   */
  const validateAll = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    let isValid = true;

    for (const field in values) {
      const error = validateField(field, values[field]);
      if (error) {
        newErrors[field] = error;
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  }, [values, validateField]);

  /**
   * Handle field change
   */
  const handleChange = useCallback((name: keyof T, value: string) => {
    setValues(prev => ({ ...prev, [name]: value }));

    // Validate field if already touched
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({
        ...prev,
        [name]: error || undefined,
      }));
    }
  }, [touched, validateField]);

  /**
   * Handle field blur
   */
  const handleBlur = useCallback((name: keyof T) => {
    setTouched(prev => ({ ...prev, [name]: true }));

    // Validate on blur
    const error = validateField(name, values[name]);
    if (error) {
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  }, [values, validateField]);

  /**
   * Handle form submit
   */
  const handleSubmit = useCallback(async (
    onSubmit: (values: T) => Promise<void> | void
  ) => {
    // Mark all fields as touched
    const allTouched = Object.keys(values).reduce(
      (acc, key) => ({ ...acc, [key]: true }),
      {}
    );
    setTouched(allTouched);

    // Validate all fields
    if (!validateAll()) {
      return false;
    }

    // Submit
    setIsSubmitting(true);
    try {
      await onSubmit(values);
      return true;
    } catch (error) {
      console.error('Form submission error:', error);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  }, [values, validateAll]);

  /**
   * Reset form
   */
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
    setIsSubmitting(false);
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    validateField,
    validateAll,
    reset,
  };
}
