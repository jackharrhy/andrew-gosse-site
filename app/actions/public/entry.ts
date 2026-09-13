import { run } from "remix/ui";

// Full document navigation ensures unsaved-work prompts and embed lifecycles remain reliable.
document.addEventListener(
  "click",
  (event) => {
    if (event.target instanceof Element)
      event.target.closest("a")?.setAttribute("data-rmx-document", "");
  },
  true,
);
document.addEventListener(
  "submit",
  (event) => {
    if (event.target instanceof HTMLFormElement)
      event.target.setAttribute("data-rmx-document", "");
  },
  true,
);

const menu = document.querySelector<HTMLDetailsElement>(".site-menu");
if (menu) {
  const query = matchMedia("(min-width:1024px)");
  menu.open = query.matches;
  query.addEventListener("change", () => {
    menu.open = query.matches;
  });
}
document.addEventListener("click", async (event) => {
  const button =
    event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("[data-color]")
      : null;
  if (!button) return;
  const text = button.textContent;
  try {
    await navigator.clipboard.writeText(button.dataset.color!);
    button.textContent = "Copied!";
  } catch {
    button.textContent = button.dataset.color!;
  }
  setTimeout(() => {
    button.textContent = text;
  }, 1200);
});

const app = run({
  async loadModule(moduleUrl, exportName) {
    let mod = await import(moduleUrl);
    return mod[exportName];
  },
});

// Server-rendered fields must not accept edits before their handlers exist.
void app
  .ready()
  .then(() => {
    const workspace = document.getElementById("workspace");
    workspace?.removeAttribute("inert");
    workspace?.removeAttribute("aria-busy");
    const status = document.getElementById("workspace-readiness");
    if (status) {
      status.textContent = "Editing workspace";
      status.removeAttribute("role");
    }
  })
  .catch(() => {
    const status = document.getElementById("workspace-readiness");
    if (status)
      status.textContent =
        "Editing tools failed to load. Please reload this page.";
  });

if (import.meta.hot) {
  import.meta.hot.on("server:update", async () => {
    try {
      await app.ready();
      await app.frames.top.reload();
    } catch (error) {
      console.error("Error reloading top frame on server update", error);
    }
  });
}
