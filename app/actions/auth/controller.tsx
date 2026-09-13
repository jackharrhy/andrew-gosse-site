import { createController } from "remix/router";
import type { Handle } from "remix/ui";
import { routes } from "../../routes.ts";
import { authContext, userContext } from "../../middleware/context.ts";
import { sessionCookie, sessionId } from "../../data/auth.ts";
import { readInput, invalid } from "../input.ts";
import { Document } from "../../ui/document.tsx";

function Login(handle: Handle<{ error?: string }>) {
  return () => (
    <Document title="Sign in · TeaCMS" admin>
      <main className="login-layout">
        <section className="login-intro">
          <a href="/" className="brand">
            <span className="brand-mark">t.</span>TeaCMS
          </a>
          <p>Andrew Gosse</p>
        </section>
        <section className="login-panel">
          <form
            method="post"
            action={routes.auth.authenticate.href()}
            data-rmx-document
          >
            <h1>Sign in</h1>
            {handle.props.error && (
              <p role="alert" className="notice error">
                {handle.props.error}
              </p>
            )}
            <label>
              Email address
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                autoFocus
              />
            </label>
            <label>
              Password
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="button primary">Sign in</button>
            <a className="muted" href="/">
              Open website ↗
            </a>
          </form>
        </section>
      </main>
    </Document>
  );
}
export default createController(routes.auth, {
  actions: {
    login(context) {
      return context.get(userContext)
        ? new Response(null, {
            status: 303,
            headers: { Location: routes.admin.index.href() },
          })
        : context.render(<Login />);
    },
    async authenticate(context) {
      const data = await readInput(context.request);
      if (
        !data ||
        typeof data.email !== "string" ||
        typeof data.password !== "string" ||
        data.email.length > 320 ||
        data.password.length > 200
      )
        return invalid();
      const auth = context.get(authContext);
      if (auth.throttled(data.email.trim().toLowerCase()))
        return context.render(
          <Login error="Too many attempts. Try again in 15 minutes." />,
          { status: 429 },
        );
      const user = await auth.verify(data.email, data.password);
      if (!user)
        return context.render(
          <Login error="Email or password is incorrect." />,
          { status: 401 },
        );
      auth.revoke(sessionId(context.request));
      const session = auth.createSession(user.id);
      return new Response(null, {
        status: 303,
        headers: {
          Location: routes.admin.index.href(),
          "Set-Cookie": sessionCookie(
            context.request,
            session.id,
            session.expiresAt,
          ),
        },
      });
    },
    logout(context) {
      context.get(authContext).revoke(sessionId(context.request));
      return new Response(null, {
        status: 303,
        headers: {
          Location: routes.auth.login.href(),
          "Set-Cookie": sessionCookie(context.request, "", new Date(0)),
        },
      });
    },
  },
});
