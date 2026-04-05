// socket_webrtc.js - Realtime communication

let socket;
let peerConnection;
let localStream;
let remoteStream;
let isCaller = false;
let currentCallTarget = null;

const rtcConfig = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" }
    ]
};

// UI Elements for WebRTC
const localVideo = document.getElementById('local-video');
const remoteVideo = document.getElementById('remote-video');
const remoteAudio = document.getElementById('remote-audio'); // fallback

const startVideoBtn = document.getElementById('start-video-btn');
const startAudioBtn = document.getElementById('start-audio-btn');

const activeCallOverlay = document.getElementById('active-call-overlay');
const incomingCallModal = document.getElementById('incoming-call-modal');
const endCallBtn = document.getElementById('end-call-btn');
const toggleMuteBtn = document.getElementById('toggle-mute-btn');
const toggleVideoBtn = document.getElementById('toggle-video-btn');

// Accept / Reject buttons
const acceptCallBtn = document.getElementById('accept-call-btn');
const rejectCallBtn = document.getElementById('reject-call-btn');

let incomingCallData = null; // Stores offer until accepted
let pendingCandidates = [];

// 1. Initialize Socket
window.connectSocket = function(username) {
    // Dynamically connect to the right URL based on environment
    // Use the explicit Render URL for production so it works even if this frontend is loaded from a separate PHP domain
    const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
        ? 'http://localhost:3000' 
        : 'https://personal-chat-nim1.onrender.com';
    
    socket = io(serverUrl);

    window.socket = socket;

    socket.on('connect', () => {
        socket.emit('join', username);
    });

    socket.on('update-users', (users) => {
        const list = document.getElementById('user-list');
        const count = document.getElementById('online-count');
        list.innerHTML = '';
        
        let othersCount = 0;
        users.forEach(u => {
            if (u.id !== socket.id) {
                othersCount++;
                const li = document.createElement('li');
                li.className = 'user-item';
                li.id = `user-${u.id}`;
                // Preserve selection state
                if (window.appState.selectedUser && window.appState.selectedUser.id === u.id) {
                    li.classList.add('active');
                }
                
                li.innerHTML = `
                    <div class="avatar">${u.name.charAt(0).toUpperCase()}</div>
                    <span>${u.name}</span>
                `;
                li.onclick = () => window.selectUserToChat(u.id, u.name);
                list.appendChild(li);
            }
        });
        count.textContent = othersCount;
    });

    socket.on('receive-message', (data) => {
        // Only show if it's from the currently selected user (or alert otherwise)
        if (window.appState.selectedUser && window.appState.selectedUser.id === data.from) {
            window.appendMessage(data.fromName, data.message, 'received');
        } else {
            // Unobtrusive notification logic could go here
            console.log(`New message from ${data.fromName}: ${data.message}`);
            // Auto open chat if none selected
            if (!window.appState.selectedUser) {
                 window.selectUserToChat(data.from, data.fromName);
                 setTimeout(() => window.appendMessage(data.fromName, data.message, 'received'), 50);
            }
        }
    });

    // WebRTC Signaling Handlers
    socket.on('offer', async (data) => {
        incomingCallData = data;
        // Show incoming modal
        document.getElementById('incoming-name').textContent = data.callerName;
        document.getElementById('incoming-avatar').textContent = data.callerName.charAt(0).toUpperCase();
        document.getElementById('incoming-type').innerHTML = `is <span class="accent-text">${data.callType}</span> calling you...`;
        incomingCallModal.classList.add('active');
    });

    socket.on('answer', async (data) => {
        if (peerConnection) {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(data.sdp));
            // Add queued candidates
            for (let c of pendingCandidates) {
                try { await peerConnection.addIceCandidate(new RTCIceCandidate(c)); } catch(e){}
            }
            pendingCandidates = [];
            window.startCallTimer();
        }
    });

    socket.on('ice-candidate', async (data) => {
        if (peerConnection && peerConnection.remoteDescription) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(data.candidate));
            } catch (e) {
                console.error('Error adding received ice candidate', e);
            }
        } else {
            pendingCandidates.push(data.candidate);
        }
    });

    socket.on('call-ended', () => {
        cleanupCall();
    });
};

window.sendMessage = function(toId, message) {
    socket.emit('send-message', { to: toId, message: message });
};

// 2. WebRTC Call Initiation
async function setupCall(targetId, type) { // type: 'audio'|'video'
    isCaller = true;
    currentCallTarget = targetId;
    
    // Show overlay
    activeCallOverlay.classList.add('active');
    document.getElementById('call-partner').textContent = window.appState.selectedUser.name;
    
    await initMedia(type === 'video');
    createPeerConnection();

    try {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        socket.emit('offer', {
            target: targetId,
            sdp: offer,
            callType: type
        });
    } catch (err) {
        console.error("Error creating offer:", err);
    }
}

startVideoBtn.addEventListener('click', () => {
    if (window.appState.selectedUser) setupCall(window.appState.selectedUser.id, 'video');
});

startAudioBtn.addEventListener('click', () => {
    if (window.appState.selectedUser) setupCall(window.appState.selectedUser.id, 'audio');
});

// 3. WebRTC Answering Call
acceptCallBtn.addEventListener('click', async () => {
    incomingCallModal.classList.remove('active');
    if (!incomingCallData) return;

    isCaller = false;
    currentCallTarget = incomingCallData.caller;
    
    activeCallOverlay.classList.add('active');
    document.getElementById('call-partner').textContent = incomingCallData.callerName;

    await initMedia(incomingCallData.callType === 'video');
    createPeerConnection();

    await peerConnection.setRemoteDescription(new RTCSessionDescription(incomingCallData.sdp));
    // Add queued candidates
    for (let c of pendingCandidates) {
        try { await peerConnection.addIceCandidate(new RTCIceCandidate(c)); } catch(e){}
    }
    pendingCandidates = [];
    
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('answer', {
        target: incomingCallData.caller,
        sdp: answer
    });
    
    window.startCallTimer();
});

rejectCallBtn.addEventListener('click', () => {
    incomingCallModal.classList.remove('active');
    if (incomingCallData) {
        socket.emit('call-ended', { target: incomingCallData.caller });
        incomingCallData = null;
    }
});

endCallBtn.addEventListener('click', () => {
    if (currentCallTarget) {
        socket.emit('call-ended', { target: currentCallTarget });
    }
    cleanupCall();
});

// 4. WebRTC Utilities
async function initMedia(videoEnabled) {
    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: videoEnabled ? true : false,
            audio: true
        });
        localVideo.srcObject = localStream;
        
        // Hide local video element if audio only to keep UI clean
        if (!videoEnabled) {
            localVideo.style.display = 'none';
        } else {
            localVideo.style.display = 'block';
        }
    } catch (err) {
        console.error("Error accessing media devices.", err);
        alert("Could not access camera or microphone.");
    }
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local tracks
    if (localStream) {
        localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
    }

    // Listen for remote tracks
    peerConnection.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteAudio.srcObject = event.streams[0];
        } else {
            if (!remoteStream) {
                remoteStream = new MediaStream();
                remoteVideo.srcObject = remoteStream;
                remoteAudio.srcObject = remoteStream;
            }
            remoteStream.addTrack(event.track);
        }
    };

    // ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('ice-candidate', {
                target: currentCallTarget,
                candidate: event.candidate
            });
        }
    };
}

function cleanupCall() {
    activeCallOverlay.classList.remove('active');
    window.stopCallTimer();
    pendingCandidates = [];
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    remoteStream = null;
    remoteVideo.srcObject = null;
    localVideo.srcObject = null;
    currentCallTarget = null;
    incomingCallData = null;
    isCaller = false;
}

// Media Controls
toggleMuteBtn.addEventListener('click', () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            toggleMuteBtn.innerHTML = audioTrack.enabled ? '<i class="ri-mic-fill"></i>' : '<i class="ri-mic-off-fill" style="color:var(--danger)"></i>';
        }
    }
});

toggleVideoBtn.addEventListener('click', () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            toggleVideoBtn.innerHTML = videoTrack.enabled ? '<i class="ri-camera-fill"></i>' : '<i class="ri-camera-off-fill" style="color:var(--danger)"></i>';
        }
    }
});
