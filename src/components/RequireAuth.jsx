import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

export default function RequireAuth({ children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!session) return <Navigate to="/auth" state={{ from: location }} replace />;
  return children;
}
