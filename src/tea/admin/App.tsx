// src/tea/admin/App.tsx
import * as React from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { api } from "./lib/api";
import { Login } from "./components/Login";
import { Layout } from "./components/Layout";
import { Dashboard } from "./components/Dashboard";
import { MediaBrowserPage } from "./components/MediaBrowser";
import { SiteEditor } from "./components/SiteEditor";
import { SidebarEditor } from "./components/SidebarEditor";
import { AdornmentLibrary } from "./components/AdornmentLibrary";
import { PageList } from "./components/PageList";
import { PageEditor } from "./components/PageEditor";
import { HomepageEditor } from "./components/HomepageEditor";
import { SeoAudit } from "./components/SeoAudit";

interface User {
  id: number;
  email: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  setUser: (u: User | null) => void;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue>({
  user: null,
  loading: true,
  setUser: () => {},
  refresh: async () => {},
});

export function useAuth() {
  return React.useContext(AuthContext);
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const r = await api.get<{ user: User }>("/auth/me");
      setUser(r.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider value={{ user, loading, setUser, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

function LoginRoute() {
  const { user, loading, setUser } = useAuth();
  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (user) return <Navigate to="/tea/admin" replace />;
  return <Login onLogin={setUser} />;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!user) {
    return <Navigate to="/tea/admin/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

function AuthedShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return null;
  return <Layout user={user}>{children}</Layout>;
}

function Stub({ name }: { name: string }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-2">{name}</h1>
      <p className="text-muted-foreground text-sm">
        Editor for this route is implemented in a later task.
      </p>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/tea/admin/login" element={<LoginRoute />} />
          <Route
            path="/tea/admin"
            element={
              <RequireAuth>
                <AuthedShell>
                  <Dashboard />
                </AuthedShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tea/admin/pages"
            element={
              <RequireAuth>
                <AuthedShell>
                  <PageList />
                </AuthedShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tea/admin/pages/:slug"
            element={
              <RequireAuth>
                <AuthedShell>
                  <PageEditor />
                </AuthedShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tea/admin/homepage"
            element={
              <RequireAuth>
                <AuthedShell>
                  <HomepageEditor />
                </AuthedShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tea/admin/sidebar"
            element={
              <RequireAuth>
                <AuthedShell>
                  <SidebarEditor />
                </AuthedShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tea/admin/site"
            element={
              <RequireAuth>
                <AuthedShell>
                  <SiteEditor />
                </AuthedShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tea/admin/adornments"
            element={
              <RequireAuth>
                <AuthedShell>
                  <AdornmentLibrary />
                </AuthedShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tea/admin/media"
            element={
              <RequireAuth>
                <AuthedShell>
                  <MediaBrowserPage />
                </AuthedShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tea/admin/seo"
            element={
              <RequireAuth>
                <AuthedShell>
                  <SeoAudit />
                </AuthedShell>
              </RequireAuth>
            }
          />
          <Route
            path="/tea/admin/*"
            element={
              <RequireAuth>
                <AuthedShell>
                  <Stub name="Not found" />
                </AuthedShell>
              </RequireAuth>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
