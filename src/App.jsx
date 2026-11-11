import { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/query-client';
import { AuthProvider } from '@/context/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import RequireAuth from '@/components/RequireAuth';
import ScrollToTop from '@/components/ScrollToTop';
import Layout from '@/components/Layout';

import Home from '@/pages/Home';

const Auth = lazy(() => import('@/pages/Auth'));
const Sso = lazy(() => import('@/pages/Sso'));
const LessonReader = lazy(() => import('@/pages/LessonReader'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const SkillPassport = lazy(() => import('@/pages/SkillPassport'));
const CareerRoles = lazy(() => import('@/pages/CareerRoles'));
const CareerRoleDetail = lazy(() => import('@/pages/CareerRoleDetail'));
const LearningPath = lazy(() => import('@/pages/LearningPath'));
const CourseDetail = lazy(() => import('@/pages/CourseDetail'));
const Courses = lazy(() => import('@/pages/Courses'));
const MyLearning = lazy(() => import('@/pages/MyLearning'));
const Pro = lazy(() => import('@/pages/Pro'));
const Experts = lazy(() => import('@/pages/Experts'));
const Studio = lazy(() => import('@/pages/Studio'));
const StudioEditor = lazy(() => import('@/pages/StudioEditor'));
const Team = lazy(() => import('@/pages/Team'));
const TeamDashboard = lazy(() => import('@/pages/TeamDashboard'));
const JoinTeam = lazy(() => import('@/pages/JoinTeam'));
const Learn = lazy(() => import('@/pages/Learn'));
const MyCredentials = lazy(() => import('@/pages/MyCredentials'));
const CredentialDetail = lazy(() => import('@/pages/CredentialDetail'));
const VerifyCredential = lazy(() => import('@/pages/VerifyCredential'));
const Settings = lazy(() => import('@/pages/Settings'));
const Privacy = lazy(() => import('@/pages/Privacy'));
const Trust = lazy(() => import('@/pages/Trust'));
const Terms = lazy(() => import('@/pages/Terms'));
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
                <Route path="/sso" element={<Sso />} />
                <Route path="/roles" element={<CareerRoles />} />
                <Route path="/roles/:slug" element={<CareerRoleDetail />} />
                <Route path="/courses" element={<Courses />} />
                <Route path="/courses/:slug" element={<CourseDetail />} />
                <Route path="/pro" element={<Pro />} />
                <Route path="/plans" element={<Pro />} />
                <Route path="/pricing" element={<Pro />} />
                <Route path="/experts" element={<Experts />} />
                <Route path="/teach" element={<RequireAuth><Studio /></RequireAuth>} />
                <Route path="/teach/:id" element={<RequireAuth><StudioEditor /></RequireAuth>} />
                <Route path="/team" element={<Team />} />
                <Route path="/team/:slug" element={<RequireAuth><TeamDashboard /></RequireAuth>} />
                <Route path="/join/:code" element={<JoinTeam />} />
                <Route path="/my-learning" element={<RequireAuth><MyLearning /></RequireAuth>} />
                <Route path="/courses/:slug/lessons/:n" element={<LessonReader />} />
                <Route path="/path/:goalId" element={<RequireAuth><LearningPath /></RequireAuth>} />
                <Route path="/learn" element={<Learn />} />
                <Route path="/missions" element={<Navigate to="/courses" replace />} />
                <Route path="/missions/:slug" element={<Navigate to="/courses" replace />} />
                <Route path="/credentials" element={<RequireAuth><MyCredentials /></RequireAuth>} />
                <Route path="/credentials/:code" element={<RequireAuth><CredentialDetail /></RequireAuth>} />
                <Route path="/verify/:code" element={<VerifyCredential />} />
                <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
                <Route path="/passport" element={<RequireAuth><SkillPassport /></RequireAuth>} />
                <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
                <Route path="/expert" element={<Navigate to="/teach" replace />} />
                <Route path="/privacy" element={<Privacy />} />
                <Route path="/trust" element={<Trust />} />
                <Route path="/terms" element={<Terms />} />
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
