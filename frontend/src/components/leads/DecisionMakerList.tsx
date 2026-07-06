import { Button } from '../ui';
import type { LeadContact } from '../../types/lead';
import { InboxIcon } from './leadIcons';

interface DecisionMakerListProps {
  contacts: LeadContact[];
  onEdit: (contact: LeadContact) => void;
  onDelete: (contact: LeadContact) => void;
}

export function DecisionMakerList({ contacts, onEdit, onDelete }: DecisionMakerListProps) {
  if (contacts.length === 0) {
    return (
      <div className="lead-contact-empty">
        <span className="lead-contact-empty__icon">
          <InboxIcon />
        </span>
        <h4>No decision makers yet</h4>
        <p>Add contacts for key stakeholders at this company.</p>
      </div>
    );
  }

  return (
    <div className="lead-contact-grid">
      {contacts.map((contact) => (
        <article key={contact.id} className="lead-contact-card">
          <div className="lead-contact-card__header">
            <div className="lead-contact-card__avatar" aria-hidden>
              {contact.full_name
                .split(/\s+/)
                .map((part) => part[0])
                .join('')
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <div className="lead-contact-card__identity">
              <h4>{contact.full_name}</h4>
              <p>{contact.designation}</p>
              {contact.department ? (
                <span className="lead-contact-card__dept">{contact.department}</span>
              ) : null}
            </div>
          </div>

          <div className="lead-contact-card__details">
            {contact.email ? (
              <div className="lead-contact-card__row">
                <span className="lead-contact-card__label">Email</span>
                <a href={`mailto:${contact.email}`}>{contact.email}</a>
              </div>
            ) : null}
            {contact.phone ? (
              <div className="lead-contact-card__row">
                <span className="lead-contact-card__label">Phone</span>
                <span>{contact.phone}</span>
              </div>
            ) : null}
            {contact.location ? (
              <div className="lead-contact-card__row">
                <span className="lead-contact-card__label">Location</span>
                <span>{contact.location}</span>
              </div>
            ) : null}
            {contact.linkedin_profile_url ? (
              <div className="lead-contact-card__row">
                <span className="lead-contact-card__label">LinkedIn</span>
                <a href={contact.linkedin_profile_url} target="_blank" rel="noreferrer">
                  View profile
                </a>
              </div>
            ) : null}
            {contact.remarks ? (
              <div className="lead-contact-card__remarks">{contact.remarks}</div>
            ) : null}
          </div>

          <div className="lead-contact-card__actions">
            <Button type="button" variant="secondary" className="payroll-action" onClick={() => onEdit(contact)}>
              Edit
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="payroll-action payroll-action--danger"
              onClick={() => onDelete(contact)}
            >
              Delete
            </Button>
          </div>
        </article>
      ))}
    </div>
  );
}
