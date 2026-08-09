import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/useAuth';

export default function RequireAuth({ children }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }

  return children;
}
