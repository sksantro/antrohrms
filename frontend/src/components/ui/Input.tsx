import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label?: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  className?: string;
}

interface InputFieldProps extends FieldProps, InputHTMLAttributes<HTMLInputElement> {
  id: string;
}

interface SelectFieldProps extends FieldProps, SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  children: ReactNode;
}

interface TextareaFieldProps extends FieldProps, TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
}

function FieldWrapper({
  id,
  label,
  error,
  hint,
  required,
  className,
  children,
}: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={`ui-field ${className ?? ''}`.trim()}>
      {label ? (
        <label htmlFor={id} className="ui-label">
          {label}
          {required ? <span className="ui-required">*</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <p className="ui-field-error">{error}</p> : null}
      {!error && hint ? <p className="ui-field-hint">{hint}</p> : null}
    </div>
  );
}

export function Input({ label, error, hint, required, className, id, ...props }: InputFieldProps) {
  return (
    <FieldWrapper
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <input id={id} className="ui-input" required={required} aria-invalid={Boolean(error)} {...props} />
    </FieldWrapper>
  );
}

export function Select({
  label,
  error,
  hint,
  required,
  className,
  id,
  children,
  ...props
}: SelectFieldProps) {
  return (
    <FieldWrapper
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <select id={id} className="ui-input ui-select" required={required} aria-invalid={Boolean(error)} {...props}>
        {children}
      </select>
    </FieldWrapper>
  );
}

export function Textarea({
  label,
  error,
  hint,
  required,
  className,
  id,
  ...props
}: TextareaFieldProps) {
  return (
    <FieldWrapper
      id={id}
      label={label}
      error={error}
      hint={hint}
      required={required}
      className={className}
    >
      <textarea
        id={id}
        className="ui-input ui-textarea"
        required={required}
        aria-invalid={Boolean(error)}
        {...props}
      />
    </FieldWrapper>
  );
}
