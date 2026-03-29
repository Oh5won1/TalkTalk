const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');
const OpenAI = require("openai"); // Groq는 OpenAI 규격을 사용해

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

// 1. Groq (Qwen AI) 설정
const groq = new OpenAI({
    apiKey: "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",
    baseURL: "https://api.groq.com/openai/v1"
});

// 2. MongoDB 연결
const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB 연결 성공"));

// 3. 모델 정의
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    statusMsg: { type: String, default: "안녕하세요!" },
    language: { type: String, default: "ko" },
    friends: [String],
    pendingRequests: [String]
}));

const Message = mongoose.model('Message', new mongoose.Schema({
    room: String,
    userId: String,
    content: String,
    senderLang: { type: String, default: "ko" },
    timestamp: { type: Date, default: Date.now }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));

// --- API 영역 ---

// AI 답변 생성 API (Qwen 사용)
app.post('/ask-ai', async (req, res) => {
    try {
        const { prompt } = req.body;
        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: "너는 사용자의 채팅 앱에 상주하는 친절한 Qwen AI 챗봇이야. 짧고 명확하게 한국어로 대답해줘." },
                { role: "user", content: prompt }
            ],
            model: "qwen-2.5-32b", // Groq에서 제공하는 Qwen 최신 모델
        });
        res.json({ success: true, answer: completion.choices[0].message.content });
    } catch (e) {
        res.json({ success: false, message: "AI가 응답할 수 없습니다." });
    }
});

// 로그인/회원가입/프로필/친구 API
app.post('/register', async (req, res) => {
    const { userId, password } = req.body;
    const exists = await User.findOne({ userId });
    if (exists) return res.json({ success: false, message: "이미 있는 아이디!" });
    await new User({ userId, password }).save();
    res.json({ success: true, message: "가입 성공!" });
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

// --- 소켓 로직 ---
io.on('connection', (socket) => {
    socket.on('join_room', async (room) => {
        socket.join(room);
        const logs = await Message.find({ room }).sort({ timestamp: 1 }).limit(100);
        socket.emit('chat_logs', logs);
    });

    socket.on('send_message', async (data) => {
        await new Message(data).save();
        io.to(data.room).emit('receive_message', data);
    });
});

server.listen(process.env.PORT || 10000);
