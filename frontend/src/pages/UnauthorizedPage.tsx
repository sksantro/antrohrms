import { Link } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import { getUnauthorizedRedirectPath } from '../utils/rbac';

interface UnauthorizedPageProps {
  title?: string;
  message?: string;
}

export function UnauthorizedPage({
  title = 'Unauthorized',
  message = 'You do not have access to this page.',
}: UnauthorizedPageProps) {
  const { user } = useAuth();
  const homePath = user ? getUnauthorizedRedirectPath(user.role, user.department) : '/login';

  return (
    <div className="page-center">
      <div className="dashboard-card unauthorized-card">
        <h2>{title}</h2>
        <p>{message}</p>
        <Link to={homePath}>Go to dashboard</Link>
      </div>
    </div>
  );
}
