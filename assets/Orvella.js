// assets/Orvella.js
(async function () {
    "use strict";

    const SUPABASE_URL = 'https://vzqicidepdmraygulrey.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_kqRWgOmLISOE2EuLL1s8fw_WN6FJRTI';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    let state = {
        pages: [],
        recommendations: [],
        rules: {
            maxOutbound: 3,
            maxInbound: 5,
            requireSharedKeyword: false
        },
        anchorDistribution: {
            primary: 35,
            secondary: 45,
            lsi: 20
        },
        tags: []
    };

    const VALID_LANGUAGES = [
        'af - Afrikaans', 'ar - Arabic', 'az - Azerbaijani', 'be - Belarusian',
        'bg - Bulgarian', 'bn - Bengali', 'bs - Bosnian', 'ca - Catalan',
        'ceb - Cebuano', 'co - Corsican', 'cs - Czech', 'cy - Welsh',
        'da - Danish', 'de - German', 'el - Greek', 'en - English',
        'eo - Esperanto', 'es - Spanish', 'et - Estonian', 'eu - Basque',
        'fa - Persian', 'fi - Finnish', 'fr - French', 'fy - Frisian',
        'ga - Irish', 'gd - Scottish Gaelic', 'gl - Galician', 'gu - Gujarati',
        'ha - Hausa', 'haw - Hawaiian', 'he - Hebrew', 'hi - Hindi',
        'hmn - Hmong', 'hr - Croatian', 'ht - Haitian Creole', 'hu - Hungarian',
        'hy - Armenian', 'id - Indonesian', 'ig - Igbo', 'is - Icelandic',
        'it - Italian', 'ja - Japanese', 'jv - Javanese', 'ka - Georgian',
        'kk - Kazakh', 'km - Khmer', 'kn - Kannada', 'ko - Korean',
        'ku - Kurdish', 'ky - Kyrgyz', 'la - Latin', 'lb - Luxembourgish',
        'lo - Lao', 'lt - Lithuanian', 'lv - Latvian', 'mg - Malagasy',
        'mi - Maori', 'mk - Macedonian', 'ml - Malayalam', 'mn - Mongolian',
        'mr - Marathi', 'ms - Malay', 'mt - Maltese', 'my - Burmese',
        'ne - Nepali', 'nl - Dutch', 'no - Norwegian', 'ny - Chichewa',
        'or - Odia', 'pa - Punjabi', 'pl - Polish', 'ps - Pashto',
        'pt - Portuguese', 'ro - Romanian', 'ru - Russian', 'sd - Sindhi',
        'si - Sinhala', 'sk - Slovak', 'sl - Slovenian', 'sm - Samoan',
        'sn - Shona', 'so - Somali', 'sq - Albanian', 'sr - Serbian',
        'st - Sesotho', 'su - Sundanese', 'sv - Swedish', 'sw - Swahili',
        'ta - Tamil', 'te - Telugu', 'tg - Tajik', 'th - Thai',
        'tl - Filipino', 'tr - Turkish', 'ug - Uyghur', 'uk - Ukrainian',
        'ur - Urdu', 'uz - Uzbek', 'vi - Vietnamese', 'xh - Xhosa',
        'yi - Yiddish', 'yo - Yoruba', 'zh - Chinese', 'zu - Zulu'
    ];
    window.debugState = state;

    let actionStatuses = {};
    let currentUser = null;
    let currentProfile = null;
    let currentUserRole = 'public';
    let sidebarComponent = null;

    let currentStep = 1;
    const totalSteps = 3;
    let currentPriority = 3;

    let saveTimeout;
    let editingPageId = null;
    let activePagesTab = 'actual';

    // ========== UTILITY FUNCTIONS ==========
    function showGlobalLoader() {
        const loader = document.getElementById('initial-loader');
        if (loader) loader.classList.remove('hidden');
    }

    function hideGlobalLoader() {
        const loader = document.getElementById('initial-loader');
        if (loader) loader.classList.add('hidden');
    }

    function getPageById(id) { return state.pages.find(p => p.id === id); }
    function createId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
    function parseKeywords(value) {
        return value.split(/[\n,]/).map(k => k.trim()).filter(Boolean)
            .filter((k, i, arr) => arr.findIndex(x => normalizeTerm(x) === normalizeTerm(k)) === i);
    }
    function normalizeUrl(value) {
        if (!value) return '';
        return /^https?:\/\//i.test(value) ? value : (value[0] === '/' ? value : '/' + value);
    }
    function displayUrl(url) {
        if (!url) return '';
        let display = url;
        try {
            const u = new URL(url);
            display = u.pathname;
        } catch (e) {}
        if (display.length > 1 && display.endsWith('/')) display = display.slice(0, -1);
        if (!display) display = '/';
        return display;
    }
    function isValidUrlPath(value) {
        return /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value) || /^\/[^\s]*$/.test(value);
    }
    function normalizeTerm(value) {
        return String(value).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s+/g, ' ').trim();
    }
    function isValidEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }
    function validateRequiredFields() {
        const requiredFields = [
            { element: elements.pageTitle, name: 'Page title' },
            { element: elements.pageUrl, name: 'Page URL' },
            { element: elements.wordCount, name: 'Word count' },
            { element: elements.addPageLanguage, name: 'Language' }
        ];
        let isValid = true;
        requiredFields.forEach(field => {
            if (!field.element.value.trim()) {
                field.element.classList.add('field-error');
                isValid = false;
            } else {
                field.element.classList.remove('field-error');
            }
        });
        if (isValid && state.languages && state.languages.length > 0) {
            const langValue = elements.addPageLanguage.value.trim();
            if (!state.languages.includes(langValue)) {
                elements.addPageLanguage.classList.add('field-error');
                showToast('Please select a language from the defined list.');
                isValid = false;
            }
        }
        return isValid;
    }

    // ========== DOM ELEMENTS ==========
    const elements = {
        addPageModal: document.getElementById("addPageModal"),
        settingsModal: document.getElementById("settingsModal"),
        pageForm: document.getElementById("pageForm"),
        formSteps: document.querySelectorAll(".form-step"),
        addPageStepTitle: document.getElementById("addPageStepTitle"),
        addPageStepDesc: document.getElementById("addPageStepDesc"),
        prevStepButton: document.getElementById("prevStepButton"),
        nextStepButton: document.getElementById("nextStepButton"),
        pageTitle: document.getElementById("pageTitle"),
        pageUrl: document.getElementById("pageUrl"),
        tagsInput: document.getElementById("tagsInput"),
        wordCount: document.getElementById("wordCount"),
        primaryKeyword: document.getElementById("primaryKeyword"),
        secondaryKeywords: document.getElementById("secondaryKeywords"),
        lsiKeywords: document.getElementById("lsiKeywords"),
        canLinkOutToggle: document.getElementById("canLinkOutToggle"),
        canReceiveLinksToggle: document.getElementById("canReceiveLinksToggle"),
        prioritySelector: document.getElementById("prioritySelector"),
        pagePriority: document.getElementById("pagePriority"),
        settingsPrimaryPercent: document.getElementById("settingsPrimaryPercent"),
        settingsSecondaryPercent: document.getElementById("settingsSecondaryPercent"),
        settingsLsiPercent: document.getElementById("settingsLsiPercent"),
        saveDistributionButton: document.getElementById("saveDistributionButton"),
        settingsDistMessage: document.getElementById("settingsDistMessage"),
        editPageModal: document.getElementById("editPageModal"),
        editPageTitle: document.getElementById("editPageTitle"),
        editPageTitleInput: document.getElementById("editPageTitleInput"),
        editPageUrl: document.getElementById("editPageUrl"),
        editTaxonomy: document.getElementById("editTaxonomy"),
        editWordCount: document.getElementById("editWordCount"),
        editPrimaryKeyword: document.getElementById("editPrimaryKeyword"),
        editSecondaryKeywords: document.getElementById("editSecondaryKeywords"),
        editLsiKeywords: document.getElementById("editLsiKeywords"),
        editCanLinkOut: document.getElementById("editCanLinkOut"),
        editCanReceiveLinks: document.getElementById("editCanReceiveLinks"),
        editPrioritySelector: document.getElementById("editPrioritySelector"),
        editPagePriority: document.getElementById("editPagePriority"),
        saveEditPageBtn: document.getElementById("saveEditPageBtn"),
        deletePageBtn: document.getElementById("deletePageBtn"),
        confirmDeleteModal: document.getElementById("confirmDeleteModal"),
        confirmDeleteBtn: document.getElementById("confirmDeleteBtn"),
        cancelDeleteBtn: document.getElementById("cancelDeleteBtn"),
        editRecommendationsBody: document.getElementById("edit-recommendations-body"),
        newTagInput: document.getElementById("newTagInput"),
        tagsListContainer: document.getElementById("tagsListContainer"),
        pageTypeToggle: document.getElementById("pageTypeToggle"),
        pageType: document.getElementById("pageType"),
        editPageTypeToggle: document.getElementById("editPageTypeToggle"),
        editPageType: document.getElementById("editPageType"),
        newLanguageInput: document.getElementById("newLanguageInput"),
        languagesListContainer: document.getElementById("languagesListContainer"),
        editLanguage: document.getElementById("editLanguage"),
        addPageLanguage: document.getElementById("addPageLanguage"),
    };

    const stepInfo = [
        { title: "Step 1 of 3", desc: "Basic page information" },
        { title: "Step 2 of 3", desc: "Keywords" },
        { title: "Step 3 of 3", desc: "Linking permissions & importance" }
    ];

    // ========== SIDEBAR ==========
    function getSidebarComponent() {
        if (!sidebarComponent) {
            sidebarComponent = document.querySelector('sidebar-component');
            if (sidebarComponent) {
                sidebarComponent.addEventListener('login-request', () => {
                    document.getElementById('auth-email').value = '';
                    document.getElementById('auth-password-login').value = '';
                    document.getElementById('auth-password-register').value = '';
                    document.getElementById('auth-confirm-password').value = '';
                    showAuthStep('step-1');
                    openModal(document.getElementById('auth-overlay'));
                });
                sidebarComponent.addEventListener('logout-request', () => {
                    logout();
                });
            }
        }
        return sidebarComponent;
    }

    async function updateNotificationDot() {
        const comp = getSidebarComponent();
        if (!comp) return;
        let hasNotifications = false;
        if (currentUser) {
            const { data } = await supabase
                .from('notifications')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('is_read', false)
                .limit(1);
            if (data && data.length > 0) hasNotifications = true;
        }
        comp.setNotificationDot(hasNotifications);
    }

    function addSidebarButtons() {
        const sidebar = document.querySelector('sidebar-component');
        if (!sidebar || !sidebar.shadowRoot) return;
        const todayList = sidebar.shadowRoot.getElementById('sidebar-today-list');
        if (!todayList || todayList.querySelector('.sidebar-today-action')) return;

        if (!sidebar.shadowRoot.querySelector('#sidebar-custom-styles')) {
            const style = document.createElement('style');
            style.id = 'sidebar-custom-styles';
            style.textContent = `
                .sidebar-today-action { gap: 10px; }
                .sidebar-label { position: relative; top: 2px; }
            `;
            sidebar.shadowRoot.appendChild(style);
        }
        todayList.innerHTML = '';

        const addBtn = document.createElement('button');
        addBtn.className = 'sidebar-item sidebar-today-action';
        addBtn.innerHTML = `<svg class="sidebar-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> <span class="sidebar-label">Add Page</span>`;
        addBtn.addEventListener('click', (e) => { e.preventDefault(); openAddPageModal(); });

        const pagesBtn = document.createElement('button');
        pagesBtn.className = 'sidebar-item sidebar-today-action';
        pagesBtn.innerHTML = `<svg class="sidebar-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" /></svg> <span class="sidebar-label">Pages</span>`;
        pagesBtn.addEventListener('click', (e) => { e.preventDefault(); openPagesListModal(); });

        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'sidebar-item sidebar-today-action';
        settingsBtn.innerHTML = `<svg class="sidebar-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg> <span class="sidebar-label">Settings</span>`;
        settingsBtn.addEventListener('click', (e) => { e.preventDefault(); openSettings(); });

        todayList.appendChild(addBtn);
        todayList.appendChild(pagesBtn);
        todayList.appendChild(settingsBtn);
    }

    function syncSidebarComponent() {
        const comp = getSidebarComponent();
        if (!comp || typeof comp.setUser !== 'function') return;
        if (currentUser) comp.setUser(currentUser, currentProfile);
        else comp.clearUser();
        comp.setTodayList([], []);
        comp.setEvents([]);
        updateNotificationDot();
        const nav = comp.shadowRoot?.getElementById('sidebar-nav');
        if (nav) nav.style.display = 'block';
        setTimeout(addSidebarButtons, 50);
    }

    function isLoggedIn() { return !!currentUser; }
    function requireLogin(actionDescription = 'perform this action') {
        if (!isLoggedIn()) {
            alert(`Please sign in to ${actionDescription}. Use the sidebar menu.`);
            return false;
        }
        return true;
    }

    // ========== STATE PERSISTENCE ==========
    async function saveState() {
        if (!currentUser) return;
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(async () => {
            const dataToSave = { ...state, actionStatuses };
            const { error } = await supabase
                .from('orvella')
                .upsert({ id: currentUser.id, data: dataToSave, updated_at: new Date() }, { onConflict: 'id' });
            if (error) {
                console.error('Supabase save failed:', error.message);
            }
        }, 300);
    }

    async function saveStateNow() {
        if (!currentUser) return;
        const dataToSave = { ...state, actionStatuses };
        const { error } = await supabase
            .from('orvella')
            .upsert({ id: currentUser.id, data: dataToSave, updated_at: new Date() }, { onConflict: 'id' });
        if (error) {
            console.error('Supabase save failed:', error.message);
            throw error;
        }
    }

    function commitPendingLink(pageId) {
        const pageInput = document.getElementById('new-rec-page');
        const anchorInput = document.getElementById('new-rec-anchor');
        if (!pageInput || !pageInput.value.trim()) return;

        const rawUrl = pageInput.value.trim();
        const url = normalizeUrl(rawUrl);
        const anchorText = anchorInput ? anchorInput.value.trim() : '';
        const newBar = document.getElementById('new-link-type-bar');
        const linkType = newBar ? newBar.querySelector('.link-type-value').value : 'intent';

        let targetPage = state.pages.find(p => p.url.toLowerCase() === url.toLowerCase());

        if (linkType === 'observed') {
            if (!targetPage) {
                showToast('Page not found. Observed Link requires an existing Actual Page.');
                return false;
            }
            if ((targetPage.pageType || 'actual') !== 'actual') {
                showToast('Cannot create Observed Link to a Planned Page.');
                return false;
            }
        }

        if (!targetPage && linkType === 'intent') {
            targetPage = {
                id: createId(),
                title: url.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Untitled',
                url: url,
                primaryKeyword: '',
                secondaryKeywords: [],
                lsiKeywords: [],
                wordCount: 0,
                canLinkOut: true,
                canReceiveLinks: true,
                priority: 3,
                tags: [],
                pageType: 'planned'
            };
            state.pages.push(targetPage);
        }

        if (targetPage) {
            addManualRecommendation(pageId, targetPage.id, anchorText, linkType);
            return true;
        }
        return false;
    }

    async function loadState() {
        if (!currentUser) return;
        const { data, error } = await supabase
            .from('orvella')
            .select('data')
            .eq('id', currentUser.id)
            .maybeSingle();
        if (error) { console.error('Failed to load state:', error); return; }
        if (data?.data) {
            state = data.data;
            state.pages = state.pages || [];
            state.recommendations = state.recommendations || [];
            state.rules = state.rules || { maxOutbound: 3, maxInbound: 5, requireSharedKeyword: false };
            state.anchorDistribution = state.anchorDistribution || { primary: 35, secondary: 45, lsi: 20 };
            state.tags = state.tags || [];
            state.languages = state.languages || [];
            state.pages = state.pages.map(p => {
                let language = p.language || null;
                let tags = p.tags || [];
                if (!language) {
                    const langTag = tags.find(t => t.toLowerCase().startsWith('lang:'));
                    if (langTag) {
                        language = langTag.substring(5).toUpperCase();
                        tags = tags.filter(t => !t.toLowerCase().startsWith('lang:'));
                    }
                }
                return {
                    id: p.id,
                    title: p.title,
                    url: p.url,
                    primaryKeyword: p.primaryKeyword || '',
                    secondaryKeywords: p.secondaryKeywords || [],
                    lsiKeywords: p.lsiKeywords || [],
                    wordCount: p.wordCount || 0,
                    canLinkOut: p.canLinkOut !== false,
                    canReceiveLinks: p.canReceiveLinks !== false,
                    priority: p.priority || 3,
                    tags: tags,
                    pageType: p.pageType || 'actual',
                    language: language
                };
            });
            state.recommendations = state.recommendations.map(rec => ({
                ...rec,
                linkType: rec.linkType || 'observed'
            }));
            state.recommendations = state.recommendations.map(rec => ({
                ...rec,
                isAuto: rec.isAuto === undefined ? false : rec.isAuto
            }));
            actionStatuses = data.data.actionStatuses || {};
        }
    }

    // ========== AUTH FLOW ==========
    async function checkEmailExists(email) {
        const { data, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('email', email)
            .maybeSingle();
        if (error) return false;
        return !!data;
    }

    function showAuthStep(stepId) {
        document.querySelectorAll('.auth-step').forEach(s => s.classList.remove('auth-step--active'));
        document.getElementById(stepId).classList.add('auth-step--active');
    }
    function openModal(modal) { modal.style.display = 'flex'; document.body.classList.add('modal-open'); }
    function closeModal(modal) {
        modal.style.display = 'none';
        if (modal === elements.editPageModal) {
            modal.style.zIndex = '';
        }
        document.body.classList.remove('modal-open');
        if (modal === elements.editPageModal) editingPageId = null;
    }

    async function buildCurrentProfile(user) {
        const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        const md = user.user_metadata || {};
        return {
            id: user.id,
            first_name: profileRow?.first_name ?? md.first_name ?? '',
            last_name: profileRow?.last_name ?? md.last_name ?? '',
            photo_url: profileRow?.photo_url ?? md.photo_url ?? '',
            username: profileRow?.username ?? md.username ?? '',
            role: profileRow?.role ?? md.role ?? 'recruit'
        };
    }

    async function logout() {
        showGlobalLoader();
        try {
            await supabase.auth.signOut();
            currentUser = null;
            currentProfile = null;
            currentUserRole = 'public';
            syncSidebarComponent();
            state.pages = [];
            state.recommendations = [];
            renderOverviewGauges();
        } finally { hideGlobalLoader(); }
    }

    async function restoreSession() {
        showGlobalLoader();
        const urlParams = new URLSearchParams(window.location.search);
        const accessToken = urlParams.get('access_token');
        const refreshToken = urlParams.get('refresh_token');
        if (accessToken && refreshToken) {
            try {
                await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (e) {}
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            currentUser = session.user;
            currentProfile = await buildCurrentProfile(currentUser);
            currentUserRole = currentProfile?.role || 'recruit';
            syncSidebarComponent();
            await loadState();
            state.recommendations = buildRecommendations();
            window.debugState = state;
        } else {
            currentUser = null;
            syncSidebarComponent();
        }
        document.getElementById('app-container').classList.remove('app-hidden');
        renderOverviewGauges();
        hideGlobalLoader();
    }

    function setupAuthListeners() {
        document.getElementById('auth-continue-btn').addEventListener('click', async () => {
            const email = document.getElementById('auth-email').value.trim();
            const errorEl = document.getElementById('auth-error-1');
            errorEl.style.display = 'none';
            if (!email) { errorEl.textContent = 'Please enter your email.'; errorEl.style.display = 'block'; return; }
            if (!isValidEmail(email)) { errorEl.textContent = 'Please enter a valid email address.'; errorEl.style.display = 'block'; return; }
            const exists = await checkEmailExists(email);
            if (exists) {
                document.getElementById('login-email-display').textContent = email;
                showAuthStep('step-2-login');
            } else {
                document.getElementById('register-email-display').value = email;
                showAuthStep('step-2-register');
            }
        });

        document.getElementById('auth-signin-btn').addEventListener('click', async () => {
            const email = document.getElementById('auth-email').value.trim();
            const password = document.getElementById('auth-password-login').value;
            const errorEl = document.getElementById('auth-error-login');
            errorEl.style.display = 'none';
            if (!password) { errorEl.textContent = 'Please enter your password.'; errorEl.style.display = 'block'; return; }
            showGlobalLoader();
            try {
                const { data, error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) { errorEl.textContent = error.message; errorEl.style.display = 'block'; return; }
                currentUser = data.user;
                currentProfile = await buildCurrentProfile(data.user);
                currentUserRole = currentProfile?.role || 'recruit';
                closeModal(document.getElementById('auth-overlay'));
                syncSidebarComponent();
                await loadState();
                state.recommendations = buildRecommendations();
                renderOverviewGauges();
            } catch (err) { errorEl.textContent = err.message || 'An unexpected error occurred.'; errorEl.style.display = 'block'; }
            finally { hideGlobalLoader(); }
        });

        document.getElementById('auth-register-btn').addEventListener('click', async () => {
            const email = document.getElementById('auth-email').value.trim();
            const firstName = document.getElementById('auth-first-name').value.trim();
            const lastName = document.getElementById('auth-last-name').value.trim();
            const password = document.getElementById('auth-password-register').value;
            const confirm = document.getElementById('auth-confirm-password').value;
            const errorEl = document.getElementById('auth-error-register');
            errorEl.style.display = 'none';
            if (!firstName || !lastName) { errorEl.textContent = 'First and last name are required.'; errorEl.style.display = 'block'; return; }
            if (password.length < 6) { errorEl.textContent = 'Password must be at least 6 characters.'; errorEl.style.display = 'block'; return; }
            if (password !== confirm) { errorEl.textContent = 'Passwords do not match.'; errorEl.style.display = 'block'; return; }
            const { error } = await supabase.auth.signUp({ email, password, options: { data: { first_name: firstName, last_name: lastName }, emailRedirectTo: window.location.origin + window.location.pathname } });
            if (error) { errorEl.textContent = error.message; errorEl.style.display = 'block'; return; }
            alert('Registration successful! Please check your email to confirm your account.');
            closeModal(document.getElementById('auth-overlay'));
        });

        document.getElementById('auth-back-to-email').addEventListener('click', () => { showAuthStep('step-1'); document.getElementById('auth-password-login').value = ''; });
        document.getElementById('auth-back-to-email-2').addEventListener('click', () => { showAuthStep('step-1'); document.getElementById('auth-first-name').value = ''; document.getElementById('auth-last-name').value = ''; document.getElementById('auth-password-register').value = ''; document.getElementById('auth-confirm-password').value = ''; });

        document.getElementById('forgot-link').addEventListener('click', (e) => {
            e.preventDefault();
            document.getElementById('forgot-email').value = document.getElementById('auth-email').value.trim();
            showAuthStep('step-forgot');
        });

        document.getElementById('auth-reset-btn').addEventListener('click', async () => {
            const email = document.getElementById('forgot-email').value.trim();
            const msgEl = document.getElementById('forgot-message');
            if (!email) { msgEl.textContent = 'Please enter an email.'; msgEl.style.color = '#ff5555'; msgEl.style.display = 'block'; return; }
            const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
            msgEl.style.display = 'block';
            if (error) { msgEl.textContent = error.message; msgEl.style.color = '#ff5555'; }
            else { msgEl.textContent = 'Reset link sent! Check your email.'; msgEl.style.color = 'var(--success)'; }
        });

        document.getElementById('auth-back-to-login').addEventListener('click', () => { showAuthStep('step-2-login'); });
    }

    // ========== MODAL HELPERS ==========
    function adjustModalPrefixes(modalElement) {
        if (!modalElement || modalElement.style.display === 'none') return;

        modalElement.querySelectorAll('.field-group').forEach(field => {
            const prefix = field.querySelector('.field-prefix');
            const input = field.querySelector('input, textarea');
            if (!prefix || !input) return;

            input.style.marginTop = '0';
            input.style.marginBottom = '0';

            const prefixWidth = prefix.getBoundingClientRect().width;
            const totalIndent = 12 + prefixWidth + 4;

            if (input.tagName === 'TEXTAREA') {
                input.style.paddingLeft = '12px';
                input.style.textIndent = totalIndent + 'px';
                input.style.paddingTop = '10px';
                prefix.style.top = '11px';
                prefix.style.transform = 'none';
            } else {
                input.style.paddingLeft = totalIndent + 'px';
                prefix.style.top = '50%';
                prefix.style.transform = 'translateY(-50%)';
            }
        });
    }

    function adjustSettingsPrefixes() {
        const modal = document.getElementById('settingsModal');
        if (!modal || modal.style.display === 'none') return;

        modal.querySelectorAll('.field-group').forEach(field => {
            const prefix = field.querySelector('.field-prefix');
            const input = field.querySelector('input');
            if (!prefix || !input) return;

            input.style.marginTop = '0';
            const prefixWidth = prefix.getBoundingClientRect().width;
            input.style.paddingLeft = (12 + prefixWidth + 8) + 'px';
        });
    }

    // ========== AUTOCOMPLETE ==========
    function attachTagsAutocomplete(input) {
        if (!input) return;

        if (input._autocompleteCleanup) {
            input._autocompleteCleanup();
        }

        const list = document.createElement('ul');
        list.className = 'autocomplete-list';
        input.parentNode.appendChild(list);

        let currentSelectedIndex = -1;

        function getCurrentTagFragment() {
            const value = input.value;
            const lastCommaIndex = value.lastIndexOf(',');
            const fragment = value.substring(lastCommaIndex + 1).trimStart();
            const prefix = value.substring(0, lastCommaIndex >= 0 ? lastCommaIndex + 1 : 0);
            return { fragment, prefix };
        }

        function selectTag(tag) {
            const { prefix } = getCurrentTagFragment();
            input.value = prefix + tag + ', ';
            list.classList.remove('active');
            input.focus();
        }

        function updateSelection(items) {
            items.forEach((item, i) => item.classList.toggle('selected', i === currentSelectedIndex));
        }

        function showSuggestions() {
            const { fragment } = getCurrentTagFragment();
            list.innerHTML = '';
            currentSelectedIndex = -1;

            if (fragment.length === 0) {
                list.classList.remove('active');
                return;
            }

            const matches = state.tags.filter(tag => tag.toLowerCase().startsWith(fragment.toLowerCase()));
            if (!matches.length) {
                list.classList.remove('active');
                return;
            }

            matches.forEach(match => {
                const li = document.createElement('li');
                li.className = 'autocomplete-item';
                li.innerHTML = `<strong>${match.substring(0, fragment.length)}</strong>${match.substring(fragment.length)}`;
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    selectTag(match);
                });
                list.appendChild(li);
            });

            list.classList.add('active');
        }

        const onInput = showSuggestions;
        const onFocus = showSuggestions;
        const onBlur = () => setTimeout(() => list.classList.remove('active'), 150);
        const onKeyDown = (e) => {
            const items = list.querySelectorAll('.autocomplete-item');
            if (!list.classList.contains('active') || items.length === 0) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                currentSelectedIndex = Math.min(currentSelectedIndex + 1, items.length - 1);
                updateSelection(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                currentSelectedIndex = Math.max(currentSelectedIndex - 1, 0);
                updateSelection(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (currentSelectedIndex >= 0 && items[currentSelectedIndex]) {
                    selectTag(items[currentSelectedIndex].textContent);
                } else {
                    showSuggestions();
                }
            } else if (e.key === 'Escape') {
                list.classList.remove('active');
            }
        };

        input.addEventListener('input', onInput);
        input.addEventListener('focus', onFocus);
        input.addEventListener('blur', onBlur);
        input.addEventListener('keydown', onKeyDown);

        input._autocompleteCleanup = () => {
            input.removeEventListener('input', onInput);
            input.removeEventListener('focus', onFocus);
            input.removeEventListener('blur', onBlur);
            input.removeEventListener('keydown', onKeyDown);
            list.remove();
            input._autocompleteCleanup = null;
        };
    }

    function attachSimpleAutocomplete(input, suggestions) {
        if (!input) return;
        if (input._simpleAutocompleteCleanup) {
            input._simpleAutocompleteCleanup();
        }

        const list = document.createElement('ul');
        list.className = 'autocomplete-list';
        input.parentNode.appendChild(list);
        let selectedIndex = -1;

        function show() {
            const value = input.value.trim();
            list.innerHTML = '';
            selectedIndex = -1;
            if (!value) {
                list.classList.remove('active');
                return;
            }
            const matches = suggestions.filter(s => s.toLowerCase().startsWith(value.toLowerCase()));
            if (!matches.length) {
                list.classList.remove('active');
                return;
            }
            matches.forEach(match => {
                const li = document.createElement('li');
                li.className = 'autocomplete-item';
                li.innerHTML = `<strong>${match.substring(0, value.length)}</strong>${match.substring(value.length)}`;
                li.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                    select(match);
                });
                list.appendChild(li);
            });
            list.classList.add('active');
        }

        function select(text) {
            input.value = text;
            list.classList.remove('active');
            input.focus();
        }

        function navigate(e) {
            const items = list.querySelectorAll('.autocomplete-item');
            if (!items.length) return;
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                updateHighlight(items);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                selectedIndex = Math.max(selectedIndex - 1, 0);
                updateHighlight(items);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (selectedIndex >= 0 && items[selectedIndex]) {
                    select(items[selectedIndex].textContent);
                }
            } else if (e.key === 'Escape') {
                list.classList.remove('active');
            }
        }

        function updateHighlight(items) {
            items.forEach((item, i) => item.classList.toggle('selected', i === selectedIndex));
        }

        input.addEventListener('input', show);
        input.addEventListener('focus', show);
        input.addEventListener('blur', () => setTimeout(() => list.classList.remove('active'), 150));
        input.addEventListener('keydown', navigate);

        input._simpleAutocompleteCleanup = () => {
            input.removeEventListener('input', show);
            input.removeEventListener('focus', show);
            input.removeEventListener('blur', () => {});
            input.removeEventListener('keydown', navigate);
            list.remove();
            input._simpleAutocompleteCleanup = null;
        };
    }

    // ========== MODAL OPEN/CLOSE ==========
    function openAddPageModal() {
        if (!requireLogin('add pages')) return;
        openModal(elements.addPageModal);
        goToStep(1);
        elements.pageForm.reset();
        elements.canLinkOutToggle.checked = true;
        elements.canReceiveLinksToggle.checked = true;
        initPrioritySelector();
        elements.pageTypeToggle.classList.remove('is-actual');
        elements.pageTypeToggle.classList.add('is-planned');
        elements.pageType.value = 'planned';
        adjustModalPrefixes(elements.addPageModal);
        elements.pageTitle.classList.remove('field-error');
        elements.pageUrl.classList.remove('field-error');
        elements.wordCount.classList.remove('field-error');
        attachTagsAutocomplete(elements.tagsInput);
        elements.addPageLanguage.value = '';
        attachSimpleAutocomplete(elements.addPageLanguage, state.languages || []);
    }

    function closeAddPageModal() {
        closeModal(elements.addPageModal);
        editingPageId = null;
    }

    function openEditPageModal(pageId) {
        const page = state.pages.find(p => p.id === pageId);
        if (!page) return;
        editingPageId = pageId;

        elements.editPageTitle.textContent = page.title;
        elements.editPageTitleInput.value = page.title;
        elements.editPageUrl.value = page.url;
        elements.editTaxonomy.value = (page.tags || []).join(', ');
        const currentLang = page.language;
        elements.editLanguage.value = currentLang
            ? `${currentLang.toLowerCase()} - ${(state.languages || []).find(l => l.startsWith(currentLang.toLowerCase() + ' -'))?.split(' - ')[1] || currentLang}`
            : '';
        attachSimpleAutocomplete(elements.editLanguage, state.languages || []);
        elements.editWordCount.value = page.wordCount || 0;
        elements.editPrimaryKeyword.value = page.primaryKeyword || '';
        elements.editSecondaryKeywords.value = (page.secondaryKeywords || []).join('\n');
        elements.editLsiKeywords.value = (page.lsiKeywords || []).join('\n');
        elements.editCanLinkOut.checked = page.canLinkOut;
        elements.editCanReceiveLinks.checked = page.canReceiveLinks;
        elements.editPagePriority.value = page.priority || 3;

        const pageType = page.pageType || 'planned';
        elements.editPageType.value = pageType;
        const toggle = elements.editPageTypeToggle;
        if (pageType === 'actual') {
            toggle.classList.add('is-actual');
            toggle.classList.remove('is-planned');
        } else {
            toggle.classList.add('is-planned');
            toggle.classList.remove('is-actual');
        }

        initEditPrioritySelector(page.priority || 3);
        renderEditRecommendations(pageId);

        openModal(elements.editPageModal);
        elements.editPageModal.style.zIndex = '1001';
        attachTagsAutocomplete(elements.editTaxonomy);

        requestAnimationFrame(() => {
            adjustModalPrefixes(elements.editPageModal);
            renderIncomingLinks(pageId);
        });
    }

    function initEditPrioritySelector(initialValue) {
        const options = elements.editPrioritySelector.querySelectorAll('.priority-option');
        options.forEach(opt => {
            const val = parseInt(opt.getAttribute('data-value'), 10);
            opt.classList.toggle('is-active', val === initialValue);
            opt.onclick = (e) => {
                e.preventDefault();
                elements.editPagePriority.value = val;
                options.forEach(o => {
                    const v = parseInt(o.getAttribute('data-value'), 10);
                    o.classList.toggle('is-active', v === val);
                });
            };
        });
    }

    // ========== EDIT PAGE: OUTBOUND SUGGESTIONS ==========
    function renderEditRecommendations(pageId) {
        const container = document.getElementById('edit-recommendations-list');
        if (!container) return;

        const recs = state.recommendations.filter(rec => rec.sourceId === pageId);
        let html = '';

        const pageUrlSuggestions = state.pages.map(p => p.url);
        const anchorSuggestions = [...new Set(state.recommendations.map(rec => rec.anchorText).filter(Boolean))];

        recs.forEach(rec => {
            const target = state.pages.find(p => p.id === rec.targetId);
            const targetUrl = target ? target.url : 'Unknown';
            const linkType = rec.linkType || 'intent';
            html += `
                <div class="suggestion-item" data-rec-id="${rec.id}">
                    <div class="suggestion-row-full">
                        <a href="${targetUrl}" class="page-link" target="_blank">${displayUrl(targetUrl)}</a>
                        <button class="remove-rec-btn" data-rec-id="${rec.id}" title="Remove">✕</button>
                    </div>
                    <div class="suggestion-row-split">
                        <input type="text" class="anchor-input" value="${rec.anchorText || ''}" 
                            placeholder="Anchor text" data-rec-id="${rec.id}">
                        <div class="link-type-bar" data-rec-id="${rec.id}">
                            <button type="button" class="link-type-option ${linkType === 'observed' ? 'is-active' : ''}" data-value="observed">Observed Link</button>
                            <button type="button" class="link-type-option ${linkType === 'intent' ? 'is-active' : ''}" data-value="intent">Link Intent</button>
                            <input type="hidden" class="link-type-value" value="${linkType}">
                        </div>
                        <button class="duplicate-rec-btn" data-rec-id="${rec.id}" title="Duplicate">＋</button>
                    </div>
                </div>
            `;
        });

        html += `
            <div class="suggestion-item" id="add-rec-row">
                <div class="suggestion-row-full">
                    <input type="text" id="new-rec-page" placeholder="Page URL (Enter to add)" autocomplete="off"
                        class="suggestion-url-input">
                </div>
                <div class="suggestion-row-split">
                    <input type="text" id="new-rec-anchor" placeholder="Anchor text (optional)" 
                        class="anchor-input">
                    <div class="link-type-bar" id="new-link-type-bar">
                        <button type="button" class="link-type-option" data-value="observed">Observed Link</button>
                        <button type="button" class="link-type-option is-active" data-value="intent">Link Intent</button>
                        <input type="hidden" class="link-type-value" value="intent">
                    </div>
                    <button class="duplicate-rec-btn" id="duplicate-add-btn" title="Duplicate">＋</button>
                </div>
            </div>
        `;

        container.innerHTML = html;

        container.querySelectorAll('.remove-rec-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const recId = btn.getAttribute('data-rec-id');
                if (recId) removeRecommendation(recId, pageId);
            });
        });

        container.querySelectorAll('.duplicate-rec-btn[data-rec-id]').forEach(btn => {
            btn.addEventListener('click', () => {
                const recId = btn.getAttribute('data-rec-id');
                const original = state.recommendations.find(r => r.id === recId);
                if (original) {
                    const newRec = { ...original, id: createId() };
                    state.recommendations.push(newRec);
                    saveState();
                    renderEditRecommendations(pageId);
                }
            });
        });

        container.querySelectorAll('.link-type-bar[data-rec-id]').forEach(bar => {
            const recId = bar.getAttribute('data-rec-id');
            const hidden = bar.querySelector('.link-type-value');
            const buttons = bar.querySelectorAll('.link-type-option');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    buttons.forEach(b => b.classList.remove('is-active'));
                    btn.classList.add('is-active');
                    hidden.value = btn.getAttribute('data-value');
                    if (recId) {
                        const rec = state.recommendations.find(r => r.id === recId);
                        if (rec) rec.linkType = hidden.value;
                    }
                });
            });
        });

        const newBar = document.getElementById('new-link-type-bar');
        if (newBar) {
            const hidden = newBar.querySelector('.link-type-value');
            const buttons = newBar.querySelectorAll('.link-type-option');
            buttons.forEach(btn => {
                btn.addEventListener('click', () => {
                    buttons.forEach(b => b.classList.remove('is-active'));
                    btn.classList.add('is-active');
                    hidden.value = btn.getAttribute('data-value');
                });
            });
        }

        const duplicateAddBtn = document.getElementById('duplicate-add-btn');
        if (duplicateAddBtn) {
            duplicateAddBtn.addEventListener('click', () => {
                const rawUrl = document.getElementById('new-rec-page')?.value.trim();
                const anchorText = document.getElementById('new-rec-anchor')?.value.trim();
                const linkType = document.querySelector('#new-link-type-bar .link-type-value')?.value || 'intent';

                if (!rawUrl) {
                    showToast('Please enter a page URL first.');
                    return;
                }

                const url = normalizeUrl(rawUrl);
                let targetPage = state.pages.find(p => p.url.toLowerCase() === url.toLowerCase());

                if (linkType === 'observed') {
                    if (!targetPage) {
                        showToast('Page not found. Observed Link requires an existing Actual Page.');
                        return;
                    }
                    if ((targetPage.pageType || 'actual') !== 'actual') {
                        showToast('Cannot create Observed Link to a Planned Page. Convert it to Actual first.');
                        return;
                    }
                }

                if (!targetPage && linkType === 'intent') {
                    targetPage = {
                        id: createId(),
                        title: url.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Untitled',
                        url: url,
                        primaryKeyword: '',
                        secondaryKeywords: [],
                        lsiKeywords: [],
                        wordCount: 0,
                        canLinkOut: true,
                        canReceiveLinks: true,
                        priority: 3,
                        tags: [],
                        pageType: 'planned'
                    };
                    state.pages.push(targetPage);
                    saveState();
                }

                if (targetPage) {
                    addManualRecommendation(pageId, targetPage.id, anchorText, linkType);
                    renderEditRecommendations(pageId);
                }
            });
        }

        container.querySelectorAll('.anchor-input').forEach(input => {
            input.addEventListener('input', () => {
                const recId = input.getAttribute('data-rec-id');
                if (recId) {
                    const rec = state.recommendations.find(r => r.id === recId);
                    if (rec) rec.anchorText = input.value.trim();
                }
            });
        });

        const pageInput = document.getElementById('new-rec-page');
        const anchorInput = document.getElementById('new-rec-anchor');

        if (pageInput) {
            attachSimpleAutocomplete(pageInput, pageUrlSuggestions);

            pageInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    const dropdown = pageInput.parentElement.querySelector('.autocomplete-list');
                    if (dropdown && dropdown.classList.contains('active')) {
                        return;
                    }
                    e.preventDefault();
                    const rawUrl = pageInput.value.trim();
                    const url = normalizeUrl(rawUrl);
                    if (!url) return;
                    const anchorText = anchorInput ? anchorInput.value.trim() : '';
                    const linkType = newBar ? newBar.querySelector('.link-type-value').value : 'intent';

                    let targetPage = state.pages.find(p => p.url.toLowerCase() === url.toLowerCase());

                    if (linkType === 'observed') {
                        if (!targetPage) {
                            showToast('Page not found. Observed Link requires an existing Actual Page.');
                            return;
                        }
                        if ((targetPage.pageType || 'actual') !== 'actual') {
                            showToast('Cannot create Observed Link to a Planned Page. Convert it to Actual first.');
                            return;
                        }
                    }

                    if (!targetPage && linkType === 'intent') {
                        targetPage = {
                            id: createId(),
                            title: url.replace(/^https?:\/\//, '').replace(/\/$/, '') || 'Untitled',
                            url: url,
                            primaryKeyword: '',
                            secondaryKeywords: [],
                            lsiKeywords: [],
                            wordCount: 0,
                            canLinkOut: true,
                            canReceiveLinks: true,
                            priority: 3,
                            tags: [],
                            pageType: 'planned'
                        };
                        state.pages.push(targetPage);
                        saveState();
                    }

                    if (targetPage) {
                        addManualRecommendation(pageId, targetPage.id, anchorText, linkType);
                        renderEditRecommendations(pageId);
                    }
                }
            });
        }

        if (anchorInput) {
            attachSimpleAutocomplete(anchorInput, anchorSuggestions);
        }
    }

    function renderIncomingLinks(pageId) {
        const tbody = document.getElementById('incoming-links-body');
        const emptyState = document.getElementById('incoming-links-empty');
        const tableWrapper = document.getElementById('incoming-links-table-wrapper');
        if (!tbody || !emptyState || !tableWrapper) return;

        const incomingRecs = state.recommendations.filter(rec => rec.targetId === pageId);
        let html = '';

        incomingRecs.forEach(rec => {
            const sourcePage = state.pages.find(p => p.id === rec.sourceId);
            if (!sourcePage) {
                console.warn(`Source page not found for recommendation ${rec.id}, sourceId: ${rec.sourceId}`);
                html += `<tr>
                    <td><span class="page-link" style="color: var(--danger)">Unknown Page (ID: ${rec.sourceId})</span></td>
                    <td>—</td>
                </tr>`;
            } else {
                const url = sourcePage.url;
                const tags = sourcePage.tags && sourcePage.tags.length ? sourcePage.tags.join(', ') : '—';
                html += `<tr>
                    <td><a href="${url}" class="page-link" target="_blank">${displayUrl(url)}</a></td>
                    <td>${tags}</td>
                </tr>`;
            }
        });

        tbody.innerHTML = html;

        if (incomingRecs.length === 0) {
            tableWrapper.style.display = 'none';
            emptyState.style.display = 'block';
        } else {
            tableWrapper.style.display = '';
            emptyState.style.display = 'none';
        }
    }

    function addManualRecommendation(sourceId, targetId, anchorText, linkType = 'intent') {
        state.recommendations.push({
            id: createId(),
            sourceId: sourceId,
            targetId: targetId,
            score: 0,
            completed: false,
            anchorText: anchorText || null,
            anchorType: anchorText ? 'manual' : null,
            linkType: linkType,
            isAuto: false
        });
    }

    function removeRecommendation(recId, pageId) {
        state.recommendations = state.recommendations.filter(rec => rec.id !== recId);
        renderEditRecommendations(pageId);
        renderIncomingLinks(pageId);
    }

    async function handleEditPageSave() {
        const pageId = editingPageId;
        if (!pageId) return;

        const title = elements.editPageTitleInput.value.trim();
        const url = normalizeUrl(elements.editPageUrl.value.trim());
        const primaryKeyword = elements.editPrimaryKeyword.value.trim();
        if (!title || !url || !primaryKeyword) {
            alert('Title, URL, and Primary keyword are required.');
            return;
        }
        if (!isValidUrlPath(url)) {
            alert('Please enter a valid URL path.');
            return;
        }

        const langValue = elements.editLanguage.value.trim();
        let langCode = null;
        if (langValue) {
            if (state.languages && state.languages.length > 0 && !state.languages.includes(langValue)) {
                showToast('Invalid language selected.');
                return;
            }
            langCode = langValue.split(' - ')[0].toUpperCase();
        }

        commitPendingLink(pageId);

        const tags = parseKeywords(elements.editTaxonomy.value);
        const wordCount = parseInt(elements.editWordCount.value, 10) || 0;
        const secondaryKeywords = parseKeywords(elements.editSecondaryKeywords.value);
        const lsiKeywords = parseKeywords(elements.editLsiKeywords.value);
        const canLinkOut = elements.editCanLinkOut.checked;
        const canReceiveLinks = elements.editCanReceiveLinks.checked;
        const priority = parseInt(elements.editPagePriority.value, 10) || 3;
        const pageType = elements.editPageType.value;

        const duplicate = state.pages.some(p => p.id !== pageId && p.url.toLowerCase() === url.toLowerCase());
        if (duplicate) {
            alert('Another page with this URL already exists.');
            return;
        }

        const index = state.pages.findIndex(p => p.id === pageId);
        if (index === -1) return;

        state.pages[index] = {
            ...state.pages[index],
            title, url, primaryKeyword,
            secondaryKeywords, lsiKeywords,
            wordCount, canLinkOut, canReceiveLinks, priority,
            tags,
            pageType,
            language: langCode
        };

        showGlobalLoader();
        try {
            await saveStateNow();
            showToast('Page updated successfully');
        } catch (err) {
            showToast('Failed to save page. Please try again.');
        } finally {
            hideGlobalLoader();
            closeModal(elements.editPageModal);
            editingPageId = null;
            renderOverviewGauges();
        }
    }

    function openSettings() { 
        openModal(elements.settingsModal); 
        syncDistributionInputs(); 
        renderTagsList();
        renderLanguagesList();
        attachSimpleAutocomplete(elements.newLanguageInput, VALID_LANGUAGES);
        adjustSettingsPrefixes();
    }

    function closeSettings() { closeModal(elements.settingsModal); }

    function syncDistributionInputs() {
        elements.settingsPrimaryPercent.value = state.anchorDistribution.primary;
        elements.settingsSecondaryPercent.value = state.anchorDistribution.secondary;
        elements.settingsLsiPercent.value = state.anchorDistribution.lsi;
    }

    function renderTagsList() {
        const container = elements.tagsListContainer;
        if (!container) return;
        container.innerHTML = '';
        (state.tags || []).forEach((tag, index) => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';
            tagItem.dataset.index = index;
            tagItem.innerHTML = `
                <span class="tag-text">${tag}</span>
                <div class="tag-actions">
                    <button class="edit-tag" title="Edit">✎</button>
                    <button class="delete-tag" title="Delete">✕</button>
                </div>
            `;
            container.appendChild(tagItem);
        });
    }

    function addTag() {
        const input = elements.newTagInput;
        const value = input.value.trim();
        if (!value) return;
        if (state.tags.includes(value)) {
            input.value = '';
            return;
        }
        state.tags.push(value);
        saveState();
        input.value = '';
        renderTagsList();
    }

    function deleteTag(index) {
        state.tags.splice(index, 1);
        saveState();
        renderTagsList();
    }

    function startEditTag(tagElement) {
        const span = tagElement.querySelector('.tag-text');
        const currentText = span.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'tag-edit-input';
        span.replaceWith(input);
        input.focus();

        const saveEdit = () => {
            const newValue = input.value.trim();
            const index = parseInt(tagElement.dataset.index, 10);
            if (newValue && !state.tags.includes(newValue)) {
                state.tags[index] = newValue;
                saveState();
                renderTagsList();
            } else {
                input.replaceWith(span);
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                input.replaceWith(span);
            }
        });

        input.addEventListener('blur', () => {
            input.replaceWith(span);
        });
    }

    // ========== LANGUAGES MANAGEMENT ==========
    function renderLanguagesList() {
        const container = elements.languagesListContainer;
        if (!container) return;
        container.innerHTML = '';
        (state.languages || []).forEach((lang, index) => {
            const tagItem = document.createElement('div');
            tagItem.className = 'tag-item';
            tagItem.dataset.index = index;
            tagItem.innerHTML = `
                <span class="tag-text">${lang}</span>
                <div class="tag-actions">
                    <button class="edit-tag" title="Edit">✎</button>
                    <button class="delete-tag" title="Delete">✕</button>
                </div>
            `;
            container.appendChild(tagItem);
        });
    }

    function addLanguage() {
        const input = elements.newLanguageInput;
        const value = input.value.trim();
        if (!value) return;

        // Check if it's a valid language from the list
        if (!VALID_LANGUAGES.includes(value)) {
            showToast('Please select a language from the list.');
            return;
        }

        if ((state.languages || []).includes(value)) {
            showToast('This language already exists.');
            input.value = '';
            return;
        }
        if (!state.languages) state.languages = [];
        state.languages.push(value);
        saveState();
        input.value = '';
        renderLanguagesList();
    }

    function deleteLanguage(index) {
        state.languages.splice(index, 1);
        saveState();
        renderLanguagesList();
    }

    function startEditLanguage(tagElement) {
        const span = tagElement.querySelector('.tag-text');
        const currentText = span.textContent;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'tag-edit-input';
        span.replaceWith(input);
        input.focus();

        const saveEdit = () => {
            const newValue = input.value.trim();
            const index = parseInt(tagElement.dataset.index, 10);
            if (newValue && !(state.languages || []).includes(newValue)) {
                state.languages[index] = newValue;
                saveState();
                renderLanguagesList();
            } else {
                input.replaceWith(span);
            }
        };

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                input.replaceWith(span);
            }
        });

        input.addEventListener('blur', () => {
            input.replaceWith(span);
        });
    }

    function handleSaveDistribution() {
        if (!requireLogin('save settings')) return;
        const primary = parseInt(elements.settingsPrimaryPercent.value, 10) || 0;
        const secondary = parseInt(elements.settingsSecondaryPercent.value, 10) || 0;
        const lsi = parseInt(elements.settingsLsiPercent.value, 10) || 0;
        const total = primary + secondary + lsi;
        if (primary < 0 || secondary < 0 || lsi < 0 || total !== 100) {
            showToast('Percentages must sum to 100.');
            return;
        }
        state.anchorDistribution = { primary, secondary, lsi };
        saveState();
        syncDistributionInputs();
        renderOverviewGauges();
        state.recommendations = buildRecommendations();
        showToast('Settings saved!');
    }

    function goToStep(step) {
        currentStep = step;
        elements.formSteps.forEach(s =>
            s.classList.toggle('is-active', parseInt(s.getAttribute('data-step')) === step)
        );
        elements.addPageStepTitle.textContent = stepInfo[step - 1].title;
        elements.addPageStepDesc.textContent = stepInfo[step - 1].desc;
        elements.prevStepButton.hidden = (step === 1);

        const nextBtn = elements.nextStepButton;
        if (step === totalSteps) {
            nextBtn.textContent = 'Add page';
            nextBtn.type = 'submit';
        } else {
            nextBtn.textContent = 'Next';
            nextBtn.type = 'button';
        }

        adjustModalPrefixes(elements.addPageModal);
    }
    function goToNextStep() {
        if (currentStep === 1 && !validateRequiredFields()) return;
        if (currentStep < totalSteps) goToStep(currentStep + 1);
    }
    function goToPrevStep() { if (currentStep > 1) goToStep(currentStep - 1); }

    async function handlePageSubmit(event) {
        event.preventDefault();
        if (!requireLogin('add pages')) return;
        if (!validateRequiredFields()) return;
        if (currentStep !== totalSteps) return;

        const title = elements.pageTitle.value.trim();
        const url = normalizeUrl(elements.pageUrl.value.trim());
        const tags = parseKeywords(elements.tagsInput.value);
        const wordCountVal = parseInt(elements.wordCount.value, 10) || 0;
        const primaryKeywordVal = elements.primaryKeyword.value.trim();
        const secondaryKeywordsVal = parseKeywords(elements.secondaryKeywords.value);
        const lsiKeywordsVal = parseKeywords(elements.lsiKeywords.value);
        const canLinkOut = elements.canLinkOutToggle.checked;
        const canReceiveLinks = elements.canReceiveLinksToggle.checked;
        const priority = parseInt(elements.pagePriority.value, 10) || 3;
        const pageType = elements.pageType.value;

        if (!title || !url || !primaryKeywordVal) return;
        if (!isValidUrlPath(url)) return;

        const langValue = elements.addPageLanguage.value.trim();
        let langCode = null;
        if (langValue) {
            if (state.languages && state.languages.length > 0 && !state.languages.includes(langValue)) {
                showToast('Invalid language selected.');
                return;
            }
            langCode = langValue.split(' - ')[0].toUpperCase();
        }

        const normalizedUrl = url.toLowerCase();
        const existingActual = state.pages.find(p => p.url.toLowerCase() === normalizedUrl && (p.pageType || 'actual') === 'actual');
        const existingPlanned = state.pages.find(p => p.url.toLowerCase() === normalizedUrl && (p.pageType || 'actual') === 'planned');

        if (pageType === 'actual') {
            if (existingActual) {
                showToast('An Actual Page with this URL already exists.');
                return;
            }
            if (existingPlanned) {
                Object.assign(existingPlanned, {
                    title,
                    url,
                    primaryKeyword: primaryKeywordVal,
                    secondaryKeywords: secondaryKeywordsVal,
                    lsiKeywords: lsiKeywordsVal,
                    wordCount: wordCountVal,
                    canLinkOut,
                    canReceiveLinks,
                    priority,
                    tags,
                    pageType: 'actual',
                    language: langCode
                });
                state.recommendations = buildRecommendations();
                await saveState();
                closeAddPageModal();
                renderOverviewGauges();
                showToast('Existing Planned Page converted to Actual Page.');
                return;
            }
        } else if (pageType === 'planned') {
            if (existingActual || existingPlanned) {
                showToast('A page with this URL already exists (Actual or Planned).');
                return;
            }
        }

        showGlobalLoader();
        try {
            setButtonLoading(elements.nextStepButton, true);
            await new Promise(resolve => setTimeout(resolve, 280));
            state.pages.push({
                id: createId(),
                title,
                url,
                primaryKeyword: primaryKeywordVal,
                secondaryKeywords: secondaryKeywordsVal,
                lsiKeywords: lsiKeywordsVal,
                wordCount: wordCountVal,
                canLinkOut,
                canReceiveLinks,
                priority,
                tags,
                pageType,
                language: langCode
            });
            state.recommendations = buildRecommendations();
            await saveState();
            closeAddPageModal();
            renderOverviewGauges();
        } catch (err) {
            console.error(err);
        } finally {
            setButtonLoading(elements.nextStepButton, false);
            hideGlobalLoader();
        }
    }

    function getPageLanguage(page) {
        return page.language || null;
    }

    function getTopicTags(page) {
        return page.tags || [];
    }

    function computeRelationScore(sourcePage, targetPage) {
        const sourceTopics = new Set(getTopicTags(sourcePage).map(t => t.toLowerCase()));
        const targetTopics = new Set(getTopicTags(targetPage).map(t => t.toLowerCase()));

        const intersection = new Set([...sourceTopics].filter(t => targetTopics.has(t)));
        if (intersection.size === 0) return 0; // hard gate already, but explicit

        const union = new Set([...sourceTopics, ...targetTopics]);
        const J = intersection.size / union.size;

        let B;
        if (intersection.size >= 2) B = 1;
        else if (intersection.size === 1) B = 0.5;
        else B = 0;

        return 0.7 * J + 0.3 * B;
    }

    function buildRecommendations() {
        const importanceWeights = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10 };
        const maxImportanceWeight = 10;
        const { pages, recommendations: existingRecs, rules } = state;

        const outboundBudgets = {};
        const sources = pages.filter(p => p.canLinkOut && p.tags && p.tags.length > 0);
        for (const src of sources) {
            let budget = Math.floor((src.wordCount || 0) / 300);
            budget = Math.max(0, Math.min(budget, rules.maxOutbound));
            outboundBudgets[src.id] = budget;
        }

        const targetDesired = {};
        const targets = pages.filter(p => p.canReceiveLinks && p.tags && p.tags.length > 0);
        for (const tgt of targets) {
            targetDesired[tgt.id] = importanceWeights[tgt.priority] || 3;
        }

        const currentInbound = {};
        const existingLinks = new Set();
        for (const rec of existingRecs) {
            currentInbound[rec.targetId] = (currentInbound[rec.targetId] || 0) + 1;
            existingLinks.add(`${rec.sourceId}:${rec.targetId}`);
        }

        const newAutoRecs = [];

        for (const source of sources) {
            let slots = outboundBudgets[source.id] || 0;
            if (slots <= 0) continue;

            const candidates = [];
            for (const target of targets) {
                if (source.id === target.id) continue;
                if (existingLinks.has(`${source.id}:${target.id}`)) continue;

                // Language gate
                const sourceLang = getPageLanguage(source);
                const targetLang = getPageLanguage(target);
                if (sourceLang && targetLang && sourceLang !== targetLang) continue;

                // Topic relevance – hard gate if no shared topic tags
                const relation = computeRelationScore(source, target);
                if (relation === 0) continue;

                const desired = targetDesired[target.id] || 0;
                const current = currentInbound[target.id] || 0;
                const deficit = Math.max(0, desired - current);
                if (deficit <= 0) continue;

                const linkNeed = Math.min(1, deficit / Math.max(1, desired));
                const importanceWeight = importanceWeights[target.priority] || 3;
                const normalizedImportance = importanceWeight / maxImportanceWeight;

                const score = 100 * (0.50 * relation + 0.35 * linkNeed + 0.15 * normalizedImportance);
                candidates.push({ target, score, deficit });
            }

            candidates.sort((a, b) => b.score - a.score);

            for (const cand of candidates) {
                if (slots <= 0) break;
                const { target } = cand;
                if ((currentInbound[target.id] || 0) >= targetDesired[target.id]) continue;

                newAutoRecs.push({
                    id: createId(),
                    sourceId: source.id,
                    targetId: target.id,
                    score: cand.score,
                    completed: false,
                    anchorText: null,
                    anchorType: null,
                    linkType: 'intent',
                    isAuto: true
                });

                currentInbound[target.id] = (currentInbound[target.id] || 0) + 1;
                existingLinks.add(`${source.id}:${target.id}`);
                slots--;
            }
        }

        // Anchor assignment (unchanged)
        let primaryCount = 0, secondaryCount = 0, lsiCount = 0;
        newAutoRecs.forEach(rec => {
            const targetPage = pages.find(p => p.id === rec.targetId);
            if (!targetPage) return;

            const deficitPrimary = getDeficit(primaryCount, newAutoRecs.length, state.anchorDistribution.primary);
            const deficitSecondary = getDeficit(secondaryCount, newAutoRecs.length, state.anchorDistribution.secondary);
            const deficitLsi = getDeficit(lsiCount, newAutoRecs.length, state.anchorDistribution.lsi);

            const availableTypes = [];
            if (targetPage.primaryKeyword) availableTypes.push({ type: 'primary', keyword: targetPage.primaryKeyword });
            if (targetPage.secondaryKeywords.length) availableTypes.push({ type: 'secondary', keyword: null });
            if (targetPage.lsiKeywords.length) availableTypes.push({ type: 'lsi', keyword: null });

            if (availableTypes.length === 0) return;

            availableTypes.sort((a, b) => {
                const dA = a.type === 'primary' ? deficitPrimary : (a.type === 'secondary' ? deficitSecondary : deficitLsi);
                const dB = b.type === 'primary' ? deficitPrimary : (b.type === 'secondary' ? deficitSecondary : deficitLsi);
                return dB - dA;
            });

            const chosen = availableTypes[0];
            let keyword;
            if (chosen.type === 'primary') {
                keyword = targetPage.primaryKeyword;
            } else if (chosen.type === 'secondary') {
                const idx = secondaryCount % targetPage.secondaryKeywords.length;
                keyword = targetPage.secondaryKeywords[idx];
            } else {
                const idx = lsiCount % targetPage.lsiKeywords.length;
                keyword = targetPage.lsiKeywords[idx];
            }
            rec.anchorText = keyword;
            rec.anchorType = chosen.type;
            if (chosen.type === 'primary') primaryCount++;
            else if (chosen.type === 'secondary') secondaryCount++;
            else lsiCount++;
        });

        const manualRecs = state.recommendations.filter(rec => !rec.isAuto);
        state.recommendations = [...newAutoRecs, ...manualRecs];
        return state.recommendations;
    }

    function getDeficit(current, total, targetPercent) {
        if (total === 0) return targetPercent;
        const currentPercent = (current / total) * 100;
        return targetPercent - currentPercent;
    }

    function calculateRelevanceScore(sourcePage, targetPage) {
        const sourceTerms = getPageTerms(sourcePage);
        const targetTerms = getPageTerms(targetPage);
        let score = 0;
        sourceTerms.forEach(st => {
            targetTerms.forEach(tt => {
                if (st === tt) score += 3;
                else if (st.indexOf(tt) !== -1 || tt.indexOf(st) !== -1) score += 1;
            });
        });
        if (sourcePage.tags && targetPage.tags) {
            sourcePage.tags.forEach(stag => {
                if (targetPage.tags.includes(stag)) score += 2;
            });
        }
        return score;
    }

    function getPageTerms(page) {
        return [page.primaryKeyword, ...(page.secondaryKeywords || []), ...(page.lsiKeywords || [])]
            .map(normalizeTerm)
            .filter(Boolean);
    }

    function getActualPages() {
        return state.pages.filter(p => (p.pageType || 'actual') === 'actual');
    }

    function getObservedLinks() {
        return state.recommendations.filter(rec => (rec.linkType || 'observed') === 'observed');
    }

    // ========== GAUGE CALCULATIONS ==========
    const overviewCalculator = {
        computeDensityScore(pages, links) {
            const pagesWithOutbound = pages.filter(p => p.canLinkOut);
            const totalWords = pagesWithOutbound.reduce((sum, p) => sum + (p.wordCount || 0), 0);
            const totalTarget = pagesWithOutbound.reduce((sum, p) => sum + Math.floor((p.wordCount || 0) / 300), 0);
            const totalLinks = links.length;
            if (totalTarget === 0) return { finalScore: 0, densityValue: 0, extra: { totalLinks, totalTarget, underlinked: 0, optimal: 0, overlinked: 0, recommendedLinks: 0 } };
            const densityValue = totalLinks / totalTarget;
            const globalScore = this._densityRatioScore(densityValue);
            const pageScores = pagesWithOutbound.map(p => {
                const expected = Math.floor((p.wordCount || 0) / 300);
                const actual = links.filter(l => l.sourceId === p.id).length;
                if (expected === 0) return { pageId: p.id, score: 100, weight: 0 };
                const ratio = actual / expected;
                const score = this._densityRatioScore(ratio);
                const weight = Math.min(p.wordCount || 0, 1200);
                return { pageId: p.id, score, weight };
            });
            const totalWeight = pageScores.reduce((sum, ps) => sum + ps.weight, 0);
            const pageLevelScore = totalWeight > 0 ? pageScores.reduce((sum, ps) => sum + ps.score * ps.weight, 0) / totalWeight : 0;
            const finalScore = Math.round(globalScore * 0.60 + pageLevelScore * 0.40);
            return {
                finalScore, densityValue,
                extra: {
                    totalLinks,
                    totalTarget,
                    underlinked: pageScores.filter(ps => ps.score < 60).length,
                    optimal: pageScores.filter(ps => ps.score >= 80 && ps.score <= 100).length,
                    overlinked: pageScores.filter(ps => ps.score > 100 && ps.weight > 0).length,
                    recommendedLinks: totalTarget
                }
            };
        },
        _densityRatioScore(ratio) {
            if (ratio < 0.8) return 100 * (ratio / 0.8);
            if (ratio <= 1.2) return 100;
            if (ratio < 2) return 100 * ((2 - ratio) / 0.8);
            return 0;
        },
        computeHealthScore(pages, links) {
            const totalLinks = links.length;
            if (totalLinks === 0) return { finalScore: 0, technicalScore: 0, permissionScore: 0, reachabilityScore: 0, contextScore: 0 };
            const technicalScore = 80;
            let compliantLinks = 0;
            links.forEach(link => {
                const source = pages.find(p => p.id === link.sourceId);
                const target = pages.find(p => p.id === link.targetId);
                if (source && target && source.canLinkOut && target.canReceiveLinks) compliantLinks++;
            });
            const permissionScore = totalLinks ? Math.round((compliantLinks / totalLinks) * 100) : 100;
            const pagesWithIncoming = pages.filter(p => p.canReceiveLinks);
            let reachabilityScore = 100;
            if (pagesWithIncoming.length > 0) {
                const totalImportance = pagesWithIncoming.reduce((sum, p) => sum + (p.priority || 3), 0);
                const reachableImportance = pagesWithIncoming.reduce((sum, p) => {
                    const hasLink = links.some(l => l.targetId === p.id);
                    return hasLink ? sum + (p.priority || 3) : sum;
                }, 0);
                reachabilityScore = totalImportance ? Math.round((reachableImportance / totalImportance) * 100) : 0;
            }
            const contextScore = 75;
            const finalScore = Math.round(technicalScore * 0.40 + permissionScore * 0.20 + reachabilityScore * 0.25 + contextScore * 0.15);
            return { finalScore, technicalScore, permissionScore, reachabilityScore, contextScore };
        },
        computeStrategyScore(pages, links, anchorDistribution) {
            const targetPages = pages.filter(p => p.canReceiveLinks);
            if (targetPages.length === 0) return { finalScore: 0, importanceAlignment: 0, anchorFit: 0, primaryPercent: 0, secondaryPercent: 0, lsiPercent: 0, deviation: 0 };

            const totalBudget = pages.filter(p => p.canLinkOut).reduce((sum, p) => sum + Math.floor((p.wordCount || 0) / 300), 0);
            const totalImportance = targetPages.reduce((sum, p) => sum + (p.priority || 3), 0);
            const expectedIncoming = {};
            targetPages.forEach(p => { expectedIncoming[p.id] = totalBudget > 0 ? (totalBudget * (p.priority || 3)) / totalImportance : 0; });
            const actualIncoming = {};
            targetPages.forEach(p => { actualIncoming[p.id] = 0; });
            links.forEach(l => { if (actualIncoming[l.targetId] !== undefined) actualIncoming[l.targetId]++; });
            const totalActual = links.length;
            const totalExpected = Object.values(expectedIncoming).reduce((sum, val) => sum + val, 0);
            let importanceAlignment = 100;
            if (totalActual > 0 && totalExpected > 0) {
                const differences = targetPages.map(p => {
                    const actualShare = actualIncoming[p.id] / totalActual;
                    const expectedShare = expectedIncoming[p.id] / totalExpected;
                    return Math.abs(actualShare - expectedShare);
                });
                const totalDiff = differences.reduce((sum, d) => sum + d, 0);
                importanceAlignment = Math.max(0, 100 * (1 - totalDiff / 2));
            }

            let primaryCount = 0, secondaryCount = 0, lsiCount = 0;
            links.forEach(link => {
                if (link.anchorType === 'primary') primaryCount++;
                else if (link.anchorType === 'secondary') secondaryCount++;
                else if (link.anchorType === 'lsi') lsiCount++;
            });
            const totalAnchorLinks = primaryCount + secondaryCount + lsiCount;
            const primaryPercent = totalAnchorLinks ? Math.round((primaryCount / totalAnchorLinks) * 100) : 0;
            const secondaryPercent = totalAnchorLinks ? Math.round((secondaryCount / totalAnchorLinks) * 100) : 0;
            const lsiPercent = totalAnchorLinks ? Math.round((lsiCount / totalAnchorLinks) * 100) : 0;

            const deviation = totalAnchorLinks ? (
                Math.abs(primaryPercent - anchorDistribution.primary) +
                Math.abs(secondaryPercent - anchorDistribution.secondary) +
                Math.abs(lsiPercent - anchorDistribution.lsi)
            ) / 3 : 0;

            const anchorScores = targetPages.map(p => {
                const incoming = links.filter(l => l.targetId === p.id);
                if (incoming.length === 0) return { pageId: p.id, fit: 100, confidence: 0, expected: expectedIncoming[p.id] };
                const total = incoming.length;
                const pCount = incoming.filter(l => l.anchorType === 'primary').length;
                const sCount = incoming.filter(l => l.anchorType === 'secondary').length;
                const lCount = incoming.filter(l => l.anchorType === 'lsi').length;
                const pPct = (pCount / total) * 100;
                const sPct = (sCount / total) * 100;
                const lPct = (lCount / total) * 100;
                const pScore = this._rangeScore(pPct, 30, 40);
                const sScore = this._rangeScore(sPct, 40, 50);
                const lScore = this._rangeScore(lPct, 10, 30);
                const fit = pScore * 0.35 + sScore * 0.45 + lScore * 0.20;
                const confidence = Math.min(1, total / 10);
                return { pageId: p.id, fit, confidence, expected: expectedIncoming[p.id] };
            });

            let anchorFit = 0;
            const totalWeightedFit = anchorScores.reduce((sum, s) => sum + s.fit * s.expected * s.confidence, 0);
            const totalWeight = anchorScores.reduce((sum, s) => sum + s.expected * s.confidence, 0);
            if (totalWeight > 0) anchorFit = totalWeightedFit / totalWeight;

            const finalScore = Math.round(importanceAlignment * 0.70 + anchorFit * 0.30);

            return {
                finalScore,
                importanceAlignment: Math.round(importanceAlignment),
                anchorFit: Math.round(anchorFit),
                primaryPercent,
                secondaryPercent,
                lsiPercent,
                deviation: Math.round(deviation * 10) / 10
            };
        },
        _rangeScore(actual, min, max) {
            if (actual >= min && actual <= max) return 100;
            if (actual < min) return 100 * (actual / min);
            return Math.max(0, 100 * ((100 - actual) / (100 - max)));
        }
    };

    function updateGaugeDetails(card, detailsArray) {
        const detailsEl = card.querySelector('.gauge-details');
        if (!detailsEl) return;
        let html = '';
        detailsArray.forEach(item => {
            html += `<div class="detail-row">
                        <span class="detail-label">${item.label}</span>
                        <span class="detail-value">${item.value}</span>
                     </div>`;
        });
        detailsEl.innerHTML = html;
    }

    function renderOverviewGauges() {
        const healthCard = document.querySelector('.gauge-card[data-gauge-type="health"]');
        const densityCard = document.querySelector('.gauge-card[data-gauge-type="density"]');
        const strategyCard = document.querySelector('.gauge-card[data-gauge-type="strategy"]');
        if (!healthCard || !densityCard || !strategyCard) return;

        const actualPages = getActualPages();
        const observedLinks = getObservedLinks();

        const health = overviewCalculator.computeHealthScore(actualPages, observedLinks);
        updateScoreGauge(healthCard, health.finalScore);
        setGaugeLabels(healthCard, health.finalScore + '%', getHealthStatus(health.finalScore));
        updateGaugeDetails(healthCard, [
            { label: 'Technical Health', value: health.technicalScore + '%' },
            { label: 'Permission Compliance', value: health.permissionScore + '%' },
            { label: 'Reachability', value: health.reachabilityScore + '%' },
            { label: 'Context Quality', value: health.contextScore + '%' }
        ]);

        const density = overviewCalculator.computeDensityScore(actualPages, observedLinks);
        updateDensityGauge(densityCard, density.densityValue);
        setGaugeLabels(densityCard, density.finalScore + '/100', getDensityStatus(density.densityValue));
        updateGaugeDetails(densityCard, [
            { label: 'Pages Below Target', value: density.extra.underlinked },
            { label: 'Pages in Optimal Range', value: density.extra.optimal },
            { label: 'Pages Above Target', value: density.extra.overlinked },
            { label: 'Recommended Links', value: density.extra.recommendedLinks }
        ]);

        const strategy = overviewCalculator.computeStrategyScore(actualPages, observedLinks, state.anchorDistribution);
        updateScoreGauge(strategyCard, strategy.finalScore);
        setGaugeLabels(strategyCard, strategy.finalScore + '%', getStrategyStatus(strategy.finalScore));
        updateGaugeDetails(strategyCard, [
            { label: 'Primary Anchors', value: strategy.primaryPercent + '%' },
            { label: 'Secondary Anchors', value: strategy.secondaryPercent + '%' },
            { label: 'Semantic Anchors', value: strategy.lsiPercent + '%' },
            { label: 'Distribution Deviation', value: strategy.deviation + '%' }
        ]);

        renderPriorityActionsTable();
        renderOrphanTable();
        renderDistributionRow();
        renderOpportunitiesTable();

        if (window.innerWidth <= 768) {
            let slider = document.querySelector('.overview-row');
            if (slider) {
                slider.classList.add('gauge-slider');
            }
        }
    }

    function updateScoreGauge(card, percent) {
        const svg = card.querySelector('svg.gauge');
        const fillPath = svg.querySelector('.gauge-fill');
        const needle = svg.querySelector('.gauge-needle');
        const circumference = 157;
        const offset = circumference - (circumference * percent / 100);
        fillPath.setAttribute('stroke-dashoffset', offset);

        const rotation = -90 + (percent / 100) * 180;
        needle.style.transform = `rotate(${rotation}deg)`;
        needle.style.transformOrigin = '70px 70px';
    }

    function updateDensityGauge(card, densityValue) {
        const svg = card.querySelector('svg.gauge');
        const needle = svg.querySelector('.gauge-needle');
        const maxDensity = 3;
        const rotation = -90 + (densityValue / maxDensity) * 180;
        needle.style.transform = `rotate(${rotation}deg)`;
        needle.style.transformOrigin = '70px 70px';
    }

    function setGaugeLabels(card, mainText, statusText) {
        const descEl = card.querySelector('.card-desc');
        if (descEl) descEl.textContent = mainText;

        const statusEl = card.querySelector('.gauge-status');
        if (statusEl) {
            statusEl.textContent = statusText;
            if (statusText === 'Excellent' || statusText === 'Optimal' || statusText === 'Aligned') {
                statusEl.style.color = 'var(--success)';
            } else if (statusText === 'Critical' || statusText === 'Very Sparse' || statusText === 'Overlinked' || statusText === 'Misaligned') {
                statusEl.style.color = 'var(--danger)';
            } else {
                statusEl.style.color = 'var(--warning)';
            }
        }
    }

    function getHealthStatus(score) {
        if (score >= 90) return 'Excellent';
        if (score >= 75) return 'Healthy';
        if (score >= 60) return 'Needs Attention';
        if (score >= 40) return 'Poor';
        return 'Critical';
    }
    function getDensityStatus(density) {
        if (density < 0.5) return 'Very Sparse';
        if (density < 0.8) return 'Sparse';
        if (density <= 1.2) return 'Optimal';
        if (density <= 1.5) return 'Dense';
        return 'Overlinked';
    }
    function getStrategyStatus(score) {
        if (score >= 90) return 'Excellent';
        if (score >= 75) return 'Aligned';
        if (score >= 60) return 'Needs Attention';
        if (score >= 40) return 'Weak';
        return 'Misaligned';
    }

    function initPrioritySelector() {
        const options = elements.prioritySelector.querySelectorAll('.priority-option');
        function setActive(value) {
            currentPriority = parseInt(value, 10);
            elements.pagePriority.value = currentPriority;
            options.forEach(opt => {
                const val = parseInt(opt.getAttribute('data-value'), 10);
                opt.classList.toggle('is-active', val === currentPriority);
            });
        }
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                setActive(opt.getAttribute('data-value'));
            });
        });
        setActive(elements.pagePriority.value || 3);
    }

    function setButtonLoading(btn, isLoading) { btn.disabled = isLoading; btn.classList.toggle('is-loading', isLoading); }

    function bindOrvellaEvents() {
        elements.prevStepButton.addEventListener("click", goToPrevStep);
        elements.pageForm.addEventListener("submit", handlePageSubmit);
        elements.saveDistributionButton.addEventListener("click", handleSaveDistribution);
        elements.saveEditPageBtn.addEventListener('click', handleEditPageSave);

        elements.nextStepButton.addEventListener('click', (e) => {
            e.preventDefault();
            if (currentStep === totalSteps) {
                elements.pageForm.requestSubmit();
            } else if (currentStep < totalSteps) {
                goToStep(currentStep + 1);
            }
        });

        elements.deletePageBtn.addEventListener('click', () => {
            openModal(elements.confirmDeleteModal);
        });

        elements.cancelDeleteBtn.addEventListener('click', () => {
            closeModal(elements.confirmDeleteModal);
        });

        elements.confirmDeleteBtn.addEventListener('click', async () => {
            const pageId = editingPageId;
            if (!pageId) return;
            state.pages = state.pages.filter(p => p.id !== pageId);
            state.recommendations = state.recommendations.filter(rec => rec.sourceId !== pageId && rec.targetId !== pageId);
            await saveState();
            closeModal(elements.confirmDeleteModal);
            closeModal(elements.editPageModal);
            editingPageId = null;
            renderOverviewGauges();
            showToast('Page deleted successfully');
        });

        elements.newTagInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                addTag();
            }
        });

        elements.pageForm.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && currentStep !== totalSteps) {
                e.preventDefault();
            }
        });

        elements.tagsListContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const tagItem = btn.closest('.tag-item');
            const index = parseInt(tagItem.dataset.index, 10);
            if (btn.classList.contains('delete-tag')) {
                deleteTag(index);
            } else if (btn.classList.contains('edit-tag')) {
                startEditTag(tagItem);
            }
        });

        elements.pageTypeToggle.addEventListener('click', () => {
            const isPlanned = elements.pageTypeToggle.classList.contains('is-planned');
            if (isPlanned) {
                elements.pageTypeToggle.classList.remove('is-planned');
                elements.pageTypeToggle.classList.add('is-actual');
                elements.pageType.value = 'actual';
            } else {
                elements.pageTypeToggle.classList.remove('is-actual');
                elements.pageTypeToggle.classList.add('is-planned');
                elements.pageType.value = 'planned';
            }
        });

        elements.editPageTypeToggle.addEventListener('click', () => {
            const toggle = elements.editPageTypeToggle;
            if (toggle.classList.contains('is-planned')) {
                toggle.classList.remove('is-planned');
                toggle.classList.add('is-actual');
                elements.editPageType.value = 'actual';
            } else {
                toggle.classList.remove('is-actual');
                toggle.classList.add('is-planned');
                elements.editPageType.value = 'planned';
            }
        });

        document.getElementById('pagesTabActual')?.addEventListener('click', () => {
            activePagesTab = 'actual';
            updatePagesTabUI();
            renderPagesList(activePagesTab);
        });

        document.getElementById('pagesTabPlanned')?.addEventListener('click', () => {
            activePagesTab = 'planned';
            updatePagesTabUI();
            renderPagesList(activePagesTab);
        });

        elements.pageTitle.addEventListener('input', () => elements.pageTitle.classList.remove('field-error'));
        elements.pageUrl.addEventListener('input', () => elements.pageUrl.classList.remove('field-error'));
        elements.wordCount.addEventListener('input', () => elements.wordCount.classList.remove('field-error'));

        document.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal');
            if (modal && e.target === modal) closeModal(modal);
        });

        document.addEventListener('click', (e) => {
            const closeBtn = e.target.closest('.close-modal');
            if (closeBtn) {
                const modal = closeBtn.closest('.modal');
                if (modal) closeModal(modal);
            }
        });

        // ========== LANGUAGES ==========
        elements.newLanguageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const dropdown = elements.newLanguageInput.parentElement.querySelector('.autocomplete-list');
                if (dropdown && dropdown.classList.contains('active')) {
                    return;
                }
                e.preventDefault();
                addLanguage();
            }
        });

        elements.languagesListContainer.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const tagItem = btn.closest('.tag-item');
            const index = parseInt(tagItem.dataset.index, 10);
            if (btn.classList.contains('delete-tag')) {
                deleteLanguage(index);
            } else if (btn.classList.contains('edit-tag')) {
                startEditLanguage(tagItem);
            }
        });
    }

    // ========== STATUS PILL GLOBAL LISTENER ==========
    document.addEventListener('click', (e) => {
        const pill = e.target.closest('.status-pill');
        if (!pill) {
            document.querySelectorAll('.status-pill.active').forEach(p => p.classList.remove('active'));
            return;
        }
        if (e.target.classList.contains('status-pill-label')) {
            document.querySelectorAll('.status-pill.active').forEach(p => {
                if (p !== pill) p.classList.remove('active');
            });
            pill.classList.toggle('active');
            return;
        }
        if (e.target.classList.contains('status-option')) {
            const value = e.target.getAttribute('data-value');
            const pageId = pill.getAttribute('data-page-id');
            const label = pill.querySelector('.status-pill-label');
            if (label) {
                label.textContent = value.charAt(0).toUpperCase() + value.slice(1);
            }
            pill.classList.remove('active');
            actionStatuses[pageId] = value;
            saveState();
            if (value === 'ignore') {
                pill.closest('tr').remove();
                const panel = document.getElementById('priority-actions-panel');
                const badge = document.getElementById('priority-badge');
                const tbody = document.getElementById('priority-actions-body');
                if (tbody && tbody.children.length === 0) {
                    panel.classList.add('is-empty');
                }
                if (badge) {
                    const remaining = tbody ? tbody.children.length : 0;
                    badge.textContent = `${remaining} issues`;
                }
            }
        }
    });

    function getPotentialSourceCount(targetPage) {
        return state.pages.filter(p =>
            p.id !== targetPage.id &&
            p.canLinkOut &&
            p.wordCount >= 300 &&
            calculateRelevanceScore(p, targetPage) > 0
        ).length;
    }



    function computeOrphanPages() {
        const orphans = [];
        const actualPages = getActualPages();
        const observedLinks = getObservedLinks();
        actualPages.forEach(page => {
            if (!page.canReceiveLinks) return;
            const hasIncoming = observedLinks.some(rec => rec.targetId === page.id);
            if (!hasIncoming) {
                let type = 'Other';
                if (page.tags && page.tags.length) {
                    const taxLower = page.tags.map(t => t.toLowerCase());
                    if (taxLower.some(t => ['post','blog','article'].includes(t))) type = 'Post';
                    else if (taxLower.some(t => ['product','service','pricing'].includes(t))) type = 'Product';
                    else if (taxLower.some(t => ['page','landing','about','contact'].includes(t))) type = 'Page';
                    else if (taxLower.some(t => ['category','tag','archive'].includes(t))) type = 'Category';
                }
                const outboundSuggestions = observedLinks.filter(rec => rec.sourceId === page.id).length;
                const potentialSources = getPotentialSourceCount(page);
                orphans.push({
                    id: page.id,
                    title: page.title,
                    url: page.url,
                    type: type,
                    importance: page.priority,
                    outbound: outboundSuggestions,
                    sources: potentialSources
                });
            }
        });
        return orphans;
    }

    function renderOrphanTable() {
        const tbody = document.getElementById('orphan-pages-body');
        const badge = document.getElementById('orphan-badge');
        const panel = document.getElementById('orphan-pages-panel');
        if (!tbody || !panel) return;

        const orphans = computeOrphanPages();
        let html = '';
        orphans.forEach(o => {
            const importanceClass = o.importance >= 4 ? 'high' : o.importance >= 3 ? 'medium' : 'low';
            html += `<tr>
                <td><a href="${o.url}" class="page-link">${displayUrl(o.url)}</a></td>
                <td>${o.type}</td>
                <td><span class="importance ${importanceClass}">${o.importance}</span></td>
                <td>${o.outbound}</td>
                <td>${o.sources}</td>
            </tr>`;
        });
        tbody.innerHTML = html;

        if (orphans.length === 0) {
            panel.classList.add('is-empty');
        } else {
            panel.classList.remove('is-empty');
        }

        if (badge) badge.textContent = `${orphans.length} orphans`;
    }

    function computePriorityActions() {
        const actions = [];
        const actualPages = getActualPages();
        const observedLinks = getObservedLinks();

        actualPages.forEach(page => {
            if (!page.canReceiveLinks) return;
            const status = actionStatuses[page.id] || 'important';
            if (status === 'ignore') return;

            const hasIncoming = observedLinks.some(rec => rec.targetId === page.id);
            if (!hasIncoming) {
                actions.push({
                    priority: 'Critical',
                    page: page,
                    issue: 'Orphan page',
                    recommendation: `Add inbound links from relevant pages (${getPotentialSourceCount(page)} potential sources)`,
                    status: status
                });
            }
        });

        const inboundCount = {};
        observedLinks.forEach(rec => {
            inboundCount[rec.targetId] = (inboundCount[rec.targetId] || 0) + 1;
        });
        for (const [pageId, count] of Object.entries(inboundCount)) {
            const page = actualPages.find(p => p.id === pageId);
            if (page && count > state.rules.maxInbound) {
                const status = actionStatuses[page.id] || 'important';
                if (status === 'ignore') continue;
                actions.push({
                    priority: 'High',
                    page: page,
                    issue: `Overlinked (${count} inbound, max ${state.rules.maxInbound})`,
                    recommendation: `Reduce to max ${state.rules.maxInbound} contextual links`,
                    status: status
                });
            }
        }

        actualPages.forEach(page => {
            if (!page.canReceiveLinks) return;
            const incoming = inboundCount[page.id] || 0;
            const status = actionStatuses[page.id] || 'important';
            if (status === 'ignore') return;
            if (page.priority >= 4 && incoming < 2 && incoming > 0) {
                const alreadyOrphan = actions.some(a => a.page.id === page.id && a.issue === 'Orphan page');
                if (!alreadyOrphan) {
                    actions.push({
                        priority: 'High',
                        page: page,
                        issue: `Underlinked (${incoming} inbound, priority ${page.priority})`,
                        recommendation: `Add at least 2-3 inbound links from relevant content`,
                        status: status
                    });
                }
            }
        });

        actions.sort((a, b) => {
            const statusOrder = { 'important': 0, 'later': 1 };
            return (statusOrder[a.status] || 0) - (statusOrder[b.status] || 0);
        });

        return actions;
    }

    function computeInternalLinkOpportunities() {
        const opportunities = [];
        const actualPages = getActualPages();
        const allPages = state.pages;

        const importanceWeights = { 1: 1, 2: 2, 3: 4, 4: 7, 5: 10 };

        const existingLinks = new Set();
        state.recommendations.forEach(rec => {
            existingLinks.add(`${rec.sourceId}:${rec.targetId}`);
        });

        const projectedInbound = {};
        state.recommendations.forEach(rec => {
            projectedInbound[rec.targetId] = (projectedInbound[rec.targetId] || 0) + 1;
        });

        const sources = actualPages.filter(p => p.canLinkOut && p.tags && p.tags.length > 0);
        const targets = allPages.filter(p => p.canReceiveLinks && p.tags && p.tags.length > 0);

        for (const source of sources) {
            const maxOutbound = Math.min(
                state.rules.maxOutbound,
                Math.max(0, Math.floor((source.wordCount || 0) / 300))
            );
            const currentOutbound = state.recommendations.filter(rec => rec.sourceId === source.id).length;
            if (currentOutbound >= maxOutbound) continue;

            const sourceLang = getPageLanguage(source);

            for (const target of targets) {
                if (source.id === target.id) continue;
                if (existingLinks.has(`${source.id}:${target.id}`)) continue;

                // Language gate – reject if both have a language and they differ
                const targetLang = getPageLanguage(target);
                if (sourceLang && targetLang && sourceLang !== targetLang) continue;

                // Topic relevance – hard gate if no shared topic tags
                const R = computeRelationScore(source, target);
                if (R === 0) continue;

                const targetInbound = importanceWeights[target.priority] || 3;
                const projIn = projectedInbound[target.id] || 0;
                if (projIn >= targetInbound) continue;

                const I = (target.priority - 1) / 4;

                const N = (targetInbound - projIn) / targetInbound;

                const score = (0.4 * R + 0.3 * I + 0.3 * N) * 100;
                opportunities.push({
                    sourcePage: source,
                    targetPage: target,
                    anchor: target.primaryKeyword || target.title,
                    score: Math.round(score)
                });
            }
        }

        opportunities.sort((a, b) => b.score - a.score);
        return opportunities;
    }

    function renderOpportunitiesTable() {
        const tbody = document.getElementById('opportunities-body');
        const badge = document.getElementById('opportunity-badge');
        const panel = document.getElementById('opportunities-panel');
        if (!tbody || !panel) return;

        const opps = computeInternalLinkOpportunities();
        let html = '';
        opps.forEach(item => {
            html += `<tr>
                <td><span class="page-link" title="${item.sourcePage.url}">${item.sourcePage.title}</span></td>
                <td>${item.anchor}</td>
                <td><span class="page-link" title="${item.targetPage.url}">${item.targetPage.title}</span></td>
                <td>${item.score}%</td>
            </tr>`;
        });
        tbody.innerHTML = html;

        if (opps.length === 0) {
            panel.classList.add('is-empty');
        } else {
            panel.classList.remove('is-empty');
        }
        if (badge) badge.textContent = `${opps.length} opportunities`;
    }

    function renderPriorityActionsTable() {
        const tbody = document.getElementById('priority-actions-body');
        const badge = document.getElementById('priority-badge');
        const panel = document.getElementById('priority-actions-panel');
        if (!tbody || !panel) return;

        const actions = computePriorityActions();
        let html = '';
        actions.forEach(item => {
            const displayStatus = item.status.charAt(0).toUpperCase() + item.status.slice(1);
            html += `<tr>
                <td><span class="badge badge-${item.priority.toLowerCase()}">${item.priority}</span></td>
                <td><a href="${item.page.url}" class="page-link">${displayUrl(item.page.url)}</a></td>
                <td>${item.issue}</td>
                <td>${item.recommendation}</td>
                <td class="status-cell">
                    <div class="status-pill" data-page-id="${item.page.id}">
                        <span class="status-pill-label">${displayStatus}</span>
                        <div class="status-pill-options">
                            ${item.status !== 'ignore' ? '<button class="status-option" data-value="ignore">Ignore</button>' : ''}
                            ${item.status !== 'later' ? '<button class="status-option" data-value="later">Later</button>' : ''}
                            ${item.status !== 'important' ? '<button class="status-option" data-value="important">Important</button>' : ''}
                        </div>
                    </div>
                </td>
            </tr>`;
        });
        tbody.innerHTML = html;

        if (actions.length === 0) {
            panel.classList.add('is-empty');
        } else {
            panel.classList.remove('is-empty');
        }

        if (badge) badge.textContent = `${actions.length} issues`;
    }

    function computeAnchorDistribution() {
        const observedLinks = getObservedLinks();
        const total = observedLinks.length;
        let primaryCount = 0, secondaryCount = 0, lsiCount = 0;
        
        const primaryKeywords = {};
        const secondaryKeywords = {};
        const lsiKeywords = {};

        observedLinks.forEach(rec => {
            const kw = rec.anchorText || '';
            if (rec.anchorType === 'primary') {
                primaryCount++;
                if (!primaryKeywords[kw] || primaryKeywords[kw].lastId < rec.id) {
                    primaryKeywords[kw] = { count: (primaryKeywords[kw]?.count || 0) + 1, lastId: rec.id };
                } else {
                    primaryKeywords[kw].count++;
                }
            } else if (rec.anchorType === 'secondary') {
                secondaryCount++;
                if (!secondaryKeywords[kw] || secondaryKeywords[kw].lastId < rec.id) {
                    secondaryKeywords[kw] = { count: (secondaryKeywords[kw]?.count || 0) + 1, lastId: rec.id };
                } else {
                    secondaryKeywords[kw].count++;
                }
            } else if (rec.anchorType === 'lsi') {
                lsiCount++;
                if (!lsiKeywords[kw] || lsiKeywords[kw].lastId < rec.id) {
                    lsiKeywords[kw] = { count: (lsiKeywords[kw]?.count || 0) + 1, lastId: rec.id };
                } else {
                    lsiKeywords[kw].count++;
                }
            }
        });

        const primaryPercent = total ? Math.round((primaryCount / total) * 100) : 0;
        const secondaryPercent = total ? Math.round((secondaryCount / total) * 100) : 0;
        const lsiPercent = 100 - primaryPercent - secondaryPercent;

        function sortByLastId(keywordsObj) {
            return Object.entries(keywordsObj)
                .sort((a, b) => b[1].lastId - a[1].lastId)
                .map(([kw, data]) => ({ keyword: kw, count: data.count }));
        }

        return {
            primaryPercent,
            secondaryPercent,
            lsiPercent,
            primaryCount,
            secondaryCount,
            lsiCount,
            topPrimary: sortByLastId(primaryKeywords),
            topSecondary: sortByLastId(secondaryKeywords),
            topLsi: sortByLastId(lsiKeywords)
        };
    }

    function computeTopLinkedPages() {
        const incoming = {};
        const observedLinks = getObservedLinks();
        observedLinks.forEach(rec => {
            incoming[rec.targetId] = (incoming[rec.targetId] || 0) + 1;
        });

        return state.pages
            .filter(p => (p.pageType || 'actual') === 'actual')
            .map(page => ({
                ...page,
                incomingLinks: incoming[page.id] || 0
            }))
            .sort((a, b) => b.incomingLinks - a.incomingLinks);
    }

    function renderDistributionRow() {
        const dist = computeAnchorDistribution();
        const topPages = computeTopLinkedPages();

        const bar = document.getElementById('anchor-bar');
        if (bar) {
            const primaryPercent = dist.primaryPercent;
            const secondaryPercent = dist.secondaryPercent;
            const lsiPercent = dist.lsiPercent;

            bar.innerHTML = `
                ${primaryPercent > 0 ? `<div class="anchor-bar-segment primary" style="width:${primaryPercent}%">${primaryPercent}%</div>` : ''}
                ${secondaryPercent > 0 ? `<div class="anchor-bar-segment secondary" style="width:${secondaryPercent}%">${secondaryPercent}%</div>` : ''}
                ${lsiPercent > 0 ? `<div class="anchor-bar-segment lsi" style="width:${lsiPercent}%">${lsiPercent}%</div>` : ''}
            `;
        }

        const keywordsContainer = document.getElementById('top-keywords');
        if (keywordsContainer) {
            const buildList = (title, count, items) => `
                <div class="keyword-column">
                    <h4>${title}</h4>
                    <div class="keyword-count-summary">${count} link${count !== 1 ? 's' : ''}</div>
                    <ul class="keyword-list">
                        ${items.map(i => `<li><span class="keyword-term">${i.keyword}</span><span class="keyword-count">${i.count}</span></li>`).join('')}
                    </ul>
                </div>
            `;
            keywordsContainer.innerHTML = 
                buildList('Primary', dist.primaryCount, dist.topPrimary) +
                buildList('Secondary', dist.secondaryCount, dist.topSecondary) +
                buildList('LSI', dist.lsiCount, dist.topLsi);
        }

        const tbody = document.getElementById('top-pages-body');
        if (tbody) {
            const totalLinks = topPages.reduce((sum, p) => sum + p.incomingLinks, 0);
            tbody.innerHTML = topPages.map(p => {
                const percent = totalLinks > 0 ? (p.incomingLinks / totalLinks * 100).toFixed(2) : '0.00';
                return `
                    <tr>
                        <td><a href="${p.url}" class="page-link">${displayUrl(p.url)}</a></td>
                        <td>${p.incomingLinks}</td>
                        <td>${percent}%</td>
                    </tr>
                `;
            }).join('');
        }
    }

    function openPagesListModal() {
        activePagesTab = 'actual';
        updatePagesTabUI();
        renderPagesList(activePagesTab);
        openModal(document.getElementById('pagesListModal'));
    }

    function updatePagesTabUI() {
        const actualEl = document.getElementById('pagesTabActual');
        const plannedEl = document.getElementById('pagesTabPlanned');
        if (actualEl) {
            actualEl.classList.toggle('active', activePagesTab === 'actual');
        }
        if (plannedEl) {
            plannedEl.classList.toggle('active', activePagesTab === 'planned');
        }
    }

    function renderPagesList(filterType = 'actual') {
        const tbody = document.getElementById('pages-list-body');
        if (!tbody) return;

        const filteredPages = state.pages.filter(p => (p.pageType || 'actual') === filterType);
        const isPlanned = filterType === 'planned';
        let html = '';
        filteredPages.forEach(page => {
            const outboundCount = state.recommendations.filter(rec => 
                rec.sourceId === page.id && (isPlanned ? rec.linkType === 'intent' : rec.linkType === 'observed')
            ).length;
            const incomingCount = state.recommendations.filter(rec => 
                rec.targetId === page.id && (isPlanned ? rec.linkType === 'intent' : rec.linkType === 'observed')
            ).length;
            const topicTags = getTopicTags(page);
            const tagsStr = topicTags.length ? topicTags.join(', ') : '—';
            html += `<tr data-page-id="${page.id}">
                <td>${page.title}</td>
                <td>${page.wordCount}</td>
                <td>${outboundCount}</td>
                <td>${incomingCount}</td>
                <td>${tagsStr}</td>
            </tr>`;
        });
        tbody.innerHTML = html || `<tr><td colspan="5" class="empty-table-message">No ${filterType === 'actual' ? 'actual' : 'planned'} pages found.</td></tr>`;

        tbody.onclick = (e) => {
            const row = e.target.closest('tr');
            if (!row) return;
            const pageId = row.getAttribute('data-page-id');
            if (pageId) openEditPageModal(pageId);
        };
    }

    // ========== INITIALIZATION ==========
    document.addEventListener('DOMContentLoaded', async () => {
        setupAuthListeners();
        customElements.whenDefined('sidebar-component').then(() => {
            getSidebarComponent();
            syncSidebarComponent();
        });
        await restoreSession();
        bindOrvellaEvents();
        renderOverviewGauges();
        adjustModalPrefixes(elements.addPageModal);
        document.querySelectorAll('.auth-logo, .header-logo').forEach(img => {
            img.addEventListener('error', () => {
                img.style.display = 'none';
            });
        });
    });

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'ravlo-toast';

        const radius = 10;
        const circumference = 2 * Math.PI * radius;

        toast.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" class="toast-ring">
                <circle cx="12" cy="12" r="${radius}" fill="none" 
                        stroke="rgba(255,255,255,0.3)" stroke-width="2"/>
                <circle cx="12" cy="12" r="${radius}" fill="none" 
                        stroke="#fff" stroke-width="2"
                        stroke-dasharray="${circumference}" stroke-dashoffset="0"
                        stroke-linecap="round"
                        style="transition: stroke-dashoffset 4s linear;"/>
            </svg>
            <span>${message}</span>
        `;

        document.body.appendChild(toast);

        requestAnimationFrame(() => {
            const ring = toast.querySelector('.toast-ring circle:last-child');
            if (ring) {
                ring.style.strokeDashoffset = circumference;
            }
        });

        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, 4000);
    }

})();