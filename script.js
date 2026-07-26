let heroes = [];
let currentLang = localStorage.getItem('herotrack_lang') || 'en';

const translations = {
    en: {
        brandTitle: "HeroTrack :",
        namePlaceholder: "Type name here...",
        registerBtn: "🚀 Register Hero",
        reportBtn: "🏆 Report",
        resetBtn: "🔄 Reset",
        modalTitle: "🏆 Monthly Report & Leaderboard",
        closeBtn: "Close",
        removeBtn: "✕ Remove",
        newChorePlaceholder: "New chore...",
        dailyProgressLabel: "Daily Progress (100% Scale):",
        weeklyTarget: "Weekly Target:",
        monthlyTarget: "Monthly:",
        emptyState: "No heroes registered yet. Type a name above and click \"Register Hero\" to begin!",
        heroNameHeader: "Hero Name",
        pointsHeader: "Points",
        monthlyProgHeader: "Monthly Progress",
        noHeroesReport: "No heroes registered yet to generate a report.",
        confirmDeleteHero: "Warning: Are you sure you want to delete {name} and all associated records?",
        confirmResetAll: "Warning: This will delete all registered heroes and reset all data. Do you want to proceed?",
        confirmDeleteChore: "Warning: Are you sure you want to delete the chore \"{chore}\"?"
    },
    ar: {
        brandTitle: "متابعة الأبطال :",
        namePlaceholder: "اكتب اسم البطل هنا...",
        registerBtn: "🚀 تسجيل بطل",
        reportBtn: "🏆 التقرير",
        resetBtn: "🔄 إعادة ضبط",
        modalTitle: "🏆 التقرير الشهري ولوحة الشرف",
        closeBtn: "إغلاق",
        removeBtn: "✕ إزالة",
        newChorePlaceholder: "مهمة جديدة...",
        dailyProgressLabel: "التقدم اليومي (مقياس 100%):",
        weeklyTarget: "الهدف الأسبوعي:",
        monthlyTarget: "الشهري:",
        emptyState: "لا يوجد أبطال مسجلين بعد. اكتب الاسم بالاعلى واضغط \"تسجيل بطل\" للبدء!",
        heroNameHeader: "اسم البطل",
        pointsHeader: "النقاط",
        monthlyProgHeader: "التقدم الشهري",
        noHeroesReport: "لا يوجد أبطال مسجلين لإنشاء تقرير.",
        confirmDeleteHero: "تحذير: هل أنت متأكد أنك تريد حذف {name} وكل السجلات المرتبطة؟",
        confirmResetAll: "تحذير: سيؤدي هذا إلى حذف كل الأبطال المسجلين وإعادة ضبط البيانات. هل تريد المتابعة؟",
        confirmDeleteChore: "تحذير: هل أنت متأكد من حذف المهمة \"{chore}\"?"
    }
};

// DOM Elements
const heroNameInput = document.getElementById('heroNameInput');
const registerBtn = document.getElementById('registerBtn');
const heroesListContainer = document.getElementById('heroesListContainer');
const resetAllBtn = document.getElementById('resetAllBtn');
const leaderboardBtn = document.getElementById('leaderboardBtn');
const reportModal = document.getElementById('reportModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalReportBody = document.getElementById('modalReportBody');
const modalMonthInfo = document.getElementById('modalMonthInfo');
const langToggleBtn = document.getElementById('langToggleBtn');

const dayModal = document.getElementById('dayModal');
const dayModalTitle = document.getElementById('dayModalTitle');
const dayModalSubInfo = document.getElementById('dayModalSubInfo');
const dayModalBody = document.getElementById('dayModalBody');
const closeDayModalBtn = document.getElementById('closeDayModalBtn');

function init() {
    loadData();
    checkDailyReset(); 
    applyLanguage();

    registerBtn.addEventListener('click', registerHero);
    heroNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') registerHero(); });
    resetAllBtn.addEventListener('click', resetAllData);
    
    leaderboardBtn.addEventListener('click', openMonthlyReportModal);
    closeModalBtn.addEventListener('click', () => reportModal.classList.add('hidden'));
    closeDayModalBtn.addEventListener('click', () => dayModal.classList.add('hidden'));

    langToggleBtn.addEventListener('click', toggleLanguage);

    renderHeroes();
}

function saveData() {
    localStorage.setItem('herotrack_heroes', JSON.stringify(heroes));
}

function loadData() {
    const saved = localStorage.getItem('herotrack_heroes');
    if (saved) {
        try {
            heroes = JSON.parse(saved);
        } catch(e) {
            heroes = [];
        }
    } else {
        // Ensure completely empty initial state (no sample names/missions)
        heroes = [];
    }
}

function checkDailyReset() {
    const todayStr = new Date().toDateString();
    const lastSavedDate = localStorage.getItem('herotrack_last_date');

    if (lastSavedDate !== todayStr) {
        heroes.forEach(hero => {
            if (hero.chores && hero.chores.length > 0) {
                hero.chores.forEach(chore => {
                    chore.completed = false; 
                });
            }
        });
        localStorage.setItem('herotrack_last_date', todayStr);
        saveData();
    }
}

function t(key) {
    return translations[currentLang][key] || key;
}

function toggleLanguage() {
    currentLang = currentLang === 'en' ? 'ar' : 'en';
    localStorage.setItem('herotrack_lang', currentLang);
    applyLanguage();
    renderHeroes();
}

function applyLanguage() {
    document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = currentLang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = t(key);
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = t(key);
    });
}

function getDaysInCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

function getCurrentDayIndex() {
    const jsDay = new Date().getDay(); 
    return jsDay === 0 ? 6 : jsDay - 1;
}

function registerHero() {
    const name = heroNameInput.value.trim();
    if (!name) return;

    const daysInMonth = getDaysInCurrentMonth();
    
    const newHero = {
        id: Date.now(),
        name: name,
        points: 0,
        photo: null, 
        chores: [],
        days: [0, 0, 0, 0, 0, 0, 0], 
        dayChoresHistory: {}, 
        monthlyDays: new Array(daysInMonth).fill(0), 
        weeklyPercentage: 0,
        monthlyPercentage: 0
    };

    heroes.push(newHero);
    heroNameInput.value = '';
    saveData();
    renderHeroes();
}

function removeHero(id) {
    const hero = heroes.find(h => h.id === id);
    const msg = t('confirmDeleteHero').replace('{name}', hero ? hero.name : '');
    if (confirm(msg)) {
        heroes = heroes.filter(h => h.id !== id);
        saveData();
        renderHeroes();
    }
}

function resetAllData() {
    if (confirm(t('confirmResetAll'))) {
        heroes = [];
        saveData();
        renderHeroes();
    }
}

function updateHeroName(id, newName) {
    const hero = heroes.find(h => h.id === id);
    if (hero) {
        hero.name = newName.trim();
        saveData();
    }
}

function updateChoreText(heroId, choreIndex, newText) {
    const hero = heroes.find(h => h.id === heroId);
    if (hero && hero.chores[choreIndex]) {
        hero.chores[choreIndex].text = newText.trim();
        saveData();
    }
}

function addChore(heroId) {
    const inputEl = document.getElementById(`chore-input-${heroId}`);
    if (!inputEl) return;
    const choreText = inputEl.value.trim();
    if (!choreText) return;

    const hero = heroes.find(h => h.id === heroId);
    if (hero) {
        hero.chores.push({ text: choreText, completed: false });
        inputEl.value = '';
        
        updateTodayTaskProgress(hero);
        saveData();
        renderHeroes();
    }
}

function toggleChore(heroId, choreIndex) {
    const hero = heroes.find(h => h.id === heroId);
    if (hero && hero.chores[choreIndex]) {
        hero.chores[choreIndex].completed = !hero.chores[choreIndex].completed;
        hero.points += hero.chores[choreIndex].completed ? 10 : -10;
        if (hero.points < 0) hero.points = 0;

        updateTodayTaskProgress(hero);
        saveData();
        renderHeroes();
    }
}

function removeChore(heroId, choreIndex) {
    const hero = heroes.find(h => h.id === heroId);
    if (hero && hero.chores[choreIndex]) {
        const msg = t('confirmDeleteChore').replace('{chore}', hero.chores[choreIndex].text);
        if (confirm(msg)) {
            hero.chores.splice(choreIndex, 1);
            
            updateTodayTaskProgress(hero);
            saveData();
            renderHeroes();
        }
    }
}

function updateTodayTaskProgress(hero) {
    const todayIndex = getCurrentDayIndex();
    
    if (hero.chores.length === 0) {
        hero.days[todayIndex] = 0;
        if (hero.dayChoresHistory) delete hero.dayChoresHistory[todayIndex];
    } else {
        const completedCount = hero.chores.filter(c => c.completed).length;
        hero.days[todayIndex] = Math.round((completedCount / hero.chores.length) * 100);
        
        if (!hero.dayChoresHistory) hero.dayChoresHistory = {};
        hero.dayChoresHistory[todayIndex] = hero.chores.map(c => ({ text: c.text, completed: c.completed }));
    }

    hero.monthlyDays[todayIndex] = hero.days[todayIndex];
    recalculateProgress(hero);
}

function recalculateProgress(hero) {
    const totalWeekScore = hero.days.reduce((acc, val) => acc + val, 0);
    hero.weeklyPercentage = Math.round(totalWeekScore / 7);

    const daysInMonth = hero.monthlyDays.length;
    const totalMonthScore = hero.monthlyDays.reduce((acc, val) => acc + val, 0);
    hero.monthlyPercentage = Math.round(totalMonthScore / daysInMonth);
}

function openDayDetailsModal(heroId, dayIndex) {
    const hero = heroes.find(h => h.id === heroId);
    if (!hero) return;

    const dayLabelsFull = currentLang === 'ar' 
        ? ['الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت', 'الأحد']
        : ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

    dayModalTitle.textContent = `${hero.name} — ${dayLabelsFull[dayIndex]}`;
    dayModalSubInfo.textContent = `Completion Rate: ${hero.days[dayIndex]}%`;

    const historyData = hero.dayChoresHistory && hero.dayChoresHistory[dayIndex];
    if (!historyData || historyData.length === 0) {
        dayModalBody.innerHTML = `<p style="text-align:center; color:#777; font-style:italic;">No recorded task data available for this day.</p>`;
    } else {
        let html = `<ul style="list-style-type: none; padding: 0;">`;
        historyData.forEach(item => {
            const icon = item.completed ? '✅' : '❌';
            const color = item.completed ? '#27ae60' : '#c0392b';
            html += `<li style="padding: 6px 8px; margin-bottom: 4px; background: #f8f9fa; border-radius: 4px; display: flex; justify-content: space-between; align-items: center;">
                <span>${item.text}</span>
                <span style="color: ${color}; font-weight: bold;">${icon} ${item.completed ? 'Completed' : 'Missed'}</span>
            </li>`;
        });
        html += `</ul>`;
        dayModalBody.innerHTML = html;
    }

    dayModal.classList.remove('hidden');
}

function openMonthlyReportModal() {
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[now.getMonth()];
    const daysInMonth = getDaysInCurrentMonth();

    modalMonthInfo.textContent = `${currentMonthName} (${daysInMonth} Days):`;

    if (heroes.length === 0) {
        modalReportBody.innerHTML = `<p>${t('noHeroesReport')}</p>`;
    } else {
        let html = `<table style="width:100%; border-collapse: collapse;">`;
        html += `<tr style="border-bottom: 1px solid #ccc;"><th style="text-align:start; padding:6px;">${t('heroNameHeader')}</th><th style="text-align:center; padding:6px;">${t('pointsHeader')}</th><th style="text-align:end; padding:6px;">${t('monthlyProgHeader')}</th></tr>`;
        heroes.forEach(h => {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding:6px; text-align:start;">${h.name}</td><td style="text-align:center; padding:6px;">⭐ ${h.points}</td><td style="text-align:end; padding:6px;">${h.monthlyPercentage}%</td></tr>`;
        });
        html += `</table>`;
        modalReportBody.innerHTML = html;
    }

    reportModal.classList.remove('hidden');
}

function renderHeroes() {
    heroesListContainer.innerHTML = '';

    if (heroes.length === 0) {
        heroesListContainer.innerHTML = `<div class="empty-state">${t('emptyState')}</div>`;
        return;
    }

    const dayLabels = currentLang === 'ar' ? ['ن', 'ث', 'ر', 'خ', 'ج', 'س', 'ح'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    heroes.forEach(hero => {
        const card = document.createElement('div');
        card.className = 'hero-card';

        let avatarContent = `<span style="font-size: 1.8rem;">⭐</span>`;
        if (hero.photo) {
            avatarContent = `<img src="${hero.photo}" alt="Hero Photo">`;
        }

        const weeklyDeg = Math.round((hero.weeklyPercentage / 100) * 360);
        const weeklyCircleStyle = `background: conic-gradient(#3498db ${weeklyDeg}deg, #ecf0f1 0deg); border: 3px solid #2980b9;`;

        const monthlyDeg = Math.round((hero.monthlyPercentage / 100) * 360);
        const monthlyCircleStyle = `background: conic-gradient(#e74c3c ${monthlyDeg}deg, #ecf0f1 0deg); border: 3px solid #c0392b;`;

        card.innerHTML = `
            <div class="hero-profile">
                <div class="avatar-container" id="avatar-${hero.id}" title="Click to change profile picture">
                    ${avatarContent}
                    <input type="file" id="fileInput-${hero.id}" accept="image/*" style="display: none;">
                </div>
                <input type="text" class="hero-name-input" value="${hero.name}" onchange="updateHeroName(${hero.id}, this.value)">
                <div class="pts-badge">⭐ ${hero.points} pts</div>
                <button class="btn-remove" onclick="removeHero(${hero.id})">${t('removeBtn')}</button>
            </div>

            <div class="chores-section">
                <div class="add-chore-row">
                    <input type="text" id="chore-input-${hero.id}" placeholder="${t('newChorePlaceholder')}">
                    <button class="btn-add-chore" id="add-chore-btn-${hero.id}">+</button>
                </div>
                <div id="chores-list-${hero.id}" style="display: flex; flex-direction: column; gap: 6px; width: 100%;"></div>
            </div>

            <div class="daily-progress-section">
                <div class="progress-label">${t('dailyProgressLabel')}</div>
                <div class="days-grid" id="days-grid-${hero.id}"></div>
            </div>

            <div class="targets-column">
                <div class="target-block">
                    <div class="target-title">${t('weeklyTarget')}</div>
                    <div class="target-circle" style="${weeklyCircleStyle}">
                        <span style="background: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem;">${hero.weeklyPercentage}%</span>
                    </div>
                </div>
                <div class="target-block">
                    <div class="target-title">${t('monthlyTarget')}</div>
                    <div class="target-circle" style="${monthlyCircleStyle}">
                        <span style="background: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem;">${hero.monthlyPercentage}%</span>
                    </div>
                </div>
            </div>
        `;

        heroesListContainer.appendChild(card);

        // 1. Programmatically render and attach event listeners for Chores securely to bypass quote syntax breaks
        const choresListEl = document.getElementById(`chores-list-${hero.id}`);
        hero.chores.forEach((chore, index) => {
            const choreItem = document.createElement('div');
            choreItem.className = `chore-item ${chore.completed ? 'completed' : ''}`;
            
            const checkboxBtn = document.createElement('button');
            checkboxBtn.className = 'chore-text-btn';
            checkboxBtn.style.cssText = 'background:none; border:none; cursor:pointer; color:inherit;';
            checkboxBtn.innerHTML = `<span>${chore.completed ? '☑' : '□'}</span>`;
            checkboxBtn.addEventListener('click', () => toggleChore(hero.id, index));

            const textInput = document.createElement('input');
            textInput.type = 'text';
            textInput.className = 'chore-text-input';
            textInput.value = chore.text;
            textInput.addEventListener('change', (e) => updateChoreText(hero.id, index, e.target.value));

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'chore-delete-btn';
            deleteBtn.title = 'Delete chore';
            deleteBtn.textContent = '✕';
            deleteBtn.addEventListener('click', () => removeChore(hero.id, index));

            choreItem.appendChild(checkboxBtn);
            choreItem.appendChild(textInput);
            choreItem.appendChild(deleteBtn);
            choresListEl.appendChild(choreItem);
        });

        // Add chore button listeners
        const addChoreBtn = document.getElementById(`add-chore-btn-${hero.id}`);
        const choreInputEl = document.getElementById(`chore-input-${hero.id}`);
        addChoreBtn.addEventListener('click', () => addChore(hero.id));
        choreInputEl.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addChore(hero.id);
        });

        // 2. Render and attach listeners for each day progress box safely
        const daysGridEl = document.getElementById(`days-grid-${hero.id}`);
        hero.days.forEach((dayPct, dIndex) => {
            const dayBox = document.createElement('div');
            dayBox.className = 'day-box';
            dayBox.title = 'Click to view tasks record for this day';
            dayBox.innerHTML = `
                <div class="day-fill" style="height: ${dayPct}%;"></div>
                <span>${dayLabels[dIndex]}</span>
                <span class="day-pct">${dayPct}%</span>
            `;
            dayBox.addEventListener('click', () => {
                openDayDetailsModal(hero.id, dIndex);
            });
            daysGridEl.appendChild(dayBox);
        });

        // 3. Attach file upload listeners for profile pictures cleanly
        const avatarBox = document.getElementById(`avatar-${hero.id}`);
        const fileInput = document.getElementById(`fileInput-${hero.id}`);

        avatarBox.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = function(uploadEvent) {
                    hero.photo = uploadEvent.target.result;
                    saveData();
                    renderHeroes();
                };
                reader.readAsDataURL(file);
            }
        });
    });
}

window.removeHero = removeHero;
window.openDayDetailsModal = openDayDetailsModal;
window.updateHeroName = updateHeroName;

init();
