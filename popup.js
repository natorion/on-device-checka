document.addEventListener('DOMContentLoaded', async () => {
    const apiList = document.getElementById('api-list');

    // Tabs Logic
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            tab.classList.add('active');
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });

    const apis = [
        {
            name: 'Language Model (Gemini Nano)',
            key: 'LanguageModel',
            docs: 'https://developer.chrome.com/docs/ai/prompt-api'
        },
        {
            name: 'Translator',
            key: 'Translator',
            checkArgs: { sourceLanguage: 'en', targetLanguage: 'es' }
        },
        {
            name: 'Language Detector',
            key: 'LanguageDetector'
        },
        {
            name: 'Summarizer',
            key: 'Summarizer'
        },
        {
            name: 'Writer',
            key: 'Writer'
        },
        {
            name: 'Rewriter',
            key: 'Rewriter'
        }
    ];

    let isGeminiAvailable = false;

    function getApiNamespace() {
        if (window.ai) return window.ai;
        if (window.model) return window.model; // Very old
        return null;
    }

    function getApiObject(apiDef) {
        // If namespace is explicit 'ai', try that first
        if (apiDef.namespace === 'ai') {
            if (window.ai && window.ai[apiDef.key]) {
                return { api: window.ai[apiDef.key], path: `window.ai.${apiDef.key}` };
            }
        }

        // Try top-level window property (for Translator, LanguageDetector, etc.)
        if (window[apiDef.key]) {
            return { api: window[apiDef.key], path: `window.${apiDef.key}` };
        }

        // Fallback checks
        if (apiDef.fallback && window[apiDef.fallback]) {
            return { api: window[apiDef.fallback], path: `window.${apiDef.fallback}` };
        }

        return { api: null, path: '' };
    }

    async function checkAvailability(apiObject, args) {
        if (!apiObject) return 'unavailable';
        try {
            if (typeof apiObject.availability === 'function') {
                let status;
                // If we have specific args, try those first
                if (args) {
                    try {
                        status = await apiObject.availability(args);
                    } catch (e) {
                        console.warn('Availability check with args failed, trying no-args', e);
                    }
                }

                // If still undefined (no args or args failed), try no-args
                if (status === undefined) {
                    try {
                        status = await apiObject.availability();
                    } catch (e) {
                        console.warn('Availability check without args failed', e);
                        if (args) return 'error';
                    }
                }

                if (status === undefined) return 'error';

                if (typeof status === 'object') {
                    if (status.available) return status.available;
                    return 'available_object';
                }
                return status;
            }
            return 'available_unknown_methods';
        } catch (e) {
            console.error('Error checking availability:', e);
            return 'error';
        }
    }

    async function renderApiItem(apiDef) {
        const card = document.createElement('div');
        card.className = 'api-card';

        const { api: apiObject, path } = getApiObject(apiDef);
        const status = await checkAvailability(apiObject, apiDef.checkArgs);

        // Check for Gemini Nano specifically to enable Mad Libs
        if (apiDef.key === 'LanguageModel') {
            if (status === 'readily' || status === 'available') { // 'available' is sometimes returned by polyfills or future versions
                isGeminiAvailable = true;
            }
        }

        // Header
        const header = document.createElement('div');
        header.className = 'api-header';

        const name = document.createElement('div');
        name.className = 'api-name';
        name.textContent = apiDef.name;

        const badge = document.createElement('div');
        badge.className = `status-badge ${status}`;
        badge.textContent = status;

        header.appendChild(name);
        header.appendChild(badge);
        card.appendChild(header);

        // Details
        const details = document.createElement('div');
        details.className = 'api-details';
        details.textContent = path || 'Not found';
        card.appendChild(details);

        // Download Action
        if (status === 'after-download' || status === 'downloadable') {
            const actions = document.createElement('div');
            actions.className = 'actions';

            const btn = document.createElement('button');
            btn.className = 'download-btn';
            btn.textContent = 'Download Model';

            const progressContainer = document.createElement('div');
            progressContainer.className = 'progress-container';
            const progressBar = document.createElement('div');
            progressBar.className = 'progress-bar';
            progressContainer.appendChild(progressBar);

            const errorMsg = document.createElement('div');
            errorMsg.className = 'error-msg';

            btn.onclick = async () => {
                btn.disabled = true;
                progressContainer.classList.add('active');
                errorMsg.style.display = 'none';

                try {
                    let session;
                    const monitor = (m) => {
                        m.addEventListener('downloadprogress', (e) => {
                            const percent = (e.loaded / e.total) * 100;
                            progressBar.style.width = `${percent}%`;
                            btn.textContent = `Downloading ${Math.round(percent)}%...`;
                        });
                    };

                    const createArgs = apiDef.checkArgs ? { ...apiDef.checkArgs, monitor } : { monitor };

                    if (apiObject.create) {
                        session = await apiObject.create(createArgs);
                    } else {
                        throw new Error("Create method not found");
                    }

                    btn.textContent = 'Downloaded!';
                    btn.onclick = null;
                    badge.className = 'status-badge readily';
                    badge.textContent = 'readily';

                    // If this was Gemini Nano, enable Mad Libs!
                    if (apiDef.key === 'LanguageModel') {
                        isGeminiAvailable = true;
                        initMadLibs();
                    }

                    setTimeout(() => {
                        if (session && typeof session.destroy === 'function') session.destroy();
                    }, 1000);

                } catch (err) {
                    console.error("Download failed", err);
                    errorMsg.textContent = "Download failed: " + err.message;
                    errorMsg.style.display = 'block';
                    btn.textContent = 'Retry Download';
                    btn.disabled = false;
                }
            };

            actions.appendChild(btn);
            card.appendChild(actions);
            card.appendChild(progressContainer);
            card.appendChild(errorMsg);
        }

        apiList.appendChild(card);
    }

    if (!window.ai && !window.translation) {
        console.warn("window.ai not found");
    }

    // Render the API list
    for (const api of apis) {
        await renderApiItem(api);
    }

    // Initialize Mad Libs Logic
    initMadLibs();

    function initMadLibs() {
        const unavailableMsg = document.getElementById('mad-libs-unavailable-msg');
        const madLibsContent = document.getElementById('mad-libs-content');

        if (isGeminiAvailable) {
            unavailableMsg.classList.add('hidden');
            madLibsContent.classList.remove('hidden');
        } else {
            unavailableMsg.classList.remove('hidden');
            madLibsContent.classList.add('hidden');
        }
    }

    // Mad Libs Core Logic
    const scanBtn = document.getElementById('scan-btn');
    const replaceBtn = document.getElementById('replace-btn');
    const loadingDiv = document.getElementById('scan-loading');
    const wordsForm = document.getElementById('words-form');

    let currentWordsMap = null; // Store the identified words

    scanBtn.addEventListener('click', async () => {
        // Reset state
        scanBtn.disabled = true;
        replaceBtn.classList.add('hidden');
        wordsForm.classList.add('hidden');
        wordsForm.innerHTML = '';
        loadingDiv.classList.remove('hidden');

        try {
            // 1. Get Text from Page
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            if (!tab || (!tab.url.startsWith('http') && !tab.url.startsWith('file'))) {
                throw new Error("Cannot run on this page.");
            }

            const injectionResults = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => document.body.innerText.substring(0, 3000) // First 3000 chars should be enough for context
            });

            const pageText = injectionResults[0].result;

            // 2. Prompt Gemini Nano
            const { api: languageModel } = getApiObject({ key: 'LanguageModel', namespace: 'ai' });
            if (!languageModel) throw new Error("Language Model API not found.");

            const session = await languageModel.create();

            const prompt = `
            Task: Identify a few nouns, verbs, and adjectives from the text below.
            Output JSON only with format:
            {
              "nouns": ["noun1", "noun2"],
              "verbs": ["verb1", "verb2"],
              "adjectives": ["adj1", "adj2"]
            }
            Find at most 3 of each category if possible.
            Text:
            ${pageText}
            `;

            const result = await session.prompt(prompt);
            console.log("Model Output:", result);

            // 3. Parse JSON
            let jsonStr = result.trim();
            // Remove markdown if present
            if (jsonStr.startsWith('```')) {
                jsonStr = jsonStr.replace(/^```(json)?/, '').replace(/```$/, '');
            }

            let parsed;
            try {
                parsed = JSON.parse(jsonStr);
            } catch (e) {
                // simple retry logic or fallback?
                // Try simpler prompt or regex?
                console.error("JSON parse failed", e);
                throw new Error("Failed to parse model output.");
            }

            currentWordsMap = parsed;

            // 4. Build UI
            renderWordsForm(parsed);

            loadingDiv.classList.add('hidden');
            wordsForm.classList.remove('hidden');
            replaceBtn.classList.remove('hidden');
            scanBtn.disabled = false;

            session.destroy();

        } catch (err) {
            console.error(err);
            loadingDiv.innerHTML = `<div style="color:red">Error: ${err.message}</div>`;
            setTimeout(() => {
                loadingDiv.classList.add('hidden');
                scanBtn.disabled = false;
                loadingDiv.innerHTML = `<div class="loading-spinner"></div><div style="margin-top: 8px;">Finding words...</div>`; // reset
            }, 3000);
        }
    });

    function renderWordsForm(wordsData) {
        // wordsData = { nouns: [...], verbs: [...], adjectives: [...] }
        const categories = ['nouns', 'verbs', 'adjectives'];

        categories.forEach(cat => {
            const words = wordsData[cat];
            if (!words || words.length === 0) return;

            words.forEach((originalWord, index) => {
                const group = document.createElement('div');
                group.className = 'input-group';

                const label = document.createElement('label');
                label.textContent = `Replace "${originalWord}" (${cat.slice(0, -1)}):`;

                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = `Enter a ${cat.slice(0, -1)}...`;
                input.dataset.original = originalWord;
                input.dataset.category = cat;

                group.appendChild(label);
                group.appendChild(input);
                wordsForm.appendChild(group);
            });
        });
    }

    replaceBtn.addEventListener('click', async () => {
        // Gather replacements
        const inputs = wordsForm.querySelectorAll('input');
        const replacements = {};

        inputs.forEach(input => {
            if (input.value.trim()) {
                replacements[input.dataset.original] = input.value.trim();
            }
        });

        if (Object.keys(replacements).length === 0) return;

        // Execute replacement script
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: (replacementsMap) => {
                // Enable designMode temporarily if needed or just replace text nodes
                // Using TreeWalker is safer than innerHTML replace
                const walker = document.createTreeWalker(
                    document.body,
                    NodeFilter.SHOW_TEXT,
                    null,
                    false
                );

                let node;
                while (node = walker.nextNode()) {
                    let text = node.nodeValue;
                    let modified = false;

                    for (const [original, replacement] of Object.entries(replacementsMap)) {
                        // Simple replaceAll for the exact word (case sensitive for simplicity initially)
                        // Using RegExp with boundary might be better: \bword\b
                        // But words from model might capture punctuation or be partial.
                        // Let's try simple global string replace first, but case insensitive?
                        // If model returns "Time", we replace "Time".

                        // Escape regex special characters to avoid crashes
                        const escapedOriginal = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                        const regex = new RegExp(escapedOriginal, 'gi');
                        if (regex.test(text)) {
                            text = text.replace(regex, replacement);
                            modified = true;
                        }
                    }

                    if (modified) {
                        node.nodeValue = text;
                    }
                }
            },
            args: [replacements]
        });

        window.close(); // Close popup after action? Or show success?
    });

});
