const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Simpan pesan dan user yang online
let messages = [];
let onlineUsers = new Map(); // socket.id -> {username, region}

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'halo nusantara.html'));
});

// Route untuk test koneksi
app.get('/test', (req, res) => {
  res.json({
    status: 'Server running',
    onlineUsers: onlineUsers.size,
    messagesCount: messages.length
  });
});

io.on('connection', (socket) => {
  console.log('⚡ User connected:', socket.id);
  
  // Kirim pesan sebelumnya ke user baru
  socket.emit('load messages', messages.slice(-50));
  
  // Kirim daftar user online
  socket.emit('online users', Array.from(onlineUsers.values()));
  
  // User login (setelah CAPTCHA)
  socket.on('user login', (userData) => {
    onlineUsers.set(socket.id, {
      id: socket.id,
      username: userData.username,
      region: userData.region || 'Unknown'
    });
    
    console.log(`👤 User login: ${userData.username} (${socket.id})`);
    
    // Broadcast ke semua user bahwa ada user baru
    socket.broadcast.emit('user joined', {
      username: userData.username,
      message: `${userData.username} telah bergabung`
    });
    
    // Update semua user dengan daftar online terbaru
    io.emit('online users', Array.from(onlineUsers.values()));
  });
  
  // User mengirim pesan
  socket.on('chat message', (messageData) => {
    const user = onlineUsers.get(socket.id);
    
    // Pastikan user ada dan valid
    if (!user) {
      socket.emit('error', 'Anda belum login');
      return;
    }
    
    // Tambahkan info pengirim ke pesan
    const fullMessage = {
      ...messageData,
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      senderId: socket.id,
      timestamp: new Date().toISOString()
    };
    
    // Simpan pesan (maksimal 200 pesan)
    messages.push(fullMessage);
    if (messages.length > 200) {
      messages = messages.slice(-200);
    }
    
    console.log(`💬 Message from ${user.username}: ${messageData.message}`);
    
    // Broadcast ke SEMUA user termasuk pengirim
    io.emit('chat message', fullMessage);
  });
  
  // User ganti nama
  socket.on('user name changed', (data) => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      const oldName = user.username;
      user.username = data.newName;
      
      // Broadcast perubahan nama
      io.emit('user name changed', {
        userId: socket.id,
        oldName: oldName,
        newName: data.newName
      });
      
      console.log(`🔄 Name changed: ${oldName} -> ${data.newName}`);
    }
  });
  
  // User mengetik
  socket.on('typing', (username) => {
    socket.broadcast.emit('user typing', {
      userId: socket.id,
      username: username
    });
  });
  
  // User berhenti mengetik
  socket.on('stop typing', () => {
    socket.broadcast.emit('user stop typing', { userId: socket.id });
  });
  
  // User disconnect
  socket.on('disconnect', () => {
    const user = onlineUsers.get(socket.id);
    if (user) {
      onlineUsers.delete(socket.id);
      
      // Broadcast ke semua user
      socket.broadcast.emit('user left', {
        username: user.username,
        message: `${user.username} telah keluar`
      });
      
      // Update daftar online
      io.emit('online users', Array.from(onlineUsers.values()));
      
      console.log(`👋 User disconnected: ${user.username} (${socket.id})`);
    }
  });
});

const PORT = process.env.PORT || 3000; // Gunakan PORT dari environment
server.listen(PORT, () => {
  console.log(`Server berjalan di port ${PORT}`);
});