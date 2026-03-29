const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const OpenAI = require("openai");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// AI 설정
const groq = new OpenAI({
    apiKey: "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",
    baseURL: "https://api.groq.com/openai/v1"
});

// DB 연결
mongoose.connect("mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB").then(() => console.log("✅ DB OK"));

// 모델 설정
const User = mongoose.model('User', new mongoose.Schema({
    userId: String, password: { type: String, required: true }, profilePic: String, statusMsg: String, language: { type: String, default: "ko" }, friends: [String], pendingRequests: [String]
}));
const Message = mongoose.model('Message', new mongoose.Schema({
    room: String, userId: String, content: String, timestamp: { type: Date, default: Date.now }
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.static(__dirname));

// 로그인/회원가입 API
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

// 실시간 소켓 통신 (AI 포함)
io.on('connection', (socket) => {
    socket.on('join_room', (room) => socket.join(room));

    socket.on('send_message', async (data) => {
        // 1. 사용자 메시지 저장 및 전송
        await new Message(data).save();
        io.to(data.room).emit('receive_message', data);

        // 2. @bot 감지 시 AI 실행
        if (data.content.includes("@bot")) {
            const prompt = data.content.replace("@bot", "").trim();
            try {
                const chat = await groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: "qwen-2.5-32b",
                });
                
                const aiReply = {
                    room: data.room,
                    userId: "🤖 AI봇",
                    content: chat.choices[0].message.content
                };
                
                // AI 답변도 같은 소켓으로 전송
                io.to(data.room).emit('receive_message', aiReply);
            } catch (e) { console.log("AI 에러 발생"); }
        }
    });
});

server.listen(process.env.PORT || 10000);
