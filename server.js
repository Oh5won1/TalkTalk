const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

// MongoDB 연결 (주소/비번 오타 주의!)
const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB 연결 성공!"))
    .catch(e => console.log("❌ DB 연결 에러:", e));

// 유저 데이터 구조
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    statusMsg: { type: String, default: "반갑습니다!" },
    friends: [String]
}));

app.use(express.json());
app.use(express.static(__dirname));

// 메인 페이지 연결 (Not Found 해결)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 회원가입: 중복 체크를 '먼저' 수행하도록 강화
app.post('/register', async (req, res) => {
    try {
        const { userId, password } = req.body;
        if (!userId || !password) return res.json({ success: false, message: "아이디와 비번을 입력해!" });

        const exists = await User.findOne({ userId });
        if (exists) return res.json({ success: false, message: "이미 사용 중인 아이디야!" });

        await new User({ userId, password }).save();
        res.json({ success: true, message: "가입 성공! 로그인해줘." });
    } catch (e) {
        res.json({ success: false, message: "서버 오류 발생!" });
    }
});

// 로그인
app.post('/login', async (req, res) => {
    const user = await User.findOne(req.body);
    if (user) res.json({ success: true, user });
    else res.json({ success: false, message: "아이디나 비번이 틀려!" });
});

// 프로필 업데이트
app.post('/update-profile', async (req, res) => {
    const { userId, profilePic, statusMsg } = req.body;
    await User.findOneAndUpdate({ userId }, { profilePic, statusMsg });
    res.json({ success: true });
});

// 친구 추가
app.post('/add-friend', async (req, res) => {
    const { userId, friendId } = req.body;
    const friend = await User.findOne({ userId: friendId });
    if (!friend) return res.json({ success: false, message: "없는 유저야!" });
    await User.findOneAndUpdate({ userId }, { $addToSet: { friends: friendId } });
    res.json({ success: true });
});

// 실시간 채팅방
io.on('connection', (socket) => {
    socket.on('join_room', (room) => socket.join(room));
    socket.on('send_message', (data) => io.to(data.room).emit('receive_message', data));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 서버 시작: ${PORT}`));
