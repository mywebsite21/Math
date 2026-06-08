import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Initialize Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAwS7AZewx0L8KRGeFXB7Jq4BJEbSB0xO0",
  authDomain: "fxgroup-5dd7c.firebaseapp.com",
  projectId: "fxgroup-5dd7c",
  storageBucket: "fxgroup-5dd7c.firebasestorage.app",
  messagingSenderId: "982128077012",
  appId: "1:982128077012:web:e5088b7be662cecf20f341",
  measurementId: "G-9FRXZNCJQJ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Application Configuration
const MASTER_EMAIL = "pinakjoy50@gmail.com";

// DOM Utility Functions
const id = (elId) => document.getElementById(elId);
const show = (elId) => { const e = id(elId); if (e) e.classList.remove('hidden'); };
const hide = (elId) => { const e = id(elId); if (e) e.classList.add('hidden'); };
const html = (elId, c) => { const e = id(elId); if (e) e.innerHTML = c; };
const val = (elId) => id(elId)?.value || '';

// --- MAIN INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    if (id("public-page-marker")) {
        initPublicPage();
    }
    if (id("admin-page-marker")) {
        initAdminPage();
    }
});

/** ==========================================
 *  PUBLIC REGISTRATION PAGE LOGIC
 *  ========================================== */
async function initPublicPage() {
    // Determine the Ref/Custom URL. URLSearchParams or hash (#demo)
    const urlParams = new URLSearchParams(window.location.search);
    let ref = urlParams.get('ref') || window.location.hash.substring(1);
    
    if (!ref) {
        // Redict completely to the admin logging page if no referral link provided
        window.location.href = "admin.html";
        return;
    }

    try {
        // Find the admin with this custom_url
        const q = query(collection(db, "admins"), where("custom_url", "==", ref));
        const qs = await getDocs(q);

        if (qs.empty) {
            hide('loading-view');
            show('error-view');
            return;
        }

        const adminDoc = qs.docs[0];
        const adminData = adminDoc.data();

        if (adminData.status !== 'approved') {
            hide('loading-view');
            show('error-view');
            id('error-message').innerText = 'This admin account is not currently active.';
            return;
        }

        // Setup the UI for registration
        hide('loading-view');
        show('registration-view');
        
        // Display admin email name prefix as name if nothing else
        const adminName = adminData.email.split('@')[0];
        html('admin-name-display', adminName);

        // Bind registration form submission
        id('public-reg-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = id('reg-submit-btn');
            const originalText = btn.innerHTML;
            btn.innerHTML = 'Processing...';
            btn.disabled = true;

            try {
                // Save Member Data
                await addDoc(collection(db, "members"), {
                    admin_uid: adminDoc.id, // the UID of the admin
                    name: val('reg-name'),
                    telegram: val('reg-telegram'),
                    whatsapp: val('reg-whatsapp'),
                    registered_at: new Date() // standard Date object for easy querying
                });

                // Redirect to Telegram Group
                if (adminData.telegram_link) {
                    window.location.href = adminData.telegram_link;
                } else {
                    btn.innerHTML = 'Success!';
                    setTimeout(() => alert('Registration Complete! No Telegram link has been configured by this admin.'), 500);
                }
            } catch (err) {
                console.error(err);
                alert("Error registering member: " + err.message);
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        });

    } catch (err) {
        console.error(err);
        hide('loading-view');
        show('error-view');
        id('error-message').innerText = 'System error occurred checking link.';
    }
}

/** ==========================================
 *  ADMIN PANEL LOGIC
 *  ========================================== */
function initAdminPage() {
    // Setup UI toggles for Auth View
    id('show-register')?.addEventListener('click', () => { hide('login-form-div'); show('register-form-div'); });
    id('show-login')?.addEventListener('click', () => { hide('register-form-div'); show('login-form-div'); });

    // Handle Auth Observer
    onAuthStateChanged(auth, async (user) => {
        hide('app-loading');
        if (user) {
            hide('auth-view');
            html('nav-user-email', user.email);
            show('dashboard-nav');
            show('dashboard-view');
            await loadAdminData(user);
        } else {
            // Not logged in
            hide('dashboard-nav');
            hide('dashboard-view');
            show('auth-view');
        }
    });

    // Login Form Submit
    id('login-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = id('login-btn');
        btn.disabled = true; btn.innerText = "Please wait...";
        try {
            await signInWithEmailAndPassword(auth, val('login-email'), val('login-pass'));
        } catch (err) {
            alert("Error Login: " + err.message);
        } finally {
            btn.disabled = false; btn.innerText = "Sign In";
        }
    });

    // Register Form Submit
    id('register-form')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = id('register-btn');
        btn.disabled = true; btn.innerText = "Please wait...";
        try {
            const userCred = await createUserWithEmailAndPassword(auth, val('reg-email'), val('reg-pass'));
            const user = userCred.user;
            // Setup their admin doc in Firestore immediately
            // Auto approve and master_admin if matched email
            const isMaster = (user.email === MASTER_EMAIL);
            const status = isMaster ? 'approved' : 'pending';
            const role = isMaster ? 'master_admin' : 'admin';

            await setDoc(doc(db, "admins", user.uid), {
                email: user.email,
                role: role,
                status: status,
                custom_url: "",
                telegram_link: "",
                created_at: new Date()
            });
            // State observer catches the logged in user
        } catch (err) {
            alert("Error Registration: " + err.message);
        } finally {
            btn.disabled = false; btn.innerText = "Register Admin";
        }
    });

    // Logout Action
    id('logout-btn')?.addEventListener('click', () => {
        signOut(auth);
    });
}

// Global scope to hold members data for CSV export
let currentMembersList = [];

// Handle Loading the Correct Admin Dashboard Pieces
async function loadAdminData(user) {
    try {
        const adminRef = doc(db, "admins", user.uid);
        const adminSnap = await getDoc(adminRef);

        if (!adminSnap.exists()) {
            console.error("Admin data not found. Creating default...");
            try {
                const isMaster = (user.email === MASTER_EMAIL);
                await setDoc(adminRef, {
                    email: user.email,
                    role: isMaster ? 'master_admin' : 'admin',
                    status: isMaster ? 'approved' : 'pending',
                    custom_url: "",
                    telegram_link: "",
                    created_at: new Date()
                });
                window.location.reload();
                return;
            } catch (err) {
                console.error("Error creating default admin data: ", err);
                hide('app-loading');
                alert("Database Error: Could not verify or create your admin profile.\n\nWHY THIS HAPPENED:\nYou have created a user in Authentication, but your Firestore Database is blocking access. \n\nHOW TO FIX:\n1. Go to Firebase Console > Firestore Database.\n2. Click the 'Rules' tab.\n3. Change your rules to allow access:\n\nmatch /{document=**} {\n  allow read, write: if true;\n}\n\n4. Publish the rules and refresh this page.\n\nError details: " + err.message);
                return;
            }
        }

        const adminData = adminSnap.data();

        // 1. If Pending -> show pending screen, exit out
        if (adminData.status === 'pending') {
            hide('panel-approved');
            hide('panel-master');
            show('panel-pending');
            return;
        }

        // 2. Setup standard Admin Approved Dashboard
        hide('panel-pending');
        hide('panel-master');
        show('panel-approved');

        // Populate Settings Forms
        id('set-custom-url').value = adminData.custom_url || "";
        id('set-telegram-link').value = adminData.telegram_link || "";
        updateLinkPreview();

        id('set-custom-url').addEventListener('keyup', updateLinkPreview);

        // Bind Settings Save
        id('settings-form').onsubmit = async (e) => {
            e.preventDefault();
            const urlVal = val('set-custom-url').trim();
            const stBtn = id('settings-save-btn');
            stBtn.innerText = "Saving...";
            
            // Check custom_url uniqueness
            if (urlVal !== "") {
                const uniqueCheckQuery = query(collection(db, "admins"), where("custom_url", "==", urlVal));
                const uniqueSnap = await getDocs(uniqueCheckQuery);
                const otherAdmins = uniqueSnap.docs.filter(d => d.id !== user.uid);
                if (otherAdmins.length > 0) {
                    alert("This Custom URL is already taken by another admin. Please choose a different one.");
                    stBtn.innerText = "Save Settings";
                    return;
                }
            }

            try {
                await updateDoc(adminRef, {
                    custom_url: urlVal,
                    telegram_link: val('set-telegram-link').trim()
                });
                stBtn.innerText = "Saved!";
                setTimeout(() => stBtn.innerText = "Save Settings", 2000);
            } catch (err) {
                alert("Error saving settings: " + err.message);
                stBtn.innerText = "Save Settings";
            }
        };

        // Bind Export CSV
        id('export-csv-btn').onclick = downloadCSV;

        // Fetch Total Members & Populate Stats & Table
        await fetchAndRenderMembers(user.uid);

        // 3. Setup Master Admin Extension (if applied)
        if (adminData.role === 'master_admin') {
            show('panel-master');
            await loadMasterAdminsList();
        }

    } catch (err) {
        console.error("Error loading admin data: ", err);
        hide('app-loading');
        alert("Firestore Permission Error: \nYour database is blocking access to read your profile info.\n\nPlease fix your Firestore Rules in the Firebase console:\nallow read, write: if true;\n\nDetails: " + err.message);
    }
}

function updateLinkPreview() {
    const customUrl = id('set-custom-url').value.trim();
    const origin = window.location.origin;
    const path = window.location.pathname.replace('admin.html', '').replace(/\/$/, "");
    if (customUrl) {
        const preview = `${origin}${path}/?ref=${customUrl}`;
        html('link-preview', `<a href="${preview}" target="_blank" class="text-[#10b981] hover:text-[#0e9f6e] hover:underline transition-colors">${preview}</a>`);
    } else {
        html('link-preview', 'No custom URL set yet.');
    }
}

// Fetching members for standard Admin
async function fetchAndRenderMembers(adminUid) {
    const q = query(collection(db, "members"), where("admin_uid", "==", adminUid));
    const qs = await getDocs(q);
    
    currentMembersList = [];
    qs.forEach(doc => currentMembersList.push({ id: doc.id, ...doc.data() }));

    // Sort by newest
    currentMembersList.sort((a,b) => {
        let da = a.registered_at?.toDate ? a.registered_at.toDate() : new Date(a.registered_at);
        let dbDate = b.registered_at?.toDate ? b.registered_at.toDate() : new Date(b.registered_at);
        return dbDate - da;
    });

    // Calculate dates
    const now = new Date();
    
    // Start of Day
    const soToday = new Date(now);
    soToday.setHours(0,0,0,0);
    
    // Start of Week (Sunday)
    const soWeek = new Date(now);
    const day = soWeek.getDay();
    const diff = soWeek.getDate() - day; // Adjust to Sunday
    soWeek.setDate(diff);
    soWeek.setHours(0,0,0,0);

    // Start of Month
    const soMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let countToday = 0;
    let countWeek = 0;
    let countMonth = 0;

    let tableHtml = "";

    currentMembersList.forEach(m => {
        let d = m.registered_at?.toDate ? m.registered_at.toDate() : new Date(m.registered_at);
        if (d >= soToday) countToday++;
        if (d >= soWeek) countWeek++;
        if (d >= soMonth) countMonth++;

        tableHtml += `
            <tr class="hover:bg-[#1c1c1c] border-b border-[#262626] last:border-b-0 text-[13px] transition-colors">
                <td class="px-5 py-3 text-[#e2e8f0] font-medium">${m.name}</td>
                <td class="px-5 py-3 text-[#888888]">${m.telegram}</td>
                <td class="px-5 py-3 text-[#888888]">${m.whatsapp}</td>
                <td class="px-5 py-3 text-[#888888]">${d.toLocaleDateString()}</td>
            </tr>
        `;
    });

    html('stat-total', currentMembersList.length);
    html('stat-today', countToday);
    html('stat-week', countWeek);
    html('stat-month', countMonth);

    if (currentMembersList.length > 0) {
        html('members-tbody', tableHtml);
    } else {
        html('members-tbody', `<tr><td colspan="4" class="px-5 py-8 text-center text-[#888888] text-[13px]">No members registered yet.</td></tr>`);
    }
}

// Master Admin Data
window.approveAdmin = async (adminId) => {
    try {
        await updateDoc(doc(db, "admins", adminId), { status: 'approved' });
        await loadMasterAdminsList();
    } catch(e) { alert(e.message); }
};
window.rejectAdmin = async (adminId) => {
     try {
        await updateDoc(doc(db, "admins", adminId), { status: 'rejected' });
        await loadMasterAdminsList();
    } catch(e) { alert(e.message); }
};

async function loadMasterAdminsList() {
    const qs = await getDocs(collection(db, "admins"));
    let htmlContent = "";
    
    qs.forEach(docSnap => {
        const d = docSnap.data();
        htmlContent += `
        <div class="flex flex-col gap-3 p-4 bg-[#0a0a0a] rounded-xl border border-[#262626] mb-3 transition-colors hover:bg-[#1c1c1c]">
            <div class="flex items-center justify-between">
                <div>
                    <p class="font-semibold text-[#e2e8f0] text-[14px]">${d.email}</p>
                    <div class="flex items-center space-x-2 text-[12px] mt-2">
                        <span class="px-2 py-0.5 rounded-sm bg-[#161616] text-[#888888] font-medium border border-[#262626]">Role: ${d.role}</span>
                        <span class="px-2 py-0.5 rounded-sm font-medium border ${d.status === 'approved' ? 'bg-[#10b981]/10 text-[#10b981] border-[#10b981]/20' : d.status === 'pending' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'}">Status: ${d.status}</span>
                    </div>
                </div>
                <!-- actions -->
                <div class="flex items-center gap-2">
                    ${(d.status !== 'approved' && d.role !== 'master_admin') ? `<button onclick="approveAdmin('${docSnap.id}')" class="px-3 py-1.5 bg-[#10b981] hover:bg-[#0e9f6e] text-black rounded-md text-[12px] font-semibold transition outline-none shadow-sm">Approve</button>` : ''}
                    ${(d.status !== 'rejected' && d.role !== 'master_admin') ? `<button onclick="rejectAdmin('${docSnap.id}')" class="px-3 py-1.5 bg-transparent hover:bg-red-500/10 text-red-500 border border-red-500/30 rounded-md text-[12px] font-semibold transition outline-none">Reject</button>` : ''}
                </div>
            </div>
        </div>
        `;
    });
    
    html('master-admins-list', htmlContent);
}

// CSV Export Logic
function downloadCSV() {
    if (currentMembersList.length === 0) {
        alert("No members to export.");
        return;
    }
    
    const headers = ["Name", "Telegram", "WhatsApp", "Registration Date"];
    const rows = currentMembersList.map(m => {
        let dDate = m.registered_at?.toDate ? m.registered_at.toDate() : new Date(m.registered_at);
        return `"${m.name}","${m.telegram}","${m.whatsapp}","${dDate.toLocaleString()}"`;
    });
    
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "members_export.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
}
