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

// 2. MongoDB 연결
const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB 연결 성공"));

// 3. 데이터 모델
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

// --- API 경로 ---
app.post('/register', async (req, res) => {
    const { userId, password } = req.body;
    const exists = await User.findOne({ userId });
    if (exists) return res.json({ success: false, message: "아이디 중복" });
    await new User({ userId, password }).save();
    res.json({ success: true });
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

// --- 소켓 로직 (AI 포함) ---
io.on('connection', (socket) => {
    socket.on('join_room', async (room) => {
        socket.join(room);
        const logs = await Message.find({ room }).sort({ timestamp: 1 }).limit(50);
        socket.emit('chat_logs', logs);
    });

    socket.on('send_message', async (data) => {
        // 1. 일반 메시지 저장 및 전송
        await new Message(data).save();
        io.to(data.room).emit('receive_message', data);

        // 2. 만약 @bot으로 시작하면 AI가 답장하도록 처리
        if (data.content.startsWith("@bot")) {
            const prompt = data.content.replace("@bot", "").trim();
            try {
                const completion = await groq.chat.completions.create({
                    messages: [
                        { role: "system", content: "너는 친절한 Qwen AI야. 한국어로 짧고 명확하게 답해줘." },
                        { role: "user", content: prompt }
                    ],
                    model: "qwen-2.5-32b",
                });
                
                const aiReply = {
                    room: data.room,
                    userId: "🤖 AI봇",
                    content: completion.choices[0].message.content,
                    senderLang: "ko"
                };
                
                await new Message(aiReply).save();
                io.to(data.room).emit('receive_message', aiReply);
            } catch (e) {
                console.error("AI Error:", e);
            }
        }
    });
});

server.listen(process.env.PORT || 10000, () => console.log("🚀 서버 가동 중"));
