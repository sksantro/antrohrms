import type { ReactNode } from 'react';

interface TableProps {
  children: ReactNode;
  className?: string;
}

export function Table({ children, className }: TableProps) {
  return (
    <div className={`ui-table-wrap ${className ?? ''}`.trim()}>
      <table className="ui-table">{children}</table>
    </div>
  );
}

export function TableEmpty({ message = 'No records found.' }: { message?: string }) {
  return <p className="ui-empty">{message}</p>;
}
