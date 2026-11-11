import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Layout } from './components/Layout.jsx';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { Spinner } from './components/Ui.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { AuthProvider, useAuth } from './lib/auth.jsx';
import Welcome from './pages/Welcome.jsx';
import Feed from './pages/Feed.jsx';
import SignIn from './pages/SignIn.jsx';
import SignUp from './pages/SignUp.jsx';
import VerifyEmail from './pages/VerifyEmail.jsx';
import SetupAccount from './pages/SetupAccount.jsx';
import ForgotPassword from './pages/ForgotPassword.jsx';
import Search from './pages/Search.jsx';
import PostDetail from './pages/PostDetail.jsx';
import CreatePost from './pages/CreatePost.jsx';
import EditPost from './pages/EditPost.jsx';
import Profile from './pages/Profile.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Conversations from './pages/Conversations.jsx';
import Chat from './pages/Chat.jsx';
import Notifications from './pages/Notifications.jsx';
import Plans from './pages/Plans.jsx';
import Interests from './pages/Interests.jsx';
import NotFound from './pages/NotFound.jsx';

/** Deep links should open at the top of the page, not wherever the last one was. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/**
 * SINT has no public pages: the feed, profiles and search are only visible to
 * signed-in accounts. A visitor who lands on a deep link is sent to sign in and
 * then back where they were going; the bare root goes to the welcome screen.
 */
function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();

  if (!ready) return <Spinner />;

  if (!user) {
    const target = `${location.pathname}${location.search}`;
    if (location.pathname === '/') return <Navigate to="/welcome" replace />;
    return <Navigate to="/signin" replace state={{ from: target }} />;
  }

  return children;
}

function GuestOnly({ children }) {
  const { user, ready } = useAuth();
  if (!ready) return <Spinner />;
  // An account that has not confirmed its address belongs on the verify screen,
  // not back in the sign-up form.
  if (user) return <Navigate to={user.emailVerified ? '/' : '/verify-email'} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <ScrollToTop />
          <ErrorBoundary>
            <Routes>
            <Route
              path="/welcome"
              element={
                <GuestOnly>
                  <Welcome />
                </GuestOnly>
              }
            />
            <Route
              path="/signin"
              element={
                <GuestOnly>
                  <SignIn />
                </GuestOnly>
              }
            />
            <Route
              path="/signup"
              element={
                <GuestOnly>
                  <SignUp />
                </GuestOnly>
              }
            />
            <Route
              path="/forgot"
              element={
                <GuestOnly>
                  <ForgotPassword />
                </GuestOnly>
              }
            />

            {/* Post-sign-up steps: signed in, but before the main shell. */}
            <Route
              path="/verify-email"
              element={
                <RequireAuth>
                  <VerifyEmail />
                </RequireAuth>
              }
            />
            <Route
              path="/setup"
              element={
                <RequireAuth>
                  <SetupAccount />
                </RequireAuth>
              }
            />

            <Route
              element={
                <RequireAuth>
                  <Layout />
                </RequireAuth>
              }
            >
              <Route index element={<Feed />} />
              <Route path="search" element={<Search />} />
              <Route path="post/:id" element={<PostDetail />} />
              <Route path="post/:id/edit" element={<EditPost />} />
              <Route path="new" element={<CreatePost />} />
              <Route path="u/:id" element={<Profile />} />
              <Route path="me/edit" element={<EditProfile />} />
              <Route path="messages" element={<Conversations />} />
              <Route path="messages/:id" element={<Chat />} />
              <Route path="notifications" element={<Notifications />} />
              <Route path="plans" element={<Plans />} />
              <Route path="interests" element={<Interests />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            </Routes>
          </ErrorBoundary>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
