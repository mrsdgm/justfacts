/**
 * ============================================================================
 * STORAGE LAYER (Isolated Data Access)
 * ============================================================================
 * Out-of-the-box: Uses localStorage seeded with curated entries.
 * Production Hosting (Vercel / Netlify): Replace the body of the 5 async
 * functions below (getEntries, addEntry, approveEntry, updateEntry, deleteEntry)
 * with Supabase or Firebase calls so all visitors share a live database.
 */
(function (global) {
  const STORAGE_KEY = 'commonplace_entries_v1';
  const THEME_KEY = 'commonplace_theme';
  const ADMIN_SESSION_KEY = 'commonplace_admin_unlocked';

  // Supports build/runtime env injection (e.g. window.APP_CONFIG.ADMIN_PASSWORD)
  const ADMIN_PASSWORD =
    (global.APP_CONFIG && global.APP_CONFIG.ADMIN_PASSWORD) || 'mrsdGM@7';

  const SEED_ENTRIES = [
    {
      id: 'seed-1',
      text: 'Most friendships are full of betrayal and people will stay close only until they can use you, while true friends treat you the same way always and genuinely care about you.',
      category: 'Quotes',
      author: 'mrsdgm',
      status: 'approved',
      createdAt: '2026-01-10T09:00:00.000Z'
    },
    {
      id: 'seed-2',
      text: 'Light from the Sun takes approximately 8 minutes and 20 seconds to reach Earth, traveling across roughly 150 million kilometers of space.',
      category: 'Space',
      author: 'NASA Science',
      status: 'approved',
      createdAt: '2026-01-11T10:30:00.000Z'
    },
    {
      id: 'seed-3',
      text: 'A sidereal day on Venus—one complete rotation on its axis—takes about 243 Earth days, making it longer than a Venusian year of roughly 225 Earth days.',
      category: 'Space',
      author: 'NASA Planetary Fact Sheet',
      status: 'approved',
      createdAt: '2026-01-12T11:15:00.000Z'
    },
    {
      id: 'seed-4',
      text: 'Oxford University began teaching around 1096, making it more than two centuries older than the founding of the Aztec capital of Tenochtitlan in 1325.',
      category: 'History',
      author: 'Historical Records',
      status: 'approved',
      createdAt: '2026-01-13T14:00:00.000Z'
    },
    {
      id: 'seed-5',
      text: 'The DNA inside a single human cell measures roughly 2 meters in length when uncoiled, yet packs tightly into a microscopic nucleus just a few micrometers wide.',
      category: 'Science',
      author: 'National Human Genome Research Institute',
      status: 'approved',
      createdAt: '2026-01-14T16:45:00.000Z'
    },
    {
      id: 'seed-6',
      text: 'We suffer more often in imagination than in reality.',
      category: 'Quotes',
      author: 'Seneca',
      status: 'approved',
      createdAt: '2026-01-15T08:20:00.000Z'
    }
  ];

  function readAllFromLocal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_ENTRIES));
        return [...SEED_ENTRIES];
      }
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [...SEED_ENTRIES];
    } catch (err) {
      console.error('Storage read failed:', err);
      return [...SEED_ENTRIES];
    }
  }

  function writeAllToLocal(entries) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  }

  function generateId() {
    if (global.crypto && typeof global.crypto.randomUUID === 'function') {
      return global.crypto.randomUUID();
    }
    return 'entry-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
  }

  /**
   * Fetch entries, optionally filtered by status ('approved' | 'pending').
   */
  async function getEntries(filterStatus = null) {
    const entries = readAllFromLocal();
    const sorted = [...entries].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
    if (!filterStatus) return sorted;
    return sorted.filter((item) => item.status === filterStatus);
  }

  /**
   * Add a new fact or quote (defaults to status: "pending" for public submissions).
   */
  async function addEntry({ text, category, author, status = 'pending' }) {
    const entries = readAllFromLocal();
    const cleanText = String(text || '').trim();
    const cleanCategory = String(category || 'General').trim() || 'General';
    const cleanAuthor = String(author || '').trim() || 'Anonymous';

    const newEntry = {
      id: generateId(),
      text: cleanText,
      category: cleanCategory,
      author: cleanAuthor,
      status: status === 'approved' ? 'approved' : 'pending',
      createdAt: new Date().toISOString()
    };

    entries.unshift(newEntry);
    writeAllToLocal(entries);
    return newEntry;
  }

  /**
   * Approve a pending entry by ID so it immediately appears on the live site.
   */
  async function approveEntry(id) {
    const entries = readAllFromLocal();
    const index = entries.findIndex((item) => item.id === id);
    if (index === -1) return null;

    entries[index] = {
      ...entries[index],
      status: 'approved'
    };
    writeAllToLocal(entries);
    return entries[index];
  }

  /**
   * Edit an existing entry's text, category, or author before or after approval.
   */
  async function updateEntry(id, updates) {
    const entries = readAllFromLocal();
    const index = entries.findIndex((item) => item.id === id);
    if (index === -1) return null;

    entries[index] = {
      ...entries[index],
      text: updates.text !== undefined ? String(updates.text).trim() : entries[index].text,
      category:
        updates.category !== undefined
          ? String(updates.category).trim() || 'General'
          : entries[index].category,
      author:
        updates.author !== undefined
          ? String(updates.author).trim() || 'Anonymous'
          : entries[index].author
    };
    writeAllToLocal(entries);
    return entries[index];
  }

  /**
   * Permanently reject or delete an entry by ID.
   */
  async function deleteEntry(id) {
    const entries = readAllFromLocal();
    const next = entries.filter((item) => item.id !== id);
    writeAllToLocal(next);
    return true;
  }

  global.AppStorage = {
    CONFIG: {
      THEME_KEY,
      ADMIN_SESSION_KEY,
      ADMIN_PASSWORD
    },
    getEntries,
    addEntry,
    approveEntry,
    updateEntry,
    deleteEntry
  };
})(window);