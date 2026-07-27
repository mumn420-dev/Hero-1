let heroes = [];
let activePhotoHeroId = null;

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
const globalPhotoInput = document.getElementById('globalPhotoInput');

function init() {
    registerBtn.addEventListener('click', registerHero);
    heroNameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') registerHero(); });
    resetAllBtn.addEventListener('click', resetAllData);
    
    leaderboardBtn.addEventListener('click', openMonthlyReportModal);
    closeModalBtn.addEventListener('click', () => reportModal.classList.add('hidden'));

    globalPhotoInput.addEventListener('change', handlePhotoUpload);

    renderHeroes();
}

// Get exact number of days in the current month (28, 29, 30, or 31)
function getDaysInCurrentMonth() {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
}

// Get current day index where Saturday is correctly mapped (Mon=0, Tue=1, Wed=2, Thu=3, Fri=4, Sat=5, Sun=6)
function getCurrentDayIndex() {
    const jsDay = new Date().getDay(); // 0 is Sunday, 1 is Monday, ..., 6 is Saturday
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
        days: [0, 0, 0, 0, 0, 0, 0], // Percentage achieved per day (0 to 100)
        monthlyDays: new Array(daysInMonth).fill(0), // Percentage achieved per month day
        weeklyPercentage: 0,
        monthlyPercentage: 0
    };

    heroes.push(newHero);
    heroNameInput.value = '';
    renderHeroes();
}

function removeHero(id) {
    const hero = heroes.find(h => h.id === id);
    if (confirm(`Warning: Are you sure you want to delete ${hero ? hero.name : 'this hero'} and all associated records?`)) {
        heroes = heroes.filter(h => h.id !== id);
        renderHeroes();
    }
}

function resetAllData() {
    if (confirm("Warning: This will delete all registered heroes and reset all data. Do you want to proceed?")) {
        heroes = [];
        renderHeroes();
    }
}

function updateHeroName(id, newName) {
    const hero = heroes.find(h => h.id === id);
    if (hero) {
        hero.name = newName.trim();
    }
}

function updateChoreText(heroId, choreIndex, newText) {
    const hero = heroes.find(h => h.id === heroId);
    if (hero && hero.chores[choreIndex]) {
        hero.chores[choreIndex].text = newText.trim();
    }
}

function addChore(heroId) {
    const inputEl = document.getElementById(`chore-input-${heroId}`);
    const choreText = inputEl.value.trim();
    if (!choreText) return;

    const hero = heroes.find(h => h.id === heroId);
    if (hero) {
        hero.chores.push({ text: choreText, completed: false });
        inputEl.value = '';
        
        // Recalculate daily task progress percentage when a new task is added
        updateTodayTaskProgress(hero);
        renderHeroes();
    }
}

// Automatically update today's task progress accurately based on completed tasks / total tasks ratio
function toggleChore(heroId, choreIndex) {
    const hero = heroes.find(h => h.id === heroId);
    if (hero && hero.chores[choreIndex]) {
        hero.chores[choreIndex].completed = !hero.chores[choreIndex].completed;
        hero.points += hero.chores[choreIndex].completed ? 10 : -10;
        if (hero.points < 0) hero.points = 0;

        updateTodayTaskProgress(hero);
        renderHeroes();
    }
}

function removeChore(heroId, choreIndex) {
    const hero = heroes.find(h => h.id === heroId);
    if (hero) {
        if (confirm(`Warning: Are you sure you want to delete the chore "${hero.chores[choreIndex].text}"?`)) {
            hero.chores.splice(choreIndex, 1);
            
            updateTodayTaskProgress(hero);
            renderHeroes();
        }
    }
}

// Calculate precise ratio for today's tasks and overall accumulated percentages
function updateTodayTaskProgress(hero) {
    const todayIndex = getCurrentDayIndex();
    
    if (hero.chores.length === 0) {
        hero.days[todayIndex] = 0;
    } else {
        const completedCount = hero.chores.filter(c => c.completed).length;
        // Percentage based strictly on completed tasks vs total tasks for that day
        hero.days[todayIndex] = Math.round((completedCount / hero.chores.length) * 100);
    }

    hero.monthlyDays[todayIndex] = hero.days[todayIndex];

    recalculateProgress(hero);
}

// Recalculate weekly and monthly averages
function recalculateProgress(hero) {
    const totalWeekScore = hero.days.reduce((acc, val) => acc + val, 0);
    hero.weeklyPercentage = Math.round(totalWeekScore / 7);

    const daysInMonth = hero.monthlyDays.length;
    const totalMonthScore = hero.monthlyDays.reduce((acc, val) => acc + val, 0);
    hero.monthlyPercentage = Math.round(totalMonthScore / daysInMonth);
}

// Allow manual override by clicking day box if needed
function toggleDay(heroId, dayIndex) {
    const hero = heroes.find(h => h.id === heroId);
    if (hero) {
        hero.days[dayIndex] = hero.days[dayIndex] === 100 ? 0 : 100;
        hero.monthlyDays[dayIndex] = hero.days[dayIndex];
        recalculateProgress(hero);
        renderHeroes();
    }
}

function triggerPhotoUpload(heroId) {
    activePhotoHeroId = heroId;
    globalPhotoInput.click();
}

function handlePhotoUpload(e) {
    const file = e.target.files[0];
    if (file && activePhotoHeroId !== null) {
        const reader = new FileReader();
        reader.onload = function(uploadEvent) {
            const hero = heroes.find(h => h.id === activePhotoHeroId);
            if (hero) {
                hero.photo = uploadEvent.target.result;
                renderHeroes();
            }
            activePhotoHeroId = null;
            globalPhotoInput.value = '';
        };
        reader.readAsDataURL(file);
    }
}

function openMonthlyReportModal() {
    const now = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const currentMonthName = monthNames[now.getMonth()];
    const daysInMonth = getDaysInCurrentMonth();

    modalMonthInfo.textContent = `Report for ${currentMonthName} (Total Days: ${daysInMonth}):`;

    if (heroes.length === 0) {
        modalReportBody.innerHTML = `<p>No heroes registered yet to generate a report.</p>`;
    } else {
        let html = `<table style="width:100%; border-collapse: collapse;">`;
        html += `<tr style="border-bottom: 1px solid #ccc;"><th style="text-align:left; padding:6px;">Hero Name</th><th style="text-align:center; padding:6px;">Points</th><th style="text-align:right; padding:6px;">Monthly Progress</th></tr>`;
        heroes.forEach(h => {
            html += `<tr style="border-bottom: 1px solid #eee;"><td style="padding:6px;">${h.name}</td><td style="text-align:center; padding:6px;">⭐ ${h.points}</td><td style="text-align:right; padding:6px;">${h.monthlyPercentage}%</td></tr>`;
        });
        html += `</table>`;
        modalReportBody.innerHTML = html;
    }

    reportModal.classList.remove('hidden');
}

function renderHeroes() {
    heroesListContainer.innerHTML = '';

    if (heroes.length === 0) {
        heroesListContainer.innerHTML = `<div class="empty-state">No heroes registered yet. Type a name above and click "Register Hero" to begin!</div>`;
        return;
    }

    const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    heroes.forEach(hero => {
        const card = document.createElement('div');
        card.className = 'hero-card';

        let choresHTML = '';
        hero.chores.forEach((chore, index) => {
            choresHTML += `
                <div class="chore-item ${chore.completed ? 'completed' : ''}">
                    <button class="chore-text-btn" onclick="toggleChore(${hero.id}, ${index})" style="background:none; border:none; cursor:pointer; color:inherit;">
                        <span>${chore.completed ? '☑' : '□'}</span>
                    </button>
                    <input type="text" class="chore-text-input" value="${chore.text}" onchange="updateChoreText(${hero.id}, ${index}, this.value)">
                    <button class="chore-delete-btn" onclick="removeChore(${hero.id}, ${index})" title="Delete chore">✕</button>
                </div>
            `;
        });

        let daysHTML = '';
        hero.days.forEach((dayPct, dIndex) => {
            let statusClass = dayPct > 0 ? 'completed' : 'missed';
            if (dayPct === 0) statusClass = 'missed';
            
            daysHTML += `
                <div class="day-box ${statusClass}" onclick="toggleDay(${hero.id}, ${dIndex})" title="Click to toggle day">
                    <span>${dayLabels[dIndex]}</span>
                    <span class="day-pct">${dayPct}%</span>
                </div>
            `;
        });

        let avatarContent = `<span style="font-size: 2rem;">⭐</span><div class="avatar-overlay">Edit Photo</div>`;
        if (hero.photo) {
            avatarContent = `<img src="${hero.photo}" alt="Hero Photo"><div class="avatar-overlay">Edit Photo</div>`;
        }

        card.innerHTML = `
            <div class="hero-profile">
                <div class="avatar-container" onclick="triggerPhotoUpload(${hero.id})" title="Click to change profile picture">
                    ${avatarContent}
                </div>
                <input type="text" class="hero-name-input" value="${hero.name}" onchange="updateHeroName(${hero.id}, this.value)">
                <div class="pts-badge">⭐ ${hero.points} pts</div>
                <button class="btn-remove" onclick="removeHero(${hero.id})">✕ Remove</button>
            </div>

            <div class="chores-section">
                <div class="add-chore-row">
                    <input type="text" id="chore-input-${hero.id}" placeholder="New chore..." onkeypress="if(event.key==='Enter') addChore(${hero.id})">
                    <button class="btn-add-chore" onclick="addChore(${hero.id})">+</button>
                </div>
                ${choresHTML}
            </div>

            <div class="daily-progress-section">
                <div class="progress-label">Daily Progress (100% Scale):</div>
                <div class="days-grid">
                    ${daysHTML}
                </div>
            </div>

            <div class="targets-column">
                <div class="target-block">
                    <div class="target-title">Weekly Target:</div>
                    <div class="target-circle">${hero.weeklyPercentage}%</div>
                </div>
                <div class="target-block">
                    <div class="target-title">Monthly (${hero.monthlyDays.length}d):</div>
                    <div class="target-circle">${hero.monthlyPercentage}%</div>
                </div>
            </div>
        `;

        heroesListContainer.appendChild(card);
    });
}

window.addChore = addChore;
window.toggleChore = toggleChore;
window.removeChore = removeChore;
window.removeHero = removeHero;
window.toggleDay = toggleDay;
window.updateHeroName = updateHeroName;
window.updateChoreText = updateChoreText;
window.triggerPhotoUpload = triggerPhotoUpload;

init();
