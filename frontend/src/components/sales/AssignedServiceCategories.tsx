import { useState } from 'react';

import { SALES_SERVICE_LINES } from './salesServiceCategories';

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={['sales-category-accordion__chevron', open ? 'is-open' : ''].filter(Boolean).join(' ')}
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function AssignedServiceCategories() {
  const [openId, setOpenId] = useState(SALES_SERVICE_LINES[0]?.id ?? '');

  return (
    <div className="sales-category-accordion-list">
      {SALES_SERVICE_LINES.map((line) => {
        const isOpen = openId === line.id;

        return (
          <article key={line.id} className={['sales-category-accordion', isOpen ? 'is-open' : ''].join(' ')}>
            <button
              type="button"
              className="sales-category-accordion__trigger"
              aria-expanded={isOpen}
              onClick={() => setOpenId((current) => (current === line.id ? '' : line.id))}
            >
              <span className="sales-category-accordion__heading">
                <span className="sales-category-accordion__title">{line.title}</span>
                <span className="sales-category-accordion__count">{line.services.length} services</span>
              </span>
              <ChevronIcon open={isOpen} />
            </button>

            {isOpen ? (
              <ul className="sales-category-accordion__services">
                {line.services.map((service) => (
                  <li key={service.name} className="sales-category-accordion__service">
                    <span className="sales-category-accordion__service-name">{service.name}</span>
                    {service.priority === 'low' ? (
                      <span className="sales-category-accordion__priority">Low / Later</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </article>
        );
      })}
    </div>
  );
}
