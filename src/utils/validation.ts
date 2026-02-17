/**
 * Input validation utilities
 * Provides consistent validation across forms and inputs
 */

export interface ValidationRule {
  type: 'required' | 'minLength' | 'maxLength' | 'pattern' | 'email' | 'url' | 'custom';
  value?: number | string;
  message: string;
  validator?: (value: string) => boolean;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate a value against multiple rules
 */
export function validate(value: string, rules: ValidationRule[]): ValidationResult {
  for (const rule of rules) {
    const result = validateRule(value, rule);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}

/**
 * Validate a single rule
 */
function validateRule(value: string, rule: ValidationRule): ValidationResult {
  switch (rule.type) {
    case 'required':
      if (!value || value.trim().length === 0) {
        return { valid: false, error: rule.message };
      }
      break;

    case 'minLength':
      if (value.length < (rule.value as number)) {
        return { valid: false, error: rule.message };
      }
      break;

    case 'maxLength':
      if (value.length > (rule.value as number)) {
        return { valid: false, error: rule.message };
      }
      break;

    case 'pattern':
      if (!new RegExp(rule.value as string).test(value)) {
        return { valid: false, error: rule.message };
      }
      break;

    case 'email':
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        return { valid: false, error: rule.message };
      }
      break;

    case 'url':
      try {
        new URL(value);
      } catch {
        return { valid: false, error: rule.message };
      }
      break;

    case 'custom':
      if (rule.validator && !rule.validator(value)) {
        return { valid: false, error: rule.message };
      }
      break;
  }

  return { valid: true };
}

/**
 * Common validation rules
 */
export const commonRules = {
  required: (fieldName = 'This field'): ValidationRule => ({
    type: 'required',
    message: `${fieldName} is required`,
  }),

  minLength: (length: number, fieldName = 'This field'): ValidationRule => ({
    type: 'minLength',
    value: length,
    message: `${fieldName} must be at least ${length} characters`,
  }),

  maxLength: (length: number, fieldName = 'This field'): ValidationRule => ({
    type: 'maxLength',
    value: length,
    message: `${fieldName} must be no more than ${length} characters`,
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule => ({
    type: 'email',
    message,
  }),

  url: (message = 'Please enter a valid URL'): ValidationRule => ({
    type: 'url',
    message,
  }),

  taskTitle: (): ValidationRule[] => [
    commonRules.required('Task title'),
    commonRules.minLength(3, 'Task title'),
    commonRules.maxLength(200, 'Task title'),
  ],

  taskDescription: (): ValidationRule[] => [
    commonRules.maxLength(2000, 'Description'),
  ],

  agentName: (): ValidationRule[] => [
    commonRules.required('Agent name'),
    commonRules.minLength(2, 'Agent name'),
    commonRules.maxLength(50, 'Agent name'),
    {
      type: 'pattern',
      value: '^[a-zA-Z0-9_-]+$',
      message: 'Agent name can only contain letters, numbers, hyphens, and underscores',
    },
  ],

  fileName: (): ValidationRule[] => [
    commonRules.required('File name'),
    {
      type: 'pattern',
      value: '^[^<>:"/\\\\|?*]+$',
      message: 'File name contains invalid characters',
    },
  ],

  noSpecialChars: (message = 'Special characters are not allowed'): ValidationRule => ({
    type: 'pattern',
    value: '^[a-zA-Z0-9\\s]+$',
    message,
  }),

  alphanumeric: (message = 'Only letters and numbers are allowed'): ValidationRule => ({
    type: 'pattern',
    value: '^[a-zA-Z0-9]+$',
    message,
  }),

  noWhitespace: (message = 'Whitespace is not allowed'): ValidationRule => ({
    type: 'pattern',
    value: '^\\S+$',
    message,
  }),
};

/**
 * Sanitize user input to prevent XSS
 */
export function sanitizeInput(input: string): string {
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Validate file upload
 */
export interface FileValidationOptions {
  maxSize?: number; // bytes
  allowedTypes?: string[]; // MIME types
  allowedExtensions?: string[];
}

export function validateFile(file: File, options: FileValidationOptions = {}): ValidationResult {
  const {
    maxSize = 10 * 1024 * 1024, // 10MB default
    allowedTypes = [],
    allowedExtensions = [],
  } = options;

  // Check file size
  if (file.size > maxSize) {
    const sizeMB = Math.round(maxSize / (1024 * 1024));
    return {
      valid: false,
      error: `File is too large. Maximum size is ${sizeMB}MB`,
    };
  }

  // Check MIME type
  if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  // Check file extension
  if (allowedExtensions.length > 0) {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !allowedExtensions.includes(ext)) {
      return {
        valid: false,
        error: `File extension not allowed. Allowed extensions: ${allowedExtensions.join(', ')}`,
      };
    }
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
