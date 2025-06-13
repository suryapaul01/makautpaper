// Initialize Telegram WebApp
const tg = window.Telegram.WebApp;
tg.expand();

// Global variables
let currentUser = null;
let currentDepartment = null;
let currentSemester = null;
let currentYear = null;

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
    initializeNavigation();
    loadUserData();
    loadDepartments();
});

// Navigation handling
function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabId = item.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // Update navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabId);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.toggle('active', content.id === tabId);
    });

    // Load tab-specific data
    switch (tabId) {
        case 'question-papers':
            loadDepartments();
            break;
        case 'topup-wallet':
            updateBalance();
            break;
        case 'purchase-history':
            loadPurchaseHistory();
            break;
        case 'profile':
            loadProfile();
            break;
    }
}

// User data handling
async function loadUserData() {
    try {
        const response = await fetch('/api/user', {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        currentUser = await response.json();
        updateUserInterface();
    } catch (error) {
        console.error('Error loading user data:', error);
        showError('Failed to load user data');
    }
}

function updateUserInterface() {
    if (!currentUser) return;

    // Update profile information
    document.getElementById('user-name').textContent = currentUser.first_name || 'User';
    document.getElementById('user-id').textContent = `ID: ${currentUser.id}`;
    document.getElementById('current-balance').textContent = currentUser.stars;
    document.getElementById('profile-balance').textContent = currentUser.stars;
}

// Department handling
async function loadDepartments() {
    try {
        const response = await fetch('/api/departments');
        const departments = await response.json();
        displayDepartments(departments);
    } catch (error) {
        console.error('Error loading departments:', error);
        showError('Failed to load departments');
    }
}

function displayDepartments(departments) {
    const container = document.getElementById('departments');
    container.innerHTML = departments.map(dept => `
        <div class="grid-item" onclick="selectDepartment('${dept}')">
            <i class="fas fa-building"></i>
            <h3>${dept}</h3>
        </div>
    `).join('');
}

async function selectDepartment(department) {
    currentDepartment = department;
    try {
        const response = await fetch(`/api/semesters/${department}`);
        const semesters = await response.json();
        displaySemesters(semesters);
    } catch (error) {
        console.error('Error loading semesters:', error);
        showError('Failed to load semesters');
    }
}

// Semester handling
function displaySemesters(semesters) {
    document.querySelector('.dept-container').classList.add('hidden');
    const container = document.querySelector('.sem-container');
    container.classList.remove('hidden');
    
    container.innerHTML = `
        <button class="back-button" onclick="backToDepartments()">
            <i class="fas fa-arrow-left"></i> Back
        </button>
        <h2>Select Semester</h2>
        <div class="grid-container">
            ${semesters.map(sem => `
                <div class="grid-item" onclick="selectSemester('${sem}')">
                    <i class="fas fa-graduation-cap"></i>
                    <h3>${sem}</h3>
                </div>
            `).join('')}
        </div>
    `;
}

async function selectSemester(semester) {
    currentSemester = semester;
    try {
        const response = await fetch(`/api/years/${currentDepartment}/${semester}`);
        const years = await response.json();
        displayYears(years);
    } catch (error) {
        console.error('Error loading years:', error);
        showError('Failed to load years');
    }
}

// Year handling
function displayYears(years) {
    document.querySelector('.sem-container').classList.add('hidden');
    const container = document.querySelector('.year-container');
    container.classList.remove('hidden');
    
    container.innerHTML = `
        <button class="back-button" onclick="backToSemesters()">
            <i class="fas fa-arrow-left"></i> Back
        </button>
        <h2>Select Year</h2>
        <div class="grid-container">
            ${years.map(year => `
                <div class="grid-item" onclick="selectYear('${year}')">
                    <i class="fas fa-calendar"></i>
                    <h3>${year}</h3>
                </div>
            `).join('')}
        </div>
    `;
}

async function selectYear(year) {
    currentYear = year;
    try {
        const response = await fetch(`/api/papers/${currentDepartment}/${currentSemester}/${year}`);
        const papers = await response.json();
        displayPapers(papers);
    } catch (error) {
        console.error('Error loading papers:', error);
        showError('Failed to load papers');
    }
}

// Paper handling
function displayPapers(papers) {
    document.querySelector('.year-container').classList.add('hidden');
    const container = document.querySelector('.papers-container');
    container.classList.remove('hidden');
    
    container.innerHTML = `
        <button class="back-button" onclick="backToYears()">
            <i class="fas fa-arrow-left"></i> Back
        </button>
        <h2>Available Papers</h2>
        <div class="grid-container">
            ${papers.map(paper => `
                <div class="grid-item" onclick="purchasePaper(${paper.id})">
                    <i class="fas fa-file-alt"></i>
                    <h3>${paper.paper_name}</h3>
                    <p>${paper.price} ⭐</p>
                </div>
            `).join('')}
        </div>
    `;
}

// Purchase handling
async function purchasePaper(paperId) {
    if (!currentUser) {
        showError('Please log in to purchase papers');
        return;
    }

    try {
        const response = await fetch('/api/purchase', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData
            },
            body: JSON.stringify({ paperId })
        });

        const result = await response.json();
        
        if (result.success) {
            if (result.requiresPayment) {
                tg.showPopup({
                    title: 'Purchase Stars',
                    message: `You need ${result.requiredStars} stars to purchase this paper.`,
                    buttons: [
                        { id: 'buy', type: 'buy', text: 'Buy Stars' },
                        { id: 'cancel', type: 'cancel', text: 'Cancel' }
                    ]
                }, (buttonId) => {
                    if (buttonId === 'buy') {
                        initiateStarPurchase(result.requiredStars);
                    }
                });
            } else {
                showSuccess('Paper purchased successfully!');
                updateBalance();
                loadPurchaseHistory();
            }
        } else {
            showError(result.message);
        }
    } catch (error) {
        console.error('Error purchasing paper:', error);
        showError('Failed to purchase paper');
    }
}

// Wallet handling
function updateBalance() {
    if (!currentUser) return;
    document.getElementById('current-balance').textContent = currentUser.stars;
}

async function initiateStarPurchase(amount) {
    try {
        const response = await fetch('/api/create-invoice', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Telegram-Init-Data': tg.initData
            },
            body: JSON.stringify({ amount })
        });

        const invoice = await response.json();
        tg.showPopup({
            title: 'Purchase Stars',
            message: `Purchase ${amount} stars for ${amount} XTR?`,
            buttons: [
                { id: 'pay', type: 'pay', text: 'Pay' },
                { id: 'cancel', type: 'cancel', text: 'Cancel' }
            ]
        }, async (buttonId) => {
            if (buttonId === 'pay') {
                try {
                    await tg.openInvoice(invoice.invoiceUrl);
                } catch (error) {
                    console.error('Error opening invoice:', error);
                    showError('Failed to open payment window');
                }
            }
        });
    } catch (error) {
        console.error('Error creating invoice:', error);
        showError('Failed to create payment invoice');
    }
}

// Purchase history handling
async function loadPurchaseHistory() {
    try {
        const response = await fetch('/api/purchase-history', {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        const history = await response.json();
        displayPurchaseHistory(history);
    } catch (error) {
        console.error('Error loading purchase history:', error);
        showError('Failed to load purchase history');
    }
}

function displayPurchaseHistory(history) {
    const container = document.getElementById('history-list');
    container.innerHTML = history.map(item => `
        <div class="history-item">
            <div class="history-info">
                <h3>${item.paper_name}</h3>
                <p>${item.department} - ${item.semester} - ${item.year}</p>
            </div>
            <button class="btn btn-primary" onclick="requestPaper(${item.paper_id})">
                <i class="fas fa-download"></i> Get Paper
            </button>
        </div>
    `).join('');
}

// Profile handling
async function loadProfile() {
    if (!currentUser) return;

    try {
        const response = await fetch('/api/profile', {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        const profile = await response.json();
        displayProfile(profile);
    } catch (error) {
        console.error('Error loading profile:', error);
        showError('Failed to load profile');
    }
}

function displayProfile(profile) {
    document.getElementById('papers-count').textContent = profile.total_papers;
    document.getElementById('total-spent').textContent = profile.total_spent;

    const deptStats = document.getElementById('dept-stats');
    deptStats.innerHTML = Object.entries(profile.department_stats).map(([dept, count]) => `
        <div class="stat-card">
            <i class="fas fa-building"></i>
            <div class="stat-info">
                <h3>${dept}</h3>
                <p>${count} papers</p>
            </div>
        </div>
    `).join('');
}

// Navigation helpers
function backToDepartments() {
    document.querySelector('.sem-container').classList.add('hidden');
    document.querySelector('.dept-container').classList.remove('hidden');
    currentSemester = null;
}

function backToSemesters() {
    document.querySelector('.year-container').classList.add('hidden');
    document.querySelector('.sem-container').classList.remove('hidden');
    currentYear = null;
}

function backToYears() {
    document.querySelector('.papers-container').classList.add('hidden');
    document.querySelector('.year-container').classList.remove('hidden');
}

// Utility functions
function showError(message) {
    tg.showPopup({
        title: 'Error',
        message: message,
        buttons: [{ id: 'ok', type: 'ok', text: 'OK' }]
    });
}

function showSuccess(message) {
    tg.showPopup({
        title: 'Success',
        message: message,
        buttons: [{ id: 'ok', type: 'ok', text: 'OK' }]
    });
}

// Handle successful payment
tg.onEvent('paymentCompleted', async (event) => {
    await loadUserData();
    showSuccess('Payment completed successfully!');
});

// Handle paper request
async function requestPaper(paperId) {
    try {
        const response = await fetch(`/api/request-paper/${paperId}`, {
            headers: {
                'X-Telegram-Init-Data': tg.initData
            }
        });
        const result = await response.json();
        
        if (result.success) {
            tg.sendData(JSON.stringify({
                action: 'send_paper',
                paper_id: paperId
            }));
            showSuccess('Paper sent to your Telegram chat!');
        } else {
            showError(result.message);
        }
    } catch (error) {
        console.error('Error requesting paper:', error);
        showError('Failed to request paper');
    }
} 