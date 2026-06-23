import { db, ref, set, get, update, onValue } from './firebase-config.js';

// --- State Management ---
let currentUser = null;
let currentView = 'mystats';
let activeSubject = null;

// Stopwatch variables
let swInterval = null;
let swSeconds = 0;
let swIsRunning = false;

// --- Initialization ---
window.onload = () => {
    const savedUser = localStorage.getItem('nildanta_user');
    if (savedUser) {
        currentUser = savedUser;
        document.getElementById('screen-auth').classList.remove('active');
        document.getElementById('main-app').classList.add('active');
        navigate('mystats');
        listenToPresence();
    }
};

// --- Authentication Logic ---
let authMode = 'signup';
window.switchAuthTab = (mode) => {
    authMode = mode;
    document.getElementById('tab-signup').classList.toggle('active', mode === 'signup');
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('auth-submit-btn').innerText = mode === 'signup' ? 'Sign Up' : 'Log In';
};

window.handleAuth = async () => {
    const user = document.getElementById('auth-username').value.trim();
    const pass = document.getElementById('auth-password').value.trim();
    const remember = document.getElementById('auth-remember').checked;
    
    if (!user || !pass) return alert("Enter username and password");

    const userRef = ref(db, 'users/' + user);
    
    if (authMode === 'signup') {
        const snap = await get(userRef);
        if (snap.exists()) return alert("Username taken");
        
        await set(userRef, { 
            password: pass, // In a real app, hash this!
            status: 'online', 
            currentSubject: '', 
            currentRunningTime: 0 
        });
        
        loginUser(user, remember);
    } else {
        const snap = await get(userRef);
        if (snap.exists() && snap.val().password === pass) {
            loginUser(user, remember);
        } else {
            alert("Invalid credentials");
        }
    }
};

function loginUser(username, remember) {
    currentUser = username;
    if (remember) localStorage.setItem('nildanta_user', username);
    
    document.getElementById('screen-auth').classList.remove('active');
    document.getElementById('main-app').classList.add('active');
    navigate('mystats');
    listenToPresence();
}

// --- Navigation Logic ---
const viewTitles = {
    'mystats': 'Home', 'timers': 'NILDANTA-TIMER', 'people': 'People in Study', 
    'leaderboard': 'Leaderboard', 'customize': 'NILDANTA-TIMER', 'timer-detail': 'NILDANTA-TIMER'
};

window.navigate = (viewName, context = null) => {
    // Hide all views
    document.querySelectorAll('.view').forEach(v => v.style.display = 'none');
    
    // Manage Bottom Nav active state
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if(viewName === 'mystats') document.getElementById('nav-home').classList.add('active');
    if(viewName === 'timers') document.getElementById('nav-timers').classList.add('active');
    if(viewName === 'people') document.getElementById('nav-people').classList.add('active');

    // Header adjustments
    document.getElementById('header-title').innerText = viewTitles[viewName] || '';
    document.getElementById('back-btn').style.display = ['customize', 'timer-detail', 'leaderboard'].includes(viewName) ? 'block' : 'none';
    document.getElementById('leaderboard-btn').style.display = viewName === 'people' ? 'block' : 'none';
    document.getElementById('header-action-btn').style.display = viewName === 'mystats' ? 'block' : 'none';

    // Show selected view
    document.getElementById(`view-${viewName}`).style.display = 'block';
    currentView = viewName;

    // View specific logic
    if (viewName === 'timers') loadSubjects();
    if (viewName === 'timer-detail' && context) setupTimerDetail(context);
    if (viewName === 'mystats') loadMyStats();
};

window.goBack = () => {
    if (currentView === 'customize' || currentView === 'timer-detail') navigate('timers');
    else if (currentView === 'leaderboard') navigate('people');
};

// --- Subjects & Timer Core Logic ---
const defaultSubjects = ['Bangla', 'English', 'ICT', 'Physics', 'Chemistry', 'Math', 'Biology'];

async function loadSubjects() {
    document.getElementById('timers-username').innerText = currentUser;
    const subjRef = ref(db, `user_subjects/${currentUser}`);
    const snap = await get(subjRef);
    let subjects = snap.exists() ? snap.val() : defaultSubjects;
    
    if (!snap.exists()) set(subjRef, subjects); // Seed defaults

    const list = document.getElementById('subject-list');
    list.innerHTML = '';
    
    // Note: In reality you'd fetch total all-time stats here to display beside the names
    subjects.forEach(sub => {
        list.innerHTML += `
            <div class="list-row" onclick="navigate('timer-detail', '${sub}')">
                <span>${sub}</span>
                <span>00:00:00</span>
            </div>
        `;
    });
}

function setupTimerDetail(subject) {
    activeSubject = subject;
    document.getElementById('active-subject-title').innerText = subject;
    // Keep UI values intact if navigating back while running
    updateDisplay('stopwatch-display', swSeconds);
}

// --- Stopwatch Logic ---
window.toggleStopwatch = () => {
    const btn = document.getElementById('stopwatch-toggle');
    if (swIsRunning) {
        clearInterval(swInterval);
        btn.innerText = 'Start';
        swIsRunning = false;
        updatePresence('', 0); // User paused/stopped
    } else {
        swInterval = setInterval(() => {
            swSeconds++;
            updateDisplay('stopwatch-display', swSeconds);
            updatePresence(activeSubject, swSeconds); // Broadcast live status
        }, 1000);
        btn.innerText = 'Pause';
        swIsRunning = true;
    }
};

window.stopStopwatch = async () => {
    if (swSeconds === 0) return;
    clearInterval(swInterval);
    swIsRunning = false;
    document.getElementById('stopwatch-toggle').innerText = 'Start';
    
    await saveTimeToStats(activeSubject, swSeconds);
    
    swSeconds = 0;
    updateDisplay('stopwatch-display', 0);
    updatePresence('', 0);
    alert('Time saved successfully!');
};

window.resetStopwatch = () => {
    clearInterval(swInterval);
    swIsRunning = false;
    swSeconds = 0;
    document.getElementById('stopwatch-toggle').innerText = 'Start';
    updateDisplay('stopwatch-display', 0);
    updatePresence('', 0);
};

// --- Firebase Data Interactions ---
async function saveTimeToStats(subject, durationInSeconds) {
    const today = new Date().toISOString().split('T')[0]; // Format: YYYY-MM-DD
    const statRef = ref(db, `stats/${currentUser}/${today}/${subject}`);
    
    const snap = await get(statRef);
    const currentTotal = snap.exists() ? snap.val() : 0;
    const newTotal = currentTotal + durationInSeconds;
    
    await set(statRef, newTotal);
}

function updatePresence(subject, time) {
    const presenceRef = ref(db, `users/${currentUser}`);
    update(presenceRef, {
        currentSubject: subject,
        currentRunningTime: time,
        lastActive: Date.now()
    });
}

function listenToPresence() {
    const usersRef = ref(db, 'users');
    onValue(usersRef, (snapshot) => {
        if (!snapshot.exists()) return;
        
        // This triggers whenever ANY user updates their stopwatch
        if (currentView === 'people') {
            const onlineContainer = document.getElementById('online-users');
            const offlineContainer = document.getElementById('offline-users');
            onlineContainer.innerHTML = '';
            offlineContainer.innerHTML = '';
            
            snapshot.forEach(child => {
                const userObj = child.val();
                const uName = child.key;
                if (uName === currentUser) return; // Skip self
                
                const isOnline = userObj.currentSubject !== '';
                
                const html = `
                    <div class="list-row ${isOnline ? '' : 'offline'}">
                        <div>
                            <div style="font-size: 1.5rem;">${uName}</div>
                        </div>
                        <div style="text-align: right; display: flex; align-items: center; gap: 10px;">
                            ${isOnline ? `
                                <div>
                                    <div style="font-size: 0.9rem;">${userObj.currentSubject}</div>
                                    <div style="font-size: 1.1rem;">${formatTime(userObj.currentRunningTime)}</div>
                                </div>
                            ` : ''}
                            <div class="status-dot ${isOnline ? 'online' : ''}"></div>
                        </div>
                    </div>
                `;
                
                if (isOnline) onlineContainer.innerHTML += html;
                else offlineContainer.innerHTML += html;
            });
        }
    });
}

async function loadMyStats() {
    const today = new Date().toISOString().split('T')[0];
    const statRef = ref(db, `stats/${currentUser}/${today}`);
    const snap = await get(statRef);
    
    const container = document.getElementById('stats-today');
    container.innerHTML = '<div style="text-align:right; font-size: 0.9rem; margin-bottom: 5px;">(h/m/s)</div>';
    
    if (snap.exists()) {
        const data = snap.val();
        let total = 0;
        for (const [sub, time] of Object.entries(data)) {
            container.innerHTML += `
                <div style="display:flex; justify-content:space-between; font-weight: bold; margin-bottom: 5px;">
                    <span>${sub}:</span>
                    <span>${formatTime(time)}</span>
                </div>
            `;
            total += time;
        }
        container.innerHTML += `
            <hr style="border-color: #777; margin: 15px 0;">
            <div style="display:flex; justify-content:space-between; font-size: 1.3rem;">
                <span>Total:</span>
                <span>${formatTime(total)}</span>
            </div>
        `;
    } else {
        container.innerHTML += `<p style="text-align:center; margin-top:20px;">No records for today.</p>`;
    }
}

// --- Utilities ---
function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
}

function updateDisplay(elementId, totalSeconds) {
    document.getElementById(elementId).innerText = formatTime(totalSeconds);
}