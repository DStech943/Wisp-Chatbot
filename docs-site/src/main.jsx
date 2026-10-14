import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "../style.css";

const WIDGET_HOST_URL = "https://wisp-widget.pages.dev/widget.js";
const WIDGET_API_URL = "https://supabasedb.datastraw.in/functions/v1/widget-chat";
const REGISTER_BRAND_URL = "https://supabasedb.datastraw.in/functions/v1/register-brand";
const CONVERSATIONS_URL = "https://supabasedb.datastraw.in/functions/v1/get-conversations";
const GET_BRAND_SETTINGS_URL = "https://supabasedb.datastraw.in/functions/v1/get-brand-settings";
const UPDATE_BRAND_SETTINGS_URL = "https://supabasedb.datastraw.in/functions/v1/update-brand-settings";
const ADMIN_KEY_STORAGE = "wisp_snippet_admin_key";
const DASHBOARD_KEY_STORAGE = "wisp_dashboard_key";
const DASHBOARD_SITE_STORAGE = "wisp_dashboard_site_id";

const DASHBOARD_TABS = [
  { id: "chats", label: "Chats" },
  { id: "customize", label: "Customize" },
  { id: "nudges", label: "Nudges" },
];

const DEFAULT_NUDGE_SETTINGS = {
  enabled: true,
  preorder: false,
  preorder_selector: "",
  preorder_keywords: ["pre-order", "preorder", "pre order"],
  results_selector: "[data-wisp-results], [id*='review'], [class*='review'], [id*='results'], [class*='results']",
  out_of_stock: {
    enabled: true,
    message: "Out of stock? We can remind you once it's back.",
    chips: ["Remind me"],
  },
  preorder_nudge: {
    enabled: true,
    message: "This product is on pre-order, so delivery might take a little longer.",
    chips: ["When will it arrive?"],
  },
  variant_flipping: {
    enabled: true,
    message: "Not sure which one fits? I can help you pick.",
    chips: ["Help me choose", "What's the difference?"],
  },
  results_anxiety: {
    enabled: true,
    message: "Want to know what to expect and when?",
    chips: ["Results & timelines", "Is it right for me?"],
  },
  hesitation: {
    enabled: true,
    message: "Questions about ingredients, size or usage?",
    chips: ["Ingredients", "Size", "Usage"],
  },
  repeat_views: {
    enabled: true,
    message: "Still thinking about this one? Here's what people ask most.",
    chips: ["What do people ask most?", "Is this right for me?", "How do I use it?"],
  },
};

const NUDGE_DEFINITIONS = [
  { id: "out_of_stock", title: "Out of stock", trigger: "Selected variant cannot be bought. 3s after load, re-checked on variant change." },
  { id: "preorder_nudge", title: "Pre-order", trigger: "Product is pre-order. 3s after load." },
  { id: "variant_flipping", title: "Variant flipping", trigger: "3+ variant changes within 120s on one page view." },
  { id: "results_anxiety", title: "Results anxiety", trigger: "Reviews or results section is at least 50% visible for 3s." },
  { id: "hesitation", title: "Hesitation", trigger: "30s of visible-tab time on a product page, no add-to-cart." },
  { id: "repeat_views", title: "Repeat views", trigger: "3rd view of the same product in a session. 5s after load." },
];

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
  const [siteId, setSiteId] = useState(() => sessionStorage.getItem(DASHBOARD_SITE_STORAGE) || "");
  const [activeTab, setActiveTab] = useState("chats");
  const [dashboardKeyInput, setDashboardKeyInput] = useState(() => sessionStorage.getItem(DASHBOARD_KEY_STORAGE) || "");
  const [isLoggedIn, setIsLoggedIn] = useState(() => Boolean(sessionStorage.getItem(DASHBOARD_KEY_STORAGE) && sessionStorage.getItem(DASHBOARD_SITE_STORAGE)));
  const [status, setStatus] = useState("");
  const [settingsStatus, setSettingsStatus] = useState("");
  const [rows, setRows] = useState([]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [nudgeSettings, setNudgeSettings] = useState(DEFAULT_NUDGE_SETTINGS);
  const [uiSettings, setUiSettings] = useState({
    botName: "Maya",
    welcomeMessage: "Hi this is Maya🤍, how can I help you?",
    launcherStyle: "Glassy",
    accentColor: "#172033",
  });
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => groupRows(rows), [rows]);

  const login = () => {
    const key = dashboardKeyInput.trim();
    const cleanedSiteId = siteId.trim();

    if (!key) {
      setStatus("Enter a dashboard key.");
      return;
    }
    if (!cleanedSiteId) {
      setStatus("Enter a site id.");
      return;
    }

    sessionStorage.setItem(DASHBOARD_KEY_STORAGE, key);
    sessionStorage.setItem(DASHBOARD_SITE_STORAGE, cleanedSiteId);
    setActiveTab("chats");
    setIsLoggedIn(true);
    window.scrollTo({ top: 0, behavior: "auto" });
    loadConversations(key, cleanedSiteId);
    loadSettings(key, cleanedSiteId);
  };

  const logout = () => {
    sessionStorage.removeItem(DASHBOARD_KEY_STORAGE);
    sessionStorage.removeItem(DASHBOARD_SITE_STORAGE);
    setDashboardKeyInput("");
    setSiteId("");
    setIsLoggedIn(false);
    setRows([]);
    setHasLoaded(false);
    setStatus("");
    setSettingsStatus("");
  };

  const loadConversations = (key = sessionStorage.getItem(DASHBOARD_KEY_STORAGE), rawSiteId = siteId) => {
    const cleanedSiteId = rawSiteId.trim();
    if (!key || !cleanedSiteId) {
      setStatus("Enter a site id and dashboard key.");
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
        sessionStorage.removeItem(DASHBOARD_SITE_STORAGE);
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
      if (error.message === "Invalid key") {
        setIsLoggedIn(false);
      }
      setRows([]);
      setHasLoaded(false);
      setStatus(error.message === "Invalid key" ? "Invalid key" : "Could not load conversations.");
    });
  };

  const loadSettings = (key = sessionStorage.getItem(DASHBOARD_KEY_STORAGE), rawSiteId = siteId) => {
    const cleanedSiteId = rawSiteId.trim();
    if (!key || !cleanedSiteId) {
      setSettingsStatus("Enter a site id and dashboard key.");
      return;
    }

    setSettingsStatus("Loading settings...");
    fetch(`${GET_BRAND_SETTINGS_URL}?site_id=${encodeURIComponent(cleanedSiteId)}`, {
      method: "GET",
      headers: {
        "X-Dashboard-Key": key,
      },
    }).then((response) => {
      if (response.status === 401) {
        sessionStorage.removeItem(DASHBOARD_KEY_STORAGE);
        sessionStorage.removeItem(DASHBOARD_SITE_STORAGE);
        throw new Error("Invalid key");
      }
      if (!response.ok) {
        throw new Error("Could not load settings");
      }
      return response.json();
    }).then((data) => {
      setNudgeSettings(normalizeNudgeSettings(data.settings?.nudge_settings));
      setUiSettings({ ...uiSettings, ...(data.settings?.ui_settings || {}) });
      setSettingsStatus("Settings loaded.");
    }).catch((error) => {
      if (error.message === "Invalid key") {
        setIsLoggedIn(false);
      }
      setSettingsStatus(error.message === "Invalid key" ? "Invalid key" : "Could not load settings.");
    });
  };

  const saveSettings = () => {
    const key = sessionStorage.getItem(DASHBOARD_KEY_STORAGE);
    const cleanedSiteId = siteId.trim();
    if (!key || !cleanedSiteId) {
      setSettingsStatus("Enter a site id and dashboard key.");
      return;
    }

    setBusy(true);
    setSettingsStatus("Saving settings...");
    fetch(UPDATE_BRAND_SETTINGS_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Dashboard-Key": key,
      },
      body: JSON.stringify({
        site_id: cleanedSiteId,
        nudge_settings: nudgeSettings,
        ui_settings: uiSettings,
      }),
    }).then((response) => response.json().catch(() => ({})).then((data) => {
      if (response.status === 401) {
        sessionStorage.removeItem(DASHBOARD_KEY_STORAGE);
        throw new Error("Invalid key");
      }
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "Could not save settings");
      }
    })).then(() => {
      setSettingsStatus("Settings saved.");
    }).catch((error) => {
      setSettingsStatus(error.message || "Could not save settings.");
    }).finally(() => {
      setBusy(false);
    });
  };

  const activeDashboardTab = DASHBOARD_TABS.find((tab) => tab.id === activeTab) || DASHBOARD_TABS[0];
  const dashboardIntro = {
    chats: "Review customer conversations and handoff requests for this brand.",
    customize: "Draft the chatbot look and greeting for this store.",
    nudges: "Control proactive messages, chips, and trigger-specific copy.",
  }[activeDashboardTab.id];

  if (!isLoggedIn) {
    return (
      <main className="dashboard-shell dashboard-auth-shell">
        <section className="page-heading">
          <p className="eyebrow">Private dashboard</p>
          <h1>Log in to open the brand workspace.</h1>
          <p>Use one protected dashboard key and a site ID to manage conversations, UI, and nudges.</p>
        </section>

        <Reveal as="section" className="tool-panel dashboard-login" aria-label="Dashboard login">
          <label className="field">
            <span>Dashboard key</span>
            <input type="password" autoComplete="current-password" value={dashboardKeyInput} onChange={(event) => setDashboardKeyInput(event.target.value)} onKeyDown={(event) => event.key === "Enter" && login()} />
          </label>
          <label className="field">
            <span>Site ID</span>
            <input id="site-id" type="text" placeholder="client-domain.com" autoComplete="off" value={siteId} onChange={(event) => setSiteId(event.target.value)} onKeyDown={(event) => event.key === "Enter" && login()} />
          </label>
          <button className="button primary" type="button" onClick={login}>Log in</button>
          <p className="status-text" role="status" aria-live="polite">{status}</p>
        </Reveal>
      </main>
    );
  }

  return (
    <main className="dashboard-app">
      <aside className="dashboard-sidebar" aria-label="Dashboard navigation">
        <div className="dashboard-sidebar-brand">
          <p className="eyebrow">Wisp dashboard</p>
          <h1>{siteId.trim() || "Brand workspace"}</h1>
          <p>Manage the chatbot experience for this storefront.</p>
        </div>

        <nav className="dashboard-sidebar-nav" aria-label="Dashboard sections">
          {DASHBOARD_TABS.map((tab) => (
            <button
              type="button"
              key={tab.id}
              className={activeTab === tab.id ? "is-active" : ""}
              aria-pressed={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="dashboard-sidebar-footer">
          <p className="sidebar-meta">
            Site ID
            <strong>{siteId.trim()}</strong>
          </p>
          <button className="button secondary" type="button" onClick={() => {
            loadConversations();
            loadSettings();
          }}>Reload brand</button>
          <button className="button secondary" type="button" onClick={logout}>Log out</button>
        </div>
      </aside>

      <section className="dashboard-main">
        <div className="dashboard-content-heading">
          <div>
            <p className="eyebrow">{activeDashboardTab.label}</p>
            <h2>{activeDashboardTab.label}</h2>
            <p>{dashboardIntro}</p>
          </div>
          {activeTab === "chats" ? (
            <button className="button primary" id="load" type="button" onClick={() => loadConversations()}>Load conversations</button>
          ) : null}
        </div>

        {activeTab === "chats" ? (
          <>
            <p className="status-text" id="status" role="status" aria-live="polite">{status}</p>
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
          </>
        ) : null}

        {activeTab === "customize" ? (
          <CustomizePanel
            uiSettings={uiSettings}
            setUiSettings={setUiSettings}
            saveSettings={saveSettings}
            busy={busy}
            status={settingsStatus}
          />
        ) : null}

        {activeTab === "nudges" ? (
          <NudgesPanel
            nudgeSettings={nudgeSettings}
            setNudgeSettings={setNudgeSettings}
            saveSettings={saveSettings}
            busy={busy}
            status={settingsStatus}
            reload={() => loadSettings()}
          />
        ) : null}
      </section>
    </main>
  );
}

function CustomizePanel({ uiSettings, setUiSettings, saveSettings, busy, status }) {
  const update = (key, value) => {
    setUiSettings((current) => ({ ...current, [key]: value }));
  };
  const accentColor = normalizeHexColor(uiSettings.accentColor) || "#172033";
  const launcherStyle = String(uiSettings.launcherStyle || "Glassy").toLowerCase();

  return (
    <Reveal as="section" className="settings-grid" aria-label="Customize chatbot UI">
      <div className="tool-panel settings-panel">
        <div>
          <p className="eyebrow">Customize</p>
          <h2>Chatbot UI</h2>
          <p className="muted-copy">Saved changes are stored in Supabase and applied by the installed widget when the storefront loads.</p>
        </div>
        <label className="field">
          <span>Bot name</span>
          <input value={uiSettings.botName || ""} onChange={(event) => update("botName", event.target.value)} />
        </label>
        <label className="field">
          <span>Welcome message</span>
          <textarea rows="3" value={uiSettings.welcomeMessage || ""} onChange={(event) => update("welcomeMessage", event.target.value)} />
        </label>
        <label className="field">
          <span>Launcher style</span>
          <select value={uiSettings.launcherStyle || "Glassy"} onChange={(event) => update("launcherStyle", event.target.value)}>
            <option>Glassy</option>
            <option>Minimal</option>
            <option>Solid</option>
          </select>
        </label>
        <label className="field">
          <span>Accent color</span>
          <input type="color" value={accentColor} onChange={(event) => update("accentColor", event.target.value)} />
        </label>
        <div className="settings-actions">
          <button className="button primary" type="button" disabled={busy} onClick={saveSettings}>{busy ? "Saving..." : "Save customization"}</button>
          <p className="status-text" role="status" aria-live="polite">{status}</p>
        </div>
      </div>
      <div className="customize-preview">
        <div className="mock-widget-stage" style={{ "--mock-accent": accentColor, "--mock-accent-soft": hexToRgba(accentColor, 0.22) }}>
          <div className={`mock-widget mock-widget-${launcherStyle}`}>
            <div className="mock-header">
              <strong>{uiSettings.botName || "Maya"}</strong>
              <span aria-hidden="true">x</span>
            </div>
            <div className="mock-body">
              <p>{uiSettings.welcomeMessage || "Hi this is Maya🤍, how can I help you?"}</p>
            </div>
            <div className="mock-footer">
              <div className="mock-suggestions">
                <span>Track my order</span>
                <span>Chat with our Team</span>
                <span>Best Sellers</span>
                <span>Ongoing Discounts?</span>
              </div>
              <div className="mock-input">
                <span>Ask me anything</span>
                <b aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none"><path d="M12 19V5m0 0-6 6m6-6 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </b>
              </div>
              <div className="mock-powered">Powered by <img src="https://wisp-widget.pages.dev/Pixie.png" alt="" /><strong>Pixie</strong></div>
            </div>
          </div>
          <div className={`mock-launcher mock-launcher-${launcherStyle}`} aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none"><path d="M7.5 17.5 4 20V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8.5a2.5 2.5 0 0 1-2.5 2.5h-10Z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function NudgesPanel({ nudgeSettings, setNudgeSettings, saveSettings, busy, status, reload }) {
  const setGlobal = (key, value) => {
    setNudgeSettings((current) => ({ ...current, [key]: value }));
  };

  const setNudge = (id, key, value) => {
    setNudgeSettings((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [key]: value,
      },
    }));
  };

  return (
    <Reveal as="section" className="tool-panel settings-panel" aria-label="Nudge settings">
      <div className="settings-heading">
        <div>
          <p className="eyebrow">Nudges</p>
          <h2>Behavior triggers</h2>
          <p className="muted-copy">Toggle each nudge and edit the message customers see. Chip labels are pipe-separated.</p>
        </div>
        <button
          className="toggle-switch"
          type="button"
          role="switch"
          aria-checked={nudgeSettings.enabled !== false}
          data-state={nudgeSettings.enabled === false ? "off" : "on"}
          onClick={() => setGlobal("enabled", nudgeSettings.enabled === false)}
        >
          <span className="toggle-track" aria-hidden="true"><span></span></span>
          <span>{nudgeSettings.enabled === false ? "All off" : "All on"}</span>
        </button>
      </div>

      <div className="nudge-config-row">
        <label className="field">
          <span>Pre-order selector</span>
          <input value={nudgeSettings.preorder_selector || ""} onChange={(event) => setGlobal("preorder_selector", event.target.value)} placeholder="[data-preorder]" />
        </label>
        <label className="field">
          <span>Results/reviews selector</span>
          <input value={nudgeSettings.results_selector || ""} onChange={(event) => setGlobal("results_selector", event.target.value)} />
        </label>
      </div>

      <div className="nudge-list">
        {NUDGE_DEFINITIONS.map((definition) => {
          const value = nudgeSettings[definition.id] || {};
          return (
            <article className="nudge-card" key={definition.id}>
              <div className="nudge-card-top">
                <div>
                  <h3>{definition.title}</h3>
                  <p>{definition.trigger}</p>
                </div>
                <button
                  className="toggle-switch"
                  type="button"
                  role="switch"
                  aria-checked={value.enabled !== false}
                  data-state={value.enabled === false ? "off" : "on"}
                  onClick={() => setNudge(definition.id, "enabled", value.enabled === false)}
                >
                  <span className="toggle-track" aria-hidden="true"><span></span></span>
                  <span>{value.enabled === false ? "Off" : "On"}</span>
                </button>
              </div>
              <label className="field">
                <span>Message</span>
                <textarea rows="2" value={value.message || ""} onChange={(event) => setNudge(definition.id, "message", event.target.value)} />
              </label>
              <label className="field">
                <span>Chips</span>
                <input value={(value.chips || []).join(" | ")} onChange={(event) => setNudge(definition.id, "chips", splitChipInput(event.target.value))} />
              </label>
            </article>
          );
        })}
      </div>

      <div className="settings-actions">
        <button className="button secondary" type="button" onClick={reload}>Reload settings</button>
        <button className="button primary" type="button" disabled={busy} onClick={saveSettings}>{busy ? "Saving..." : "Save nudges"}</button>
        <p className="status-text" role="status" aria-live="polite">{status}</p>
      </div>
    </Reveal>
  );
}

function splitChipInput(value) {
  return value.split(value.indexOf("|") === -1 ? "," : "|").map((item) => item.trim()).filter(Boolean);
}

function normalizeHexColor(value) {
  const color = String(value || "").trim();

  if (/^#[0-9a-f]{6}$/i.test(color)) {
    return color;
  }

  if (/^#[0-9a-f]{3}$/i.test(color)) {
    return `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`;
  }

  return "";
}

function hexToRgba(color, alpha) {
  const normalized = normalizeHexColor(color) || "#172033";
  const red = parseInt(normalized.slice(1, 3), 16);
  const green = parseInt(normalized.slice(3, 5), 16);
  const blue = parseInt(normalized.slice(5, 7), 16);

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function normalizeNudgeSettings(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    ...DEFAULT_NUDGE_SETTINGS,
    ...source,
    out_of_stock: { ...DEFAULT_NUDGE_SETTINGS.out_of_stock, ...(source.out_of_stock || {}) },
    preorder_nudge: { ...DEFAULT_NUDGE_SETTINGS.preorder_nudge, ...(source.preorder_nudge || source.preorder || {}) },
    variant_flipping: { ...DEFAULT_NUDGE_SETTINGS.variant_flipping, ...(source.variant_flipping || {}) },
    results_anxiety: { ...DEFAULT_NUDGE_SETTINGS.results_anxiety, ...(source.results_anxiety || {}) },
    hesitation: { ...DEFAULT_NUDGE_SETTINGS.hesitation, ...(source.hesitation || {}) },
    repeat_views: { ...DEFAULT_NUDGE_SETTINGS.repeat_views, ...(source.repeat_views || {}) },
  };
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
