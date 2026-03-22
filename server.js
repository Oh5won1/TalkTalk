const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 }); // 큰 이미지 업로드 허용

const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI).then(() => console.log("✅ DB 연결 성공"));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" }, // 베이스64 이미지 데이터 저장
    statusMsg: { type: String, default: "안녕하세요!" },
    friends: [String],
    pendingRequests: [String]
}));

app.use(express.json({ limit: '10mb' })); // 이미지 전송을 위해 용량 제한 늘림
app.use(express.static(__dirname));

// 로그인/가입/친구 관련 API는 이전과 동일 (생략 없이 통합본에 포함)
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

// ⭐ 프로필 업데이트 API
app.post('/update-profile', async (req, res) => {
    const { userId, profilePic, statusMsg } = req.body;
    await User.findOneAndUpdate({ userId }, { profilePic, statusMsg });
    res.json({ success: true, message: "프로필 업데이트 완료!" });
});

// 친구 요청 및 수락 API
app.post('/send-request', async (req, res) => {
    const { userId, friendId } = req.body;
    const friend = await User.findOne({ userId: friendId });
    if (!friend) return res.json({ success: false, message: "유저 없음" });
    await User.findOneAndUpdate({ userId: friendId }, { $addToSet: { pendingRequests: userId } });
    res.json({ success: true, message: "요청 보냄" });
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

io.on('connection', (socket) => {
    socket.on('join_room', (room) => socket.join(room));
    socket.on('send_message', (data) => io.to(data.room).emit('receive_message', data));
});

server.listen(process.env.PORT || 10000);
