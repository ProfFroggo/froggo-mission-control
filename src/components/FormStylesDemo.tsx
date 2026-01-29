/**
 * FormStylesDemo - Visual demonstration of all form component styles
 * Use this to test and preview the new form styling system
 * 
 * Access via Command Palette: ⌘K -> "Form Styles Demo"
 */

import { useState } from 'react';
import { Check, X, Eye, EyeOff, Search, Calendar } from 'lucide-react';

export default function FormStylesDemo() {
  const [textValue, setTextValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [textareaValue, setTextareaValue] = useState('');
  const [selectValue, setSelectValue] = useState('');
  const [checkboxValue, setCheckboxValue] = useState(false);
  const [radioValue, setRadioValue] = useState('option1');

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-clawd-text mb-2">Form Components Showcase</h1>
        <p className="text-clawd-text-dim">
          Visual demonstration of the new form styling system (forms.css)
        </p>
      </div>

      <div className="space-y-12">
        {/* Text Inputs */}
        <section>
          <h2 className="text-xl font-semibold text-clawd-text mb-4">Text Inputs</h2>
          <div className="space-y-4">
            <div className="clawd-form-group">
              <label className="clawd-form-label required">Text Input</label>
              <input
                type="text"
                value={textValue}
                onChange={(e) => setTextValue(e.target.value)}
                placeholder="Enter some text..."
              />
              <span className="clawd-form-hint">This is a helpful hint message</span>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Email Input</label>
              <input
                type="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                placeholder="you@example.com"
                className={emailValue && !emailValue.includes('@') ? 'error' : ''}
              />
              {emailValue && !emailValue.includes('@') && (
                <span className="clawd-form-error">Please enter a valid email address</span>
              )}
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Password Input (with toggle)</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  placeholder="Enter password..."
                  className="pr-12"
                />
                <button
                  type="button"
                  className="icon ghost absolute right-2 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Search Input</label>
              <div className="clawd-input-group">
                <span className="clawd-input-addon">
                  <Search size={16} />
                </span>
                <input type="search" placeholder="Search..." />
              </div>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Date Input</label>
              <div className="clawd-input-group">
                <input type="date" />
                <button type="button" className="icon">
                  <Calendar size={16} />
                </button>
              </div>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Disabled Input</label>
              <input type="text" value="This input is disabled" disabled />
            </div>
          </div>
        </section>

        {/* Textarea */}
        <section>
          <h2 className="text-xl font-semibold text-clawd-text mb-4">Textarea</h2>
          <div className="space-y-4">
            <div className="clawd-form-group">
              <label className="clawd-form-label">Description</label>
              <textarea
                value={textareaValue}
                onChange={(e) => setTextareaValue(e.target.value)}
                placeholder="Enter a detailed description..."
                rows={4}
              />
              <span className="clawd-form-hint">{textareaValue.length} characters</span>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Disabled Textarea</label>
              <textarea
                value="This textarea is disabled"
                disabled
                rows={3}
              />
            </div>
          </div>
        </section>

        {/* Select Dropdown */}
        <section>
          <h2 className="text-xl font-semibold text-clawd-text mb-4">Select Dropdown</h2>
          <div className="space-y-4">
            <div className="clawd-form-group">
              <label className="clawd-form-label">Priority</label>
              <select value={selectValue} onChange={(e) => setSelectValue(e.target.value)}>
                <option value="">Select priority...</option>
                <option value="p0">🔴 P0 - Urgent</option>
                <option value="p1">🟠 P1 - High</option>
                <option value="p2">🟡 P2 - Medium</option>
                <option value="p3">⚪ P3 - Low</option>
              </select>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Disabled Select</label>
              <select disabled>
                <option>This select is disabled</option>
              </select>
            </div>
          </div>
        </section>

        {/* Checkboxes & Radio Buttons */}
        <section>
          <h2 className="text-xl font-semibold text-clawd-text mb-4">Checkboxes & Radio Buttons</h2>
          <div className="space-y-4">
            <div className="clawd-form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkboxValue}
                  onChange={(e) => setCheckboxValue(e.target.checked)}
                />
                <span className="text-clawd-text">I agree to the terms and conditions</span>
              </label>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Select Option</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="demo-radio"
                    value="option1"
                    checked={radioValue === 'option1'}
                    onChange={(e) => setRadioValue(e.target.value)}
                  />
                  <span className="text-clawd-text">Option 1</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="demo-radio"
                    value="option2"
                    checked={radioValue === 'option2'}
                    onChange={(e) => setRadioValue(e.target.value)}
                  />
                  <span className="text-clawd-text">Option 2</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="demo-radio"
                    value="option3"
                    checked={radioValue === 'option3'}
                    onChange={(e) => setRadioValue(e.target.value)}
                  />
                  <span className="text-clawd-text">Option 3</span>
                </label>
              </div>
            </div>

            <div className="clawd-form-group">
              <label className="flex items-center gap-2 cursor-pointer opacity-50">
                <input type="checkbox" disabled />
                <span className="text-clawd-text">Disabled checkbox</span>
              </label>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section>
          <h2 className="text-xl font-semibold text-clawd-text mb-4">Buttons</h2>
          
          <div className="space-y-6">
            {/* Button Variants */}
            <div>
              <h3 className="text-sm font-medium text-clawd-text-dim mb-3">Variants</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button">Default Button</button>
                <button type="button" className="primary">Primary Button</button>
                <button type="button" className="secondary">Secondary Button</button>
                <button type="button" className="danger">Danger Button</button>
                <button type="button" className="ghost">Ghost Button</button>
              </div>
            </div>

            {/* Button Sizes */}
            <div>
              <h3 className="text-sm font-medium text-clawd-text-dim mb-3">Sizes</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="sm">Small Button</button>
                <button type="button">Default Button</button>
                <button type="button" className="lg">Large Button</button>
              </div>
            </div>

            {/* Button with Icons */}
            <div>
              <h3 className="text-sm font-medium text-clawd-text-dim mb-3">With Icons</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="primary">
                  <Check size={16} />
                  Save Changes
                </button>
                <button type="button" className="danger">
                  <X size={16} />
                  Cancel
                </button>
                <button type="button" className="ghost">
                  <Search size={16} />
                  Search
                </button>
              </div>
            </div>

            {/* Icon Buttons */}
            <div>
              <h3 className="text-sm font-medium text-clawd-text-dim mb-3">Icon Only</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" className="icon">
                  <Search size={16} />
                </button>
                <button type="button" className="icon primary">
                  <Check size={16} />
                </button>
                <button type="button" className="icon danger">
                  <X size={16} />
                </button>
                <button type="button" className="icon ghost">
                  <Calendar size={16} />
                </button>
              </div>
            </div>

            {/* Disabled Buttons */}
            <div>
              <h3 className="text-sm font-medium text-clawd-text-dim mb-3">Disabled State</h3>
              <div className="flex flex-wrap gap-2">
                <button type="button" disabled>Default Disabled</button>
                <button type="button" className="primary" disabled>Primary Disabled</button>
                <button type="button" className="danger" disabled>Danger Disabled</button>
              </div>
            </div>
          </div>
        </section>

        {/* Form Example */}
        <section>
          <h2 className="text-xl font-semibold text-clawd-text mb-4">Complete Form Example</h2>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              alert('Form submitted!');
            }}
            className="space-y-4 p-6 border border-clawd-border rounded-lg"
          >
            <div className="clawd-form-group">
              <label className="clawd-form-label required" htmlFor="form-name">
                Full Name
              </label>
              <input
                id="form-name"
                type="text"
                placeholder="John Doe"
                required
              />
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label required" htmlFor="form-email">
                Email Address
              </label>
              <input
                id="form-email"
                type="email"
                placeholder="john@example.com"
                required
              />
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label" htmlFor="form-role">
                Role
              </label>
              <select id="form-role">
                <option value="">Select a role...</option>
                <option value="developer">Developer</option>
                <option value="designer">Designer</option>
                <option value="manager">Manager</option>
              </select>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label" htmlFor="form-message">
                Message
              </label>
              <textarea
                id="form-message"
                placeholder="Tell us about yourself..."
                rows={4}
              />
              <span className="clawd-form-hint">Optional message</span>
            </div>

            <div className="clawd-form-group">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" required />
                <span className="text-clawd-text">
                  I agree to the <a href="#" className="text-clawd-accent hover:underline">terms and conditions</a>
                </span>
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <button type="button" className="secondary">
                Cancel
              </button>
              <button type="submit" className="primary">
                Submit Form
              </button>
            </div>
          </form>
        </section>

        {/* States Demo */}
        <section>
          <h2 className="text-xl font-semibold text-clawd-text mb-4">Interactive States</h2>
          <div className="space-y-4">
            <div className="clawd-form-group">
              <label className="clawd-form-label">Hover & Focus States</label>
              <input type="text" placeholder="Hover over me, then click to focus" />
              <span className="clawd-form-hint">
                Try hovering and focusing to see the smooth transitions
              </span>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Error State</label>
              <input type="text" className="error" value="Invalid input" readOnly />
              <span className="clawd-form-error">This field has an error</span>
            </div>

            <div className="clawd-form-group">
              <label className="clawd-form-label">Success State</label>
              <input type="text" className="success" value="Valid input" readOnly />
              <span className="clawd-form-hint" style={{ color: 'var(--clawd-accent)' }}>
                ✓ This field is valid
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Info */}
      <div className="mt-12 p-6 border border-clawd-border rounded-lg bg-clawd-surface">
        <h3 className="text-lg font-semibold text-clawd-text mb-2">Usage Notes</h3>
        <ul className="text-sm text-clawd-text-dim space-y-2">
          <li>• All form elements use CSS variables from the Clawd theme</li>
          <li>• Focus states include a 3px green ring for keyboard navigation visibility</li>
          <li>• Hover states provide subtle feedback before interaction</li>
          <li>• Disabled states use 50% opacity and not-allowed cursor</li>
          <li>• All transitions are 150ms for smooth, responsive feel</li>
          <li>• Add <code className="text-clawd-accent">.unstyled</code> class to opt out of auto-styling</li>
          <li>• Mobile-friendly with minimum 16px font size to prevent iOS zoom</li>
        </ul>
      </div>
    </div>
  );
}
