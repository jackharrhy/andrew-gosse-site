// src/tea/admin/components/Login.tsx
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

interface Props {
  onLogin: (user: { id: number; email: string }) => void;
}

export function Login({ onLogin }: Props) {
  const navigate = useNavigate();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const r = await api.post<{ user: { id: number; email: string } }>(
        "/auth/login",
        { email, password }
      );
      onLogin(r.user);
      navigate("/tea/admin");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm p-8 rounded-md border border-border bg-card flex flex-col gap-4"
      >
        <h1 className="text-2xl font-semibold">TeaCMS</h1>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="rounded-md border border-input bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}
