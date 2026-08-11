// Autolingo -- maintained by joaomtsplay@gmail.com
//
// Manifest-registered content script -- runs in the isolated world, so it
// has chrome.* API access but can't touch Duolingo's own page JavaScript.
// Its whole job is being the bridge: it injects injected.js into the page's
// real world, forwards chrome.storage changes and popup messages inward as
// CustomEvents on `document`, and hands injected.js its one-time initial
// state (settings + icon assets) when it asks for the extension id.

// injects a file as a <script> tag so it runs with page-level permissions
// instead of the isolated content script world
const injectScript = (fileName) => {
    let th = document.getElementsByTagName('body')[0];
    let s = document.createElement('script');
    s.setAttribute('type', 'module');

    // set the source attribute for the injected script
    s.setAttribute('src', `chrome-extension://${chrome.runtime.id}/${fileName}`);
    th.appendChild(s);
}

const send_custom_event = (event_name, data=null) => {
    var event = document.createEvent("CustomEvent")
    event.initCustomEvent(event_name, true, true, {"data": data});
    document.dispatchEvent(event);
}

const getAssetDataUrl = async (fileName) => {
    const response = await fetch(chrome.runtime.getURL(fileName));
    const blob = await response.blob();

    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

let isScriptInjected = false;

if (!isScriptInjected) {
    injectScript("content_scripts/injected.js");
    isScriptInjected = true;
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
        if (changes.autolingo_enabled) {
            const isEnabled = changes.autolingo_enabled.newValue;
            if (isEnabled) {
                send_custom_event("enable_automation");
            } else {
                send_custom_event("disable_automation");
            }
        }
        if (changes.autolingo_auto_grind) {
            const isAutoGrindEnabled = changes.autolingo_auto_grind.newValue;
            if (isAutoGrindEnabled) {
                send_custom_event("enable_auto_grind");
            } else {
                send_custom_event("disable_auto_grind");
            }
        }
        if (changes.autolingo_legendary_grind) {
            const isLegendaryGrindEnabled = changes.autolingo_legendary_grind.newValue;
            if (isLegendaryGrindEnabled) {
                send_custom_event("enable_legendary_grind");
            } else {
                send_custom_event("disable_legendary_grind");
            }
        }
    }
});

// add a listener that forwards messages to the injected script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
        case "set_delay":
            send_custom_event("set_delay", message.delay);
            break;
        default:
            console.error(`Given unknown message type '${message.action}'`);
    }
});

// when the extension asks for the id, give it!
window.addEventListener("get_extension_id", async () => {
    const extensionId = chrome.runtime.id;
    send_custom_event("extension_id", extensionId);
    try {
        const [tierIconUrl, legendaryIconUrl] = await Promise.all([
            getAssetDataUrl("images/diamond-league.png"),
            getAssetDataUrl("images/legendary.svg"),
        ]);
        send_custom_event("set_icon_assets", { tierIconUrl, legendaryIconUrl });
    } catch (error) {
        console.error("Failed to load Autolingo icon assets", error);
    }

    chrome.storage.local.get([
        "autolingo_enabled",
        "autolingo_auto_grind",
        "autolingo_legendary_grind",
        "autolingo_delay",
    ], (response) => {
        const isEnabled = Boolean(response["autolingo_enabled"]);
        const isAutoGrindEnabled = Boolean(response["autolingo_auto_grind"]);
        const isLegendaryGrindEnabled = Boolean(response["autolingo_legendary_grind"]);
        let delay = response["autolingo_delay"];

        if (typeof delay !== 'number' || delay < 0 || delay > 2000) {
            delay = 500;
        }

        send_custom_event("set_initial_state", { isEnabled, isAutoGrindEnabled, isLegendaryGrindEnabled, delay });
    });
});
