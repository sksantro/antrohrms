import { Link } from 'react-router-dom';

interface UnauthorizedPageProps {
  title?: string;
  message?: string;
}

export function UnauthorizedPage({
  title = 'Unauthorized',
  message = 'You do not have access to this page.',
}: UnauthorizedPageProps) {
  return (
    <div className="page-center">
      <div className="dashboard-card">
        <h2>{title}</h2>
        <p>{message}</p>
        <Link to="/login">Back to login</Link>
      </div>
    </div>
  );
}
