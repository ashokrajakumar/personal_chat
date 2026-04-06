const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

// Serve all frontend files (HTML, CSS, JS) from the current folder
app.use(express.static(__dirname));

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Allows connections from the PHP frontend
    methods: ["GET", "POST"]
  }
});

let onlineUsers = {}; // Maps socket.id to username

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);

  // User joins with a username
  socket.on('join', (username) => {
    onlineUsers[socket.id] = username;
    io.emit('update-users', Object.entries(onlineUsers).map(([id, name]) => ({ id, name })));
    console.log(`${username} joined with ID: ${socket.id}`);
  });

  // Handle instant one-to-one text messaging and global room
  socket.on('send-message', (data) => {
    // data expected: { to: 'target_socket_id', message: 'the text' }
    if (data.to === 'global') {
        socket.broadcast.emit('receive-message', {
            from: 'global',
            realFrom: socket.id,
            fromName: onlineUsers[socket.id] || 'Unknown',
            message: data.message
        });
        return;
    }
    
    if (data.to && data.to !== socket.id) {
       socket.to(data.to).emit('receive-message', {
         from: socket.id,
         realFrom: socket.id,
         fromName: onlineUsers[socket.id] || 'Unknown',
         message: data.message,
         timestamp: Date.now()
       });
    }
  });

  socket.on('send-file', (data) => {
    // data: { to, fileName, fileType, fileData }
    const payload = {
        from: socket.id,
        fromName: onlineUsers[socket.id] || 'Unknown',
        fileName: data.fileName,
        fileType: data.fileType,
        fileData: data.fileData,
        timestamp: Date.now()
    };

    if (data.to === 'global') {
        socket.broadcast.emit('receive-file', { ...payload, from: 'global' });
    } else {
        socket.to(data.to).emit('receive-file', payload);
    }
  });

  // Real-time Chat Context (Typing / Seen)
  socket.on('typing', (data) => {
      // data: { to: 'id' }
      if (data.to === 'global') {
          socket.broadcast.emit('user-typing', { from: socket.id, fromName: onlineUsers[socket.id] });
      } else {
          socket.to(data.to).emit('user-typing', { from: socket.id, fromName: onlineUsers[socket.id] });
      }
  });

  socket.on('stop-typing', (data) => {
      if (data.to === 'global') {
          socket.broadcast.emit('user-stop-typing', { from: socket.id });
      } else {
          socket.to(data.to).emit('user-stop-typing', { from: socket.id });
      }
  });

  socket.on('message-seen', (data) => {
      // data: { to: 'id' }
      if (data.to !== 'global') {
          socket.to(data.to).emit('message-seen', { from: socket.id });
      }
  });

  // --- WebRTC Signaling ---
  
  // Caller sends offer
  socket.on('offer', (data) => {
    socket.to(data.target).emit('offer', {
      caller: socket.id,
      callerName: onlineUsers[socket.id] || 'Unknown',
      sdp: data.sdp,
      callType: data.callType // 'audio' or 'video'
    });
  });

  // Callee answers
  socket.on('answer', (data) => {
    socket.to(data.target).emit('answer', {
      callee: socket.id,
      sdp: data.sdp
    });
  });

  // Exchange ICE Candidates for P2P connection
  socket.on('ice-candidate', (data) => {
    socket.to(data.target).emit('ice-candidate', {
      sender: socket.id,
      candidate: data.candidate
    });
  });

  // Hang up
  socket.on('call-ended', (data) => {
      socket.to(data.target).emit('call-ended', { sender: socket.id });
  });

  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.id}`);
    delete onlineUsers[socket.id];
    io.emit('update-users', Object.entries(onlineUsers).map(([id, name]) => ({ id, name })));
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Signaling server listening on port ${PORT}`);
});
