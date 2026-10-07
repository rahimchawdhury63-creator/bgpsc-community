import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card text-center">
        <div className="text-6xl">404</div>
        <h1 className="mt-4 text-2xl font-bold">Page Not Found</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          The page you're looking for doesn't exist.
        </p>
        <Link to="/" className="btn btn-primary mt-6">
          Go Home
        </Link>
      </div>
    </div>
  );
}
