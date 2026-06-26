/* =====================================================================
   PaDi Shooter 89 - Local Leaderboard
   Stores high scores in the browser using localStorage.
   ===================================================================== */
(function () {
  'use strict';
  const PADI = (window.PADI = window.PADI || {});
  const KEY = 'padishooter89.leaderboard.v1';
  const MAX_ENTRIES = 25;

  const Leaderboard = {
    load() {
      try {
        const raw = localStorage.getItem(KEY);
        const list = raw ? JSON.parse(raw) : [];
        return Array.isArray(list) ? list : [];
      } catch (e) {
        return [];
      }
    },

    _save(list) {
      try {
        localStorage.setItem(KEY, JSON.stringify(list));
      } catch (e) {
        /* storage might be full or blocked - fail silently */
      }
    },

    _sort(list) {
      list.sort((a, b) => {
        if (b.goals !== a.goals) return b.goals - a.goals; // most goals first
        if (b.win !== a.win) return b.win - a.win; // then winners
        return (b.date || '').localeCompare(a.date || ''); // newest first
      });
      return list;
    },

    add(entry) {
      const list = this.load();
      const clean = {
        name: String(entry.name || 'PLAYER').slice(0, 10).toUpperCase(),
        goals: entry.goals | 0,
        against: entry.against | 0,
        opponent: String(entry.opponent || '').slice(0, 10),
        mode: entry.mode || '1P',
        win: entry.win ? 1 : 0,
        date: new Date().toISOString(),
      };
      list.push(clean);
      this._sort(list);
      const trimmed = list.slice(0, MAX_ENTRIES);
      this._save(trimmed);
      return trimmed;
    },

    top(n) {
      return this._sort(this.load()).slice(0, n || 10);
    },

    clear() {
      this._save([]);
    },
  };

  PADI.Leaderboard = Leaderboard;
})();
