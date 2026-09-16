import { Search, UserRound, Stethoscope } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { supabase } from '../../lib/supabase';
import { patientPath, opportunityPath } from '../../routing/paths';
import { createGlobalSearch } from '../../services/globalSearch';

export default function GlobalSearch({ clinicId, compact = false }) {
  const inputRef = useRef(null);
  const linksRef = useRef([]);
  const sequence = useRef(0);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [state, setState] = useState({ loading: false, rows: [], error: '' });
  const search = useMemo(() => clinicId ? createGlobalSearch(supabase, clinicId) : null, [clinicId]);

  useEffect(() => {
    const shortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        if (!inputRef.current || inputRef.current.offsetParent === null) return;
        event.preventDefault();
        setOpen(true);
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);

  useEffect(() => {
    const normalized = query.trim();
    setActive(-1);
    if (!search || normalized.length < 2) {
      sequence.current += 1;
      setState({ loading: false, rows: [], error: '' });
      return undefined;
    }
    const ticket = ++sequence.current;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setState((current) => ({ ...current, loading: true, error: '' }));
      try {
        const rows = await search({ query: normalized, signal: controller.signal });
        if (ticket === sequence.current) setState({ loading: false, rows, error: '' });
      } catch (error) {
        if (!controller.signal.aborted && ticket === sequence.current)
          setState({ loading: false, rows: [], error: error.message || 'No pudimos buscar.' });
      }
    }, 220);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, search]);

  const showPanel = open && query.trim().length >= 2;
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { setOpen(false); inputRef.current?.blur(); return; }
    if (!state.rows.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActive((current) => (current + delta + state.rows.length) % state.rows.length);
    }
    if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      linksRef.current[active]?.click();
    }
  };

  return (
    <div className={`relative w-full ${compact ? '' : 'max-w-2xl'}`} onFocusCapture={() => setOpen(true)} onBlurCapture={(event) => {
      if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
    }}>
      <label className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-slate-200 bg-card px-3 shadow-sm focus-within:border-mint focus-within:ring-4 focus-within:ring-mint/10">
        <Search className="h-4 w-4 shrink-0 text-textFaint" aria-hidden="true" />
        <span className="sr-only">Búsqueda global</span>
        <input
          ref={inputRef}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-base text-cream outline-none placeholder:text-textFaint"
          placeholder={compact ? 'Buscar' : 'Buscar pacientes, teléfonos o tratamientos'}
          role="combobox"
          aria-label="Búsqueda global"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          aria-autocomplete="list"
          autoComplete="off"
        />
        {!compact ? <kbd className="hidden rounded border border-slate-200 bg-soft px-2 py-1 text-xs text-textFaint sm:inline">Ctrl K</kbd> : null}
      </label>
      {showPanel ? (
        <div id="global-search-results" role="listbox" className="absolute left-0 right-0 z-50 mt-2 max-h-[min(28rem,65vh)] overflow-y-auto rounded-xl border border-slate-200 bg-card p-2 shadow-2xl">
          {state.loading ? <p className="px-3 py-4 text-sm text-textMuted">Buscando…</p> : null}
          {state.error ? <p role="alert" className="px-3 py-4 text-sm text-danger">{state.error}</p> : null}
          {!state.loading && !state.error && !state.rows.length ? <p className="px-3 py-4 text-sm text-textMuted">No encontramos pacientes ni tratamientos.</p> : null}
          {state.rows.map((result, index) => {
            const ResultIcon = result.result_type === 'opportunity' ? Stethoscope : UserRound;
            const to = result.result_type === 'opportunity'
              ? opportunityPath(result.contact_id, result.opportunity_id)
              : patientPath(result.contact_id);
            return <Link
              key={`${result.result_type}:${result.result_id}`}
              ref={(element) => { linksRef.current[index] = element; }}
              to={to}
              role="option"
              aria-selected={active === index}
              onMouseEnter={() => setActive(index)}
              onClick={() => { setOpen(false); setQuery(''); }}
              className={`flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mint ${active === index ? 'bg-elevated' : 'hover:bg-elevated'}`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-mint/10 text-mint"><ResultIcon className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-cream">{result.title}</strong><span className="mt-0.5 block truncate text-xs text-textMuted">{result.subtitle}{result.phone ? ` · ${result.phone}` : ''}</span></span>
              <span className="text-xs font-semibold text-textFaint">{result.result_type === 'opportunity' ? 'Oportunidad' : 'Paciente'}</span>
            </Link>;
          })}
        </div>
      ) : null}
    </div>
  );
}
