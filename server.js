const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 }); // 이미지 전송 대응

// MongoDB 연결 (본인의 URI 확인)
const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI).then(() => console.log("✅ DB Connected")).catch(e => console.log("❌ DB Error:", e));

// 1. 유저 모델 (언어 설정 추가)
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    statusMsg: { type: String, default: "안녕하세요!" },
    language: { type: String, default: "ko" }, // 기본값 한국어
    friends: [String],
    pendingRequests: [String]
}));

// 2. 메시지 모델 (보낸 사람 언어 정보 포함)
const Message = mongoose.model('Message', new mongoose.Schema({
    room: String,
    userId: String,
    content: String,
    senderLang: { type: String, default: "ko" },
    timestamp: { type: Date, default: Date.now }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// --- API 영역 ---
app.post('/register', async (req, res) => {
    try {
        const { userId, password } = req.body;
        const exists = await User.findOne({ userId });
        if (exists) return res.json({ success: false, message: "이미 있는 아이디!" });
        await new User({ userId, password }).save();
        res.json({ success: true, message: "가입 성공!" });
    } catch (e) { res.json({ success: false, message: e.message }); }
});

app.post('/login', async (req, res) => {
    const user = await User.findOne(req.body);
    if (user) res.json({ success: true, user });
    else res.json({ success: false, message: "정보 불일치" });
});

app.post('/update-profile', async (req, res) => {
    const { userId, profilePic, statusMsg, language } = req.body;
    await User.findOneAndUpdate({ userId }, { profilePic, statusMsg, language });
    res.json({ success: true });
});

app.post('/send-request', async (req, res) => {
    const { userId, friendId } = req.body;
    const friend = await User.findOne({ userId: friendId });
    if (!friend) return res.json({ success: false, message: "유저 없음" });
    await User.findOneAndUpdate({ userId: friendId }, { $addToSet: { pendingRequests: userId } });
    res.json({ success: true });
});

app.post('/handle-request', async (req, res) => {
    const { userId, requesterId, action } = req.body;
    if (action === 'accept') {
        await User.findOneAndUpdate({ userId }, { $addToSet: { friends: requesterId }, $pull: { pendingRequests: requesterId } });
        await User.findOneAndUpdate({ userId: requesterId }, { $addToSet: { friends: userId } });
    } else {
        await User.findOneAndUpdate({ userId }, { $pull: { pendingRequests: requesterId } });
    }
    res.json({ success: true });
});

// --- 소켓 영역 (채팅 기록 불러오기 및 저장) ---
io.on('connection', (socket) => {
    socket.on('join_room', async (room) => {
        socket.join(room);
        const logs = await Message.find({ room }).sort({ timestamp: 1 }).limit(100);
        socket.emit('chat_logs', logs);
    });

    socket.on('send_message', async (data) => {
        const msg = new Message(data);
        await msg.save();
        io.to(data.room).emit('receive_message', data);
    });
});

server.listen(process.env.PORT || 10000);
