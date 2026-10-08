import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../style.css";

const WIDGET_HOST_URL = "https://wisp-widget.pages.dev/widget.js";
const WIDGET_API_URL = "https://supabasedb.datastraw.in/functions/v1/widget-chat";
const REGISTER_BRAND_URL = "https://supabasedb.datastraw.in/functions/v1/register-brand";
const CONVERSATIONS_URL = "https://supabasedb.datastraw.in/functions/v1/get-conversations";
const ADMIN_KEY_STORAGE = "wisp_snippet_admin_key";
const DASHBOARD_KEY_STORAGE = "wisp_dashboard_key";

const PREVIEW_EVENTS = [
  { type: "message", side: "bot", text: "Hi. How can I help?", at: 0 },
  { type: "message", side: "user", text: "Where do I paste the script?", at: 1 },
  { type: "typing", at: 2 },
  { type: "message", side: "bot", text: "Right before the closing body tag.", at: 3 },
  { type: "message", side: "user", text: "Will it work on every page?", at: 4 },
  { type: "typing", at: 5 },
  { type: "message", side: "bot", text: "Yes. Add it to the shared layout and it appears site-wide.", at: 6 },
  { type: "message", side: "user", text: "Thank you!", at: 7 },
];

function App() {
  const [path, setPath] = useState(normalizePath(window.location.pathname));

  useEffect(() => {
    const onPopState = () => setPath(normalizePath(window.location.pathname));
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.title = titleForPath(path);
  }, [path]);

  const navigate = (event, href) => {
    event.preventDefault();
    window.history.pushState({}, "", href);
    setPath(normalizePath(href));
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  return (
    <>
      <AuroraBackground />
      <Header path={path} navigate={navigate} />
      <div className="route-view" key={path}>
        {path === "/install-shopify" ? <ShopifyInstall /> : null}
        {path === "/install-website" ? <WebsiteInstall /> : null}
        {path === "/dashboard" ? <Dashboard /> : null}
        {path === "/" ? <Home navigate={navigate} /> : null}
      </div>
    </>
  );
}

function AuroraBackground() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const surfaceSelector = [
      "a",
      "button",
      "input",
      "textarea",
      "select",
      "pre",
      ".site-header",
      ".hero-copy",
      ".preview-panel",
      ".card",
      ".step",
      ".tool-panel",
      ".tutorial-media",
      ".session-card",
      ".modal",
      ".section",
      ".page-heading",
    ].join(",");
    let reconnectTimer = 0;

    const reconnect = () => {
      root.style.setProperty("--aurora-break", "0px");
      root.style.setProperty("--aurora-break-glow", "0");
    };

    const breakAtPointer = (event) => {
      if (reducedMotion.matches) {
        return;
      }

      if (event.target instanceof Element && event.target.closest(surfaceSelector)) {
        reconnect();
        return;
      }

      root.style.setProperty("--aurora-x", `${event.clientX}px`);
      root.style.setProperty("--aurora-y", `${event.clientY}px`);
      root.style.setProperty("--aurora-break", "72px");
      root.style.setProperty("--aurora-break-glow", "1");

      window.clearTimeout(reconnectTimer);
      reconnectTimer = window.setTimeout(reconnect, 420);
    };

    window.addEventListener("pointermove", breakAtPointer, { passive: true });
    window.addEventListener("pointerleave", reconnect);

    return () => {
      window.clearTimeout(reconnectTimer);
      window.removeEventListener("pointermove", breakAtPointer);
      window.removeEventListener("pointerleave", reconnect);
      reconnect();
    };
  }, []);

  return (
    <div className="aurora-bg" aria-hidden="true">
      <span className="aurora-blob aurora-blob-one"></span>
      <span className="aurora-blob aurora-blob-two"></span>
      <span className="aurora-break-ring"></span>
    </div>
  );
}

function Header({ path, navigate }) {
  return (
    <header className="site-header">
      <a className="brand" href="/" aria-label="Wisp home" onClick={(event) => navigate(event, "/")}>
        <img src="https://wisp-widget.pages.dev/Pixie.png" alt="" className="brand-mark" />
        <span>Wisp</span>
      </a>
      <nav className="nav" aria-label="Main navigation">
        <a href="/install-shopify" aria-current={path === "/install-shopify" ? "page" : undefined} onClick={(event) => navigate(event, "/install-shopify")}>Shopify</a>
        <a href="/install-website" aria-current={path === "/install-website" ? "page" : undefined} onClick={(event) => navigate(event, "/install-website")}>Website</a>
        <a href="/dashboard" aria-current={path === "/dashboard" ? "page" : undefined} onClick={(event) => navigate(event, "/dashboard")}>Dashboard</a>
      </nav>
    </header>
  );
}

function Home({ navigate }) {
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Chat widget install hub</p>
          <h1>Install Wisp on Shopify or any website.</h1>
          <p>Use these guides to add the floating chat widget, route it through Supabase, and check live customer conversations from the private dashboard.</p>
          <div className="hero-actions">
            <a className="button primary" href="/install-shopify" onClick={(event) => navigate(event, "/install-shopify")}>Shopify guide</a>
            <a className="button secondary" href="/install-website" onClick={(event) => navigate(event, "/install-website")}>Website guide</a>
          </div>
        </div>
        <div className="preview-panel" aria-label="Widget preview">
          <div className="preview-top">
            <span>Chat with us</span>
            <span className="preview-dot"></span>
          </div>
          <div className="preview-body">
            <div className="preview-scroll">
              {PREVIEW_EVENTS.map((event, index) => (
                event.type === "typing" ? (
                  <div
                    className="preview-typing"
                    style={{ "--message-index": event.at }}
                    key={`typing-${index}`}
                    aria-label="Agent is typing"
                  >
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                ) : (
                  <p
                    className={`preview-message ${event.side === "user" ? "reply" : ""}`}
                    style={{ "--message-index": event.at }}
                    key={`${event.side}-${event.text}`}
                  >
                    {event.text}
                  </p>
                )
              ))}
            </div>
          </div>
        </div>
      </section>

      <Reveal as="section" className="section">
        <div className="section-heading">
          <p className="eyebrow">Choose a path</p>
          <h2>Two install flows, one widget.</h2>
        </div>
        <div className="grid two">
          <article className="card">
            <h3>Shopify brands</h3>
            <p>Send the client a custom-distribution app install link. They install the app, enable the theme app embed, and save.</p>
            <a href="/install-shopify" onClick={(event) => navigate(event, "/install-shopify")}>Open Shopify steps</a>
          </article>
          <article className="card">
            <h3>Non-Shopify websites</h3>
            <p>Generate a small script tag using the client site id, then ask the client to paste it before the closing body tag.</p>
            <a href="/install-website" onClick={(event) => navigate(event, "/install-website")}>Generate snippet</a>
          </article>
        </div>
      </Reveal>

      <Reveal as="section" className="section muted">
        <div className="section-heading">
          <p className="eyebrow">Private view</p>
          <h2>Conversation dashboard</h2>
        </div>
        <p className="measure">The dashboard reads conversation rows from Supabase at runtime. It stores the dashboard key in session storage only.</p>
        <a className="button secondary" href="/dashboard" onClick={(event) => navigate(event, "/dashboard")}>Open dashboard</a>
      </Reveal>
    </main>
  );
}

function ShopifyInstall() {
  const steps = [
    ["Open the install link", "Use the custom-distribution install link sent by Wisp."],
    ["Install the app", "Review the app install screen in Shopify, then approve the install."],
    ["Open theme customization", <>Go to <strong>Online Store</strong>, then <strong>Themes</strong>, then <strong>Customize</strong>.</>],
    ["Enable the app embed", <>Open <strong>App embeds</strong>, turn on <strong>Chat widget</strong>, then save.</>],
    ["Check the storefront", "Refresh the storefront and confirm the chat bubble appears in the lower-right corner."],
  ];

  return (
    <main className="page">
      <section className="tutorial-hero">
        <div className="page-heading">
          <p className="eyebrow">Shopify install</p>
          <h1>Enable the Wisp chat widget in your Shopify theme.</h1>
          <p>Follow these steps after receiving your custom-distribution Shopify app install link.</p>
        </div>
        <TutorialMedia
          label="Shopify walkthrough"
          path="docs-site/public/tutorials/shopify-install.mp4"
        />
      </section>
      <section className="steps" aria-label="Shopify installation steps">
        {steps.map(([title, body], index) => (
          <Reveal as="article" className="step" key={title}>
            <span className="step-number">{index + 1}</span>
            <div>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
          </Reveal>
        ))}
      </section>
    </main>
  );
}

function WebsiteInstall() {
  const [siteId, setSiteId] = useState("");
  const [brandName, setBrandName] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [backendUrl, setBackendUrl] = useState("https://datastraw-support-agent-production-54f5.up.railway.app/api/widget/chat");
  const [snippet, setSnippet] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminInput, setAdminInput] = useState("");
  const [adminError, setAdminError] = useState("");
  const [pendingGenerate, setPendingGenerate] = useState(null);

  useModalBodyLock(adminModalOpen);

  const buildSnippet = (value) => (
    `<script\n` +
    `  src="${WIDGET_HOST_URL}"\n` +
    `  data-site-id="${value.replace(/"/g, "&quot;")}"\n` +
    `  data-platform="web"\n` +
    `  data-api="${WIDGET_API_URL}"\n` +
    `  defer\n` +
    `></script>`
  );

  const requestAdminKey = () => {
    const stored = sessionStorage.getItem(ADMIN_KEY_STORAGE);
    if (stored) {
      return Promise.resolve(stored);
    }

    setAdminInput("");
    setAdminError("");
    setAdminModalOpen(true);
    return new Promise((resolve) => setPendingGenerate(() => resolve));
  };

  const closeAdminModal = (value = "") => {
    setAdminModalOpen(false);
    if (pendingGenerate) {
      pendingGenerate(value);
      setPendingGenerate(null);
    }
  };

  const submitAdminKey = () => {
    const value = adminInput.trim();
    if (!value) {
      setAdminError("Enter the admin key to continue.");
      return;
    }
    sessionStorage.setItem(ADMIN_KEY_STORAGE, value);
    closeAdminModal(value);
  };

  const generate = async () => {
    const cleanedSiteId = siteId.trim();
    const cleanedBrandName = brandName.trim();
    const cleanedWebsiteUrl = websiteUrl.trim();
    const cleanedBackendUrl = backendUrl.trim();
    let origins = splitOrigins(allowedOrigins);

    if (!cleanedSiteId) {
      setStatus("Enter a site id first.");
      setSnippet("");
      return;
    }
    if (!cleanedBrandName || !cleanedWebsiteUrl || !cleanedBackendUrl) {
      setStatus("Fill in brand name, website URL, and backend URL.");
      setSnippet("");
      return;
    }
    if (!origins.length) {
      origins = defaultOriginsFromWebsite(cleanedWebsiteUrl);
      setAllowedOrigins(origins.join(", "));
    }

    const adminKey = await requestAdminKey();
    if (!adminKey) {
      setStatus("Enter the admin key.");
      return;
    }

    setBusy(true);
    setStatus("Creating brand row...");
    setSnippet("");

    fetch(REGISTER_BRAND_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Key": adminKey,
      },
      body: JSON.stringify({
        site_id: cleanedSiteId,
        brand_name: cleanedBrandName,
        website_url: cleanedWebsiteUrl,
        backend_url: cleanedBackendUrl,
        allowed_origins: origins,
        platform: "web",
      }),
    }).then((response) => response.json().catch(() => ({})).then((data) => {
      if (response.status === 401) {
        sessionStorage.removeItem(ADMIN_KEY_STORAGE);
      }
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Could not create brand row.");
      }
      return data;
    })).then(() => {
      setSnippet(buildSnippet(cleanedSiteId));
      setStatus("Brand row created. Snippet is ready.");
    }).catch((error) => {
      setStatus(error.message || "Could not create snippet.");
    }).finally(() => {
      setBusy(false);
    });
  };

  const copySnippet = () => {
    if (!snippet) {
      setStatus("Generate a snippet first.");
      return;
    }
    navigator.clipboard.writeText(snippet).then(() => {
      setStatus("Copied.");
    }, () => {
      setStatus("Copy failed. Select the snippet and copy it manually.");
    });
  };

  return (
    <>
      <main className="page">
        <section className="tutorial-hero">
          <div className="page-heading">
            <p className="eyebrow">Website install</p>
            <h1>Add Wisp with one script tag.</h1>
            <p>Paste the generated snippet before the closing <code>&lt;/body&gt;</code> tag on the client site.</p>
          </div>
          <TutorialMedia
            label="Website walkthrough"
            path="docs-site/public/tutorials/website-install.mp4"
          />
        </section>

        <Reveal as="section" className="tool-panel" aria-labelledby="snippet-title">
          <div>
            <h2 id="snippet-title">Generate client snippet</h2>
            <p>Register the brand, then generate the client snippet.</p>
          </div>
          <label className="field">
            <span>Your site ID</span>
            <input id="site-id" type="text" placeholder="client-domain.com" autoComplete="off" value={siteId} onChange={(event) => setSiteId(event.target.value)} onKeyDown={(event) => event.key === "Enter" && generate()} />
          </label>
          <label className="field">
            <span>Brand name</span>
            <input id="brand-name" type="text" placeholder="Client Brand" autoComplete="off" value={brandName} onChange={(event) => setBrandName(event.target.value)} />
          </label>
          <label className="field">
            <span>Website URL</span>
            <input id="website-url" type="url" placeholder="https://client-domain.com" autoComplete="off" value={websiteUrl} onChange={(event) => setWebsiteUrl(event.target.value)} />
          </label>
          <label className="field">
            <span>Allowed origins</span>
            <textarea id="allowed-origins" rows="3" placeholder="https://client-domain.com, https://www.client-domain.com" value={allowedOrigins} onChange={(event) => setAllowedOrigins(event.target.value)} />
          </label>
          <label className="field">
            <span>Backend URL</span>
            <input id="backend-url" type="url" autoComplete="off" value={backendUrl} onChange={(event) => setBackendUrl(event.target.value)} />
          </label>
          <button className="button primary" id="generate" type="button" disabled={busy} onClick={generate}>{busy ? "Creating..." : "Create snippet"}</button>
          <div className="snippet-row">
            <pre id="snippet" tabIndex="0">{snippet}</pre>
            <button className="button secondary" id="copy" type="button" onClick={copySnippet}>Copy</button>
          </div>
          <p className="status-text" id="copy-status" role="status" aria-live="polite">{status}</p>
        </Reveal>

        <Reveal as="section" className="steps compact" aria-label="Website installation steps">
          <Step number="1" title="Generate the snippet">Use the exact site id registered for the brand.</Step>
          <Step number="2" title="Paste before the body close">Add it before <code>&lt;/body&gt;</code> on every page where chat should appear.</Step>
          <Step number="3" title="Refresh and test">Open the site, send a message, and confirm the reply comes through.</Step>
        </Reveal>
      </main>

      <KeyModal
        open={adminModalOpen}
        idPrefix="admin-key"
        eyebrow="Private action"
        title="Enter snippet admin key"
        copy="This key lets the install page create or update a brand row in Supabase."
        label="Admin key"
        value={adminInput}
        error={adminError}
        onChange={setAdminInput}
        onSubmit={submitAdminKey}
        onCancel={() => closeAdminModal("")}
      />
    </>
  );
}

function Dashboard() {
  const [siteId, setSiteId] = useState("");
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [dashboardKeyInput, setDashboardKeyInput] = useState("");
  const [dashboardKeyError, setDashboardKeyError] = useState("");
  const [pendingKeyResolver, setPendingKeyResolver] = useState(null);

  useModalBodyLock(keyModalOpen);

  useEffect(() => {
    getDashboardKey(false);
  }, []);

  const getDashboardKey = (forcePrompt) => {
    const stored = sessionStorage.getItem(DASHBOARD_KEY_STORAGE);
    if (stored && !forcePrompt) {
      return Promise.resolve(stored);
    }
    setDashboardKeyInput("");
    setDashboardKeyError("");
    setKeyModalOpen(true);
    return new Promise((resolve) => setPendingKeyResolver(() => resolve));
  };

  const closeDashboardKeyModal = (value = "") => {
    setKeyModalOpen(false);
    if (pendingKeyResolver) {
      pendingKeyResolver(value);
      setPendingKeyResolver(null);
    }
  };

  const submitDashboardKey = () => {
    const value = dashboardKeyInput.trim();
    if (!value) {
      setDashboardKeyError("Enter the dashboard key to continue.");
      return;
    }
    sessionStorage.setItem(DASHBOARD_KEY_STORAGE, value);
    closeDashboardKeyModal(value);
  };

  const loadConversations = async () => {
    const key = await getDashboardKey(false);
    const cleanedSiteId = siteId.trim();
    if (!key) {
      setStatus("Enter a dashboard key.");
      return;
    }
    if (!cleanedSiteId) {
      setStatus("Enter a site id.");
      return;
    }

    setStatus("Loading...");
    setRows([]);
    setHasLoaded(false);

    fetch(`${CONVERSATIONS_URL}?site_id=${encodeURIComponent(cleanedSiteId)}`, {
      method: "GET",
      headers: {
        "X-Dashboard-Key": key,
      },
    }).then((response) => {
      if (response.status === 401) {
        sessionStorage.removeItem(DASHBOARD_KEY_STORAGE);
        throw new Error("Invalid key");
      }
      if (!response.ok) {
        throw new Error("Could not load conversations");
      }
      return response.json();
    }).then((data) => {
      setStatus("");
      setRows(normalizeRows(data));
      setHasLoaded(true);
    }).catch((error) => {
      setRows([]);
      setHasLoaded(false);
      setStatus(error.message === "Invalid key" ? "Invalid key" : "Could not load conversations.");
    });
  };

  const groups = useMemo(() => groupRows(rows), [rows]);

  return (
    <>
      <main className="dashboard-shell">
        <section className="page-heading">
          <p className="eyebrow">Private dashboard</p>
          <h1>Customer conversations by brand.</h1>
          <p>No conversation data is stored in this page. Rows load from Supabase after you enter a dashboard key.</p>
        </section>

        <Reveal as="section" className="tool-panel dashboard-controls" aria-label="Dashboard controls">
          <label className="field">
            <span>Site ID</span>
            <input id="site-id" type="text" placeholder="client-domain.com" autoComplete="off" value={siteId} onChange={(event) => setSiteId(event.target.value)} onKeyDown={(event) => event.key === "Enter" && loadConversations()} />
          </label>
          <button className="button primary" id="load" type="button" onClick={loadConversations}>Load conversations</button>
          <button className="button secondary" id="change-key" type="button" onClick={() => {
            sessionStorage.removeItem(DASHBOARD_KEY_STORAGE);
            getDashboardKey(true);
          }}>Change key</button>
          <p className="status-text" id="status" role="status" aria-live="polite">{status}</p>
        </Reveal>

        <Reveal as="section" id="sessions" className="sessions" aria-live="polite">
          {hasLoaded && rows.length === 0 ? <p className="empty-state">No conversations found for this site id.</p> : null}
          {groups.map((group) => (
            <article className="session-card" key={group.sessionId}>
              <div className="session-heading">
                <h2>{group.sessionId}</h2>
                <span>{group.messages.length} message{group.messages.length === 1 ? "" : "s"}</span>
              </div>
              {group.messages.map((row, index) => (
                <div className="conversation-row" key={row.id || `${group.sessionId}-${index}`}>
                  <p className="conversation-time">{formatTimestamp(row.timestamp || row.created_at)}</p>
                  <p className="conversation-message">{row.message || ""}</p>
                  <p className="conversation-reply">{row.reply || ""}</p>
                  {row.handoff === true || row.handoff === "true" ? <span className="badge">Handoff</span> : null}
                </div>
              ))}
            </article>
          ))}
        </Reveal>
      </main>

      <KeyModal
        open={keyModalOpen}
        idPrefix="dashboard-key"
        eyebrow="Private dashboard"
        title="Enter dashboard key"
        copy="This key protects customer conversation history."
        label="Dashboard key"
        value={dashboardKeyInput}
        error={dashboardKeyError}
        onChange={setDashboardKeyInput}
        onSubmit={submitDashboardKey}
        onCancel={() => closeDashboardKeyModal("")}
      />
    </>
  );
}

function Step({ number, title, children }) {
  return (
    <article className="step">
      <span className="step-number">{number}</span>
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </article>
  );
}

function Reveal({ as: Tag = "div", className = "", children, ...props }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || visible) {
      return undefined;
    }

    if (!("IntersectionObserver" in window)) {
      setVisible(true);
      return undefined;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true);
        observer.disconnect();
      }
    }, {
      rootMargin: "0px 0px -12% 0px",
      threshold: 0.12,
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [visible]);

  return (
    <Tag
      {...props}
      ref={ref}
      className={`${className} reveal ${visible ? "is-visible" : ""}`.trim()}
    >
      {children}
    </Tag>
  );
}

function TutorialMedia({ label, path }) {
  return (
    <aside className="tutorial-media" aria-label={label}>
      <div className="tutorial-media-frame">
        <div className="tutorial-media-top">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div className="tutorial-media-body">
          <p className="eyebrow">{label}</p>
          <h2>Drop tutorial media here</h2>
          <p>Add an MP4, WebM, or GIF at:</p>
          <code>{path}</code>
        </div>
      </div>
    </aside>
  );
}

function KeyModal({ open, idPrefix, eyebrow, title, copy, label, value, error, onChange, onSubmit, onCancel }) {
  if (!open) {
    return null;
  }

  return (
    <div className="modal-backdrop" id={`${idPrefix}-modal`} onMouseDown={(event) => {
      if (event.target === event.currentTarget) {
        onCancel();
      }
    }}>
      <section className="modal" role="dialog" aria-modal="true" aria-labelledby={`${idPrefix}-title`}>
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2 id={`${idPrefix}-title`}>{title}</h2>
          </div>
          <button className="modal-icon-button" id={`${idPrefix}-close`} type="button" aria-label="Close" onClick={onCancel}>x</button>
        </div>
        <p className="modal-copy">{copy}</p>
        <label className="field">
          <span>{label}</span>
          <input
            id={`${idPrefix}-input`}
            type="password"
            autoComplete="current-password"
            value={value}
            autoFocus
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onSubmit();
              }
              if (event.key === "Escape") {
                onCancel();
              }
            }}
          />
        </label>
        <p className="status-text modal-error" id={`${idPrefix}-error`} role="status" aria-live="polite">{error}</p>
        <div className="modal-actions">
          <button className="button secondary" id={`${idPrefix}-cancel`} type="button" onClick={onCancel}>Cancel</button>
          <button className="button primary" id={`${idPrefix}-submit`} type="button" onClick={onSubmit}>Continue</button>
        </div>
      </section>
    </div>
  );
}

function useModalBodyLock(open) {
  useEffect(() => {
    document.body.classList.toggle("modal-open", open);
    return () => document.body.classList.remove("modal-open");
  }, [open]);
}

function splitOrigins(value) {
  return value.split(",").map((origin) => origin.trim()).filter(Boolean);
}

function defaultOriginsFromWebsite(value) {
  try {
    const url = new URL(value);
    const origins = [url.origin];
    if (url.hostname.indexOf("www.") === 0) {
      origins.push(`${url.protocol}//${url.hostname.replace(/^www\./, "")}`);
    } else {
      origins.push(`${url.protocol}//www.${url.hostname}`);
    }
    return origins;
  } catch {
    return [];
  }
}

function normalizeRows(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.data)) return data.data;
  if (Array.isArray(data.rows)) return data.rows;
  return [];
}

function dateValue(row) {
  const value = row.timestamp || row.created_at || "";
  const time = Date.parse(value);
  return Number.isNaN(time) ? 0 : time;
}

function formatTimestamp(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
}

function groupRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const sessionId = row.session_id || "unknown-session";
    if (!map.has(sessionId)) {
      map.set(sessionId, []);
    }
    map.get(sessionId).push(row);
  });

  return Array.from(map.entries()).map(([sessionId, groupRowsValue]) => {
    const messages = groupRowsValue.slice().sort((a, b) => dateValue(a) - dateValue(b));
    const newest = messages.reduce((max, row) => Math.max(max, dateValue(row)), 0);
    return { sessionId, newest, messages };
  }).sort((a, b) => b.newest - a.newest);
}

function normalizePath(path) {
  if (path === "/install-shopify" || path === "/install-website" || path === "/dashboard") {
    return path;
  }
  return "/";
}

function titleForPath(path) {
  if (path === "/install-shopify") return "Install Wisp on Shopify";
  if (path === "/install-website") return "Install Wisp on Any Website";
  if (path === "/dashboard") return "Wisp Conversations Dashboard";
  return "Wisp Chat Widget";
}

createRoot(document.getElementById("root")).render(<App />);
