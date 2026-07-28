(() => {
  "use strict";

  const STORAGE_KEY = "herotrack.quests.v2";
  const RIVALS_KEY = "herotrack.rivals.v1";
  const YOU_NAME = "You";
  const YOU_AVATAR = "🦸";

  const DEFAULT_RIVALS = [
    { id: "r1", name: "Turbo Tori", avatar: "🐯", max: 280 },
    { id: "r2", name: "Captain Cloud", avatar: "☁️", max: 180 },
    { id: "r3", name: "Mega Mochi", avatar: "🍡", max: 220 },
    { id: "r4", name: "Ninja Newt", avatar: "🦎", max: 150 },
    { id: "r5", name: "Sir Waffles", avatar: "🧇", max: 200 },
  ];

  function loadRivals() {
    try {
      const raw = localStorage.getItem(RIVALS_KEY);
      if (raw) return JSON.parse(raw);
      saveRivals(DEFAULT_RIVALS);
      return DEFAULT_RIVALS;
    } catch {
      return DEFAULT_RIVALS;
    }
  }

  function saveRivals(rivals) {
    localStorage.setItem(RIVALS_KEY, JSON.stringify(rivals));
  }

  // ----- DOM refs -----
  const questList = document.getElementById("quest-list");
  const emptyState = document.getElementById("empty-state");
  const form = document.getElementById("quest-form");
  const nameInput = document.getElementById("quest-name");
  const pointChoice = document.getElementById("point-choice");
  const questTemplate = document.getElementById("quest-template");
  const boardRowTemplate = document.getElementById("board-row-template");
  const totalPointsEl = document.getElementById("total-points");
  const levelNumberEl = document.getElementById("level-number");
  const todayLabel = document.getElementById("today-label");
  const todayPointsEarned = document.getElementById("today-points-earned");
  const tabs = document.getElementById("tabs");
  const confettiLayer = document.getElementById("confetti-layer");
  const heroForm = document.getElementById("hero-form");
  const heroAvatarInput = document.getElementById("hero-avatar");
  const heroNameInput = document.getElementById("hero-name");
  const heroDifficulty = document.getElementById("hero-difficulty");
  const heroList = document.getElementById("hero-list");
  const heroEmptyState = document.getElementById("hero-empty-state");
  const heroCardTemplate = document.getElementById("hero-card-template");

  let selectedPoints = 10;
  let selectedHeroMax = 220;

  // ----- Storage -----
  function loadQuests() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveQuests(quests) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(quests));
  }

  // ----- Date helpers -----
  function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function todayKey() {
    return formatDateKey(new Date());
  }

  function startOfWeek(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function weekKey(date) {
    const start = startOfWeek(date);
    return formatDateKey(start);
  }

  function monthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function daysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  // ----- Streaks -----
  function currentStreak(quest) {
    let streak = 0;
    const cursor = new Date();
    if (!quest.completions[formatDateKey(cursor)]) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (quest.completions[formatDateKey(cursor)]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // ----- Points math -----
  function pointsOnDate(quests, key) {
    return quests.reduce((sum, q) => sum + (q.completions[key] ? q.points : 0), 0);
  }

  function totalPoints(quests) {
    let sum = 0;
    quests.forEach((q) => {
      Object.keys(q.completions).forEach((key) => {
        if (q.completions[key]) sum += q.points;
      });
    });
    return sum;
  }

  function weeklyPoints(quests) {
    const start = startOfWeek(new Date());
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      if (d > new Date()) break;
      sum += pointsOnDate(quests, formatDateKey(d));
    }
    return sum;
  }

  function monthlyPoints(quests) {
    const now = new Date();
    let sum = 0;
    for (let day = 1; day <= now.getDate(); day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      sum += pointsOnDate(quests, formatDateKey(d));
    }
    return sum;
  }

  // ----- Deterministic "rival" scores (seeded, no server needed) -----
  function seededRandom(seedStr) {
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) {
      h = (Math.imul(31, h) + seedStr.charCodeAt(i)) | 0;
    }
    return function next() {
      h = Math.imul(h ^ (h >>> 15), 2246822519);
      h ^= h >>> 13;
      h = Math.imul(h, 3266489917);
      h ^= h >>> 16;
      return (h >>> 0) / 4294967296;
    };
  }

  function rivalScore(rival, periodKey, fractionElapsed) {
    const rng = seededRandom(rival.name + periodKey);
    const base = rng() * rival.max * fractionElapsed;
    const jitter = rng() * 12;
    return Math.round(base + jitter);
  }

  function weekFractionElapsed() {
    const day = (new Date().getDay() + 6) % 7; // 0=Mon
    return (day + 1) / 7;
  }

  function monthFractionElapsed() {
    const now = new Date();
    return now.getDate() / daysInMonth(now);
  }

  // ----- Rendering: quests -----
  function renderQuests(quests) {
    emptyState.hidden = quests.length > 0;
    questList.innerHTML = "";
    const key = todayKey();
    let pointsToday = 0;
    let doneCount = 0;

    quests.forEach((quest) => {
      const node = questTemplate.content.cloneNode(true);
      const checkBtn = node.querySelector(".quest-check");
      const nameEl = node.querySelector(".quest-name");
      const streakNumEl = node.querySelector(".streak-number");
      const removeBtn = node.querySelector(".quest-remove");
      const pointsValueEl = node.querySelector(".points-value");

      const doneToday = !!quest.completions[key];
      if (doneToday) {
        pointsToday += quest.points;
        doneCount++;
      }

      nameEl.textContent = quest.name;
      pointsValueEl.textContent = String(quest.points);
      checkBtn.setAttribute("aria-pressed", String(doneToday));
      streakNumEl.textContent = String(currentStreak(quest));

      checkBtn.addEventListener("click", () => toggleCompletion(quest.id));
      removeBtn.addEventListener("click", () => removeQuest(quest.id, quest.name));

      questList.appendChild(node);
    });

    todayPointsEarned.textContent = `+${pointsToday} today`;
    if (quests.length > 0 && doneCount === quests.length) {
      burstConfetti();
    }
  }

  // ----- Rendering: leaderboards -----
  function renderBoard(kind) {
    const quests = loadQuests();
    const isWeekly = kind === "weekly";
    const periodKey = isWeekly ? weekKey(new Date()) : monthKey(new Date());
    const fraction = isWeekly ? weekFractionElapsed() : monthFractionElapsed();
    const yourScore = isWeekly ? weeklyPoints(quests) : monthlyPoints(quests);

    const rivals = loadRivals();
    const entries = rivals.map((r) => ({
      name: r.name,
      avatar: r.avatar,
      score: rivalScore(r, periodKey, fraction),
    }));
    entries.push({ name: YOU_NAME, avatar: YOU_AVATAR, score: yourScore, isYou: true });
    entries.sort((a, b) => b.score - a.score);

    const podiumEl = document.getElementById(`${kind}-podium`);
    const listEl = document.getElementById(`${kind}-list`);
    podiumEl.innerHTML = "";
    listEl.innerHTML = "";

    const medals = ["🥇", "🥈", "🥉"];
    const podiumOrder = [1, 0, 2]; // visual order: 2nd, 1st, 3rd
    podiumOrder.forEach((idx) => {
      const entry = entries[idx];
      if (!entry) return;
      const spot = document.createElement("div");
      spot.className = `podium-spot rank-${idx + 1}`;
      spot.innerHTML = `
        <span class="podium-medal">${medals[idx]}</span>
        <span class="podium-avatar">${entry.avatar}</span>
        <span class="podium-name">${entry.isYou ? "You" : entry.name}</span>
        <span class="podium-points">${entry.score} pts</span>
      `;
      podiumEl.appendChild(spot);
    });

    entries.slice(3).forEach((entry, i) => {
      const row = boardRowTemplate.content.cloneNode(true);
      const rowEl = row.querySelector(".board-row");
      if (entry.isYou) rowEl.classList.add("is-you");
      row.querySelector(".board-rank").textContent = `#${i + 4}`;
      row.querySelector(".board-avatar").textContent = entry.avatar;
      row.querySelector(".board-name").textContent = entry.isYou ? "You" : entry.name;
      row.querySelector(".board-points").textContent = `${entry.score} pts`;
      listEl.appendChild(row);
    });
  }

  // ----- Header (level / total points) -----
  function renderHeader(quests) {
    const total = totalPoints(quests);
    totalPointsEl.textContent = String(total);
    levelNumberEl.textContent = String(Math.floor(total / 100) + 1);
    todayLabel.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long",
      month: "short",
      day: "numeric",
    });
  }

  function difficultyLabel(max) {
    if (max <= 120) return "Rookie";
    if (max <= 220) return "Pro";
    return "Legend";
  }

  function renderHeroes() {
    const rivals = loadRivals();
    heroEmptyState.hidden = rivals.length > 0;
    heroList.innerHTML = "";
    rivals.forEach((rival) => {
      const node = heroCardTemplate.content.cloneNode(true);
      node.querySelector(".hero-card-avatar").textContent = rival.avatar;
      node.querySelector(".hero-card-name").textContent = rival.name;
      node.querySelector(".hero-card-difficulty").textContent = `${difficultyLabel(rival.max)} rival`;
      node.querySelector(".quest-remove").addEventListener("click", () => removeHero(rival.id, rival.name));
      heroList.appendChild(node);
    });
  }

  function addHero(avatar, name, max) {
    const rivals = loadRivals();
    rivals.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      avatar,
      max,
    });
    saveRivals(rivals);
    renderHeroes();
    renderBoard("weekly");
    renderBoard("monthly");
  }

  function removeHero(id, name) {
    if (!confirm(`Remove "${name}" from the leaderboard?`)) return;
    const rivals = loadRivals().filter((r) => r.id !== id);
    saveRivals(rivals);
    renderHeroes();
    renderBoard("weekly");
    renderBoard("monthly");
  }

  function render() {
    const quests = loadQuests();
    renderHeader(quests);
    renderQuests(quests);
    renderBoard("weekly");
    renderBoard("monthly");
    renderHeroes();
  }

  // ----- Actions -----
  function toggleCompletion(id) {
    const quests = loadQuests();
    const quest = quests.find((q) => q.id === id);
    if (!quest) return;
    const key = todayKey();
    if (quest.completions[key]) {
      delete quest.completions[key];
    } else {
      quest.completions[key] = true;
    }
    saveQuests(quests);
    render();
  }

  function removeQuest(id, name) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    const quests = loadQuests().filter((q) => q.id !== id);
    saveQuests(quests);
    render();
  }

  function addQuest(name, points) {
    const quests = loadQuests();
    quests.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      points,
      createdAt: new Date().toISOString(),
      completions: {},
    });
    saveQuests(quests);
    render();
  }

  function burstConfetti() {
    const colors = ["#ff6fa5", "#ffd23f", "#34cf85", "#8c6fff", "#5fb8ff"];
    for (let i = 0; i < 40; i++) {
      const piece = document.createElement("span");
      piece.className = "confetti-piece";
      piece.style.left = `${Math.random() * 100}vw`;
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = `${Math.random() * 0.3}s`;
      confettiLayer.appendChild(piece);
      setTimeout(() => piece.remove(), 2200);
    }
  }

  // ----- Wiring -----
  pointChoice.addEventListener("click", (e) => {
    const btn = e.target.closest(".point-choice-btn");
    if (!btn) return;
    pointChoice.querySelectorAll(".point-choice-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedPoints = Number(btn.dataset.points);
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    if (!name) return;
    addQuest(name, selectedPoints);
    nameInput.value = "";
    nameInput.focus();
  });

  heroDifficulty.addEventListener("click", (e) => {
    const btn = e.target.closest(".point-choice-btn");
    if (!btn) return;
    heroDifficulty.querySelectorAll(".point-choice-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    selectedHeroMax = Number(btn.dataset.max);
  });

  heroForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const avatar = heroAvatarInput.value.trim() || "🦹";
    const name = heroNameInput.value.trim();
    if (!name) return;
    addHero(avatar, name, selectedHeroMax);
    heroAvatarInput.value = "";
    heroNameInput.value = "";
    heroNameInput.focus();
  });

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    document.querySelectorAll(".tab").forEach((t) => {
      t.classList.remove("active");
      t.setAttribute("aria-selected", "false");
    });
    btn.classList.add("active");
    btn.setAttribute("aria-selected", "true");
    document.querySelectorAll(".panel").forEach((p) => p.classList.add("hidden"));
    document.getElementById(`panel-${btn.dataset.tab}`).classList.remove("hidden");
  });

  render();
})();
