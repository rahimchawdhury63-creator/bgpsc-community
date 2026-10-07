import { Suspense, lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './lib/stores/auth';
import { useI18nStore } from './lib/stores/i18n';
import Layout from './components/Layout';
import LoadingScreen from './components/LoadingScreen';
import ErrorBoundary from './components/ErrorBoundary';

// Lazy-loaded pages
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const PostPage = lazy(() => import('./pages/PostPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const Messages = lazy(() => import('./pages/Messages'));
const Notifications = lazy(() => import('./pages/Notifications'));
const Search = lazy(() => import('./pages/Search'));
const Settings = lazy(() => import('./pages/Settings'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const StatusPage = lazy(() => import('./pages/StatusPage'));
const CreatePost = lazy(() => import('./pages/CreatePost'));
const OnboardingInterests = lazy(() => import('./pages/OnboardingInterests'));
const NotFound = lazy(() => import('./pages/NotFound'));

function App() {
  const { session, loadSession } = useAuthStore();
  const { locale, loadLocale } = useI18nStore();

  useEffect(() => {
    loadSession();
    loadLocale();
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = 'ltr';
  }, [locale]);

  return (
    <ErrorBoundary>
      <Suspense fallback={<LoadingScreen />}>
        <Routes>
          {/* Public routes */}
          <Route path="/login" element={session ? <Navigate to="/" /> : <Login />} />
          <Route path="/register" element={session ? <Navigate to="/" /> : <Register />} />
          <Route path="/status" element={<StatusPage />} />
          
          {/* Main app routes */}
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="create" element={session ? <CreatePost /> : <Navigate to="/login" />} />
            <Route path="onboarding" element={session ? <OnboardingInterests /> : <Navigate to="/login" />} />
            <Route path="post/:slug" element={<PostPage />} />
            <Route path=":handle" element={<ProfilePage />} />
            <Route path="u/:handle" element={<ProfilePage />} />
            <Route path="messages/*" element={session ? <Messages /> : <Navigate to="/login" />} />
            <Route path="notifications" element={session ? <Notifications /> : <Navigate to="/login" />} />
            <Route path="search" element={<Search />} />
            <Route path="settings/*" element={session ? <Settings /> : <Navigate to="/login" />} />
            <Route path="admin/*" element={session ? <AdminPanel /> : <Navigate to="/login" />} />
          </Route>
          
          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

export default App;
