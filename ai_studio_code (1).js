(function () {
  const {
    CONFIG,
    getEntries,
    addEntry,
    approveEntry,
    updateEntry,
    deleteEntry
  } = window.AppStorage;

  // Application State
  const state = {
    allEntries: [],
    approvedEntries: [],
    pendingEntries: [],
    spotlightEntry: null,
    selectedCategory: 'All',
    searchQuery: '',
    adminTab: 'pending',
    isAdminUnlocked: sessionStorage.getItem(CONFIG.ADMIN_SESSION_KEY) === 'true'
  };

  // DOM References
  const els = {
    // Theme
    themeBtns: document.querySelectorAll('.theme-btn'),
    // Spotlight
    spotlightCategory: document.getElementById('spotlightCategory'),
    spotlightText: document.getElementById('spotlightText'),
    spotlightAuthor: document.getElementById('spotlightAuthor'),
    newSpotlightBtn: document.getElementById('newSpotlightBtn'),
    copySpotlightBtn: document.getElementById('copySpotlightBtn'),
    // Filter & Grid
    searchInput: document.getElementById('searchInput'),
    categoryPills: document.getElementById('categoryPills'),
    entriesCount: document.getElementById('entriesCount'),
    entriesGrid: document.getElementById('entriesGrid'),
    emptyState: document.getElementById('emptyState'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    // Submit Modal
    submitModal: document.getElementById('submitModal'),
    openSubmitModalBtn: document.getElementById('openSubmitModalBtn'),
    submitForm: document.getElementById('submitForm'),
    submitFeedback: document.getElementById('submitFeedback'),
    entryTextInput: document.getElementById('entryTextInput'),
    entryCategorySelect: document.getElementById('entryCategorySelect'),
    customCategoryGroup: document.getElementById('customCategoryGroup'),
    customCategoryInput: document.getElementById('customCategoryInput'),
    entryAuthorInput: document.getElementById('entryAuthorInput'),
    // Admin Modal
    adminModal: document.getElementById('adminModal'),
    openAdminModalBtn: document.getElementById('openAdminModalBtn'),
    adminLoginForm: document.getElementById('adminLoginForm'),
    adminLoginError: document.getElementById('adminLoginError'),
    adminPasswordInput: document.getElementById('adminPasswordInput'),
    togglePasswordBtn: document.getElementById('togglePasswordBtn'),
    adminDashboardView: document.getElementById('adminDashboardView'),
    adminTabs: document.querySelectorAll('.admin-tab'),
    pendingCountBadge: document.getElementById('pendingCountBadge'),
    publishedCountBadge: document.getElementById('publishedCountBadge'),
    adminPendingList: document.getElementById('adminPendingList'),
    adminPublishedList: document.getElementById('adminPublishedList'),
    adminAddDirectBtn: document.getElementById('adminAddDirectBtn'),
    adminLogoutBtn: document.getElementById('adminLogoutBtn'),
    adminEditorForm: document.getElementById('adminEditorForm'),
    adminEditorTitle: document.getElementById('adminEditorTitle'),
    cancelAdminEditorBtn: document.getElementById('cancelAdminEditorBtn'),
    adminEditId: document.getElementById('adminEditId'),
    adminEditText: document.getElementById('adminEditText'),
    adminEditCategory: document.getElementById('adminEditCategory'),
    adminEditAuthor: document.getElementById('adminEditAuthor'),
    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  // =========================================================
  // Utilities
  // =========================================================
  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    els.toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2600);
  }

  async function copyEntryText(entry, buttonEl = null) {
    const formatted = `"${entry.text}" — ${entry.author}`;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(formatted);
      } else {
        const temp = document.createElement('textarea');
        temp.value = formatted;
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        temp.remove();
      }

      showToast('Copied to clipboard');
      if (buttonEl) {
        const label = buttonEl.querySelector('span');
        if (label) {
          const prev = label.textContent;
          label.textContent = 'Copied!';
          setTimeout(() => {
            label.textContent = prev;
          }, 1500);
        }
      }
    } catch (err) {
      showToast('Unable to copy automatically');
    }
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  // =========================================================
  // Theme Switcher
  // =========================================================
  function applyTheme(theme) {
    const valid = ['light', 'sepia', 'dark'].includes(theme) ? theme : 'light';
    document.documentElement.setAttribute('data-theme', valid);
    try {
      localStorage.setItem(CONFIG.THEME_KEY, valid);
    } catch (e) {}

    els.themeBtns.forEach((btn) => {
      const isActive = btn.dataset.themeValue === valid;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });
  }

  function initTheme() {
    let saved = 'light';
    try {
      saved = localStorage.getItem(CONFIG.THEME_KEY) || 'light';
    } catch (e) {}
    applyTheme(saved);

    els.themeBtns.forEach((btn) => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.themeValue));
    });
  }

  // =========================================================
  // Data Sync & Rendering
  // =========================================================
  async function refreshData() {
    state.allEntries = await getEntries();
    state.approvedEntries = state.allEntries.filter((e) => e.status === 'approved');
    state.pendingEntries = state.allEntries.filter((e) => e.status === 'pending');

    // Keep spotlight valid or pick a random approved entry
    if (state.approvedEntries.length === 0) {
      state.spotlightEntry = null;
    } else if (
      !state.spotlightEntry ||
      !state.approvedEntries.some((e) => e.id === state.spotlightEntry.id)
    ) {
      pickRandomSpotlight();
    } else {
      state.spotlightEntry = state.approvedEntries.find(
        (e) => e.id === state.spotlightEntry.id
      );
    }

    renderSpotlight();
    renderCategoryPills();
    renderApprovedGrid();
    renderAdminDashboard();
  }

  function pickRandomSpotlight() {
    const list = state.approvedEntries;
    if (list.length === 0) {
      state.spotlightEntry = null;
      return;
    }
    if (list.length === 1) {
      state.spotlightEntry = list[0];
      return;
    }
    const candidates = state.spotlightEntry
      ? list.filter((item) => item.id !== state.spotlightEntry.id)
      : list;
    const randomIndex = Math.floor(Math.random() * candidates.length);
    state.spotlightEntry = candidates[randomIndex];
  }

  function renderSpotlight() {
    if (!state.spotlightEntry) {
      els.spotlightCategory.textContent = 'Archive';
      els.spotlightText.textContent = 'No approved entries yet. Submit one to get started!';
      els.spotlightAuthor.textContent = '';
      els.copySpotlightBtn.disabled = true;
      els.newSpotlightBtn.disabled = true;
      return;
    }

    els.copySpotlightBtn.disabled = false;
    els.newSpotlightBtn.disabled = false;
    els.spotlightCategory.textContent = state.spotlightEntry.category;
    els.spotlightText.textContent = `“${state.spotlightEntry.text}”`;
    els.spotlightAuthor.textContent = `— ${state.spotlightEntry.author}`;
  }

  function renderCategoryPills() {
    const categories = Array.from(
      new Set(state.approvedEntries.map((item) => item.category))
    ).sort((a, b) => a.localeCompare(b));

    if (
      state.selectedCategory !== 'All' &&
      !categories.includes(state.selectedCategory)
    ) {
      state.selectedCategory = 'All';
    }

    const allPills = ['All', ...categories];
    els.categoryPills.innerHTML = allPills
      .map(
        (cat) => `
        <button
          type="button"
          class="pill-btn ${state.selectedCategory === cat ? 'active' : ''}"
          data-category="${escapeHtml(cat)}"
          role="tab"
          aria-selected="${state.selectedCategory === cat}"
        >
          ${escapeHtml(cat)}
        </button>`
      )
      .join('');
  }

  function getFilteredApproved() {
    const query = state.searchQuery.trim().toLowerCase();
    return state.approvedEntries.filter((item) => {
      const matchesCategory =
        state.selectedCategory === 'All' ||
        item.category === state.selectedCategory;
      if (!matchesCategory) return false;
      if (!query) return true;

      return (
        item.text.toLowerCase().includes(query) ||
        item.author.toLowerCase().includes(query) ||
        item.category.toLowerCase().includes(query)
      );
    });
  }

  function renderApprovedGrid() {
    const items = getFilteredApproved();
    els.entriesCount.textContent = `${items.length} ${
      items.length === 1 ? 'entry' : 'entries'
    }`;

    if (items.length === 0) {
      els.entriesGrid.innerHTML = '';
      els.emptyState.classList.remove('hidden');
      return;
    }

    els.emptyState.classList.add('hidden');
    els.entriesGrid.innerHTML = items
      .map(
        (item) => `
        <article class="entry-card">
          <div>
            <div class="entry-card-top">
              <span class="category-badge">${escapeHtml(item.category)}</span>
            </div>
            <p class="entry-text" style="margin-top: 0.9rem;">${escapeHtml(item.text)}</p>
          </div>
          <div class="entry-card-footer">
            <span class="entry-author">— ${escapeHtml(item.author)}</span>
            <button
              type="button"
              class="btn btn-outline copy-card-btn"
              data-copy-id="${escapeHtml(item.id)}"
              aria-label="Copy entry by ${escapeHtml(item.author)}"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              <span>Copy</span>
            </button>
          </div>
        </article>`
      )
      .join('');
  }

  // =========================================================
  // Modals (Submit & Admin)
  // =========================================================
  function openModal(modalEl) {
    modalEl.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function closeModal(modalEl) {
    modalEl.classList.add('hidden');
    document.body.style.overflow = '';
    if (modalEl === els.adminModal && window.location.hash === '#admin') {
      history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  }

  // =========================================================
  // Public Submission Flow
  // =========================================================
  function initSubmitFeature() {
    els.openSubmitModalBtn.addEventListener('click', () => {
      els.submitFeedback.classList.add('hidden');
      els.submitForm.reset();
      els.customCategoryGroup.classList.add('hidden');
      openModal(els.submitModal);
      els.entryTextInput.focus();
    });

    els.entryCategorySelect.addEventListener('change', () => {
      const isCustom = els.entryCategorySelect.value === '__custom__';
      els.customCategoryGroup.classList.toggle('hidden', !isCustom);
      if (isCustom) els.customCategoryInput.focus();
    });

    els.submitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      els.submitFeedback.classList.add('hidden');
      els.submitFeedback.classList.remove('alert-error');

      const text = els.entryTextInput.value.trim();
      if (!text) {
        els.submitFeedback.textContent = 'Please enter a fact or quote before submitting.';
        els.submitFeedback.classList.add('alert-error');
        els.submitFeedback.classList.remove('hidden');
        els.entryTextInput.focus();
        return;
      }

      let category = els.entryCategorySelect.value;
      if (category === '__custom__') {
        category = els.customCategoryInput.value.trim();
        if (!category) {
          els.submitFeedback.textContent = 'Please enter a custom category tag.';
          els.submitFeedback.classList.add('alert-error');
          els.submitFeedback.classList.remove('hidden');
          els.customCategoryInput.focus();
          return;
        }
      }

      const author = els.entryAuthorInput.value.trim() || 'Anonymous';

      await addEntry({
        text,
        category,
        author,
        status: 'pending'
      });

      els.submitForm.reset();
      els.customCategoryGroup.classList.add('hidden');
      els.submitFeedback.textContent = 'Thank you! Your submission is pending admin approval.';
      els.submitFeedback.classList.remove('hidden');

      await refreshData();
    });
  }

  // =========================================================
  // Admin Dashboard & Moderation
  // =========================================================
  function updateAdminAuthUI() {
    els.adminLoginError.classList.add('hidden');
    if (state.isAdminUnlocked) {
      els.adminLoginForm.classList.add('hidden');
      els.adminDashboardView.classList.remove('hidden');
      renderAdminDashboard();
    } else {
      els.adminDashboardView.classList.add('hidden');
      els.adminLoginForm.classList.remove('hidden');
    }
  }

  function openAdminModal() {
    updateAdminAuthUI();
    openModal(els.adminModal);
    if (!state.isAdminUnlocked) {
      els.adminPasswordInput.value = '';
      els.adminPasswordInput.focus();
    }
  }

  function renderAdminDashboard() {
    if (!state.isAdminUnlocked) return;

    els.pendingCountBadge.textContent = state.pendingEntries.length;
    els.publishedCountBadge.textContent = state.approvedEntries.length;

    els.adminTabs.forEach((tab) => {
      const active = tab.dataset.adminTab === state.adminTab;
      tab.classList.toggle('active', active);
      tab.setAttribute('aria-selected', String(active));
    });

    els.adminPendingList.classList.toggle('hidden', state.adminTab !== 'pending');
    els.adminPublishedList.classList.toggle('hidden', state.adminTab !== 'published');

    // Render Pending List
    if (state.pendingEntries.length === 0) {
      els.adminPendingList.innerHTML =
        '<div class="admin-empty">No submissions waiting for review.</div>';
    } else {
      els.adminPendingList.innerHTML = state.pendingEntries
        .map(
          (item) => `
          <div class="admin-item">
            <div class="admin-item-meta">
              <span class="category-badge">${escapeHtml(item.category)}</span>
              <span>Submitted ${escapeHtml(formatDate(item.createdAt))}</span>
            </div>
            <p class="admin-item-text">${escapeHtml(item.text)}</p>
            <div class="admin-item-footer">
              <span class="admin-item-author">— ${escapeHtml(item.author)}</span>
              <div class="admin-item-actions">
                <button type="button" class="btn btn-success btn-sm" data-admin-action="approve" data-id="${escapeHtml(item.id)}">Approve</button>
                <button type="button" class="btn btn-secondary btn-sm" data-admin-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" data-admin-action="delete" data-id="${escapeHtml(item.id)}">Reject / Delete</button>
              </div>
            </div>
          </div>`
        )
        .join('');
    }

    // Render Published List
    if (state.approvedEntries.length === 0) {
      els.adminPublishedList.innerHTML =
        '<div class="admin-empty">No published entries yet.</div>';
    } else {
      els.adminPublishedList.innerHTML = state.approvedEntries
        .map(
          (item) => `
          <div class="admin-item">
            <div class="admin-item-meta">
              <span class="category-badge">${escapeHtml(item.category)}</span>
              <span>Published ${escapeHtml(formatDate(item.createdAt))}</span>
            </div>
            <p class="admin-item-text">${escapeHtml(item.text)}</p>
            <div class="admin-item-footer">
              <span class="admin-item-author">— ${escapeHtml(item.author)}</span>
              <div class="admin-item-actions">
                <button type="button" class="btn btn-secondary btn-sm" data-admin-action="edit" data-id="${escapeHtml(item.id)}">Edit</button>
                <button type="button" class="btn btn-danger btn-sm" data-admin-action="delete" data-id="${escapeHtml(item.id)}">Delete</button>
              </div>
            </div>
          </div>`
        )
        .join('');
    }
  }

  function openAdminEditor(entry = null) {
    if (entry) {
      els.adminEditorTitle.textContent =
        entry.status === 'pending'
          ? 'Edit Submission Before Approving'
          : 'Edit Published Entry';
      els.adminEditId.value = entry.id;
      els.adminEditText.value = entry.text;
      els.adminEditCategory.value = entry.category;
      els.adminEditAuthor.value = entry.author;
    } else {
      els.adminEditorTitle.textContent = 'Add New Entry Directly (Auto-Approved)';
      els.adminEditId.value = '';
      els.adminEditText.value = '';
      els.adminEditCategory.value = 'Quotes';
      els.adminEditAuthor.value = '';
    }
    els.adminEditorForm.classList.remove('hidden');
    els.adminEditText.focus();
  }

  function initAdminFeature() {
    els.openAdminModalBtn.addEventListener('click', openAdminModal);

    els.togglePasswordBtn.addEventListener('click', () => {
      const isHidden = els.adminPasswordInput.type === 'password';
      els.adminPasswordInput.type = isHidden ? 'text' : 'password';
      els.togglePasswordBtn.textContent = isHidden ? 'Hide' : 'Show';
    });

    els.adminLoginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (els.adminPasswordInput.value === CONFIG.ADMIN_PASSWORD) {
        state.isAdminUnlocked = true;
        sessionStorage.setItem(CONFIG.ADMIN_SESSION_KEY, 'true');
        updateAdminAuthUI();
        showToast('Admin dashboard unlocked');
      } else {
        els.adminLoginError.textContent = 'Incorrect password. Please try again.';
        els.adminLoginError.classList.remove('hidden');
        els.adminPasswordInput.select();
      }
    });

    els.adminLogoutBtn.addEventListener('click', () => {
      state.isAdminUnlocked = false;
      sessionStorage.removeItem(CONFIG.ADMIN_SESSION_KEY);
      els.adminEditorForm.classList.add('hidden');
      updateAdminAuthUI();
      showToast('Admin dashboard locked');
    });

    els.adminTabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        state.adminTab = tab.dataset.adminTab;
        renderAdminDashboard();
      });
    });

    els.adminAddDirectBtn.addEventListener('click', () => openAdminEditor(null));
    els.cancelAdminEditorBtn.addEventListener('click', () => {
      els.adminEditorForm.classList.add('hidden');
    });

    els.adminEditorForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = els.adminEditId.value;
      const text = els.adminEditText.value.trim();
      const category = els.adminEditCategory.value.trim() || 'General';
      const author = els.adminEditAuthor.value.trim() || 'Anonymous';

      if (!text) return;

      if (id) {
        await updateEntry(id, { text, category, author });
        showToast('Entry updated');
      } else {
        await addEntry({ text, category, author, status: 'approved' });
        showToast('Entry published directly');
      }

      els.adminEditorForm.classList.add('hidden');
      await refreshData();
    });

    // Delegate Approve / Edit / Delete clicks
    els.adminDashboardView.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-admin-action]');
      if (!btn) return;

      const action = btn.dataset.adminAction;
      const id = btn.dataset.id;

      if (action === 'approve') {
        await approveEntry(id);
        showToast('Approved and published live!');
        await refreshData();
      } else if (action === 'edit') {
        const target = state.allEntries.find((item) => item.id === id);
        if (target) openAdminEditor(target);
      } else if (action === 'delete') {
        await deleteEntry(id);
        showToast('Entry removed');
        await refreshData();
      }
    });

    // Support opening via /admin path or #admin hash
    if (
      window.location.pathname.endsWith('/admin') ||
      window.location.hash === '#admin'
    ) {
      openAdminModal();
    }
    window.addEventListener('hashchange', () => {
      if (window.location.hash === '#admin') openAdminModal();
    });
  }

  // =========================================================
  // Event Wiring & Boot
  // =========================================================
  function initPublicInteractions() {
    els.newSpotlightBtn.addEventListener('click', () => {
      pickRandomSpotlight();
      renderSpotlight();
    });

    els.copySpotlightBtn.addEventListener('click', () => {
      if (state.spotlightEntry) {
        copyEntryText(state.spotlightEntry, els.copySpotlightBtn);
      }
    });

    els.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value;
      renderApprovedGrid();
    });

    els.categoryPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      state.selectedCategory = btn.dataset.category;
      renderCategoryPills();
      renderApprovedGrid();
    });

    els.resetFiltersBtn.addEventListener('click', () => {
      state.searchQuery = '';
      state.selectedCategory = 'All';
      els.searchInput.value = '';
      renderCategoryPills();
      renderApprovedGrid();
    });

    els.entriesGrid.addEventListener('click', (e) => {
      const copyBtn = e.target.closest('[data-copy-id]');
      if (!copyBtn) return;
      const entry = state.approvedEntries.find(
        (item) => item.id === copyBtn.dataset.copyId
      );
      if (entry) copyEntryText(entry, copyBtn);
    });

    // Modal close handlers
    document.querySelectorAll('[data-close-modal]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const modal = document.getElementById(btn.dataset.closeModal);
        if (modal) closeModal(modal);
      });
    });

    [els.submitModal, els.adminModal].forEach((modal) => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal(modal);
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (!els.submitModal.classList.contains('hidden')) closeModal(els.submitModal);
        if (!els.adminModal.classList.contains('hidden')) closeModal(els.adminModal);
      }
    });
  }

  async function init() {
    initTheme();
    initPublicInteractions();
    initSubmitFeature();
    initAdminFeature();
    await refreshData();
  }

  init();
})();