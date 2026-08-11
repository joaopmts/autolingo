// Autolingo -- maintained by joaomtsplay@gmail.com

import DuolingoChallenge from "./DuolingoChallenge.js"

export default class DuolingoSkill {
    constructor (skill_node, type) {
        window.ds = this;
        this.skill_node = skill_node;
        this.type = type
    }

    start = (start_button_selector, is_final_level) => {
        this.is_final_level = is_final_level;

        this.skill_node.children[0]?.click();
        document.querySelector(start_button_selector)?.click();

        if (this.is_final_level) {
            document.querySelector('[data-test="legendary-start-button"]')?.click()
        }

        if (this.type === "lesson") {
            setTimeout(() => {
                this.state_machine = setInterval(this.complete_challenge, window.autolingo_delay);
            }, 1000)
        } else if (this.type === "story") {
            this.solve_whole_story();
        } else {
            console.error(`unknown type: ${this.type}`)
        }
    }

    end () {
        clearInterval(this.state_machine);
        this.current_challenge.end();
        window.log("Lesson complete, stopping the autocompleter!");
    }

    solve_whole_story () {
        const solveStoryInterval = setInterval(() => {
            const status_node = document.getElementsByClassName("_2neC7")[0];
            const status_node_internals = window.ru.ReactFiber(status_node);
            if (status_node_internals) {
                status_node_internals?.return?.memoizedProps?.continueStory();
                // TODO skip through story until you have a `currentChallengeSession`
                // and then solve the challenge instead of skipping it
            }
        }, window.autolingo_delay);
    }

    complete_challenge = () => {
        if (window?.autolingo?.solving) {
            return; // don't try to solve the same thing twice
        }

        // if you're on the home page, stop trying to complete the skill
        if (window.location.href.includes("duolingo.com/learn")) {
            return;
        }

        // else try to find the status and act accordingly
        const status_node = document.getElementsByClassName("_3yE3H")[0];
        if (!status_node) {
            window.log("can't find status node!");
            return;
        }
        // window.ru.ReactFiber(document.getElementsByClassName("_1RBqm")[0]).return.memoizedProps.player.status;
        // window.ru.ReactFiber(document.getElementsByClassName("_3yE3H")[0]).return.memoizedProps.player.status
        const status = window.ru.ReactFiber(status_node).return.return.memoizedProps.player.status;

        window.log(status)
        switch (status) {
            // loading this lesson
            case "LOADING":
                break;
            // lil pop-up at the beginning of practice lessons
            case "SKILL_PRACTICE_SPLASH":
            case "CHECKPOINT_TEST_SPLASH":
            case "FINAL_LEVEL_DUO":
            case "LEGENDARY_DUO":
            case "UNIT_TEST_SPLASH":
            case "CAPSTONE_REVIEW_SPLASH":
                // click START PRACTICE
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                break;
            // lil pop-up at the beginning of the practice that you start by clicking
            // the weight icon in the bottom left
            case "GLOBAL_PRACTICE_SPLASH":
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                break;
            // waiting for answer for this challenge
            case "GUESSING":
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.solve().then(() => {
                    this.current_challenge.click_next();
                    this.current_challenge.click_next();
                    window.autolingo.solving = false;
                }).catch(error => {
                    console.error(error);
                });
                break;
            // showing the question before you can actually answer it
            case "SHOWING":
                break;
            // grading this challenge
            case "BLAMING":
                break;
            case "GRADING":
                break;
            // loading next challenge
            case "SLIDING":
            case "PARTIAL_XP_DUO_SLIDING":
                break;
            // loading coach duo to give advice
            case "COACH_DUO_SLIDING":
            case "HARD_MODE_DUO_SLIDING":
                break;
            // waiting to hit CONTINUE for coach duo's advice
            // NOTE it's called "DOACH_DUO" but i think it's a typo so i put an extra case
            // here just in case they fix it
            case "COACH_DUO_SPLASH":
            case "DOACH_DUO":
            case "COACH_DUO":
            case "HARD_MODE_DUO":
            case "PARTIAL_XP_DUO":
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                break;
            // just finished the lesson, loading results
            case "COACH_DUO_SUBMITTING":
            case "SUBMITTING":
                break;
            // results are here!
            case "END_CAROUSEL":
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                this.current_challenge.click_next();
                this.current_challenge.click_next();
                break;
            // little ad that pops up
            case "PLUS_AD":
                this.current_challenge = new DuolingoChallenge();
                this.current_challenge.click_next();
                break;
            // when they give you a little info before the lesson
            case "PRE_LESSON_TIP_SPLASH":
            case "GRAMMAR_SKILL_SPLASH":
                document.querySelector("[data-test=player-next]")?.click();
                Array.from(document.querySelectorAll("span")).forEach(e => {
                    if (e.innerText.toLowerCase().includes("start lesson") || e.innerText.toLowerCase().includes("let's go")) {
                        e?.click();
                    }
                });
                break;
            default:
                console.log("UNKNOWN STATUS: " + status);
                break;
        }
    }
}