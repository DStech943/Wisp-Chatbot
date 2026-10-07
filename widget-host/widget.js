(function () {
  "use strict";

  var script = document.currentScript;
  var dataset = script ? script.dataset : {};
  var siteId = dataset.siteId || "";
  var platform = dataset.platform || "custom";
  var api = dataset.api || "";
  var pixieLogo = script && script.src ? new URL("Pixie.png", script.src).href : "Pixie.png";

  if (!siteId || !api) {
    return;
  }

  var storageKey = "wisp_chat_session_id:" + siteId;
  var sessionId = getSessionId(storageKey);
  var isOpen = false;
  var isSending = false;
  var isHandoff = false;

  var host = document.createElement("div");
host.setAttribute("data-wisp-chat-host", siteId);
host.style.setProperty("display", "block", "important");
  document.body.appendChild(host);

  var shadow = host.attachShadow({ mode: "open" });
  shadow.innerHTML = [
    "<style>",
    ":host { all: initial; position: fixed; right: 20px; bottom: 20px; z-index: 2147483647; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif; color: #172033; }",
    "* { box-sizing: border-box; }",
    ".wisp-root { position: relative; width: 64px; height: 64px; }",
    ".wisp-bubble { width: 64px; height: 64px; border: 0; border-radius: 50%; background: #172033; color: #ffffff; box-shadow: 0 14px 34px rgba(23, 32, 51, 0.28); cursor: pointer; display: grid; place-items: center; transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease; }",
    ".wisp-bubble:hover { transform: translateY(-1px); box-shadow: 0 18px 42px rgba(23, 32, 51, 0.34); }",
    ".wisp-bubble:focus-visible, .wisp-send:focus-visible { outline: 3px solid rgba(23, 32, 51, 0.2); outline-offset: 3px; }",
    ".wisp-bubble svg { width: 29px; height: 29px; display: block; }",
    ".wisp-panel { position: absolute; right: 0; bottom: 78px; width: 360px; height: 520px; max-height: calc(100vh - 112px); background: #ffffff; border: 1px solid rgba(23, 32, 51, 0.1); border-radius: 18px; box-shadow: 0 26px 70px rgba(23, 32, 51, 0.18); overflow: hidden; display: none; flex-direction: column; }",
    ".wisp-root[data-open='true'] .wisp-panel { display: flex; }",
    ".wisp-header { min-height: 56px; padding: 14px 16px; background: #172033; color: #ffffff; display: flex; align-items: center; justify-content: space-between; gap: 12px; }",
    ".wisp-title { font-size: 15px; line-height: 20px; font-weight: 700; margin: 0; }",
    ".wisp-close { width: 32px; height: 32px; border: 0; border-radius: 50%; background: rgba(255, 255, 255, 0.1); color: #ffffff; cursor: pointer; display: grid; place-items: center; }",
    ".wisp-close:hover { background: rgba(255, 255, 255, 0.18); }",
    ".wisp-close svg { width: 18px; height: 18px; display: block; }",
    ".wisp-messages { flex: 1; min-height: 0; padding: 16px; overflow-y: auto; background: #ffffff; display: flex; flex-direction: column; gap: 10px; }",
    ".wisp-message { max-width: 82%; padding: 10px 12px; border-radius: 8px; font-size: 14px; line-height: 20px; overflow-wrap: anywhere; white-space: pre-wrap; }",
    ".wisp-message-user { align-self: flex-end; background: #172033; color: #ffffff; }",
    ".wisp-message-assistant { align-self: flex-start; background: #ffffff; color: #172033; border: 1px solid rgba(23, 32, 51, 0.09); }",
    ".wisp-message-error { align-self: flex-start; background: #f3f4f6; color: #172033; border: 1px solid rgba(23, 32, 51, 0.14); }",
    ".wisp-typing { align-self: flex-start; display: none; align-items: center; gap: 4px; height: 34px; padding: 0 12px; background: #ffffff; border: 1px solid rgba(23, 32, 51, 0.09); border-radius: 8px; }",
    ".wisp-root[data-typing='true'] .wisp-typing { display: flex; }",
    ".wisp-dot { width: 6px; height: 6px; border-radius: 50%; background: #7a8496; animation: wispPulse 1s infinite ease-in-out; }",
    ".wisp-dot:nth-child(2) { animation-delay: 120ms; }",
    ".wisp-dot:nth-child(3) { animation-delay: 240ms; }",
    "@keyframes wispPulse { 0%, 80%, 100% { opacity: 0.35; transform: translateY(0); } 40% { opacity: 1; transform: translateY(-3px); } }",
    ".wisp-footer { padding: 10px 12px 8px; background: #ffffff; border-top: 1px solid rgba(23, 32, 51, 0.06); }",
    ".wisp-form { height: 50px; padding: 4px 5px 4px 16px; background: #fbfbfc; border: 1px solid rgba(23, 32, 51, 0.16); border-radius: 18px; display: flex; align-items: center; gap: 8px; box-shadow: inset 0 1px 2px rgba(23, 32, 51, 0.03); }",
    ".wisp-input { min-width: 0; flex: 1; height: 40px; border: 0; border-radius: 14px; padding: 0; font: inherit; font-size: 16px; font-weight: 600; color: #172033; background: transparent; }",
    ".wisp-input:focus { outline: none; }",
    ".wisp-input::placeholder { color: #aeb4c2; font-weight: 600; }",
    ".wisp-input:disabled { color: #8b92a3; }",
    ".wisp-send { width: 40px; height: 40px; flex: 0 0 40px; border: 0; border-radius: 50%; background: #172033; color: #ffffff; cursor: pointer; display: grid; place-items: center; }",
    ".wisp-send:hover { background: #2c3447; }",
    ".wisp-send:disabled { cursor: not-allowed; opacity: 0.6; }",
    ".wisp-send svg { width: 18px; height: 18px; display: block; }",
    ".wisp-powered { height: 18px; margin-top: 7px; display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 9px; line-height: 1; color: #6b7280; font-weight: 700; }",
    ".wisp-powered img { width: 16px; height: 16px; object-fit: contain; display: block; }",
    ".wisp-powered strong { color: #2476ff; font-size: 11px; font-weight: 800; }",
    "@media (max-width: 479px) {",
    "  :host { right: 0; bottom: 0; }",
    "  .wisp-root { width: 100vw; height: 100vh; pointer-events: none; }",
    "  .wisp-bubble { position: absolute; right: 16px; bottom: 16px; pointer-events: auto; }",
    "  .wisp-panel { position: absolute; inset: 0; width: 100vw; height: 100vh; max-height: none; border-radius: 0; border: 0; pointer-events: auto; }",
    "  .wisp-root[data-open='true'] .wisp-bubble { display: none; }",
    "}",
    "</style>",
    "<div class=\"wisp-root\" data-open=\"false\" data-typing=\"false\">",
    "  <section class=\"wisp-panel\" aria-label=\"Chat\" aria-hidden=\"true\">",
    "    <header class=\"wisp-header\">",
    "      <h2 class=\"wisp-title\">Chat with us</h2>",
    "      <button class=\"wisp-close\" type=\"button\" aria-label=\"Close chat\">",
    "        <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path fill=\"currentColor\" d=\"M18.3 5.7a1 1 0 0 0-1.4 0L12 10.6 7.1 5.7a1 1 0 1 0-1.4 1.4l4.9 4.9-4.9 4.9a1 1 0 1 0 1.4 1.4l4.9-4.9 4.9 4.9a1 1 0 0 0 1.4-1.4L13.4 12l4.9-4.9a1 1 0 0 0 0-1.4Z\"/></svg>",
    "      </button>",
    "    </header>",
    "    <div class=\"wisp-messages\" role=\"log\" aria-live=\"polite\" aria-relevant=\"additions\">",
    "      <div class=\"wisp-message wisp-message-assistant\">Hi. How can I help?</div>",
    "      <div class=\"wisp-typing\" aria-label=\"Assistant is typing\">",
    "        <span class=\"wisp-dot\"></span><span class=\"wisp-dot\"></span><span class=\"wisp-dot\"></span>",
    "      </div>",
    "    </div>",
    "    <div class=\"wisp-footer\">",
    "      <form class=\"wisp-form\">",
    "        <input class=\"wisp-input\" type=\"text\" autocomplete=\"off\" placeholder=\"Ask me anything\" aria-label=\"Message\" />",
    "        <button class=\"wisp-send\" type=\"submit\" aria-label=\"Send message\">",
    "          <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\"><path d=\"M12 19V5m0 0-6 6m6-6 6 6\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
    "        </button>",
    "      </form>",
    "      <div class=\"wisp-powered\">Powered by <img src=\"" + pixieLogo + "\" alt=\"\" /><strong>Pixie</strong></div>",
    "    </div>",
    "  </section>",
    "  <button class=\"wisp-bubble\" type=\"button\" aria-label=\"Open chat\" aria-expanded=\"false\">",
    "    <svg viewBox=\"0 0 24 24\" aria-hidden=\"true\" fill=\"none\"><path d=\"M7.5 17.5 4 20V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8.5a2.5 2.5 0 0 1-2.5 2.5h-10Z\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
    "  </button>",
    "</div>"
  ].join("");

  var root = shadow.querySelector(".wisp-root");
  var panel = shadow.querySelector(".wisp-panel");
  var bubble = shadow.querySelector(".wisp-bubble");
  var closeButton = shadow.querySelector(".wisp-close");
  var messages = shadow.querySelector(".wisp-messages");
  var typing = shadow.querySelector(".wisp-typing");
  var form = shadow.querySelector(".wisp-form");
  var input = shadow.querySelector(".wisp-input");
  var sendButton = shadow.querySelector(".wisp-send");

  bubble.addEventListener("click", function () {
    setOpen(!isOpen);
  });

  closeButton.addEventListener("click", function () {
    setOpen(false);
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    sendMessage();
  });

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  function setOpen(nextOpen) {
    isOpen = nextOpen;
    root.setAttribute("data-open", String(isOpen));
    panel.setAttribute("aria-hidden", String(!isOpen));
    bubble.setAttribute("aria-expanded", String(isOpen));
    bubble.setAttribute("aria-label", isOpen ? "Close chat" : "Open chat");

    if (isOpen) {
      window.setTimeout(function () {
        input.focus();
      }, 0);
    }
  }

  function sendMessage() {
    var message = input.value.trim();

    if (!message || isSending || isHandoff) {
      return;
    }

    input.value = "";
    appendMessage(message, "user");
    setSending(true);

    fetch(api, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        site_id: siteId,
        message: message,
        session_id: sessionId,
        platform: platform,
        page_url: window.location.href
      })
    })
      .then(function (response) {
        return response.text().then(function (text) {
          var data = parseJson(text);

          if (!response.ok) {
            return Promise.reject({
              reply: data && typeof data.reply === "string" ? data.reply : null
            });
          }

          return data;
        });
      })
      .then(function (data) {
        var reply = data && typeof data.reply === "string" ? data.reply : "";

        if (!reply) {
          throw new Error("Response did not include a reply.");
        }

        appendMessage(reply, "assistant");

        if (data.handoff === true) {
          appendMessage("A team member will take it from here", "assistant");
          setHandoff();
        }
      })
      .catch(function (error) {
        appendMessage(error && error.reply ? error.reply : "Sorry, I'm having trouble right now. Please try again.", "error");
      })
      .finally(function () {
        setSending(false);
      });
  }

  function appendMessage(text, type) {
    var message = document.createElement("div");
    message.className = "wisp-message wisp-message-" + type;
    message.textContent = text;
    messages.insertBefore(message, typing);
    messages.scrollTop = messages.scrollHeight;
  }

  function setSending(nextSending) {
    isSending = nextSending;
    root.setAttribute("data-typing", String(isSending));
    sendButton.disabled = isSending || isHandoff;
    input.disabled = isSending || isHandoff;
    messages.scrollTop = messages.scrollHeight;
  }

  function setHandoff() {
    isHandoff = true;
    input.value = "";
    input.placeholder = "A team member will take it from here";
    setSending(false);
  }

  function parseJson(text) {
    if (!text) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function getSessionId(key) {
    var existing = null;

    try {
      existing = window.localStorage.getItem(key);
    } catch (error) {
      existing = null;
    }

    if (existing) {
      return existing;
    }

    var next = createSessionId();

    try {
      window.localStorage.setItem(key, next);
    } catch (error) {
      return next;
    }

    return next;
  }

  function createSessionId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }

    return "session_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2);
  }
})();
