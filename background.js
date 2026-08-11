// Autolingo -- maintained by joaomtsplay@gmail.com
//
// Service worker. The only thing running here is the toolbar badge -- it
// mirrors "autolingo_enabled" from chrome.storage.local (✓ green when on,
// "off" grey when not) and makes sure that flag exists with a sane default
// on first install. Everything else lives in the content scripts.

let previousEnabled = null;

const set_badge = async () => {
    const { autolingo_enabled } = await chrome.storage.local.get(["autolingo_enabled"]);

    if (autolingo_enabled === previousEnabled) {
        return;
    }

    if (autolingo_enabled) {
        chrome.action.setBadgeText({text: "✓"});
        chrome.action.setBadgeBackgroundColor({color: "green"});
    } else {
        chrome.action.setBadgeText({text: "off"});
        chrome.action.setBadgeBackgroundColor({color: "#888888"});
    }

    previousEnabled = autolingo_enabled;
}

const ensure_default_enabled = async () => {
    const { autolingo_enabled } = await chrome.storage.local.get(["autolingo_enabled"]);

    if (autolingo_enabled === undefined || autolingo_enabled === null) {
        chrome.storage.local.set({ "autolingo_enabled": true });
    }
}

setInterval(set_badge, 1000)
ensure_default_enabled();
set_badge();
