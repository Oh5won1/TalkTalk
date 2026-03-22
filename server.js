const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

// MongoDB 주소 (오타 확인 필수)
const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";

mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ MongoDB 연결 성공!"))
    .catch(e => console.log("❌ DB 연결 에러:", e));

// 데이터 모델 정의
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    statusMsg: { type: String, default: "안녕하세요!" },
    friends: [String]
}));

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// 메인 페이지 접속 설정 (Not Found 방지)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 회원가입 API (중복 체크 강화 버전)
app.post('/register', async (req, res) => {
    try {
        const { userId, password } = req.body;
        if (!userId || !password) return res.json({ success: false, message: "아이디/비번을 입력해!" });

        // 1. DB에서 아이디가 이미 있는지 먼저 직접 조회
        const exists = await User.findOne({ userId });
        if (exists) {
            return res.json({ success: false, message: "이미 가입된 아이디입니다." });
        }

        // 2. 존재하지 않으면 새로 저장
        const newUser = new User({ userId, password });
        await newUser.save();
        res.json({ success: true, message: "회원가입 성공! 로그인해주세요." });

    } catch (e) {
        console.error("가입 에러 상세:", e);
        res.json({ success: false, message: "서버 오류: " + e.message });
    }
});

// 로그인 API
app.post('/login', async (req, res) => {
    const user = await User.findOne(req.body);
    if (user) res.json({ success: true, user });
    else res.json({ success: false, message: "정보가 일치하지 않습니다." });
});

// 프로필/친구 추가 등 기타 기능
app.post('/update-profile', async (req, res) => {
    const { userId, profilePic, statusMsg } = req.body;
    await User.findOneAndUpdate({ userId }, { profilePic, statusMsg });
    res.json({ success: true });
});

app.post('/add-friend', async (req, res) => {
    const { userId, friendId } = req.body;
    const friend = await User.findOne({ userId: friendId });
    if (!friend) return res.json({ success: false, message: "존재하지 않는 아이디입니다." });
    await User.findOneAndUpdate({ userId }, { $addToSet: { friends: friendId } });
    res.json({ success: true });
});

// 실시간 채팅 로직
io.on('connection', (socket) => {
    socket.on('join_room', (room) => socket.join(room));
    socket.on('send_message', (data) => io.to(data.room).emit('receive_message', data));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 서버 실행 중: ${PORT}`));
