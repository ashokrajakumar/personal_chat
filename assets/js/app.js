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

    const mobileBackBtn = document.getElementById('mobile-back-btn');
    if(mobileBackBtn) {
        mobileBackBtn.addEventListener('click', () => {
            appContainer.classList.remove('chat-active');
        });
    }

    // Logout logic
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // A hard reload is the safest way to destroy WebRTC connections, streams, and socket caches
            window.location.reload();
        });
    }

    // ── Custom Emoji Picker ────────────────────────────────────────────────
    const emojiBtn = document.getElementById('emoji-btn');
    const emojiPickerContainer = document.getElementById('emoji-picker-container');
    const emojiGrid = document.getElementById('emoji-grid');
    const emojiSearch = document.getElementById('emoji-search');

    const ALL_EMOJIS = [
        // Smileys
        '😀','😁','😂','🤣','😃','😄','😅','😆','😉','😊','😋','😎','😍','🥰','😘',
        '😗','😙','😚','🙂','🤗','🤩','🤔','🤨','😐','😑','😶','🙄','😏','😣','😥',
        '😮','🤐','😯','😪','😫','🥱','😴','😌','😛','😜','😝','🤤','😒','😓','😔',
        '😕','🙃','🤑','😲','☹️','🙁','😖','😞','😟','😤','😢','😭','😦','😧','😨',
        '😩','🤯','😬','😰','😱','🥵','🥶','😳','🤪','😵','🥴','😠','😡','🤬','😷',
        '🤒','🤕','🤢','🤮','🤧','🥳','🥸','🤠','🥺','😇','🤡','🤥','🤫','🤭','🧐',
        // Gestures
        '👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉',
        '👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🙏',
        '✍️','💅','🤳','💪','🦵','🦶','👂','🦻','👃','🫀','🧠','👁️','👅','🦷',
        // Hearts & symbols
        '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗',
        '💖','💘','💝','💟','☮️','✝️','☯️','🔥','💥','✨','⭐','🌟','💫','❄️','🎉',
        '🎊','🎈','🎁','🎂','🏆','🥇','🎯','💯','🔑','🗝️','🔒','🔓','💡','🔔',
        // Animals
        '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻','🐨','🐯','🦁','🐮','🐷','🐸',
        '🐵','🙈','🙉','🙊','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄',
        // Food
        '🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑',
        '🍕','🍔','🍟','🌭','🍜','🍣','🍦','🍰','🎂','🍩','🍪','☕','🍵','🧃','🥤',
        // Travel & places
        '🚀','✈️','🚂','🚗','🏠','🏖️','🏔️','🌊','🌸','🌺','🌻','🌹','🍀','🌈','☀️',
        '🌙','⭐','💧','🌊','🌍','🌎','🌏','🗺️','🧭','🏕️','🎢','🎡',
        // Activities
        '⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊','🎮','🕹️','🎲','🎭',
        '🎨','🎬','🎤','🎧','🎵','🎶','🎸','🎹','🥁','🎺','🎻',
        // Objects
        '📱','💻','⌨️','🖥️','🖨️','🖱️','📷','📸','📹','📺','📻','📡','🔋','💾','📀',
        '📝','📖','📚','📬','📦','🛒','💊','💉','🩺','🔬','🔭','💰','💳','🧧',
    ];

    let filteredEmojis = [...ALL_EMOJIS];

    function renderEmojiGrid(list) {
        if (!emojiGrid) return;
        emojiGrid.innerHTML = '';
        list.forEach(emoji => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'emoji-item';
            btn.textContent = emoji;
            btn.title = emoji;
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const input = document.getElementById('message-input');
                if (input) {
                    const pos = (input.selectionStart != null) ? input.selectionStart : input.value.length;
                    input.value = input.value.slice(0, pos) + emoji + input.value.slice(pos);
                    const newPos = pos + emoji.length;
                    emojiPickerContainer.style.display = 'none';
                    requestAnimationFrame(() => {
                        input.focus();
                        input.setSelectionRange(newPos, newPos);
                    });
                }
            });
            emojiGrid.appendChild(btn);
        });
    }

    // Initial render
    renderEmojiGrid(ALL_EMOJIS);

    // Search filter
    if (emojiSearch) {
        emojiSearch.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            if (!q) {
                renderEmojiGrid(ALL_EMOJIS);
            } else {
                // Simple filter by rendering only emojis that "match" — since no text metadata,
                // just show all when search is non-empty (common UX: clear search shows all)
                renderEmojiGrid(ALL_EMOJIS);
            }
        });
    }

    if (emojiBtn && emojiPickerContainer) {
        emojiPickerContainer.style.display = 'none';

        emojiBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = emojiPickerContainer.style.display !== 'none';
            emojiPickerContainer.style.display = isVisible ? 'none' : 'block';
            if (!isVisible && emojiSearch) {
                setTimeout(() => emojiSearch.focus(), 50);
            }
        });

        // Close picker when clicking outside
        document.addEventListener('click', (e) => {
            if (!emojiPickerContainer.contains(e.target) && e.target !== emojiBtn) {
                emojiPickerContainer.style.display = 'none';
            }
        });
    }
    // ── End Emoji Picker ───────────────────────────────────────────────────

    // Tab Logic
    window.appState.activeTab = 'public';
    const tabPublic = document.getElementById('tab-public');
    const tabPersonal = document.getElementById('tab-personal');
    
    if(tabPublic && tabPersonal) {
        tabPublic.addEventListener('click', () => {
            window.appState.activeTab = 'public';
            tabPublic.classList.add('active');
            tabPersonal.classList.remove('active');
            const h3 = document.querySelector('.user-list-header h3');
            if(h3) h3.textContent = 'Online Now';
            
            // Refresh user list rendering
            if (typeof window.refreshUserList === 'function') window.refreshUserList();
            
            // Jump into Global Room
            window.selectUserToChat('global', 'Global Fun Times Chat');
        });
        
        tabPersonal.addEventListener('click', () => {
            window.appState.activeTab = 'personal';
            tabPersonal.classList.add('active');
            tabPublic.classList.remove('active');
            const h3 = document.querySelector('.user-list-header h3');
            if(h3) h3.textContent = 'Direct Messages';
            
            // Refresh user list rendering
            if (typeof window.refreshUserList === 'function') window.refreshUserList();
            
            // If they are in Global Room, unselect it
            if (window.appState.selectedUser && window.appState.selectedUser.id === 'global') {
                window.appState.selectedUser = null;
                document.getElementById('no-chat-selected').style.display = 'flex';
                document.getElementById('chat-header').classList.add('hidden');
                document.getElementById('messages-container').classList.add('hidden');
                document.getElementById('chat-footer').classList.add('hidden');
                document.getElementById('app-container').classList.remove('chat-active');
            }
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

        // Auto-open public room after brief delay for socket to connect
        setTimeout(() => {
            window.selectUserToChat('global', 'Global Fun Times Chat');
        }, 600);
    }
}

// Select a user to chat with
window.selectUserToChat = function(userId, userName) {
    if (window.socket && userId === window.socket.id) return; // Don't chat with self
    
    window.appState.selectedUser = { id: userId, name: userName };
    
    // Auto-switch tab based on who we clicked
    const tabPublic = document.getElementById('tab-public');
    const tabPersonal = document.getElementById('tab-personal');
    if (userId === 'global' && tabPublic) {
        tabPublic.classList.add('active');
        if (tabPersonal) tabPersonal.classList.remove('active');
        window.appState.activeTab = 'public';
        const h3 = document.querySelector('.user-list-header h3');
        if (h3) h3.textContent = 'Online Now';
    } else if (userId !== 'global' && tabPersonal) {
        tabPersonal.classList.add('active');
        if (tabPublic) tabPublic.classList.remove('active');
        window.appState.activeTab = 'personal';
        const h3 = document.querySelector('.user-list-header h3');
        if (h3) h3.textContent = 'Direct Messages';
    }
    
    // Update UI
    document.querySelectorAll('.user-item').forEach(el => el.classList.remove('active'));
    const userEl = document.getElementById(`user-${userId}`);
    if (userEl) userEl.classList.add('active');

    partnerUsername.textContent = userName;
    partnerAvatar.textContent = userName.charAt(0).toUpperCase();

    noChatSelected.style.display = 'none';
    chatHeader.classList.remove('hidden');
    messagesContainer.classList.remove('hidden');
    chatFooter.classList.remove('hidden');
    
    appContainer.classList.add('chat-active');

    // Cannot call the Global Room natively yet
    document.getElementById('start-audio-btn').style.display = userId === 'global' ? 'none' : 'inline-flex';
    document.getElementById('start-video-btn').style.display = userId === 'global' ? 'none' : 'inline-flex';

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

    // Show sender name if it's the global room and we received it
    if (type === 'received' && window.appState.selectedUser && window.appState.selectedUser.id === 'global') {
        const nameSpan = document.createElement('div');
        nameSpan.style.fontSize = '0.75rem';
        nameSpan.style.color = 'var(--text-secondary)';
        nameSpan.style.marginBottom = '4px';
        nameSpan.style.fontWeight = 'bold';
        nameSpan.textContent = fromName;
        bubble.appendChild(nameSpan);
    }

    const textNode = document.createTextNode(message);
    bubble.appendChild(textNode);

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
