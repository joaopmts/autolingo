// Autolingo -- maintained by joaomtsplay@gmail.com

import ReactUtils from "./ReactUtils.js"
import DuolingoSkill from "./DuolingoSkill.js"

const DEBUG = true;

window.ru = new ReactUtils();

// append an iframe so we can re-enable console.log
// using its window.log
const frame = document.createElement('iframe');
frame.style.display = "none";
document.body.appendChild(frame);

// if DEBUG, re-enable console.log as window.log
const welcome_message = "Welcome to Autolingo!";
if (DEBUG) {
    window.log = frame.contentWindow.console.log
} else {
    window.log = () => {}
}

// print our welcome message regardless
window.log(welcome_message);

// if the user changes the language, re-inject
let previous_language = null;
let previous_url = null;
setInterval(() => {
    // get the current language from the page
    const page_data = window.ru.ReactFiber(document.querySelector("._3BJQ_"))?.return?.stateNode?.props;
    const current_language = page_data?.courses?.find(e => { return e.isCurrent; })?.learningLanguageId;

    // get current url
    const current_url = document.location.href;

    // if the language changed, we know we just loaded the home page
    if (previous_language !== current_language || previous_url !== current_url) {
        inject_autolingo();
        previous_language = current_language;
        previous_url = current_url;
    }
}, 100);

let stylesheet_loaded = false;
let the_extension_id = null;
let isAutomationEnabled = false;
let isAutoGrindDesired = false;
let isLegendaryGrindDesired = false;
let isAutolingoInjected = false;
let currentObserver = null;
let pendingInjectionInterval = null;
let tier_img_url = null;
let legendary_img_url = null;

// ---------------------------------------------------------------
// AUTO GRIND: keeps starting the CURRENT lesson (the node the Duolingo
// path itself is showing "COMEÇAR"/"CONTINUAR" on) as soon as you land back
// on the path, so you don't have to click the Autolingo icon by hand every
// time. It deliberately never touches the "Pular pra cá?" / unit-skip node,
// so it never skips a level or a whole unit.
//
// Legendary mode (isLegendaryGrindDesired, only selectable while Auto Grind
// itself is on) swaps what auto_grind_tick looks for: instead of the normal
// lesson it exclusively starts available legendary practice, and does
// nothing (not even the normal lesson) when none is available.
//
// Between starting a lesson and landing back on the path there can be any
// number of interstitial screens -- confirm modals, results, XP recap,
// streak, legendary/titan challenge offers, etc. -- and the text on them is
// never the same twice. What IS always the same is that each one has a
// "Continuar"/"Continue" button, so the closer below just keeps clicking
// that, whatever it is, until the URL is back on the path.
// ---------------------------------------------------------------
const CURRENT_LESSON_LABELS = ["COMEÇAR", "CONTINUAR"];
const AUTO_GRIND_POLL_MS = 2000;
const CLOSER_POLL_MS = 1200;
const CLOSER_TIMEOUT_MS = 5 * 60 * 1000; // give up babysitting after 5 minutes

let autoGrindInterval = null;
let closerInterval = null;
let isGrindingLesson = false;
let legendaryNotFoundLogged = false;

const on_learn_page = () => window.location.href.includes("duolingo.com/learn");

const find_current_lesson_start_button = () => {
    // NOTE: don't require children.length === 0 here -- Duolingo sometimes
    // renders a little animated icon <span> inside this label, so the node
    // isn't always a bare text leaf even though its trimmed text still
    // matches exactly.
    const label = [...document.querySelectorAll("div, span")].find(
        el => CURRENT_LESSON_LABELS.includes(el.textContent.trim().toUpperCase())
    );
    if (!label) return null;

    // walk up until we find the ancestor that also holds the Autolingo
    // overlay button for that same skill node
    let node = label;
    for (let i = 0; i < 10 && node; i++) {
        const btn = node.querySelector?.(".start-autolingo-skill-container .start-autolingo-skill");
        if (btn) return btn;
        node = node.parentElement;
    }
    return null;
};

// any visible, enabled "Continuar"/"Continue" button on screen that belongs
// to an interstitial (results, XP recap, chest reward, etc.) -- NOT the
// "A SEGUIR / Seção N" card Duolingo shows at the bottom of a section once
// it's fully complete, which also says "Continuar" but actually navigates
// to the NEXT SECTION of the course. That card lives inside the plain path
// view ([data-test="home"]), while interstitials render outside of it, so
// that's what tells them apart.
const find_continue_button = () => {
    return [...document.querySelectorAll("button")].find(btn => {
        if (btn.disabled) return false;
        if (!btn.offsetParent) return false; // not visible
        const text = btn.textContent.trim().toUpperCase();
        if (text !== "CONTINUAR" && text !== "CONTINUE") return false;
        if (btn.closest('[data-test="home"]')) return false; // "next section" card
        return true;
    }) || null;
};

// reward chests aren't lessons (the extension deliberately skips them when
// injecting its own buttons), but they're a plain one-click "Abrir"/"Open"
// sitting right there on the path, so grab those too
const find_open_chest_button = () => {
    return [...document.querySelectorAll("button")].find(btn => {
        if (btn.disabled) return false;
        if (!btn.offsetParent) return false;
        const text = btn.textContent.trim().toUpperCase();
        return text === "ABRIR" || text === "OPEN";
    }) || null;
};

const stop_lesson_closer = () => {
    if (closerInterval) {
        clearInterval(closerInterval);
        closerInterval = null;
    }
    isGrindingLesson = false;
};

const run_lesson_closer = () => {
    const startedAt = Date.now();

    closerInterval = setInterval(() => {
        if (Date.now() - startedAt > CLOSER_TIMEOUT_MS) {
            window.log?.("Auto-grind: timed out waiting for the lesson to wrap up, giving up on this cycle");
            stop_lesson_closer();
            return;
        }

        // don't fight DuolingoChallenge while it's actively mid-answer
        if (window?.autolingo?.solving) return;

        // whatever the screen is -- start confirm, results, XP recap,
        // streak, legendary/titan offer, chest reward reveal -- just click
        // through it. Checked before the on_learn_page() check below
        // because chests open as a modal ON TOP of /learn without ever
        // navigating away, so "we're on /learn" alone doesn't mean "done".
        const continueBtn = find_continue_button();
        if (continueBtn) {
            window.log?.("Auto-grind: clicking Continuar to move past an interstitial");
            continueBtn.click();
            return;
        }

        if (on_learn_page()) {
            window.log?.("Auto-grind: back on the path");
            stop_lesson_closer();
        }
    }, CLOSER_POLL_MS);
};

// The path is virtualized -- Duolingo only keeps the skill-path-unit nodes
// near the current scroll position mounted in the DOM, unmounting the rest
// for performance. That means ".final-autolingo-skill" only ever shows up
// for whatever's currently scrolled into (or near) view, NOT the first one
// in the whole course. To reliably find the earliest available legendary
// we scroll to the very top and sweep downward in overlapping steps,
// pausing after each scroll for the virtualized list to remount, until we
// find one or run out of path.
const SCROLL_STEP_WAIT_MS = 400;

const find_first_legendary_by_scrolling = async () => {
    const scroller = document.documentElement;
    scroller.scrollTop = 0;
    await new Promise(r => setTimeout(r, SCROLL_STEP_WAIT_MS));

    const stepSize = Math.max(scroller.clientHeight * 0.8, 200);
    let scrollPos = 0;

    while (true) {
        const btn = document.querySelector('.final-autolingo-skill');
        if (btn) return btn;

        if (scrollPos >= scroller.scrollHeight) return null;

        scrollPos += stepSize;
        scroller.scrollTop = scrollPos;
        await new Promise(r => setTimeout(r, SCROLL_STEP_WAIT_MS));
    }
};

let isSearchingLegendary = false;

const auto_grind_tick = () => {
    if (isGrindingLesson || isSearchingLegendary) return;
    if (!on_learn_page()) return;

    // Legendary mode: only ever start legendary practice, never the normal
    // lesson. Autolingo only renders ".final-autolingo-skill" on skills that
    // are crown-maxed and haven't had their legendary completed yet (once
    // done, level.state flips from "passed" to "legendary" and the button
    // stops being rendered), so the first one found (searching from the top
    // of the path) is always eligible.
    if (isLegendaryGrindDesired) {
        isSearchingLegendary = true;
        find_first_legendary_by_scrolling().then(legendaryBtn => {
            isSearchingLegendary = false;

            // Auto Grind or legendary mode may have been turned off while
            // the scroll search was still running -- don't act on a stale
            // request.
            if (!isAutomationEnabled || !isAutoGrindDesired || !isLegendaryGrindDesired) return;

            if (!legendaryBtn) {
                if (!legendaryNotFoundLogged) {
                    window.log?.("Auto-grind: legendary mode on, but no available legendary found");
                    legendaryNotFoundLogged = true;
                }
                return;
            }
            legendaryNotFoundLogged = false;
            isGrindingLesson = true;
            window.log?.("Auto-grind: starting the first available legendary lesson");
            legendaryBtn.click();
            run_lesson_closer();
        });
        return;
    }

    const chestBtn = find_open_chest_button();
    if (chestBtn) {
        isGrindingLesson = true;
        window.log?.("Auto-grind: opening a reward chest");
        chestBtn.click();
        run_lesson_closer();
        return;
    }

    const btn = find_current_lesson_start_button();
    if (!btn) return;

    isGrindingLesson = true;
    window.log?.("Auto-grind: starting the current lesson automatically");
    btn.click();
    run_lesson_closer();
};

const start_auto_grind = () => {
    if (autoGrindInterval) return;
    window.log?.("Auto-grind: enabled");
    autoGrindInterval = setInterval(auto_grind_tick, AUTO_GRIND_POLL_MS);
    auto_grind_tick();
};

const stop_auto_grind = () => {
    stop_lesson_closer();
    if (!autoGrindInterval) return;
    window.log?.("Auto-grind: disabled");
    clearInterval(autoGrindInterval);
    autoGrindInterval = null;
};

const sync_auto_grind = () => {
    const shouldRun = isAutomationEnabled && isAutoGrindDesired;
    if (shouldRun) {
        start_auto_grind();
    } else {
        stop_auto_grind();
    }
};

// inject stylesheet, buttons, etc.
const inject = (extension_id) => {
    the_extension_id = extension_id;
    // inject stylesheet
    let stylesheet = document.createElement("LINK");
    stylesheet.setAttribute("rel", "stylesheet")
    stylesheet.setAttribute("type", "text/css")
    stylesheet.setAttribute("href", `${the_extension_id}/content_scripts/main.css`)
    document.body.appendChild(stylesheet)
    stylesheet.onload = () => {
        stylesheet_loaded = true;
    }
}

const inject_autolingo = () => {
    if (!isAutomationEnabled) return;
    if (!the_extension_id || !tier_img_url || !legendary_img_url) return;
    
    remove_autolingo();
    
    // Clear any pending injection interval
    if (pendingInjectionInterval) {
        clearInterval(pendingInjectionInterval);
        pendingInjectionInterval = null;
    }
    
    pendingInjectionInterval = setInterval(() => {
        if (stylesheet_loaded && the_extension_id && tier_img_url && legendary_img_url) {
            const targetNode = document.querySelector('[data-test="skill-path"]');
            if (!targetNode) return;

            clearInterval(pendingInjectionInterval);
            pendingInjectionInterval = null;

            function processSkillNode(skillNode) {
                const skillNodes = [...skillNode?.querySelector("div")?.children || []];
                
                skillNodes.forEach(skill_node => {
                    const skill_metadata = window.ru.ReactFiber(skill_node)?.child?.memoizedProps?.level;
                    if (!skill_metadata) return;

                    const unlocked = skill_metadata.state !== "locked";
                    const legendary_level_unlocked = skill_metadata.state === "passed";
                    const shouldShowStartButton = (
                        skill_metadata.type === "story"
                        || !legendary_level_unlocked
                        || (legendary_level_unlocked && skill_metadata.hasLevelReview)
                    );
                    const shouldShowLegendaryButton = legendary_level_unlocked;
                    const desiredButtonState = !unlocked || skill_metadata.type === "chest"
                        ? "hidden"
                        : `${shouldShowStartButton ? "start" : ""}${shouldShowStartButton && shouldShowLegendaryButton ? "+" : ""}${shouldShowLegendaryButton ? "legendary" : ""}`;
                    const existingContainer = skill_node.querySelector(".start-autolingo-skill-container");

                    if (desiredButtonState === "hidden") {
                        existingContainer?.remove();
                        return;
                    }

                    if (existingContainer?.dataset.buttonState === desiredButtonState) {
                        return;
                    }

                    existingContainer?.remove();

                    if (unlocked && skill_metadata.type !== "chest") {
                        let autolingo_skill_container = document.createElement("DIV");
                        autolingo_skill_container.className = "start-autolingo-skill-container";
                        autolingo_skill_container.dataset.buttonState = desiredButtonState;
                        
                        skill_node.appendChild(autolingo_skill_container);

                        const lessonType = skill_metadata.type === "story" ? "story" : "lesson";

                        if (shouldShowStartButton) {
                            let start_autolingo_skill_tooltip = document.createElement("DIV");
                            start_autolingo_skill_tooltip.className = "tooltip";

                            let start_autolingo_skill = document.createElement("IMG");
                            start_autolingo_skill.src = tier_img_url
                            start_autolingo_skill.className = "start-autolingo-skill";
    
                            start_autolingo_skill.onclick = () => {
                                let ds = new DuolingoSkill(skill_node, lessonType);
                                ds.start('[data-test*="skill-path-state"]', false);
                            };
    
                            let start_autolingo_tooltip_text = document.createElement("SPAN");
                            start_autolingo_tooltip_text.innerHTML = `Autocomplete <strong>${skill_metadata.type}</strong> with AutoLingo.`;
                            start_autolingo_tooltip_text.className = "tooltip-text";
    
                            start_autolingo_skill_tooltip.appendChild(start_autolingo_tooltip_text);
                            start_autolingo_skill_tooltip.appendChild(start_autolingo_skill);
                            autolingo_skill_container.appendChild(start_autolingo_skill_tooltip);
                        }

                        if (shouldShowLegendaryButton) {
                            let final_autolingo_skill_tooltip = document.createElement("DIV");
                            final_autolingo_skill_tooltip.className = "tooltip";
    
                            // append a lil button to each skill
                            // when clicked, this button starts an auto-lesson
                            let final_autolingo_skill = document.createElement("IMG");
                            final_autolingo_skill.src = legendary_img_url;
                            final_autolingo_skill.className = "final-autolingo-skill";
    
                            // on click, final the lesson and let the extension know it's time to autocomplete
                            final_autolingo_skill.onclick = () => {
                                let ds = new DuolingoSkill(skill_node, lessonType);
                                ds.start('[data-test="legendary-node-button"]', true);                            
                            }
    
                            // show tooltip when hovering over the auto-lesson buttons
                            let final_autolingo_tooltip_text = document.createElement("SPAN");
                            final_autolingo_tooltip_text.innerHTML = `Autocomplete <strong>legendary ${skill_metadata.type}</strong> with AutoLingo.`;
                            final_autolingo_tooltip_text.className = "tooltip-text";
    
                            // append nodes to eachother
                            final_autolingo_skill_tooltip.appendChild(final_autolingo_tooltip_text);
                            final_autolingo_skill_tooltip.appendChild(final_autolingo_skill);
                            autolingo_skill_container.appendChild(final_autolingo_skill_tooltip);
                        }
                    }
                });
            }

            // iterate over all skills
            Array.from(targetNode.querySelectorAll('[data-test*="skill-path-unit"]')).forEach(e => {
                processSkillNode(e);
            });

            // start observing the target node for configured mutations
            const processAffectedSkillUnits = (node) => {
                if (!(node instanceof Element)) return;

                const skillPathUnit = node.matches('[data-test*="skill-path-unit"]')
                    ? node
                    : node.closest('[data-test*="skill-path-unit"]');
                if (skillPathUnit) {
                    processSkillNode(skillPathUnit);
                }

                node.querySelectorAll?.('[data-test*="skill-path-unit"]').forEach(processSkillNode);
            };

            currentObserver = new MutationObserver((mutationsList) => {
                for (const mutation of mutationsList) {
                    if (mutation.type === 'childList') {
                        mutation.addedNodes.forEach(node => {
                            processAffectedSkillUnits(node);
                        });
                    }
                }
            });

            const config = { childList: true, subtree: true };
            currentObserver.observe(targetNode, config);
            
            isAutolingoInjected = true;
        }
    }, 100)
}

const remove_autolingo = () => {
    // Disconnect any existing observer
    if (currentObserver) {
        currentObserver.disconnect();
        currentObserver = null;
    }
    
    // Clear any pending injection interval
    if (pendingInjectionInterval) {
        clearInterval(pendingInjectionInterval);
        pendingInjectionInterval = null;
    }
    
    // Remove all autolingo elements from the page
    document.querySelectorAll('.start-autolingo-skill-container').forEach(el => {
        el.remove();
    });
    isAutolingoInjected = false;
}

document.addEventListener("extension_id", e => {
    const extension_id = `chrome-extension://${e.detail.data}`;
    inject(extension_id);
});

document.addEventListener("set_icon_assets", e => {
    tier_img_url = e.detail.data.tierIconUrl;
    legendary_img_url = e.detail.data.legendaryIconUrl;

    if (isAutomationEnabled) {
        inject_autolingo();
    }
});

document.addEventListener("set_initial_state", e => {
    const { isEnabled, isAutoGrindEnabled, isLegendaryGrindEnabled, delay } = e.detail.data;
    window.log("Initial state received:", { isEnabled, isAutoGrindEnabled, isLegendaryGrindEnabled, delay });

    isAutomationEnabled = Boolean(isEnabled);
    isAutoGrindDesired = Boolean(isAutoGrindEnabled);
    isLegendaryGrindDesired = Boolean(isLegendaryGrindEnabled);
    window.autolingo_delay = delay;

    if (isAutomationEnabled) {
        inject_autolingo();
    }
    sync_auto_grind();
});

document.addEventListener("enable_automation", () => {
    window.log("Enabling automation");
    isAutomationEnabled = true;
    if (!isAutolingoInjected) {
        inject_autolingo();
    }
    sync_auto_grind();
});

document.addEventListener("disable_automation", () => {
    window.log("Disabling automation");
    isAutomationEnabled = false;
    if (isAutolingoInjected) {
        remove_autolingo();
    }
    sync_auto_grind();
});

document.addEventListener("enable_auto_grind", () => {
    isAutoGrindDesired = true;
    sync_auto_grind();
});

document.addEventListener("disable_auto_grind", () => {
    isAutoGrindDesired = false;
    sync_auto_grind();
});

// Legendary is a mode flag read by auto_grind_tick, not a separate loop --
// it doesn't need its own start/stop, just to change what the next tick
// looks for.
document.addEventListener("enable_legendary_grind", () => {
    isLegendaryGrindDesired = true;
    legendaryNotFoundLogged = false;
});

document.addEventListener("disable_legendary_grind", () => {
    isLegendaryGrindDesired = false;
});

window.dispatchEvent(
    new CustomEvent("get_extension_id", { detail: null })
);

document.addEventListener("set_delay", (e) => {
    window.autolingo_delay = e.detail.data;
});

