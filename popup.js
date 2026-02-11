document.addEventListener('DOMContentLoaded', async () => {
    const apiList = document.getElementById('api-list');

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
                        // This is expected if the API *requires* args and we didn't provide them or they failed
                        console.warn('Availability check without args failed', e);
                        // If we already tried args and failed, and now no-args failed, return error or unavailable?
                        // If the API requires args, and we provided them and it failed, it might be an error.
                        // But if we didn't provide args and it requires them, it's an error in our config.
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
        const isDownloadable = status === 'after-download' || status === 'downloadable' || status === 'readily'; // readily might mean we just want to verify? No, usually not.
        // Actually, sometimes 'readily' means it is ready, so no download needed.
        // But 'downloadable' means we can download it.
        // 'after-download' is the old string? Prompt API says 'after-download'.

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
        // Maybe just log a warning but still render list so we see "Not found"
        console.warn("window.ai not found");
    }

    for (const api of apis) {
        await renderApiItem(api);
    }
});
