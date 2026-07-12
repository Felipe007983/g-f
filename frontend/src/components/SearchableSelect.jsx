import { useEffect, useId, useMemo, useRef, useState } from 'react';

/**
 * Combobox pesquisável — digite para filtrar e selecione da lista.
 */
export default function SearchableSelect({
  options = [],
  value = '',
  onChange,
  placeholder = 'Buscar e selecionar…',
  required = false,
  getOptionLabel = (o) => o.label ?? o.name ?? '',
  getOptionValue = (o) => o.value ?? o.id ?? '',
  getOptionMeta = (o) => o.meta ?? o.contact ?? '',
}) {
  const listId = useId();
  const rootRef = useRef(null);
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const selected = useMemo(
    () => options.find((o) => getOptionValue(o) === value) || null,
    [options, value, getOptionValue]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const label = String(getOptionLabel(o)).toLowerCase();
      const meta = String(getOptionMeta(o) || '').toLowerCase();
      return label.includes(q) || meta.includes(q);
    });
  }, [options, query, getOptionLabel, getOptionMeta]);

  useEffect(() => {
    if (!open) {
      setQuery(selected ? getOptionLabel(selected) : '');
      setHighlight(0);
    }
  }, [selected, open, getOptionLabel]);

  useEffect(() => {
    function onDocClick(e) {
      if (!rootRef.current?.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  function selectOption(option) {
    onChange(getOptionValue(option));
    setQuery(getOptionLabel(option));
    setOpen(false);
  }

  function clearSelection(e) {
    e.stopPropagation();
    onChange('');
    setQuery('');
    setOpen(true);
    inputRef.current?.focus();
  }

  function onKeyDown(e) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) {
      setOpen(true);
      return;
    }
    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[highlight]) selectOption(filtered[highlight]);
    } else if (e.key === 'Escape') {
      setOpen(false);
      setQuery(selected ? getOptionLabel(selected) : '');
    }
  }

  return (
    <div className={`search-select ${open ? 'is-open' : ''} ${value ? 'has-value' : ''}`} ref={rootRef}>
      <div className="search-select-control" onClick={() => inputRef.current?.focus()}>
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          required={required && !value}
          placeholder={placeholder}
          value={open ? query : selected ? getOptionLabel(selected) : query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlight(0);
            if (value) onChange('');
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={onKeyDown}
          autoComplete="off"
        />
        <div className="search-select-actions">
          {value && (
            <button
              type="button"
              className="search-select-clear"
              aria-label="Limpar"
              onClick={clearSelection}
            >
              ×
            </button>
          )}
          <span className="search-select-chevron" aria-hidden>
            ▾
          </span>
        </div>
      </div>

      {open && (
        <ul id={listId} className="search-select-menu" role="listbox">
          {filtered.length === 0 ? (
            <li className="search-select-empty">Nenhum resultado</li>
          ) : (
            filtered.map((option, index) => {
              const id = getOptionValue(option);
              const meta = getOptionMeta(option);
              const active = id === value;
              const focused = index === highlight;
              return (
                <li
                  key={id}
                  role="option"
                  aria-selected={active}
                  className={`search-select-option ${active ? 'is-selected' : ''} ${focused ? 'is-focused' : ''}`}
                  onMouseEnter={() => setHighlight(index)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectOption(option);
                  }}
                >
                  <span className="search-select-option-name">{getOptionLabel(option)}</span>
                  {meta ? <span className="search-select-option-meta">{meta}</span> : null}
                </li>
              );
            })
          )}
        </ul>
      )}

      {/* Garante validação HTML required quando o combobox está fechado */}
      <input type="hidden" value={value} required={required} readOnly tabIndex={-1} />
    </div>
  );
}
