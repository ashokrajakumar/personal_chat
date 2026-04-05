// app.js - General UI interactions

const authModal = document.getElementById('auth-modal');
const usernameInput = document.getElementById('username-input');
const joinBtn = document.getElementById('join-btn');
const appContainer = document.getElementById('app-container');
const myUsernameDisplay = document.getElementById('my-username');
const myAvatarDisplay = document.getElementById('my-avatar');

// Chat DOM
const noChatSelected = document.getElementById('no-chat-selected');
const chatHeader = document.getElementById('chat-header');
const messagesContainer = document.getElementById('messages-container');
const chatFooter = document.getElementById('chat-footer');
const partnerUsername = document.getElementById('partner-username');
const partnerAvatar = document.getElementById('partner-avatar');
const messagesList = document.getElementById('messages');
const messageForm = document.getElementById('message-form');
const messageInput = document.getElementById('message-input');

// Call DOM
// Removed duplicated const declarations (activeCallOverlay, incomingCallModal) that exist in socket_webrtc.js
const incomingName = document.getElementById('incoming-name');
const incomingType = document.getElementById('incoming-type');
const incomingAvatar = document.getElementById('incoming-avatar');
const callPartnerDisplay = document.getElementById('call-partner');
const callTimerDisplay = document.getElementById('call-timer');

// Global App State
window.appState = {
    username: '',
    selectedUser: null, // {id, name}
    callTimerInterval: null,
    callSeconds: 0
};

// Start App Flow
document.addEventListener('DOMContentLoaded', () => {
    console.log("App DOM loaded, binding events...");
    const joinBtn = document.getElementById('join-btn');
    if(joinBtn) {
        joinBtn.addEventListener('click', joinOrbit);
    } else {
        console.error("join-btn not found!");
    }
    
    const usernameInput = document.getElementById('username-input');
    if(usernameInput) {
        usernameInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') joinOrbit();
        });
    }
});

function joinOrbit() {
    const val = usernameInput.value.trim();
    console.log("joinOrbit clicked! Input value is:", val);
    if (val) {
        console.log("Value is truthy, proceeding...");
        window.appState.username = val;
        myUsernameDisplay.textContent = val;
        myAvatarDisplay.textContent = val.charAt(0).toUpperCase();

        // Hide auth, show app
        authModal.classList.remove('active');
        setTimeout(() => appContainer.classList.remove('hidden'), 300);

        // Tell socket_webrtc.js to connect
        if (typeof window.connectSocket === 'function') {
            window.connectSocket(val);
        }
    }
}

// Select a user to chat with
window.selectUserToChat = function(userId, userName) {
    if (userId === window.socket.id) return; // Don't chat with self
    
    window.appState.selectedUser = { id: userId, name: userName };
    
    // Update UI
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    document.getElementById(`user-${userId}`).classList.add('active');

    partnerUsername.textContent = userName;
    partnerAvatar.textContent = userName.charAt(0).toUpperCase();

    noChatSelected.style.display = 'none';
    chatHeader.classList.remove('hidden');
    messagesContainer.classList.remove('hidden');
    chatFooter.classList.remove('hidden');

    // Clear old messages for now (since ephemeral and no DB per user built-in in this simple ui)
    // In a real app we'd load previous messages. Filtering is tricky without persistence.
    // We'll keep it as is, maybe just clear for demo so it looks fresh, or leave them.
    messagesList.innerHTML = '';
};

// Append Message to UI
window.appendMessage = function(fromName, message, type) { // type: 'sent' | 'received'
    const li = document.createElement('li');
    li.className = `msg-wrapper ${type}`;
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Safety against XSS simply using textContent
    const bubble = document.createElement('div');
    bubble.className = 'msg-bubble';
    bubble.textContent = message;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'msg-time';
    timeSpan.textContent = time;

    li.appendChild(bubble);
    li.appendChild(timeSpan);
    
    messagesList.appendChild(li);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
};

// Send Message Flow
messageForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = messageInput.value.trim();
    if (msg && window.appState.selectedUser) {
        window.appendMessage(window.appState.username, msg, 'sent');
        
        if (typeof window.sendMessage === 'function') {
            window.sendMessage(window.appState.selectedUser.id, msg);
        }
        
        messageInput.value = '';
    }
});

// Call Timer Logic
window.startCallTimer = function() {
    window.appState.callSeconds = 0;
    callTimerDisplay.textContent = "00:00";
    window.appState.callTimerInterval = setInterval(() => {
        window.appState.callSeconds++;
        const m = String(Math.floor(window.appState.callSeconds / 60)).padStart(2, '0');
        const s = String(window.appState.callSeconds % 60).padStart(2, '0');
        callTimerDisplay.textContent = `${m}:${s}`;
    }, 1000);
};

window.stopCallTimer = function() {
    clearInterval(window.appState.callTimerInterval);
    callTimerDisplay.textContent = "00:00";
};
