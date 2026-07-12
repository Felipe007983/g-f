import { useLayoutEffect, useRef } from 'react';

function applyTableLabels(table) {
  const headers = [...table.querySelectorAll('thead th')].map((th) =>
    th.textContent.replace(/\s+/g, ' ').trim()
  );

  table.querySelectorAll('tbody tr').forEach((row) => {
    [...row.querySelectorAll('td')].forEach((td, index) => {
      const label = headers[index];
      if (label) {
        td.setAttribute('data-label', label);
      } else {
        td.removeAttribute('data-label');
      }
    });
  });
}

export default function ResponsiveTable({ children, className = '', style }) {
  const wrapRef = useRef(null);

  useLayoutEffect(() => {
    const table = wrapRef.current?.querySelector('table');
    if (!table) return;

    applyTableLabels(table);

    const observer = new MutationObserver(() => applyTableLabels(table));
    observer.observe(table, { childList: true, subtree: true, characterData: true });

    return () => observer.disconnect();
  }, [children]);

  const classes = className ? `table-wrap ${className}` : 'table-wrap';

  return (
    <div ref={wrapRef} className={classes} style={style}>
      {children}
    </div>
  );
}
