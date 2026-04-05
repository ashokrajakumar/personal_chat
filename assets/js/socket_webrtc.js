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

// Filter Elements
const filterNoneBtn = document.getElementById('filter-none-btn');
const filterBwBtn = document.getElementById('filter-bw-btn');
const filterEmojiBtn = document.getElementById('filter-emoji-btn');

let incomingCallData = null; // Stores offer until accepted
let pendingCandidates = [];

// Canvas Filter State
let currentVideoFilter = 'none';
let filterCanvas = document.createElement('canvas');
let filterCtx = filterCanvas.getContext('2d');
let rawVideoElement = document.createElement('video');
rawVideoElement.autoplay = true;
rawVideoElement.playsInline = true;
rawVideoElement.muted = true;
let filterAnimationFrameId = null;

function processFilterFrame() {
    if (!rawVideoElement.videoWidth) {
        filterAnimationFrameId = requestAnimationFrame(processFilterFrame);
        return;
    }

    if (filterCanvas.width !== rawVideoElement.videoWidth) {
        filterCanvas.width = rawVideoElement.videoWidth;
        filterCanvas.height = rawVideoElement.videoHeight;
    }

    if (currentVideoFilter === 'bw') {
        filterCtx.filter = 'grayscale(100%) contrast(1.2)';
    } else {
        filterCtx.filter = 'none';
    }
    
    filterCtx.drawImage(rawVideoElement, 0, 0, filterCanvas.width, filterCanvas.height);
    filterCtx.filter = 'none';

    if (currentVideoFilter === 'emoji') {
        const time = Date.now() / 1000;
        const x = filterCanvas.width / 2 + Math.sin(time * 2) * (filterCanvas.width/3);
        const y = filterCanvas.height / 2 + Math.cos(time * 3) * (filterCanvas.height/3);
        const x2 = filterCanvas.width / 2 + Math.cos(time * 1.5) * (filterCanvas.width/3);
        const y2 = filterCanvas.height / 1.5 + Math.sin(time * 2.5) * (filterCanvas.height/3);
        
        filterCtx.font = "80px Arial";
        filterCtx.fillText("🚀", x, y);
        filterCtx.fillText("⭐", x2, y2);
        filterCtx.fillText("👨‍🚀", filterCanvas.width/1.2, filterCanvas.height/1.2 + Math.sin(time*4)*20);
    }
    
    filterAnimationFrameId = requestAnimationFrame(processFilterFrame);
}

if(filterNoneBtn) {
    filterNoneBtn.onclick = () => { currentVideoFilter = 'none'; filterNoneBtn.style.display='none'; }
    filterBwBtn.onclick = () => { currentVideoFilter = 'bw'; filterNoneBtn.style.display='inline-flex'; }
    filterEmojiBtn.onclick = () => { currentVideoFilter = 'emoji'; filterNoneBtn.style.display='inline-flex'; }
}

let lastKnownUsers = [];

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
        lastKnownUsers = users;
        const list = document.getElementById('user-list');
        const count = document.getElementById('online-count');
        list.innerHTML = '';

        const activeTab = window.appState && window.appState.activeTab ? window.appState.activeTab : 'public';
        const others = users.filter(u => u.id !== socket.id);
        count.textContent = others.length;

        if (activeTab === 'public') {
            // Public tab: show all online users as a read-only roster (no click to DM)
            if (others.length === 0) {
                const empty = document.createElement('li');
                empty.style.cssText = 'padding:16px 20px; color:var(--text-secondary); font-size:0.85rem; text-align:center;';
                empty.textContent = 'No one else is online yet...';
                list.appendChild(empty);
            } else {
                others.forEach(u => {
                    const li = document.createElement('li');
                    li.className = 'user-item';
                    li.style.opacity = '0.7';
                    li.innerHTML = `
                        <div class="avatar">${u.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <div>${u.name}</div>
                            <div style="font-size:0.75rem; color:var(--success); display:flex; align-items:center; gap:4px;"><span style="width:6px;height:6px;background:var(--success);border-radius:50%;display:inline-block;"></span> Online</div>
                        </div>
                    `;
                    list.appendChild(li);
                });
            }
        } else {
            // Personal tab: show clickable DM list
            if (others.length === 0) {
                const empty = document.createElement('li');
                empty.style.cssText = 'padding:16px 20px; color:var(--text-secondary); font-size:0.85rem; text-align:center;';
                empty.textContent = 'No one else is online. Share the link!';
                list.appendChild(empty);
            } else {
                others.forEach(u => {
                    const li = document.createElement('li');
                    li.className = 'user-item';
                    li.id = `user-${u.id}`;
                    if (window.appState.selectedUser && window.appState.selectedUser.id === u.id) {
                        li.classList.add('active');
                    }
                    li.innerHTML = `
                        <div class="avatar">${u.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <div>${u.name}</div>
                            <div style="font-size:0.75rem; color:var(--text-secondary);">Tap to message</div>
                        </div>
                    `;
                    li.onclick = () => window.selectUserToChat(u.id, u.name);
                    list.appendChild(li);
                });
            }
        }
    });

    socket.on('receive-message', (data) => {
        // Global message — show if on the public tab regardless of selectedUser
        if (data.from === 'global') {
            const isPublicTabActive = window.appState && window.appState.activeTab === 'public';
            if (isPublicTabActive && window.appState.selectedUser && window.appState.selectedUser.id === 'global') {
                window.appendMessage(data.fromName, data.message, 'received');
            }
            return;
        }
        // Private message
        if (window.appState.selectedUser && window.appState.selectedUser.id === data.from) {
            window.appendMessage(data.fromName, data.message, 'received');
        } else {
            console.log(`New message from ${data.fromName}: ${data.message}`);
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

// Allow tabs to force a re-render of the user list without a new server message
window.refreshUserList = function() {
    if (lastKnownUsers.length > 0 || true) {
        // Simulate the update-users event with cached data
        const fakeEvent = new CustomEvent('_refresh-users', { detail: lastKnownUsers });
        document.dispatchEvent(fakeEvent);
    }
};

document.addEventListener('_refresh-users', (e) => {
    const users = e.detail;
    const list = document.getElementById('user-list');
    const count = document.getElementById('online-count');
    if (!list) return;
    list.innerHTML = '';

    const activeTab = window.appState && window.appState.activeTab ? window.appState.activeTab : 'public';
    const others = users.filter(u => window.socket && u.id !== window.socket.id);
    count.textContent = others.length;

    if (activeTab === 'public') {
        if (others.length === 0) {
            const empty = document.createElement('li');
            empty.style.cssText = 'padding:16px 20px; color:var(--text-secondary); font-size:0.85rem; text-align:center;';
            empty.textContent = 'No one else is online yet...';
            list.appendChild(empty);
        } else {
            others.forEach(u => {
                const li = document.createElement('li');
                li.className = 'user-item';
                li.style.opacity = '0.7';
                li.innerHTML = `
                    <div class="avatar">${u.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div>${u.name}</div>
                        <div style="font-size:0.75rem; color:var(--success); display:flex; align-items:center; gap:4px;"><span style="width:6px;height:6px;background:var(--success);border-radius:50%;display:inline-block;"></span> Online</div>
                    </div>
                `;
                list.appendChild(li);
            });
        }
    } else {
        if (others.length === 0) {
            const empty = document.createElement('li');
            empty.style.cssText = 'padding:16px 20px; color:var(--text-secondary); font-size:0.85rem; text-align:center;';
            empty.textContent = 'No one else is online. Share the link!';
            list.appendChild(empty);
        } else {
            others.forEach(u => {
                const li = document.createElement('li');
                li.className = 'user-item';
                li.id = `user-${u.id}`;
                if (window.appState.selectedUser && window.appState.selectedUser.id === u.id) {
                    li.classList.add('active');
                }
                li.innerHTML = `
                    <div class="avatar">${u.name.charAt(0).toUpperCase()}</div>
                    <div>
                        <div>${u.name}</div>
                        <div style="font-size:0.75rem; color:var(--text-secondary);">Tap to message</div>
                    </div>
                `;
                li.onclick = () => window.selectUserToChat(u.id, u.name);
                list.appendChild(li);
            });
        }
    }
});

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
            video: videoEnabled ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false,
            audio: true
        });
        
        if (videoEnabled) {
            rawVideoElement.srcObject = localStream;
            
            // Wait for metadata to configure canvas
            await new Promise(r => {
                const handler = () => {
                    filterCanvas.width = rawVideoElement.videoWidth;
                    filterCanvas.height = rawVideoElement.videoHeight;
                    rawVideoElement.removeEventListener('loadedmetadata', handler);
                    r();
                };
                rawVideoElement.addEventListener('loadedmetadata', handler);
            });
            
            if(!filterAnimationFrameId) processFilterFrame();
            
            let canvasStream = filterCanvas.captureStream(30);
            const finalStream = new MediaStream();
            finalStream.addTrack(canvasStream.getVideoTracks()[0]);
            finalStream.addTrack(localStream.getAudioTracks()[0]);
            
            window.rawCameraStream = localStream; // Save original
            localStream = finalStream;
        }

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
    currentVideoFilter = 'none';
    if(filterNoneBtn) filterNoneBtn.style.display = 'none';
    
    if (filterAnimationFrameId) {
        cancelAnimationFrame(filterAnimationFrameId);
        filterAnimationFrameId = null;
    }
    
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    if (window.rawCameraStream) {
        window.rawCameraStream.getTracks().forEach(track => track.stop());
        window.rawCameraStream = null;
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
