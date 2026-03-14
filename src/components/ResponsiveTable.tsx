import { useBreakpoint } from '../hooks/useBreakpoint';

export interface TableColumn<T> {
  key: string;
  label: string;
  render?: (value: any, row: T) => React.ReactNode;
}

interface ResponsiveTableProps<T extends Record<string, any>> {
  columns: TableColumn<T>[];
  data: T[];
  keyField: string;
  className?: string;
  emptyMessage?: string;
}

export default function ResponsiveTable<T extends Record<string, any>>({
  columns,
  data,
  keyField,
  className = '',
  emptyMessage = 'No data available',
}: ResponsiveTableProps<T>) {
  const { isMobile } = useBreakpoint();

  if (data.length === 0) {
    return (
      <div className={`flex items-center justify-center py-8 text-mission-control-text-dim text-sm ${className}`}>
        {emptyMessage}
      </div>
    );
  }

  if (isMobile) {
    // Card layout — each row becomes a label/value card
    return (
      <div className={`space-y-3 ${className}`}>
        {data.map((row) => (
          <div
            key={String(row[keyField])}
            className="bg-mission-control-surface border border-mission-control-border rounded-xl p-4 space-y-2"
          >
            {columns.map((col) => {
              const rawValue = row[col.key];
              const displayValue = col.render ? col.render(rawValue, row) : rawValue;

              // Skip columns where the value is null/undefined and there's no render fn
              if (rawValue == null && !col.render) return null;

              return (
                <div key={col.key} className="flex items-start justify-between gap-3 min-h-[24px]">
                  <span className="text-xs font-medium text-mission-control-text-dim flex-shrink-0 w-24 pt-0.5">
                    {col.label}
                  </span>
                  <span className="text-sm text-mission-control-text text-right flex-1 min-w-0">
                    {displayValue != null ? displayValue : <span className="text-mission-control-text-dim">—</span>}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // Standard desktop table
  return (
    <div className={`overflow-x-auto rounded-xl border border-mission-control-border ${className}`}>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-mission-control-border bg-mission-control-bg">
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold text-mission-control-text-dim uppercase tracking-wide whitespace-nowrap"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr
              key={String(row[keyField])}
              className={`border-b border-mission-control-border/50 transition-colors hover:bg-mission-control-border/20 ${
                rowIdx % 2 === 0 ? '' : 'bg-mission-control-bg/30'
              }`}
            >
              {columns.map((col) => {
                const rawValue = row[col.key];
                const displayValue = col.render ? col.render(rawValue, row) : rawValue;
                return (
                  <td key={col.key} className="px-4 py-3 text-mission-control-text">
                    {displayValue != null ? displayValue : <span className="text-mission-control-text-dim">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
