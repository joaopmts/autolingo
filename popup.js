// Autolingo -- maintained by joaomtsplay@gmail.com
//
// Renders the popup UI into #content (from popup.html) and is the only
// place the user's settings get written: every toggle/input here writes
// straight to chrome.storage.local, which the content scripts pick up via
// storage.onChanged. Also sends the live "set_delay" message to the active
// Duolingo tab so a delay change applies without needing a page reload.

var enabled = false;
var autoGrindEnabled = false;
var legendaryGrindEnabled = false;

const update_toggle = (inputId, stateId, value) => {
    const input_switch = document.getElementById(inputId);
    const state_elem = document.getElementById(stateId);

    if (!input_switch || !state_elem) return;

    input_switch.checked = value;
    state_elem.textContent = value ? "On" : "Off";
    state_elem.classList.toggle("state-on", value);
    state_elem.classList.toggle("state-off", !value);
}

const update_dependent_row_availability = (rowId, inputId, gateValue) => {
    const row = document.getElementById(rowId);
    const input_switch = document.getElementById(inputId);
    if (!row || !input_switch) return;

    input_switch.disabled = !gateValue;
    row.classList.toggle("row-disabled", !gateValue);
}

// Auto Grind requires Automation; Legendary requires Auto Grind (it's a mode
// switch on top of it, not an independent feature) -- so it stays locked
// until Auto Grind itself is on, regardless of Automation.
const update_dependent_rows_availability = () => {
    update_dependent_row_availability("auto-grind-row", "toggle-auto-grind-input", enabled);
    update_dependent_row_availability("legendary-grind-row", "toggle-legendary-grind-input", autoGrindEnabled);
}

const toggle_extension_enabled = () => {
    enabled = !enabled;
    chrome.storage.local.set({"autolingo_enabled": enabled});
    update_toggle("toggle-enabled-input", "toggle-enabled-state", enabled);
    update_dependent_rows_availability();
}

const toggle_auto_grind = () => {
    autoGrindEnabled = !autoGrindEnabled;
    chrome.storage.local.set({"autolingo_auto_grind": autoGrindEnabled});
    update_toggle("toggle-auto-grind-input", "toggle-auto-grind-state", autoGrindEnabled);
    update_dependent_rows_availability();
}

const toggle_legendary_grind = () => {
    legendaryGrindEnabled = !legendaryGrindEnabled;
    chrome.storage.local.set({"autolingo_legendary_grind": legendaryGrindEnabled});
    update_toggle("toggle-legendary-grind-input", "toggle-legendary-grind-state", legendaryGrindEnabled);
}

const send_event = (actionType, data = {}) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs.length > 0 && tabs[0].id) {
           chrome.tabs.sendMessage(tabs[0].id, {
               action: actionType,
               ...data
           }, () => {
               if (chrome.runtime.lastError) {
                   console.log("Could not send message to content script:", chrome.runtime.lastError.message);
               }
           });
        } else {
             console.log("No suitable active tab found to send message.");
        }
    });
}

const render_content = () => {
    let content_div = document.getElementById("content");

    content_div.innerHTML = `
        <div class="section">
            <div class="toggle-row">
                <label class="autolingo-switch">
                    <input id="toggle-enabled-input" type="checkbox">
                    <span class="autolingo-slider"></span>
                </label>
                <div class="toggle-label">
                    <span class="toggle-name">Automation</span>
                    <span id="toggle-enabled-state" class="toggle-state"></span>
                </div>
            </div>

            <div class="toggle-row" id="auto-grind-row">
                <label class="autolingo-switch">
                    <input id="toggle-auto-grind-input" type="checkbox">
                    <span class="autolingo-slider"></span>
                </label>
                <div class="toggle-label">
                    <span class="toggle-name">Auto Grind</span>
                    <span id="toggle-auto-grind-state" class="toggle-state"></span>
                </div>
            </div>
            <div class="hint">Auto Grind keeps starting your next lesson automatically. Requires Automation to be on.</div>

            <div class="toggle-row" id="legendary-grind-row">
                <label class="autolingo-switch">
                    <input id="toggle-legendary-grind-input" type="checkbox">
                    <span class="autolingo-slider"></span>
                </label>
                <div class="toggle-label">
                    <span class="toggle-name">Legendary</span>
                    <span id="toggle-legendary-grind-state" class="toggle-state"></span>
                </div>
            </div>
            <div class="hint">When on, Auto Grind only starts available legendary practice instead of the normal lesson. Requires Auto Grind to be on.</div>
        </div>

        <div class="section delay-row">
            <label for="delay-input">Solve delay</label>
            <div class="delay-input-wrap">
                <input type="number" id="delay-input" min="0" max="2000" step="50">
                <span class="unit">ms</span>
            </div>
        </div>

        <div class="footer-credit">Made by joaomtsplay@gmail.com</div>
    `

    document.getElementById("toggle-enabled-input").onclick = toggle_extension_enabled;
    document.getElementById("toggle-auto-grind-input").onclick = toggle_auto_grind;
    document.getElementById("toggle-legendary-grind-input").onclick = toggle_legendary_grind;

    const delayInput = document.getElementById("delay-input");

    chrome.storage.local.get("autolingo_delay", (response) => {
        let currentDelay = response.autolingo_delay;
        if (typeof currentDelay !== 'number' || currentDelay < 0 || currentDelay > 2000) {
            currentDelay = 500;
        }
        delayInput.value = currentDelay;
    });

    delayInput.onchange = () => {
        let delay = parseInt(delayInput.value, 10);
        if (isNaN(delay) || delay < 0) {
            delay = 0;
        } else if (delay > 2000) {
            delay = 2000;
        }
        delayInput.value = delay;
        chrome.storage.local.set({"autolingo_delay": delay});
        send_event("set_delay", { delay });
    };

    update_toggle("toggle-enabled-input", "toggle-enabled-state", enabled);
    update_toggle("toggle-auto-grind-input", "toggle-auto-grind-state", autoGrindEnabled);
    update_toggle("toggle-legendary-grind-input", "toggle-legendary-grind-state", legendaryGrindEnabled);
    update_dependent_rows_availability();
}

document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get(
        [
            "autolingo_enabled",
            "autolingo_auto_grind",
            "autolingo_legendary_grind",
        ],
        (response) => {
            if (chrome.runtime.lastError) {
                console.error("Error getting data from storage:", chrome.runtime.lastError);
                document.body.innerHTML = "<p>Error loading extension data.</p>";
                return;
            }

            enabled = Boolean(response["autolingo_enabled"]);
            autoGrindEnabled = Boolean(response["autolingo_auto_grind"]);
            legendaryGrindEnabled = Boolean(response["autolingo_legendary_grind"]);

            render_content();
        }
    );
});
