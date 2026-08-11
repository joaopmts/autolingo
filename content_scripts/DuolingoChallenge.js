// Autolingo -- maintained by joaomtsplay@gmail.com

function executeWithDelay(functionToApply, list, delayMs) {
    return new Promise((resolve) => {
        list.forEach((item, index) => {
            setTimeout(() => {
                functionToApply(item);
                if (index === list.length - 1) resolve();
            }, index * delayMs);
        });
    });
}

export default class DuolingoChallenge {
    constructor() {
        window.autolingo = this;

        // get the react internals for the current lesson
        autolingo.challenge_internals = autolingo?.get_challenge_internals();

        // make sure the keyboard is enabled so we can paste in the input box
        if (
            autolingo?.challenge_internals?.challengeToggleState?.canToggleTyping &&
            !autolingo?.challenge_internals?.challengeToggleState?.isToggledToTyping
        ) {
            autolingo.enable_keyboard()
        }

        // get the react internals for the current challenge
        autolingo.challenge_node = autolingo?.challenge_internals?.challenge
        autolingo.skill_node = autolingo?.challenge_internals?.skill;

        if (autolingo?.challenge_node) {
            autolingo.source_language = autolingo?.challenge_node?.sourceLanguage;
            autolingo.target_language = autolingo?.challenge_node?.targetLanguage;

            autolingo.challenge_type = autolingo?.challenge_node?.type;
            autolingo.challenge_id = autolingo?.challenge_node?.id;

            autolingo.click_next_count = 0;
            autolingo.active_click_next = undefined;
        }
    }

    enable_keyboard () {
        document.querySelector('[data-test="player-toggle-keyboard"]')?.click()
    }

    get_challenge_internals = () => {
        const challenge_elem = window.ru.ReactFiber(document.querySelector('[data-test="challenge-header"]'));
        if (challenge_elem) {
            return challenge_elem?.memoizedProps?.children?.props;
        }
    };

    async solve () {
        window.log(`solving! ${autolingo.challenge_type}`)
        if (!autolingo.challenge_internals) { return; }
        window.autolingo.solving = true

        switch (autolingo?.challenge_type) {
            case "characterMatch":
                await autolingo.solve_character_match();
                break;
            case "translate":
                await autolingo.solve_translate();
                break;
            case "assist": // comment dit-on « baba »
            case "form": // fill in the blank
                await autolingo.solve_form();
                break;
            case "characterSelect":
                await autolingo.solve_character_select();
                break;
            // mark the correct meaning
            case "judge":
                await autolingo.solve_judge();
                break;
            // what do you hear?
            case "selectTranscription":
                await autolingo.solve_select_transcription();
                break;
            // what sound does this make?
            case "characterIntro":
                await autolingo.solve_select_transcription();
                break;
            // which one of these is "_____"?
            case "select":
                await autolingo.solve_select();
                break;
            // what do you hear?
            case "selectPronunciation":
                await autolingo.solve_select_transcription();
                break;
            case "listen":
            case "listenTap":
                await autolingo.solve_listen_tap();
                break;
            case "name":
                await autolingo.solve_name();
                break;
            case "gapFill":
                await autolingo.solve_form();
                break;
            // fill in the blanks (in the table)
            case "tapCompleteTable":
                await autolingo.solve_tap_complete_table();
                break;
            case "typeCompleteTable":
                await autolingo.solve_type_complete_table();
                break;
            case "typeCloze":
            case "typeClozeTable":
                await autolingo.solve_type_complete_table();
                break;
            case "tapClozeTable":
                await autolingo.solve_tap_cloze_table();
                break;
            case "tapCloze":
                await autolingo.solve_tap_cloze();
                break;
            case "tapComplete":
                await autolingo.solve_tap_compelete();
                break;
            // read and respond
            case "readComprehension":
                await autolingo.solve_form();
                break;
            case "listenComprehension":
                await autolingo.solve_select_transcription();
                break;
            // complete the chat
            case "dialogue":
                autolingo.click_next();
                autolingo.click_next();
                await autolingo.solve_select_transcription();
                break;
            // speak this sentence
            case "speak":
                await autolingo.skip_speak();
                break;
            case "listenMatch":
                await autolingo.solve_pairs();
                break;
            case "match":
                await autolingo.solve_match();
                break;
            case "definition":
            case "listenIsolation":
                await autolingo.solve_definition();
                break;
            case "completeReverseTranslation":
                await autolingo.solve_reverse_translate(); // new
                break;
            case "partialReverseTranslate":
                await autolingo.solve_partialReverseTranslate();
                break;
            case "listenComplete":
                await autolingo.solve_complete_reverse_translation();
                break;
            default:
                console.log(`AUTOLINGO - UNKNOWN CHALLENGE TYPE: ${autolingo.challenge_type}`);
            }
    }

    

    async solve_partialReverseTranslate () {
        const textToFill = autolingo.challenge_node.displayTokens.filter(token => token.isBlank).map(token => token.text).join('');
        const challenge_translate_input = document.querySelector('[contenteditable="true"]')
        window.ru.ReactFiber(challenge_translate_input)?.pendingProps?.onInput({currentTarget: {innerText: textToFill}})
    }

    skip_speak () {
        document.querySelector("[data-test='player-skip']")?.click()
    }

    insert_translation = (translation) => {
        let challenge_translate_input = document.querySelector("[data-test='challenge-translate-input']");
        window.ru.ReactFiber(challenge_translate_input)?.pendingProps?.onChange({target: {value: translation}})
    }

    async solve_definition () {
        let correct_index = autolingo.challenge_node.correctIndex;
        autolingo.choose_index("[data-test='challenge-judge-text']", correct_index);
    }

    async solve_reverse_translate () {
        let translation = autolingo.challenge_node.challengeResponseTrackingProperties.best_solution
        autolingo.insert_translation(translation);
    }

    // target to source AND source to target translations
    async solve_translate() {
        if (autolingo.get_challenge_internals().challengeToggleState.isToggledToTyping) {
            let translation = autolingo.challenge_node.correctSolutions[0];
            autolingo.insert_translation(translation);
        } else {
            let correct_tokens = autolingo.challenge_node.correctTokens;

            // get the nodes for all the options
            let tap_token_nodes = document.querySelectorAll(
                "[data-test='challenge-tap-token-text']"
            );

            // build a map from the text content to the node
            // handling duplicate tokens
            let tap_tokens = {};
            Array.from(tap_token_nodes).forEach((tap_token_node) => {
                let content = tap_token_node.childNodes[0].textContent;
                if (!tap_tokens[content]) {
                    tap_tokens[content] = [];
                }
                tap_tokens[content].push(tap_token_node);
            });

            // click the correct tokens
            await executeWithDelay((token, index) => {
                if (tap_tokens[token] && tap_tokens[token].length > 0) {
                    // Click the first available node for this token
                    let node = tap_tokens[token].shift();
                    node.click();
                }
            }, correct_tokens, window.autolingo_delay);
        }
    };


    async solve_listen_tap () {
        let translation = autolingo.challenge_node.prompt;
        autolingo.insert_translation(translation);
    }

    async solve_name () {
        const answer = autolingo.challenge_node.correctSolutions[0];
        
        const articles = autolingo.challenge_node.articles;
        let answer_text;

        // if there are articles, find which article is the right one
        // and click it and remove it from the answer
        if (articles) {
            const correct_article = articles.find(article => {
                return answer.startsWith(article);
            });

            // select the correct article
            Array.from(document.querySelectorAll("[data-test='challenge-judge-text']")).find(e => {
                return e.innerHTML === correct_article;
            })?.click();

            // get the answer without the article and enter it
            answer_text = answer.replace(correct_article, "");
        }
        // if there are no articles, just write the text
        else {
            answer_text = answer;
        }

        let challenge_translate_input = document.querySelector("[data-test='challenge-text-input']");
        window.ru.ReactFiber(challenge_translate_input)?.return?.stateNode?.props?.onChange({"target": {"value": answer_text}});
    }

    async solve_tap_complete_table () {
        const tokens = autolingo.challenge_node.displayTableTokens;

        // get the nodes for all the options
        const tap_token_nodes = document.querySelectorAll("[data-test='challenge-tap-token-text']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node.childNodes[0].textContent;
            tap_tokens[content] = tap_token_node;
        });

        // for each cell in the table, see if there is a matching choice for the right answer
        // if there is, then click on that choice
        // this will ensure that we've clicked the answers in the right order
        tokens.forEach(row => {
            row.forEach(cell => {
                cell = cell[0];
                if (cell.isBlank) {
                    const matching_choice = tap_tokens[cell.text];
                    if (matching_choice) {
                        matching_choice?.click();
                    }
                }
            });
        });
    }

    async solve_type_complete_table () {
        const blank_inputs = document.querySelectorAll("input[type=text]");
        blank_inputs.forEach(input => {
            const fiber = window.ru.ReactFiber(input);
            const answer_token = fiber?.return?.return?.return?.return?.pendingProps;
            const answer = answer_token?.fullText?.substring(answer_token?.damageStart);
            fiber?.pendingProps?.onChange({"target": {"value": answer}});
        });
    }

    async solve_tap_cloze_table () {
        const tokens = autolingo.challenge_node?.displayTableTokens;

        // get the nodes for all the options
        const tap_token_nodes = document.querySelectorAll("[data-test='challenge-tap-token-text']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node?.childNodes[0]?.textContent;
            tap_tokens[content] = tap_token_node;
        });

        // for each cell in the table, see if there is a matching choice for the right answer
        // if there is, then click on that choice
        // this will ensure that we've clicked the answers in the right order
        tokens.forEach(row => {
            row.forEach(cell => {
                cell = cell[0];                
                if (cell.damageStart !== undefined) {
                    const answer = cell.text.substring(cell.damageStart);
                    const matching_choice = tap_tokens[answer];
                    if (matching_choice) {
                        matching_choice?.click();
                    }
                }
            });
        });
    }

    // matching pairs
    async solve_character_match () {
        let pairs = autolingo.challenge_node.pairs;

        // get the nodes for all the options
        let tap_token_nodes = document.querySelectorAll("[data-test='challenge-tap-token-text']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node.childNodes[0].textContent;
            tap_tokens[content] = tap_token_node;
        })

        // for each pair, click both tokens
        pairs.forEach(pair => {
            tap_tokens[pair.character]?.click();
            tap_tokens[pair.transliteration]?.click();
        })
    }

    async solve_pairs () {
        const nodes = document.querySelectorAll('[data-test*="-challenge-tap-token"]');

        // Group nodes by the base part of their data-test attribute
        const groupedNodes = {};
        nodes.forEach(node => {
            const dataTestKey = node.getAttribute('data-test');
            if (!groupedNodes[dataTestKey]) {
                groupedNodes[dataTestKey] = [];
            }
            groupedNodes[dataTestKey].push(node);
        });
        
        await executeWithDelay((pair) => {
            pair?.[0]?.click()
            pair?.[1]?.click()
        }, Object.values(groupedNodes), window.autolingo_delay)
    }

    // matching pairs
    async solve_match () {
        let pairs = autolingo.challenge_node.pairs;

        // get the nodes for all the options
        let tap_token_nodes = document.querySelectorAll("[data-test='challenge-tap-token-text']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node.childNodes[0].textContent;
            tap_tokens[content] = tap_token_node;
        })

        // for each pair, click both tokens
        pairs.forEach(pair => {
            tap_tokens[pair.learningToken]?.click();
            tap_tokens[pair.fromToken]?.click();
        })
    }

    async solve_form () {
        let correct_index = autolingo.challenge_node.correctIndex;
        autolingo.choose_index("[data-test='challenge-choice']", correct_index);
    }
    
    async solve_character_select () {
        let correct_index = autolingo.challenge_node.correctIndex;
        autolingo.choose_index("[data-test='challenge-choice-card']", correct_index);
    }

    async solve_judge () {
        let correct_index = autolingo.challenge_node.correctIndices[0];
        autolingo.choose_index("[data-test='challenge-judge-text']", correct_index);
    }

    async solve_select_transcription () {
        let correct_index = autolingo.challenge_node.correctIndex;
        autolingo.choose_index("[data-test='challenge-judge-text']", correct_index);
    }

    async solve_select () {
        let correct_index = autolingo.challenge_node.correctIndex;
        autolingo.choose_index("[data-test*='challenge-choice']", correct_index);
    }

    async solve_complete_reverse_translation () {
        let challenge_translate_inputs = Array.from(document.querySelectorAll("[data-test='challenge-text-input']"));

        autolingo.challenge_node.displayTokens.forEach(token => {
            if (token.isBlank) {
                const answer = token.text;
                const challenge_translate_input = challenge_translate_inputs.shift();
                window.ru.ReactFiber(challenge_translate_input)?.return?.stateNode?.props?.onChange({"target": {"value": answer}});
            }
        });
    }

    async solve_tap_cloze () {
        // get the nodes for all the options
        const tap_token_nodes = document.querySelectorAll("[data-test='challenge-tap-token-text']");

        // build a map from the text content to the node
        let tap_tokens = {};
        Array.from(tap_token_nodes).forEach(tap_token_node => {
            let content = tap_token_node.childNodes[0].textContent;
            tap_tokens[content] = tap_token_node;
        });

        // for each token
        autolingo.challenge_node.displayTokens.forEach(answer_token => {
            // if it requires an answer
            if (answer_token.damageStart !== undefined) {
                // get the text for the answer
                let answer = answer_token.text.substring(answer_token.damageStart);

                // and click the right tap token
                tap_tokens[answer]?.click();
            };
        });
    }

    async solve_tap_compelete () {
        await autolingo.choose_indices(
            "[data-test='challenge-tap-token-text']",
            autolingo.challenge_node.correctIndices,
            document.querySelector('[data-test="word-bank"]')
        );
    }

    async choose_indices (query_selector, correctIndices, element_to_select_from=null) {
        if (element_to_select_from === null) {
            element_to_select_from = document
        }

        let choices = element_to_select_from.querySelectorAll(query_selector);

        await executeWithDelay(correct_index => {
            if (correct_index >= choices.length) {
                correct_index = choices.length - 1;
            }
    
            choices[correct_index]?.click();
        }, correctIndices, window.autolingo_delay);
    }

    choose_index = (query_selector, correct_index, element_to_select_from=null) => {
        if (element_to_select_from === null) {
            element_to_select_from = document
        }

        let choices = element_to_select_from.querySelectorAll(query_selector);
        if (correct_index >= choices.length) {
            correct_index = choices.length - 1;
        }

        choices[correct_index]?.click();
    }

    click_next = () => {
        // increase the count
        autolingo.click_next_count = (autolingo.click_next_count || 0) + 1;

        // if we're not handling a click-next, handle this one!
        if (!autolingo.active_click_next) {
            if (autolingo.click_next_interval) {
                clearInterval(autolingo.click_next_interval);
            }

            autolingo.set_click_next_interval();
            autolingo.active_click_next = true;
        }
    }

    set_click_next_interval = () => {
        // keep trying to click the 'next' button until something happens
        autolingo.click_next_interval = setInterval(() => {
            let player_next_button = (
                document.querySelector("[data-test='player-next']") ||
                document.querySelector('[data-test="cta-button"]') ||
                document.querySelector('[data-test="continue-final-level"]') ||
                document.querySelector('[data-test="legendary-session-end-continue"]')
            )

            if (!player_next_button) {
                player_next_button = Array.from(document.querySelectorAll("button, [role='button']"))
                    .find(element => element.textContent?.trim().toLowerCase() === "continue");
            }

            // if we can click the button...
            if (
                player_next_button &&
                !player_next_button.disabled &&
                player_next_button.getAttribute("aria-disabled") !== "true" &&
                autolingo.click_next_count > 0
            ) {

                // click it! and decrease the count
                player_next_button?.click();
                autolingo.click_next_count--;

                // stop checking to click for THIS button
                clearInterval(autolingo.click_next_interval);

                // if we have more to click, start the next one!
                if (autolingo.click_next_count > 0) {
                    autolingo.active_click_next = true;
                    autolingo.set_click_next_interval();
                } else {
                    autolingo.active_click_next = false;
                }
            }
        }, window.autolingo_delay)
    }

    // clean-up: end the active intervals
    end () {
        if (autolingo.click_next_interval) {
            clearInterval(autolingo.click_next_interval);
        }
    }
}
