const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

// MongoDB 연결 설정 (본인의 URI 확인)
const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI)
    .then(() => console.log("✅ DB 연결 성공"))
    .catch(e => console.log("❌ DB 연결 에러:", e));

// 데이터 모델 정의
const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    statusMsg: { type: String, default: "반갑습니다!" },
    friends: [String],
    pendingRequests: [String]
}));

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// 회원가입 (중복 아이디 체크 포함)
app.post('/register', async (req, res) => {
    try {
        const { userId, password } = req.body;
        const exists = await User.findOne({ userId });
        if (exists) return res.json({ success: false, message: "이미 사용 중인 아이디입니다." });
        await new User({ userId, password }).save();
        res.json({ success: true, message: "회원가입 성공!" });
    } catch (e) { res.json({ success: false, message: "서버 오류: " + e.message }); }
});

// 로그인
app.post('/login', async (req, res) => {
    const user = await User.findOne(req.body);
    if (user) res.json({ success: true, user });
    else res.json({ success: false, message: "아이디 또는 비밀번호가 틀립니다." });
});

// 친구 요청 보내기
app.post('/send-request', async (req, res) => {
    const { userId, friendId } = req.body;
    if (userId === friendId) return res.json({ success: false, message: "자신에게는 보낼 수 없습니다." });
    const friend = await User.findOne({ userId: friendId });
    if (!friend) return res.json({ success: false, message: "존재하지 않는 사용자입니다." });
    if (friend.friends.includes(userId)) return res.json({ success: false, message: "이미 친구입니다." });
    
    await User.findOneAndUpdate({ userId: friendId }, { $addToSet: { pendingRequests: userId } });
    res.json({ success: true, message: "친구 요청을 보냈습니다." });
});

// 친구 요청 수락/거절
app.post('/handle-request', async (req, res) => {
    const { userId, requesterId, action } = req.body;
    if (action === 'accept') {
        await User.findOneAndUpdate({ userId }, { $addToSet: { friends: requesterId }, $pull: { pendingRequests: requesterId } });
        await User.findOneAndUpdate({ userId: requesterId }, { $addToSet: { friends: userId } });
        res.json({ success: true, message: "수락되었습니다." });
    } else {
        await User.findOneAndUpdate({ userId }, { $pull: { pendingRequests: requesterId } });
        res.json({ success: true, message: "거절되었습니다." });
    }
});

// 실시간 채팅 연결
io.on('connection', (socket) => {
    socket.on('join_room', (room) => socket.join(room));
    socket.on('send_message', (data) => io.to(data.room).emit('receive_message', data));
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => console.log(`🚀 서버 가동 중: ${PORT}`));
