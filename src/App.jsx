import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import RequireAuth from '@/components/RequireAuth';
import ScrollToTop from '@/components/ScrollToTop';
import Layout from '@/components/Layout';

import Home from '@/pages/Home';

const Auth = lazy(() => import('@/pages/Auth'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const SkillPassport = lazy(() => import('@/pages/SkillPassport'));
const CareerRoles = lazy(() => import('@/pages/CareerRoles'));
const CareerRoleDetail = lazy(() => import('@/pages/CareerRoleDetail'));
const LearningPath = lazy(() => import('@/pages/LearningPath'));
const CourseDetail = lazy(() => import('@/pages/CourseDetail'));
const Missions = lazy(() => import('@/pages/Missions'));
const MissionDetail = lazy(() => import('@/pages/MissionDetail'));
const PageNotFound = lazy(() => import('@/pages/PageNotFound'));

function RouteFallback() {
  return <div className="flex min-h-[50vh] items-center justify-center" />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/roles" element={<CareerRoles />} />
                <Route path="/roles/:slug" element={<CareerRoleDetail />} />
                <Route path="/courses/:slug" element={<CourseDetail />} />
                <Route path="/path/:goalId" element={<RequireAuth><LearningPath /></RequireAuth>} />
                <Route path="/missions" element={<Missions />} />
                <Route path="/missions/:slug" element={<MissionDetail />} />
                <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/passport" element={<RequireAuth><SkillPassport /></RequireAuth>} />
                <Route path="*" element={<PageNotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
