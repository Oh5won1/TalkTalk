const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const OpenAI = require("openai"); // AI 패키지 추가
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e8 });

// AI 설정 (Groq API 사용)
const groq = new OpenAI({
    apiKey: "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",
    baseURL: "https://api.groq.com/openai/v1"
});

const MONGO_URI = "mongodb://dhttmddnjs704:mack1234@ac-m2itvfm-shard-00-00.znnzv5q.mongodb.net:27017,ac-m2itvfm-shard-00-01.znnzv5q.mongodb.net:27017,ac-m2itvfm-shard-00-02.znnzv5q.mongodb.net:27017/myTalkDB?ssl=true&replicaSet=atlas-13w1l9-shard-0&authSource=admin&retryWrites=true&w=majority";
mongoose.connect(MONGO_URI).then(() => console.log("✅ DB Connected"));

// DB 모델 설정[cite: 3]
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
    room: String, userId: String, content: String,
    senderLang: { type: String, default: "ko" },
    timestamp: { type: Date, default: Date.now }
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname));
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));

// API 생략 (기존 /register, /login, /update-profile 등 유지)[cite: 3]

io.on('connection', (socket) => {
    socket.on('join_room', async (room) => {
        socket.join(room);
        const logs = await Message.find({ room }).sort({ timestamp: 1 }).limit(100);
        socket.emit('chat_logs', logs);
    });

    socket.on('send_message', async (data) => {
        // 1. 메시지 저장 및 전송[cite: 3]
        await new Message(data).save();
        io.to(data.room).emit('receive_message', data);

        // 2. AI 챗봇 호출 감지 (@bot)
        if (data.content.includes("@bot")) {
            const userPrompt = data.content.replace("@bot", "").trim();
            try {
                const completion = await groq.chat.completions.create({
                    messages: [{ role: "user", content: userPrompt }],
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
            } catch (err) { console.error("AI Error:", err); }
        }
    });
});

server.listen(process.env.PORT || 10000);
