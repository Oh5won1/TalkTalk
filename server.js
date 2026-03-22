const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

// MongoDB 주소
const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI).then(() => console.log("✅ MongoDB 연결 성공!"));

// 데이터 모델
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    statusMsg: { type: String, default: "상태메시지가 없습니다." },
    friends: [String]
}));

app.use(express.json());
// 파일 경로를 절대경로로 설정 (Not Found 방지)
app.use(express.static(path.join(__dirname)));

// 메인 페이지 접속 시 무조건 index.html을 보내도록 설정
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 회원가입 (중복 아이디 체크 포함)
app.post('/register', async (req, res) => {
    try {
        const { userId, password } = req.body;
        await new User({ userId, password }).save();
        res.json({ success: true, message: "회원가입 성공!" });
    } catch (e) {
        res.json({ success: false, message: "이미 있는 아이디야!" });
    }
});

// 로그인
app.post('/login', async (req, res) => {
    const user = await User.findOne(req.body);
    if (user) res.json({ success: true, user });
    else res.json({ success: false, message: "정보가 틀려!" });
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

// 실시간 채팅
io.on('connection', (socket) => {
    socket.on('join_room', (room) => socket.join(room));
    socket.on('send_message', (data) => io.to(data.room).emit('receive_message', data));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 서버 가동 중: ${PORT}`));