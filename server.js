const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const OpenAI = require("openai");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    maxHttpBufferSize: 1e8,
    cors: { origin: "*" }
});

// 1. Qwen AI (Groq) 설정
const groq = new OpenAI({
    apiKey: "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",
    baseURL: "https://api.groq.com/openai/v1"
});

// 2. MongoDB 연결 (본인 계정 정보 확인)
const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB 연결 성공"));

// 3. 데이터베이스 모델
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    statusMsg: { type: String, default: "반가워요!" },
    language: { type: String, default: "ko" },
    friends: [String],
    pendingRequests: [String]
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    room: String, userId: String, content: String,
    senderLang: { type: String, default: "ko" },
    timestamp: { type: Date, default: Date.now }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// --- API 경로 설정 ---

// [중요] AI 답변 생성 API
app.post('/ask-ai', async (req, res) => {
    try {
        const { prompt } = req.body;
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "너는 친절한 Qwen AI야. 한국어로 짧고 명확하게 답해줘." },
                { role: "user", content: prompt }
            ],
            model: "qwen-2.5-32b",
        });
        res.json({ success: true, answer: completion.choices[0].message.content });
    } catch (e) {
        console.error(e);
        res.json({ success: false, message: "AI 응답 실패" });
    }
});

app.post('/register', async (req, res) => {
    try {
        const { userId, password } = req.body;
        const exists = await User.findOne({ userId });
        if (exists) return res.json({ success: false, message: "중복된 아이디" });
        await new User({ userId, password }).save();
        res.json({ success: true });
    } catch(e) { res.json({ success: false }); }
});

app.post('/login', async (req, res) => {
    const user = await User.findOne(req.body);
    if (user) res.json({ success: true, user });
    else res.json({ success: false });
});

app.post('/update-profile', async (req, res) => {
    await User.findOneAndUpdate({ userId: req.body.userId }, req.body);
    res.json({ success: true });
});

app.post('/send-request', async (req, res) => {
    await User.findOneAndUpdate({ userId: req.body.friendId }, { $addToSet: { pendingRequests: req.body.userId } });
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

// --- 소켓 로직 ---
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

server.listen(process.env.PORT || 10000, () => console.log("🚀 서버 가동 중"));
