const express = require('express');
const passport = require('passport');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const http = require('http');
const cors = require('cors');
require('dotenv').config();
const { connectDb } = require('./db');

// 모니터링 관련 모듈 호출
const { monitoringMiddleware, getMetrics, register } = require('./monitoring');

const app = express();

// CORS 설정
const allowedOrigins = [
  'http://localhost:3000',   // 로컬 개발 환경
  'https://sadajo.site',     // 배포된 프론트엔드 주소
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// 세션 및 Passport 초기화
app.use(passport.initialize());
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 1일
  },
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URL, dbName: 'SADAJO' }),
}));
app.use(passport.session());

// JSON 파싱 미들웨어
app.use(express.json());

// 모니터링 미들웨어 적용
app.use(monitoringMiddleware);

// /metrics 엔드포인트: Prometheus가 메트릭을 수집
app.get('/metrics', async (req, res) => {
  try {
    const metrics = await getMetrics();
    res.set('Content-Type', register.contentType);
    res.end(metrics);
  } catch (err) {
    console.error('Error generating metrics:', err);
    res.status(500).end(err);
  }
});

// 일반 라우터
const indexRouter = require('./routes/index');
app.use('/', indexRouter);

// API 라우터
const apiRouter = require('./routes/api');
app.use('/api', apiRouter);

const server = http.createServer(app);

// 소켓 초기화 (socket.js 모듈)
const initializeSocket = require("./socket");
initializeSocket(server);

// MongoDB 연결 후 서버 실행
connectDb().then(() => {
  const PORT = process.env.PORT || 8080;
  server.listen(PORT, () => {
    console.log(`🚀 서버 실행 중: http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('❌ 서버 실행 실패:', err);
});
