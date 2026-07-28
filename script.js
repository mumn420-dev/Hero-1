(() => {
  "use strict";

  const HEROES_KEY = "herotrack.heroes.v1";
  const QUESTS_KEY = "herotrack.quests.v3";
  const ACTIVE_KEY = "herotrack.activeHero.v1";

  const AVATAR_COLORS = ["#ff6fa5", "#8c6fff", "#34cf85", "#ffb23f", "#5fb8ff", "#ff8f6b"];

  // ----- DOM refs -----
  const activeHeroAvatarEl = document.getElementById("active-hero-avatar");
  const activeHeroNameEl = document.getElementById("active-hero-name");
  const totalPointsEl = document.getElementById("total-points");
  const heroSwitcher = document.getElementById("hero-switcher");
  const tabs = document.getElementById("tabs");

  const questList = document.getElementById("quest-list");
  const emptyState = document.getElementById("empty-state");
  const noHeroState = document.getElementById("no-hero-state");
  const form = document.getElementById("quest-form");
  const nameInput = document.getElementById("quest-name");
  const questTemplate = document.getElementById("quest-template");
  const todayLabel = document.getElementById("today-label");
  const todayPointsEarned = document.getElementById("today-points-earned");
  const confettiLayer = document.getElementById("confetti-layer");

  const heroForm = document.getElementById("hero-form");
  const heroPhotoInput = document.getElementById("hero-photo");
  const heroPhotoPreview = document.getElementById("hero-photo-preview");
  const heroPhotoPlaceholder = document.getElementById("hero-photo-placeholder");
  const heroNameInput = document.getElementById("hero-name");
  const heroList = document.getElementById("hero-list");
  const heroEmptyState = document.getElementById("hero-empty-state");
  const heroCardTemplate = document.getElementById("hero-card-template");
  const boardRowTemplate = document.getElementById("board-row-template");

  let pendingPhoto = null; // dataURL for the hero currently being added

  // ----- Storage: heroes -----
  function loadHeroes() {
    try {
      const raw = localStorage.getItem(HEROES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
  function saveHeroes(heroes) {
    localStorage.setItem(HEROES_KEY, JSON.stringify(heroes));
  }

  // ----- Storage: quests, keyed by heroId -----
  function loadAllQuests() {
    try {
      const raw = localStorage.getItem(QUESTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function saveAllQuests(all) {
    localStorage.setItem(QUESTS_KEY, JSON.stringify(all));
  }
  function getQuestsFor(heroId) {
    const all = loadAllQuests();
    return all[heroId] || [];
  }
  function setQuestsFor(heroId, quests) {
    const all = loadAllQuests();
    all[heroId] = quests;
    saveAllQuests(all);
  }

  // ----- Active hero -----
  function getActiveHeroId() {
    const stored = localStorage.getItem(ACTIVE_KEY);
    const heroes = loadHeroes();
    if (stored && heroes.some((h) => h.id === stored)) return stored;
    return heroes.length ? heroes[0].id : null;
  }
  function setActiveHeroId(id) {
    localStorage.setItem(ACTIVE_KEY, id);
  }

  // ----- Date helpers -----
  function formatDateKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  function todayKey() { return formatDateKey(new Date()); }

  function startOfWeek(date) {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7; // Monday = 0
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function daysInMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  }

  // ----- Streaks -----
  function currentStreak(quest) {
    let streak = 0;
    const cursor = new Date();
    if (!quest.completions[formatDateKey(cursor)]) cursor.setDate(cursor.getDate() - 1);
    while (quest.completions[formatDateKey(cursor)]) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }

  // ----- Percentage math -----
  function completionsOnDate(quests, key) {
    return quests.reduce((sum, q) => sum + (q.completions[key] ? 1 : 0), 0);
  }
  function todayPercent(quests) {
    if (quests.length === 0) return 0;
    const done = completionsOnDate(quests, todayKey());
    return Math.round((done / quests.length) * 100);
  }
  function rangePercent(quests, dayKeys) {
    if (quests.length === 0) return 0;
    const possible = quests.length * dayKeys.length;
    if (possible === 0) return 0;
    const done = dayKeys.reduce((sum, key) => sum + completionsOnDate(quests, key), 0);
    return Math.min(100, Math.round((done / possible) * 100));
  }
  function weeklyPercent(quests) {
    const start = startOfWeek(new Date());
    const keys = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      if (d > new Date()) break;
      keys.push(formatDateKey(d));
    }
    return rangePercent(quests, keys);
  }
  function monthlyPercent(quests) {
    const now = new Date();
    const keys = [];
    for (let day = 1; day <= now.getDate(); day++) {
      keys.push(formatDateKey(new Date(now.getFullYear(), now.getMonth(), day)));
    }
    return rangePercent(quests, keys);
  }

  // ----- Avatars (photo or colored initials) -----
  function colorForId(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return AVATAR_COLORS[h % AVATAR_COLORS.length];
  }
  function initialsFor(name) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] || "?";
    const second = parts[1]?.[0] || "";
    return (first + second).toUpperCase();
  }
  function buildAvatarNode(hero, extraClass) {
    const slot = document.createElement("span");
    slot.className = extraClass ? `hero-avatar-slot ${extraClass}` : "hero-avatar-slot";
    if (hero.photo) {
      const img = document.createElement("img");
      img.src = hero.photo;
      img.alt = "";
      slot.appendChild(img);
    } else {
      slot.style.background = colorForId(hero.id);
      slot.textContent = initialsFor(hero.name);
    }
    return slot;
  }

  // ----- Photo resize (keeps localStorage small) -----
  function readAndResizePhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Could not read file"));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not read image"));
        img.onload = () => {
          const size = 160;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          const scale = Math.max(size / img.width, size / img.height);
          const w = img.width * scale;
          const h = img.height * scale;
          ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ----- Rendering: header + switcher -----
  function renderHeader() {
    const heroes = loadHeroes();
    const activeId = getActiveHeroId();
    const active = heroes.find((h) => h.id === activeId);

    activeHeroAvatarEl.innerHTML = "";
    if (active) {
      activeHeroAvatarEl.appendChild(buildAvatarNode(active));
      activeHeroNameEl.textContent = active.name;
      totalPointsEl.textContent = `${todayPercent(getQuestsFor(active.id))}%`;
    } else {
      activeHeroAvatarEl.textContent = "🦸";
      activeHeroNameEl.textContent = "Add a hero";
      totalPointsEl.textContent = "0%";
    }

    todayLabel.textContent = new Date().toLocaleDateString(undefined, {
      weekday: "long", month: "short", day: "numeric",
    });
  }

  function renderSwitcher() {
    const heroes = loadHeroes();
    const activeId = getActiveHeroId();
    heroSwitcher.innerHTML = "";
    heroes.forEach((hero) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "hero-switcher-btn" + (hero.id === activeId ? " active" : "");
      btn.appendChild(buildAvatarNode(hero));
      const label = document.createElement("span");
      label.className = "hero-switcher-name";
      label.textContent = hero.name;
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        setActiveHeroId(hero.id);
        renderAll();
      });
      heroSwitcher.appendChild(btn);
    });
  }

  // ----- Rendering: quests for active hero -----
  function renderQuests() {
    const heroes = loadHeroes();
    const activeId = getActiveHeroId();
    const active = heroes.find((h) => h.id === activeId);

    noHeroState.hidden = !!active;
    form.hidden = !active;
    questList.innerHTML = "";

    if (!active) {
      emptyState.hidden = true;
      todayPointsEarned.textContent = "";
      return;
    }

    const quests = getQuestsFor(active.id);
    emptyState.hidden = quests.length > 0;

    const key = todayKey();
    let doneCount = 0;

    quests.forEach((quest) => {
      const node = questTemplate.content.cloneNode(true);
      const checkBtn = node.querySelector(".quest-check");
      const nameEl = node.querySelector(".quest-name");
      const streakNumEl = node.querySelector(".streak-number");
      const removeBtn = node.querySelector(".quest-remove");

      const doneToday = !!quest.completions[key];
      if (doneToday) doneCount++;

      nameEl.textContent = quest.name;
      checkBtn.setAttribute("aria-pressed", String(doneToday));
      streakNumEl.textContent = String(currentStreak(quest));

      checkBtn.addEventListener("click", () => toggleCompletion(active.id, quest.id));
      removeBtn.addEventListener("click", () => removeQuest(active.id, quest.id, quest.name));

      questList.appendChild(node);
    });

    const pct = quests.length ? Math.round((doneCount / quests.length) * 100) : 0;
    todayPointsEarned.textContent = quests.length ? `${pct}% today (${doneCount}/${quests.length})` : "";
    if (quests.length > 0 && doneCount === quests.length) burstConfetti();
  }

  // ----- Rendering: leaderboards among real heroes -----
  function renderBoard(kind) {
    const heroes = loadHeroes();
    const activeId = getActiveHeroId();
    const podiumEl = document.getElementById(`${kind}-podium`);
    const listEl = document.getElementById(`${kind}-list`);
    const emptyEl = document.getElementById(`${kind}-empty-state`);
    podiumEl.innerHTML = "";
    listEl.innerHTML = "";

    emptyEl.hidden = heroes.length > 0;
    if (heroes.length === 0) return;

    const entries = heroes.map((hero) => {
      const quests = getQuestsFor(hero.id);
      const score = kind === "weekly" ? weeklyPercent(quests) : monthlyPercent(quests);
      return { hero, score };
    });
    entries.sort((a, b) => b.score - a.score);

    const medals = ["🥇", "🥈", "🥉"];
    const podiumOrder = [1, 0, 2];
    podiumOrder.forEach((idx) => {
      const entry = entries[idx];
      if (!entry) return;
      const spot = document.createElement("div");
      spot.className = `podium-spot rank-${idx + 1}`;

      const medal = document.createElement("span");
      medal.className = "podium-medal";
      medal.textContent = medals[idx];

      const avatar = buildAvatarNode(entry.hero);

      const name = document.createElement("span");
      name.className = "podium-name";
      name.textContent = entry.hero.name;

      const points = document.createElement("span");
      points.className = "podium-points";
      points.textContent = `${entry.score}%`;

      spot.append(medal, avatar, name, points);
      podiumEl.appendChild(spot);
    });

    entries.slice(3).forEach((entry, i) => {
      const row = boardRowTemplate.content.cloneNode(true);
      const rowEl = row.querySelector(".board-row");
      if (entry.hero.id === activeId) rowEl.classList.add("is-active");
      row.querySelector(".board-rank").textContent = `#${i + 4}`;
      row.querySelector(".board-avatar").replaceWith(buildAvatarNode(entry.hero, "board-avatar"));
      row.querySelector(".board-name").textContent = entry.hero.name;
      row.querySelector(".board-points").textContent = `${entry.score}%`;
      listEl.appendChild(row);
    });

    // keep board-avatar class findable next render (replaceWith drops the class)
  }

  // ----- Rendering: hero management list -----
  function renderHeroManagement() {
    const heroes = loadHeroes();
    heroEmptyState.hidden = heroes.length > 0;
    heroList.innerHTML = "";
    heroes.forEach((hero) => {
      const node = heroCardTemplate.content.cloneNode(true);
      node.querySelector(".hero-card-avatar").replaceWith(buildAvatarNode(hero, "hero-card-avatar"));
      node.querySelector(".hero-card-name").textContent = hero.name;
      const questCount = getQuestsFor(hero.id).length;
      node.querySelector(".hero-card-sub").textContent = `${questCount} quest${questCount === 1 ? "" : "s"}`;
      node.querySelector(".quest-remove").addEventListener("click", () => removeHero(hero.id, hero.name));
      heroList.appendChild(node);
    });
  }

  function renderAll() {
    renderHeader();
    renderSwitcher();
    renderQuests();
    renderBoard("weekly");
    renderBoard("monthly");
    renderHeroManagement();
  }

  // ----- Actions: quests -----
  function toggleCompletion(heroId, questId) {
    const quests = getQuestsFor(heroId);
    const quest = quests.find((q) => q.id === questId);
    if (!quest) return;
    const key = todayKey();
    if (quest.completions[key]) delete quest.completions[key];
    else quest.completions[key] = true;
    setQuestsFor(heroId, quests);
    renderAll();
  }

  function removeQuest(heroId, questId, name) {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    const quests = getQuestsFor(heroId).filter((q) => q.id !== questId);
    setQuestsFor(heroId, quests);
    renderAll();
  }

  function addQuest(heroId, name) {
    const quests = getQuestsFor(heroId);
    quests.push({
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      createdAt: new Date().toISOString(),
      completions: {},
    });
    setQuestsFor(heroId, quests);
    renderAll();
  }

  // ----- Actions: heroes -----
  function addHero(name, photo) {
    const heroes = loadHeroes();
    const hero = {
      id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
      name,
      photo: photo || null,
    };
    heroes.push(hero);
    saveHeroes(heroes);
    setActiveHeroId(hero.id);
    renderAll();
  }

  function removeHero(id, name) {
    if (!confirm(`Remove "${name}" and all their quests? This can't be undone.`)) return;
    const heroes = loadHeroes().filter((h) => h.id !== id);
    saveHeroes(heroes);
    const all = loadAllQuests();
    delete all[id];
    saveAllQuests(all);
    if (getActiveHeroId() === id) {
      localStorage.removeItem(ACTIVE_KEY);
    }
    renderAll();
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
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const activeId = getActiveHeroId();
    if (!activeId) return;
    const name = nameInput.value.trim();
    if (!name) return;
    addQuest(activeId, name);
    nameInput.value = "";
    nameInput.focus();
  });

  heroPhotoInput.addEventListener("change", async () => {
    const file = heroPhotoInput.files[0];
    if (!file) return;
    try {
      pendingPhoto = await readAndResizePhoto(file);
      heroPhotoPreview.src = pendingPhoto;
      heroPhotoPreview.hidden = false;
      heroPhotoPlaceholder.hidden = true;
    } catch {
      pendingPhoto = null;
    }
  });

  heroForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const name = heroNameInput.value.trim();
    if (!name) return;
    addHero(name, pendingPhoto);
    heroNameInput.value = "";
    heroPhotoInput.value = "";
    pendingPhoto = null;
    heroPhotoPreview.hidden = true;
    heroPhotoPreview.src = "";
    heroPhotoPlaceholder.hidden = false;
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

  renderAll();
})();
