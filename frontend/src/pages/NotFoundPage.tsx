import { Link } from 'react-router-dom';

interface NotFoundPageProps {
  title?: string;
  message?: string;
}

export function NotFoundPage({
  title = 'Page Not Found',
  message = 'The page you are looking for does not exist.',
}: NotFoundPageProps) {
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
