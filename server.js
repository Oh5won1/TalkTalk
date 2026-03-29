const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

mongoose.connect("mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB").then(() => console.log("✅ DB OK"));

const User = mongoose.model('User', new mongoose.Schema({
    userId: String, password: { type: String, required: true }, friends: [String]
}));
const Message = mongoose.model('Message', new mongoose.Schema({
    room: String, userId: String, content: String, timestamp: { type: Date, default: Date.now }
}));

app.use(express.json());
app.use(express.static(__dirname));

app.post('/login', async (req, res) => {
    const user = await User.findOne(req.body);
    res.json({ success: !!user, user });
});

app.post('/register', async (req, res) => {
    const exists = await User.findOne({ userId: req.body.userId });
    if (exists) return res.json({ success: false });
    await new User(req.body).save();
    res.json({ success: true });
});

io.on('connection', (socket) => {
    socket.on('join_room', async (room) => {
        socket.join(room);
        const logs = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
        socket.emit('chat_logs', logs);
    });

    socket.on('send_message', async (data) => {
        await new Message(data).save();
        io.to(data.room).emit('receive_message', data);
    });
});

server.listen(process.env.PORT || 10000);
