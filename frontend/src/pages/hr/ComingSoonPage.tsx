import { Link } from 'react-router-dom';

import { Card } from '../../components/ui';

interface ComingSoonPageProps {
  title: string;
  description: string;
  backTo?: string;
  backLabel?: string;
}

export function ComingSoonPage({
  title,
  description,
  backTo = '/hr/dashboard',
  backLabel = 'Back to HR Dashboard',
}: ComingSoonPageProps) {
  return (
    <div className="coming-soon-page">
      <Card wide className="coming-soon-card">
        <div className="coming-soon-card__glow" aria-hidden />
        <div className="coming-soon-card__content">
          <span className="coming-soon-card__badge">Coming Soon</span>
          <h2 className="coming-soon-card__title">{title}</h2>
          <p className="coming-soon-card__description">{description}</p>
          <p className="coming-soon-card__note">
            This HR module is planned for a future release. Your access and navigation are already
            set up.
          </p>
          <Link to={backTo} className="coming-soon-card__action">
            {backLabel}
          </Link>
        </div>
      </Card>
    </div>
  );
}
