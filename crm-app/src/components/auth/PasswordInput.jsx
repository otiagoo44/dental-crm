import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';

export default function PasswordInput({ label, value, onChange, autoComplete, placeholder = '********', required = true }) {
  const [visible, setVisible] = useState(false);

  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-slate-700">{label}</span>
      <span className="flex items-center gap-3 rounded-xl border border-slate-200 bg-input px-3 py-3 transition hover:border-slate-300 focus-within:border-mint focus-within:ring-4 focus-within:ring-mint/10">
        <LockKeyhole className="h-4 w-4 shrink-0 text-mint" aria-hidden="true" />
        <input
          className="min-w-0 flex-1 bg-transparent text-cream outline-none placeholder:text-slate-400"
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
        />
        <button
          className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-elevated hover:text-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
        </button>
      </span>
    </label>
  );
}
