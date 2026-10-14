(function () {
  "use strict";

  var script = document.currentScript;
  var dataset = script ? script.dataset : {};
  var siteId = dataset.siteId || "";
  var platform = dataset.platform || "custom";
  var api = dataset.api || "";
  var pixieLogo = script && script.src ? new URL("Pixie.png", script.src).href : "Pixie.png";
  var pageContentLimit = 8000;

  if (!siteId || !api) {
    return;
  }

  var storageKey = "wisp_chat_session_id:" + siteId;
  var sessionId = getSessionId(storageKey);
  var isOpen = false;
  var isSending = false;
  var isHandoff = false;
  var nudgeConfig = getNudgeConfig(dataset);
  var nudgeState = {
    fired: {},
    pending: [],
    flushTimer: null,
    cooldownUntil: 0,
    variantChangeTimes: [],
    lastVariantKey: getSelectedVariantKey(),
    addToCartClicked: false,
    visibleProductSeconds: 0,
    resultsTimer: null
  };

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
    ".wisp-chip-row { margin-top: 9px; display: flex; flex-wrap: wrap; gap: 7px; }",
    ".wisp-chip { max-width: 100%; min-height: 30px; border: 1px solid rgba(23, 32, 51, 0.16); border-radius: 999px; padding: 6px 10px; background: #ffffff; color: #172033; cursor: pointer; font: inherit; font-size: 12px; line-height: 16px; font-weight: 700; overflow-wrap: anywhere; }",
    ".wisp-chip:hover { background: #f6f7f9; border-color: rgba(23, 32, 51, 0.28); }",
    ".wisp-chip:focus-visible { outline: 3px solid rgba(23, 32, 51, 0.16); outline-offset: 2px; }",
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

  startNudgeEngine();

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

    if (sendUserMessage(message)) {
      input.value = "";
    }
  }

  function sendUserMessage(message) {
    message = normalizeText(message);

    if (!message || isSending || isHandoff) {
      return false;
    }

    appendMessage(message, "user");
    setSending(true);

    var pageContext = getPageContext();

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
        page_url: window.location.href,
        page_title: pageContext.title,
        page_content: pageContext.content
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

    return true;
  }

  function appendMessage(text, type) {
    var message = document.createElement("div");
    message.className = "wisp-message wisp-message-" + type;
    message.textContent = text;
    messages.insertBefore(message, typing);
    messages.scrollTop = messages.scrollHeight;
  }

  function appendNudge(text, chips, id) {
    var message = document.createElement("div");
    message.className = "wisp-message wisp-message-assistant";
    message.setAttribute("data-wisp-nudge-id", id);

    var copy = document.createElement("div");
    copy.textContent = text;
    message.appendChild(copy);

    if (chips && chips.length > 0) {
      var chipRow = document.createElement("div");
      chipRow.className = "wisp-chip-row";

      chips.forEach(function (chip) {
        var chipButton = document.createElement("button");
        chipButton.className = "wisp-chip";
        chipButton.type = "button";
        chipButton.textContent = chip;
        chipButton.addEventListener("click", function () {
          setOpen(true);
          sendUserMessage(chip);
        });
        chipRow.appendChild(chipButton);
      });

      message.appendChild(chipRow);
    }

    messages.insertBefore(message, typing);
    messages.scrollTop = messages.scrollHeight;
  }

  function startNudgeEngine() {
    if (!nudgeConfig.enabled) {
      return;
    }

    var isRepeatProductView = isThirdProductView();

    window.setTimeout(function () {
      if (isSelectedVariantUnavailable()) {
        queueNudge("out_of_stock");
      }

      if (isPreorderProduct()) {
        queueNudge("preorder");
      }
    }, 3000);

    window.setTimeout(function () {
      if (isRepeatProductView) {
        queueNudge("repeat_views");
      }
    }, 5000);

    document.addEventListener("change", function (event) {
      if (isVariantControl(event.target)) {
        handleVariantChange();
      }
    }, true);

    document.addEventListener("click", function (event) {
      if (isAddToCartControl(event.target)) {
        nudgeState.addToCartClicked = true;
        return;
      }

      if (isVariantControl(event.target)) {
        handleVariantChange();
      }
    }, true);

    startResultsObserver();
    startHesitationTimer();
  }

  function handleVariantChange() {
    window.setTimeout(function () {
      var variantKey = getSelectedVariantKey();

      if (variantKey && variantKey !== nudgeState.lastVariantKey) {
        nudgeState.lastVariantKey = variantKey;
        recordVariantFlip();
      }

      if (isSelectedVariantUnavailable()) {
        queueNudge("out_of_stock");
      }
    }, 250);
  }

  function recordVariantFlip() {
    var now = Date.now();
    nudgeState.variantChangeTimes = nudgeState.variantChangeTimes.filter(function (time) {
      return now - time <= 120000;
    });
    nudgeState.variantChangeTimes.push(now);

    if (nudgeState.variantChangeTimes.length >= 3) {
      queueNudge("variant_flipping");
    }
  }

  function startResultsObserver() {
    if (!window.IntersectionObserver) {
      return;
    }

    var targets = queryAllSafe(nudgeConfig.resultsSelector);
    if (targets.length === 0) {
      return;
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
          if (!nudgeState.resultsTimer) {
            nudgeState.resultsTimer = window.setTimeout(function () {
              queueNudge("results_anxiety");
            }, 3000);
          }
        } else if (nudgeState.resultsTimer) {
          window.clearTimeout(nudgeState.resultsTimer);
          nudgeState.resultsTimer = null;
        }
      });
    }, { threshold: [0, 0.5, 1] });

    targets.forEach(function (target) {
      observer.observe(target);
    });
  }

  function startHesitationTimer() {
    if (!isProductPage()) {
      return;
    }

    window.setInterval(function () {
      if (document.visibilityState === "hidden" || nudgeState.addToCartClicked) {
        return;
      }

      nudgeState.visibleProductSeconds += 1;

      if (nudgeState.visibleProductSeconds >= 45) {
        queueNudge("hesitation");
      }
    }, 1000);
  }

  function queueNudge(id) {
    var definition = nudgeConfig.nudges[id];

    if (!definition || nudgeState.fired[id]) {
      return;
    }

    nudgeState.fired[id] = true;
    nudgeState.pending.push({
      id: id,
      priority: definition.priority,
      message: definition.message,
      chips: definition.chips
    });

    if (!nudgeState.flushTimer) {
      nudgeState.flushTimer = window.setTimeout(flushNudges, 250);
    }
  }

  function flushNudges() {
    var now = Date.now();
    nudgeState.flushTimer = null;

    if (nudgeState.pending.length === 0) {
      return;
    }

    if (now < nudgeState.cooldownUntil) {
      nudgeState.flushTimer = window.setTimeout(flushNudges, nudgeState.cooldownUntil - now);
      return;
    }

    nudgeState.pending.sort(function (left, right) {
      return left.priority - right.priority;
    });

    var next = nudgeState.pending.shift();
    setOpen(true);
    appendNudge(next.message, next.chips, next.id);
    nudgeState.cooldownUntil = Date.now() + 20000;

    if (nudgeState.pending.length > 0) {
      nudgeState.flushTimer = window.setTimeout(flushNudges, 20000);
    }
  }

  function isSelectedVariantUnavailable() {
    var addButton = getAddToCartButton();

    if (addButton) {
      return addButton.disabled ||
        addButton.getAttribute("aria-disabled") === "true" ||
        /\b(sold out|out of stock|unavailable)\b/i.test(addButton.textContent || "");
    }

    return /\b(sold out|out of stock|currently unavailable)\b/i.test(getVisibleBodyText().slice(0, 4000));
  }

  function isPreorderProduct() {
    if (nudgeConfig.preorder === true) {
      return true;
    }

    if (nudgeConfig.preorderSelector && queryOneSafe(nudgeConfig.preorderSelector)) {
      return true;
    }

    var text = getVisibleBodyText().slice(0, 6000).toLowerCase();
    return nudgeConfig.preorderKeywords.some(function (keyword) {
      return keyword && text.indexOf(keyword.toLowerCase()) !== -1;
    });
  }

  function isThirdProductView() {
    if (!isProductPage() || !window.sessionStorage) {
      return false;
    }

    var productKey = getProductKey();
    if (!productKey) {
      return false;
    }

    var key = "wisp_product_views:" + siteId + ":" + productKey;
    var current = 0;

    try {
      current = parseInt(window.sessionStorage.getItem(key) || "0", 10) || 0;
      current += 1;
      window.sessionStorage.setItem(key, String(current));
    } catch (error) {
      return false;
    }

    return current === 3;
  }

  function isProductPage() {
    if (dataset.productPage === "true") {
      return true;
    }

    if (dataset.productPage === "false") {
      return false;
    }

    return /\/products?\//i.test(window.location.pathname) ||
      !!queryOneSafe("[data-product], [itemtype*='Product'], form[action*='/cart/add']");
  }

  function getProductKey() {
    var canonical = queryOneSafe("link[rel='canonical']");
    var value = canonical && canonical.href ? canonical.href : window.location.href.split("#")[0];

    return value.replace(/[?&]variant=[^&]+/i, "").replace(/\/$/, "");
  }

  function getSelectedVariantKey() {
    var variantParam = "";

    try {
      variantParam = new URL(window.location.href).searchParams.get("variant") || "";
    } catch (error) {
      variantParam = "";
    }

    var values = [];
    var controls = queryAllSafe("select[name*='option'], select[name='id'], input[name*='option']:checked, input[name='id']:checked, [data-selected-variant], [data-variant-id]");

    controls.forEach(function (control) {
      var value = control.value ||
        control.getAttribute("data-selected-variant") ||
        control.getAttribute("data-variant-id") ||
        control.textContent;

      if (value) {
        values.push(normalizeText(value));
      }
    });

    return [variantParam].concat(values).filter(Boolean).join("|") || window.location.href;
  }

  function isVariantControl(target) {
    var element = getElement(target);

    if (!element || isAddToCartControl(element)) {
      return false;
    }

    return !!closestSafe(element, "select[name='id'], select[name*='option'], input[name='id'], input[name*='option'], [data-variant-id], [data-variant], [data-option], [class*='variant'], [class*='swatch'], [class*='option']");
  }

  function isAddToCartControl(target) {
    var element = getElement(target);

    return !!element && !!closestSafe(element, "button[name='add'], button[type='submit'][name='add'], form[action*='/cart/add'] button[type='submit'], [data-add-to-cart], [data-testid*='add-to-cart']");
  }

  function getAddToCartButton() {
    return queryOneSafe("button[name='add'], button[type='submit'][name='add'], form[action*='/cart/add'] button[type='submit'], [data-add-to-cart], [data-testid*='add-to-cart']");
  }

  function getVisibleBodyText() {
    if (document.body && typeof document.body.innerText === "string") {
      return normalizeText(document.body.innerText);
    }

    return collectPageText();
  }

  function getNudgeConfig(source) {
    var faqChips = parseList(source.faqChips, ["Ingredients", "Size", "Usage"]);
    var topQuestionChips = parseList(source.topQuestions, [
      "What do people ask most?",
      "Is this right for me?",
      "How do I use it?"
    ]);

    return {
      enabled: source.nudges !== "false",
      preorder: source.preorder === "true",
      preorderSelector: source.preorderSelector || "",
      preorderKeywords: parseList(source.preorderKeywords, ["pre-order", "preorder", "pre order"]),
      resultsSelector: source.resultsSelector || "[data-wisp-results], [id*='review'], [class*='review'], [id*='results'], [class*='results']",
      nudges: {
        out_of_stock: {
          priority: 1,
          message: "Out of stock? We can remind you once it's back.",
          chips: ["Remind me"]
        },
        preorder: {
          priority: 2,
          message: "This product is on pre-order, so delivery might take a little longer.",
          chips: ["When will it arrive?"]
        },
        variant_flipping: {
          priority: 3,
          message: "Not sure which one fits? I can help you pick.",
          chips: ["Help me choose", "What's the difference?"]
        },
        results_anxiety: {
          priority: 4,
          message: "Want to know what to expect and when?",
          chips: ["Results & timelines", "Is it right for me?"]
        },
        hesitation: {
          priority: 5,
          message: "Questions about ingredients, size or usage?",
          chips: faqChips
        },
        repeat_views: {
          priority: 6,
          message: "Still thinking about this one? Here's what people ask most.",
          chips: topQuestionChips
        }
      }
    };
  }

  function parseList(value, fallback) {
    if (typeof value !== "string" || !value.trim()) {
      return fallback;
    }

    return value.split(value.indexOf("|") === -1 ? "," : "|").map(function (item) {
      return normalizeText(item);
    }).filter(Boolean);
  }

  function queryOneSafe(selector) {
    if (!selector) {
      return null;
    }

    try {
      return document.querySelector(selector);
    } catch (error) {
      return null;
    }
  }

  function queryAllSafe(selector) {
    if (!selector) {
      return [];
    }

    try {
      return Array.prototype.slice.call(document.querySelectorAll(selector));
    } catch (error) {
      return [];
    }
  }

  function closestSafe(element, selector) {
    if (!element || !selector) {
      return null;
    }

    try {
      return element.closest(selector);
    } catch (error) {
      return null;
    }
  }

  function getElement(target) {
    if (!target) {
      return null;
    }

    return target.nodeType === 1 ? target : target.parentElement;
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

  function getPageContext() {
    return {
      title: normalizeText(document.title || "").slice(0, 300),
      content: collectPageText().slice(0, pageContentLimit)
    };
  }

  function collectPageText() {
    var nodeFilter = window.NodeFilter;

    if (!document.body || !document.createTreeWalker || !nodeFilter) {
      return "";
    }

    var walker = document.createTreeWalker(document.body, nodeFilter.SHOW_TEXT, {
      acceptNode: function (node) {
        if (!node.nodeValue || !node.nodeValue.trim()) {
          return nodeFilter.FILTER_REJECT;
        }

        return isReadableTextNode(node) ? nodeFilter.FILTER_ACCEPT : nodeFilter.FILTER_REJECT;
      }
    });
    var chunks = [];
    var totalLength = 0;
    var node;

    while ((node = walker.nextNode())) {
      var text = normalizeText(node.nodeValue);

      if (!text) {
        continue;
      }

      chunks.push(text);
      totalLength += text.length + 1;

      if (totalLength >= pageContentLimit) {
        break;
      }
    }

    return normalizeText(chunks.join(" "));
  }

  function isReadableTextNode(node) {
    var element = node.parentElement;

    while (element && element !== document.body) {
      var tagName = element.tagName ? element.tagName.toLowerCase() : "";

      if (
        tagName === "script" ||
        tagName === "style" ||
        tagName === "noscript" ||
        tagName === "svg" ||
        tagName === "canvas" ||
        tagName === "iframe" ||
        tagName === "form" ||
        tagName === "input" ||
        tagName === "textarea" ||
        tagName === "select" ||
        tagName === "button" ||
        element.getAttribute("aria-hidden") === "true" ||
        element.hasAttribute("data-wisp-chat-host")
      ) {
        return false;
      }

      var style = window.getComputedStyle ? window.getComputedStyle(element) : null;
      if (style && (style.display === "none" || style.visibility === "hidden")) {
        return false;
      }

      element = element.parentElement;
    }

    return true;
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
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
