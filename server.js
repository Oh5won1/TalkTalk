const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { maxHttpBufferSize: 1e7 });

const MONGO_URI = "mongodb+srv://dhttmddnjs704:mack1234@cluster0.znnzv5q.mongodb.net/myTalkDB?retryWrites=true&w=majority";
mongoose.connect(MONGO_URI).then(() => console.log("✅ DB 연결 성공")).catch(e => console.log("❌ DB 에러:", e));

const User = mongoose.model('User', new mongoose.Schema({
    userId: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    profilePic: { type: String, default: "" },
    statusMsg: { type: String, default: "반갑습니다!" },
    friends: [String],
    pendingRequests: [String] // 받은 친구 요청 목록
}));

app.use(express.json());
app.use(express.static(__dirname));

app.get('/', (req, res) => { res.sendFile(path.join(__dirname, 'index.html')); });

// 회원가입
app.post('/register', async (req, res) => {
    try {
        const { userId, password } = req.body;
        const exists = await User.findOne({ userId });
        if (exists) return res.json({ success: false, message: "이미 있는 아이디야!" });
        await new User({ userId, password }).save();
        res.json({ success: true, message: "가입 성공!" });
    } catch (e) { res.json({ success: false, message: "서버 오류: " + e.message }); }
});

// 로그인
app.post('/login', async (req, res) => {
    const user = await User.findOne(req.body);
    if (user) res.json({ success: true, user });
    else res.json({ success: false, message: "아이디/비번 틀림" });
});

// 친구 요청 보내기
app.post('/send-request', async (req, res) => {
    const { userId, friendId } = req.body;
    if (userId === friendId) return res.json({ success: false, message: "본인에게는 못 보냅니다." });
    const friend = await User.findOne({ userId: friendId });
    if (!friend) return res.json({ success: false, message: "없는 유저입니다." });
    if (friend.friends.includes(userId)) return res.json({ success: false, message: "이미 친구입니다." });
    
    await User.findOneAndUpdate({ userId: friendId }, { $addToSet: { pendingRequests: userId } });
    res.json({ success: true, message: "요청을 보냈습니다." });
});

// 수락/거절 처리
app.post('/handle-request', async (req, res) => {
    const { userId, requesterId, action } = req.body;
    if (action === 'accept') {
        await User.findOneAndUpdate({ userId }, { $addToSet: { friends: requesterId }, $pull: { pendingRequests: requesterId } });
        await User.findOneAndUpdate({ userId: requesterId }, { $addToSet: { friends: userId } });
        res.json({ success: true, message: "수락 완료" });
    } else {
        await User.findOneAndUpdate({ userId }, { $pull: { pendingRequests: requesterId } });
        res.json({ success: true, message: "거절 완료" });
    }
});

app.post('/update-profile', async (req, res) => {
    const { userId, profilePic, statusMsg } = req.body;
    await User.findOneAndUpdate({ userId }, { profilePic, statusMsg });
    res.json({ success: true });
});

io.on('connection', (socket) => {
    socket.on('join_room', (room) => socket.join(room));
    socket.on('send_message', (data) => io.to(data.room).emit('receive_message', data));
});

server.listen(process.env.PORT || 10000);
