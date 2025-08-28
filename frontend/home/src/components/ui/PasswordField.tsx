import React from 'react';

type PasswordFieldProps = {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  name?: string;
  id?: string;
  inputClassName?: string; // extra classes for input
};

export default function PasswordField({
  value,
  onChange,
  placeholder = 'Enter password',
  required,
  disabled,
  ariaLabel = 'Password',
  name,
  id,
  inputClassName = ''
}: PasswordFieldProps) {
  const [show, setShow] = React.useState(false);
  const toggle = () => setShow(s => !s);

  return (
    <div className="relative">
      {/* Input */}
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        aria-label={ariaLabel}
        name={name}
        id={id}
        type={show ? 'text' : 'password'}
        required={required}
        disabled={disabled}
        className={
          `mt-1 w-full pr-12 px-3 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 outline-none focus:ring-2 focus:ring-cyan-400 disabled:opacity-50 ${inputClassName}`
        }
      />
      {/* Toggle button */}
      <button
        type="button"
        onClick={toggle}
        aria-label={show ? 'Hide password' : 'Show password'}
        title={show ? 'Hide password' : 'Show password'}
        disabled={disabled}
        className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-white/90 hover:bg-white/10 focus:ring-2 focus:ring-cyan-400/50 outline-none z-10"
      >
        {show ? (
          // Eye-off (clean outline)
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 15.338 7.244 18 12 18c.999 0 1.963-.128 2.872-.367"/>
            <path d="M6.228 6.228A10.45 10.45 0 0112 6c4.756 0 8.774 2.662 10.066 6-.302.792-.74 1.53-1.293 2.197"/>
            <path d="M9.88 9.88A3 3 0 0014.12 14.12"/>
            <path d="M3 3l18 18"/>
          </svg>
        ) : (
          // Eye (clean outline)
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
          </svg>
        )}
      </button>
    </div>
  );
}