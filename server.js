const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const OpenAI = require("openai");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const groq = new OpenAI({
    apiKey: "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",
    baseURL: "https://api.groq.com/openai/v1"
});

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
    socket.on('join_room', (room) => socket.join(room));
    socket.on('send_message', async (data) => {
        await new Message(data).save();
        io.to(data.room).emit('receive_message', data);
        if (data.content.includes("@bot")) {
            const prompt = data.content.replace("@bot", "").trim();
            try {
                const chat = await groq.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    model: "qwen-2.5-32b",
                });
                const aiMsg = { room: data.room, userId: "🤖 AI봇", content: chat.choices[0].message.content };
                io.to(data.room).emit('receive_message', aiMsg);
            } catch (e) { console.log("AI Error"); }
        }
    });
});

server.listen(process.env.PORT || 10000);
