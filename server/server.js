import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
// Общий список разрешенных origins
const allowedOrigins = [
  "https://krx-messenger.onrender.com",
  "http://localhost:3000",
  "https://krx-messenger-client-i3q044dyp-sams-projects-b690f611.vercel.app"
];

// Настройка CORS для socket.io
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"],
  }
});

// Настройка CORS для Express
app.use(cors({
  origin: function(origin, callback) {
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("Blocked origin:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
// Добавь эти строки после: app.use(cors());
app.use(express.json());
// Добавь эти строки после: app.use(cors());
app.use(express.json());

// Root route - для проверки сервера
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 KRX Messenger Server is running!',
    version: '1.0.0',
    endpoints: [
      '/api/health',
      '/api/debug-users',
      '/api/users'
    ]
  });
});

// API routes
app.get('/api/debug-users', (req, res) => {
  db.all('SELECT * FROM users', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows || []);
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'KRX Server is running!' });
});

// API routes
app.get('/api/debug-users', (req, res) => {
  db.all('SELECT * FROM users', (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'KRX Server is running!' });
});
app.use(express.json());

// Обработка ошибок Socket.IO
io.engine.on("connection_error", (err) => {
  console.log("❌ Socket.IO connection error:", err);
});

// Логирование подключений
io.on('connection', (socket) => {
  console.log('✅ New client connected:', socket.id);
  
  socket.on('disconnect', (reason) => {
    console.log('🔌 Client disconnected:', socket.id, 'reason:', reason);
  });

  socket.on('error', (error) => {
    console.error('❌ Socket error:', error);
  });
});

// Создаем папки если нет
if (!fs.existsSync('uploads/avatars')) {
  fs.mkdirSync('uploads/avatars', { recursive: true });
}
if (!fs.existsSync('uploads/messages')) {
  fs.mkdirSync('uploads/messages', { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/avatars/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'avatar-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

// Хранилище для медиа сообщений
const messagesStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/messages/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'media-' + uniqueSuffix + path.extname(file.originalname));
  }
});
const uploadMedia = multer({ storage: messagesStorage, limits: { fileSize: 50 * 1024 * 1024 } });

app.use('/media', express.static(path.join(__dirname, 'uploads', 'messages')));

app.use('/avatars', express.static(path.join(__dirname, 'uploads', 'avatars')));

const db = new sqlite3.Database('./database/krx.db');

// API для блокировки пользователя
app.post('/api/users/block/:userId', async (req, res) => {
  const { userId } = req.params;
  const { blockedById } = req.body;

  if (!userId || !blockedById) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Добавляем блокировку
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)',
        [blockedById, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// API для разблокировки пользователя
app.post('/api/users/unblock/:userId', async (req, res) => {
  const { userId } = req.params;
  const { unblockedById } = req.body;

  if (!userId || !unblockedById) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
        [unblockedById, userId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// API для проверки статуса блокировки
app.get('/api/users/block-status/:userId', async (req, res) => {
  const { userId } = req.params;
  const { checkedById } = req.query;

  if (!userId || !checkedById) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const blockStatus = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
        [checkedById, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({ isBlocked: !!blockStatus });
  } catch (err) {
    console.error('Block status check error:', err);
    res.status(500).json({ error: 'Failed to check block status' });
  }
});

// Блокировка пользователя
app.post('/api/users/block/:userId', async (req, res) => {
  const { userId } = req.params;
  const { blockedById } = req.body;

  if (!userId || !blockedById) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    // Проверяем, не заблокирован ли уже
    const checkBlocked = await new Promise((resolve, reject) => {
      db.get(
        'SELECT id FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
        [blockedById, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (checkBlocked) {
      return res.status(400).json({ error: 'User is already blocked' });
    }

    // Добавляем блокировку
    await new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)',
        [blockedById, userId],
        (err) => {
          if (err) reject(err);
          else resolve(null);
        }
      );
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Block user error:', err);
    res.status(500).json({ error: 'Failed to block user' });
  }
});

// Разблокировка пользователя
app.post('/api/users/unblock/:userId', async (req, res) => {
  const { userId } = req.params;
  const { unblockedById } = req.body;

  if (!userId || !unblockedById) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
        [unblockedById, userId],
        (err) => {
          if (err) reject(err);
          else resolve(null);
        }
      );
    });

    res.json({ success: true });
  } catch (err) {
    console.error('Unblock user error:', err);
    res.status(500).json({ error: 'Failed to unblock user' });
  }
});

// Проверка блокировки
app.get('/api/users/block-status/:userId', async (req, res) => {
  const { userId } = req.params;
  const { checkedById } = req.query;

  if (!userId || !checkedById) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    const blockStatus = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?',
        [checkedById, userId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    res.json({ isBlocked: !!blockStatus });
  } catch (err) {
    console.error('Block status check error:', err);
    res.status(500).json({ error: 'Failed to check block status' });
  }
});

// ОБНОВЛЕННАЯ СТРУКТУРА БАЗЫ ДАННЫХ
db.serialize(() => {
  // Таблица блокировок
  db.run(`CREATE TABLE IF NOT EXISTS blocked_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    blocked_user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(blocked_user_id) REFERENCES users(id),
    UNIQUE(user_id, blocked_user_id)
  )`);

  // Пользователи
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    is_online BOOLEAN DEFAULT 0,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Чаты (личные и групповые)
  db.run(`CREATE TABLE IF NOT EXISTS chats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL DEFAULT 'direct',
    name TEXT,
    description TEXT,
    avatar_url TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_message_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(created_by) REFERENCES users(id)
  )`);

  // Таблица для заблокированных пользователей
  db.run(`CREATE TABLE IF NOT EXISTS blocked_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    blocked_user_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(blocked_user_id) REFERENCES users(id),
    UNIQUE(user_id, blocked_user_id)
  )`);

  // Каналы (используем chats.type = 'channel')
  // Каналы хранятся в той же таблице `chats` с type='channel'.
  // Add posts_restricted column if missing (controls whether only admins can post in a group)
  db.all(`PRAGMA table_info(chats)`, (err, cols) => {
    if (err || !cols) return;
    const colNames = cols.map(c => c.name);
    if (!colNames.includes('posts_restricted')) {
      db.run(`ALTER TABLE chats ADD COLUMN posts_restricted BOOLEAN DEFAULT 0`, (err) => {
        if (err) console.error('❌ Error adding posts_restricted column:', err);
        else console.log('✅ posts_restricted column added to chats table');
      });
    }
    if (!colNames.includes('comments_enabled')) {
      db.run(`ALTER TABLE chats ADD COLUMN comments_enabled BOOLEAN DEFAULT 1`, (err) => {
        if (err) console.error('❌ Error adding comments_enabled column:', err);
        else console.log('✅ comments_enabled column added to chats table');
      });
    }
    if (!colNames.includes('channel_id')) {
      db.run(`ALTER TABLE chats ADD COLUMN channel_id TEXT`, (err) => {
        if (err) console.error('❌ Error adding channel_id column:', err);
        else console.log('✅ channel_id column added to chats table');
      });
    }

    // Ensure unique index on channel_id for stable channel identifiers
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_chats_channel_id ON chats(channel_id)`, (err) => {
      if (err) console.error('❌ Error creating index on channel_id:', err);
    });
  });

  // Участники чатов
  db.run(`CREATE TABLE IF NOT EXISTS chat_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    user_id INTEGER,
    role TEXT DEFAULT 'member',
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(chat_id) REFERENCES chats(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(chat_id, user_id)
  )`);

  // Сообщения
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id INTEGER,
    sender_id INTEGER,
    content TEXT,
    message_type TEXT DEFAULT 'text',
    is_read BOOLEAN DEFAULT 0,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(chat_id) REFERENCES chats(id),
    FOREIGN KEY(sender_id) REFERENCES users(id)
  )`);

  // Реакции на сообщения (emoji, лайки и т.д.)
  db.run(`CREATE TABLE IF NOT EXISTS reactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    message_id INTEGER,
    user_id INTEGER,
    emoji TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(message_id) REFERENCES messages(id),
    FOREIGN KEY(user_id) REFERENCES users(id),
    UNIQUE(message_id, user_id, emoji)
  )`);

  // Индексы для производительности
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_members_user_id ON chat_members(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_chat_members_chat_id ON chat_members(chat_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_reactions_message_id ON reactions(message_id)`);
});

// Хранилище онлайн пользователей
const onlineUsers = new Map();

// API Routes

// Регистрация
app.post('/api/register', async (req, res) => {
  const { username, password, displayName } = req.body;
  
  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    db.run(
      `INSERT INTO users (username, password, display_name) VALUES (?, ?, ?)`,
      [username, hashedPassword, displayName || username],
      function(err) {
        if (err) {
          return res.status(400).json({ error: 'Username already exists' });
        }
        res.json({ 
          id: this.lastID, 
          username, 
          displayName: displayName || username,
          avatarUrl: null
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Логин
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get(
    `SELECT * FROM users WHERE username = ?`,
    [username],
    async (err, user) => {
      if (err || !user) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return res.status(400).json({ error: 'Invalid credentials' });
      }
      
      // Обновляем статус онлайн
      db.run(`UPDATE users SET is_online = 1 WHERE id = ?`, [user.id]);
      
      res.json({
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        avatarUrl: user.avatar_url
      });
    }
  );
});

// Выход
app.post('/api/logout', (req, res) => {
  const { userId } = req.body;
  
  db.run(`UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?`, [userId]);
  onlineUsers.delete(userId);
  
  res.json({ success: true });
});

// Получить всех пользователей (для поиска)
app.get('/api/users', (req, res) => {
  const { currentUserId } = req.query;
  
  db.all(
    `SELECT id, username, display_name as displayName, avatar_url as avatarUrl, is_online as isOnline 
     FROM users 
     WHERE id != ?`,
    [currentUserId],
    (err, users) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(users);
    }
  );
});

// Получить чаты пользователя (ИСПРАВЛЕННАЯ ВЕРСИЯ)
app.get('/api/chats', (req, res) => {
  const { userId } = req.query;
  
  if (!userId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  console.log('📋 Fetching chats for user:', userId);

  // Упрощенный запрос - получаем ВСЕ чаты пользователя, даже без сообщений
  const query = `
    SELECT 
      c.*,
      cm.role,
      last_msg.content as last_message,
      last_msg.timestamp as last_message_time,
      last_msg.sender_id as last_message_sender_id,
      sender.display_name as last_message_sender_name,
      -- Для личных чатов получаем информацию о другом пользователе
      CASE 
        WHEN c.type = 'direct' THEN (
          SELECT u.id 
          FROM chat_members cm2 
          JOIN users u ON cm2.user_id = u.id 
          WHERE cm2.chat_id = c.id AND cm2.user_id != ?
        )
        ELSE NULL
      END as other_user_id,
      CASE 
        WHEN c.type = 'direct' THEN (
          SELECT u.display_name 
          FROM chat_members cm2 
          JOIN users u ON cm2.user_id = u.id 
          WHERE cm2.chat_id = c.id AND cm2.user_id != ?
        )
        ELSE NULL
      END as other_user_name,
      CASE 
        WHEN c.type = 'direct' THEN (
          SELECT u.avatar_url 
          FROM chat_members cm2 
          JOIN users u ON cm2.user_id = u.id 
          WHERE cm2.chat_id = c.id AND cm2.user_id != ?
        )
        ELSE NULL
      END as other_user_avatar,
      CASE 
        WHEN c.type = 'direct' THEN (
          SELECT u.is_online 
          FROM chat_members cm2 
          JOIN users u ON cm2.user_id = u.id 
          WHERE cm2.chat_id = c.id AND cm2.user_id != ?
        )
        ELSE NULL
      END as other_user_online
    FROM chats c
    JOIN chat_members cm ON c.id = cm.chat_id AND cm.user_id = ?
    LEFT JOIN (
      SELECT m1.chat_id, m1.content, m1.timestamp, m1.sender_id
      FROM messages m1
      WHERE m1.id = (
        SELECT m2.id FROM messages m2 
        WHERE m2.chat_id = m1.chat_id 
        ORDER BY m2.timestamp DESC 
        LIMIT 1
      )
    ) last_msg ON last_msg.chat_id = c.id
    LEFT JOIN users sender ON last_msg.sender_id = sender.id
    ORDER BY COALESCE(last_msg.timestamp, c.created_at) DESC
  `;

  db.all(query, [userId, userId, userId, userId, userId], (err, chats) => {
    if (err) {
      console.error('❌ Error fetching chats:', err);
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
    
    console.log(`✅ Found ${chats.length} chats for user ${userId}`);
    
    // Форматируем ответ
    const formattedChats = chats.map(chat => {
      const baseChat = {
        id: chat.id,
        type: chat.type,
        name: chat.type === 'direct' ? chat.other_user_name : chat.name,
        description: chat.description,
        avatarUrl: chat.type === 'direct' ? chat.other_user_avatar : chat.avatar_url,
        channelId: chat.channel_id || chat.channelId || null,
        lastMessage: chat.last_message,
        lastMessageTime: chat.last_message_time,
        lastMessageSender: chat.last_message_sender_name,
        unreadCount: 0,
        role: chat.role
      };
      
      if (chat.type === 'direct') {
        baseChat.otherUser = {
          id: chat.other_user_id,
          displayName: chat.other_user_name,
          avatarUrl: chat.other_user_avatar,
          isOnline: chat.other_user_online === 1
        };
      }
      
      return baseChat;
    });
    
    res.json(formattedChats);
  });
});

// Получить или создать личный чат
app.post('/api/direct-chat', (req, res) => {
  const { userId, otherUserId } = req.body;
  
  if (!userId || !otherUserId) {
    return res.status(400).json({ error: 'User IDs are required' });
  }
  
  if (userId === otherUserId) {
    return res.status(400).json({ error: 'Cannot create chat with yourself' });
  }
  
  console.log('💬 Creating direct chat between:', userId, 'and', otherUserId);
  
  // Проверяем существующий чат
  const checkQuery = `
    SELECT c.* 
    FROM chats c
    JOIN chat_members cm1 ON c.id = cm1.chat_id AND cm1.user_id = ?
    JOIN chat_members cm2 ON c.id = cm2.chat_id AND cm2.user_id = ?
    WHERE c.type = 'direct'
  `;
  
  db.get(checkQuery, [userId, otherUserId], (err, existingChat) => {
    if (err) {
      console.error('❌ Error checking existing chat:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (existingChat) {
      console.log('✅ Using existing chat:', existingChat.id);
      return res.json(existingChat);
    }
    
    // Создаем новый чат
    db.run(
      `INSERT INTO chats (type, created_by) VALUES ('direct', ?)`,
      [userId],
      function(err) {
        if (err) {
          console.error('❌ Error creating chat:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const chatId = this.lastID;
        console.log('✅ New chat created with ID:', chatId);
        
        // Добавляем обоих пользователей в чат
        const stmt = db.prepare(`INSERT INTO chat_members (chat_id, user_id) VALUES (?, ?)`);
        stmt.run([chatId, userId]);
        stmt.run([chatId, otherUserId]);
        stmt.finalize();
        
        // Возвращаем новый чат с полной информацией
        db.get(
          `SELECT c.*, cm.role 
           FROM chats c 
           JOIN chat_members cm ON c.id = cm.chat_id AND cm.user_id = ?
           WHERE c.id = ?`,
          [userId, chatId],
          (err, newChat) => {
            if (err) {
              return res.status(500).json({ error: 'Error fetching new chat' });
            }
            
            // Уведомляем пользователей о новом чате
            [userId, otherUserId].forEach(userId => {
              const userSocketId = onlineUsers.get(userId.toString());
              if (userSocketId) {
                io.to(userSocketId).emit('chats_updated');
                console.log('📢 Notified user about new chat:', userId);
              }
            });
            
            res.json(newChat);
          }
        );
      }
    );
  });
});

// Создание группового чата - ФИКС ДЛЯ ВСЕХ УЧАСТНИКОВ
app.post('/api/create-group', upload.single('avatar'), (req, res) => {
  const { name, description, createdBy, members } = req.body;
  
  console.log('🔄 Creating group:', { name, description, createdBy, members });
  
  if (!name || !createdBy) {
    return res.status(400).json({ error: 'Group name and creator are required' });
  }

  let membersArray = [];
  try {
    if (members && typeof members === 'string') {
      membersArray = JSON.parse(members);
    }
  } catch (error) {
    console.log('ℹ️ Members is not JSON, treating as empty array');
  }

  if (!Array.isArray(membersArray)) {
    membersArray = [];
  }

  membersArray = membersArray.map(m => parseInt(m)).filter(m => !isNaN(m));
  const creatorId = parseInt(createdBy);
  
  // Всегда добавляем создателя
  if (!membersArray.includes(creatorId)) {
    membersArray.push(creatorId);
  }

  console.log('📝 Final members array:', membersArray);

  db.run(
    `INSERT INTO chats (type, name, description, avatar_url, created_by) VALUES ('group', ?, ?, ?, ?)`,
    [name, description, req.file ? `/avatars/${req.file.filename}` : null, createdBy],
    function(err) {
      if (err) {
        console.error('❌ Error creating group chat:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      
      const chatId = this.lastID;
      console.log('✅ Group chat created with ID:', chatId);
      
      // Добавляем всех участников
      const stmt = db.prepare(`INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)`);
      
      membersArray.forEach((userId) => {
        const role = userId === creatorId ? 'admin' : 'member';
        stmt.run([chatId, userId, role], (err) => {
          if (err) {
            console.error('❌ Error adding member:', userId, err);
          } else {
            console.log('✅ Added member:', userId, 'as', role);
          }
        });
      });
      
      stmt.finalize((err) => {
        if (err) {
          console.error('❌ Error finalizing statement:', err);
        }
        
        // Получаем полную информацию о группе для отправки всем участникам
        db.get(
          `SELECT 
            c.*,
            cm.role,
            u.display_name as creator_name
           FROM chats c 
           JOIN chat_members cm ON c.id = cm.chat_id AND cm.user_id = ?
           JOIN users u ON c.created_by = u.id
           WHERE c.id = ?`,
          [createdBy, chatId],
          (err, group) => {
            if (err) {
              console.error('❌ Error fetching created group:', err);
              return res.status(500).json({ error: 'Error fetching group data' });
            }
            
            // Форматируем группу для отправки
            const groupData = {
              id: group.id,
              type: group.type,
              name: group.name,
              description: group.description,
              avatarUrl: group.avatar_url,
              role: group.role,
              lastMessage: `Group created by ${group.creator_name}`,
              lastMessageTime: new Date().toISOString(),
              unreadCount: 0
            };
            
            console.log('🎉 Group created successfully, notifying participants...');
            
            // УВЕДОМЛЯЕМ ВСЕХ УЧАСТНИКОВ О НОВОЙ ГРУППЕ
            membersArray.forEach(userId => {
              const userSocketId = onlineUsers.get(userId.toString());
              if (userSocketId) {
                io.to(userSocketId).emit('new_group', groupData);
                console.log('📢 Sent new_group event to user:', userId);
              } else {
                console.log('ℹ️ User offline, will see group on next login:', userId);
              }
            });
            
            res.json(groupData);
          }
        );
      });
    }
  );
});

// Создание канала (админ публикует посты, остальные только читают и реагируют)
app.post('/api/create-channel', upload.single('avatar'), (req, res) => {
  const { name, description, createdBy, members, channelId } = req.body;

  if (!name || !createdBy) {
    return res.status(400).json({ error: 'Channel name and creator are required' });
  }

  let membersArray = [];
  try {
    if (members && typeof members === 'string') membersArray = JSON.parse(members);
  } catch (e) {
    membersArray = [];
  }

  if (!Array.isArray(membersArray)) membersArray = [];
  const creatorId = parseInt(createdBy);
  if (!membersArray.includes(creatorId)) membersArray.push(creatorId);

  const doInsert = () => {
    // Insert without potentially-missing columns (older DBs may not have posts_restricted/comments_enabled)
    db.run(
      `INSERT INTO chats (type, name, description, avatar_url, created_by, channel_id) 
       VALUES ('channel', ?, ?, ?, ?, ?)`,
      [name, description, req.file ? `/avatars/${req.file.filename}` : null, createdBy, channelId || null],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error: ' + err.message });

        const chatId = this.lastID;
        const stmt = db.prepare(`INSERT INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)`);
        membersArray.forEach((userId) => {
          const role = userId === creatorId ? 'admin' : 'member';
          stmt.run([chatId, userId, role]);
        });
        stmt.finalize(() => {
          // Try to set posts_restricted/comments_enabled if those columns exist (migration might not have run)
          db.all(`PRAGMA table_info(chats)`, (err, cols) => {
            const colNames = (cols || []).map(c => c.name);
            const updates = [];
            const params = [];
            if (colNames.includes('posts_restricted')) {
              updates.push('posts_restricted = 1');
            }
            if (colNames.includes('comments_enabled')) {
              updates.push('comments_enabled = 1');
            }

            if (updates.length > 0) {
              db.run(`UPDATE chats SET ${updates.join(', ')} WHERE id = ?`, [chatId], (err) => {
                if (err) console.error('❌ Error updating channel flags after insert:', err);
              });
            }

            // Возвращаем канал и уведомляем участников
            const channelData = {
              id: chatId,
              type: 'channel',
              name,
              description,
              avatarUrl: req.file ? `/avatars/${req.file.filename}` : null,
              channelId: channelId || null,
              role: 'admin',
              lastMessage: `Channel created by ${creatorId}`,
              lastMessageTime: new Date().toISOString(),
              unreadCount: 0,
              postsRestricted: true,
              commentsEnabled: true
            };

            membersArray.forEach(userId => {
              const userSocketId = onlineUsers.get(userId.toString());
              if (userSocketId) io.to(userSocketId).emit('new_channel', channelData);
            });

            res.json(channelData);
          });
        });
      }
    );
  };

  if (channelId) {
    // Check uniqueness and only then insert
    db.get(`SELECT id FROM chats WHERE channel_id = ?`, [channelId], (err, existing) => {
      if (err) {
        console.error('Error checking channel_id uniqueness', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (existing) return res.status(400).json({ error: 'Channel ID already in use' });
      doInsert();
    });
  } else {
    doInsert();
  }
});

// Добавить участников в чат/канал
app.post('/api/chats/:id/add-members', (req, res) => {
  const chatId = req.params.id;
  const { members } = req.body; // expect array of ids

  let membersArray = [];
  try { membersArray = Array.isArray(members) ? members.map(m => parseInt(m)) : JSON.parse(members).map(m => parseInt(m)); } catch (e) { membersArray = []; }
  membersArray = membersArray.filter(m => !isNaN(m));

  if (membersArray.length === 0) return res.status(400).json({ error: 'No members to add' });

  const stmt = db.prepare(`INSERT OR IGNORE INTO chat_members (chat_id, user_id, role) VALUES (?, ?, ?)`);
  membersArray.forEach(userId => {
    stmt.run([chatId, userId, 'member']);
  });
  stmt.finalize((err) => {
    if (err) return res.status(500).json({ error: 'Database error' });

    // Notify newly added users if online
    membersArray.forEach(userId => {
      const userSocketId = onlineUsers.get(userId.toString());
      if (userSocketId) io.to(userSocketId).emit('chats_updated');
    });

    res.json({ success: true });
  });
});

// Редактировать чат/канал (имя, описание, аватар)
app.post('/api/chats/:id/edit', upload.single('avatar'), (req, res) => {
  const chatId = req.params.id;
  const { name, description } = req.body;
  const avatarUrl = req.file ? `/avatars/${req.file.filename}` : null;

  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (description) { updates.push('description = ?'); params.push(description); }
  if (avatarUrl) { updates.push('avatar_url = ?'); params.push(avatarUrl); }
  if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

  params.push(chatId);
  db.run(`UPDATE chats SET ${updates.join(', ')} WHERE id = ?`, params, function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });

    // Notify members about update
    db.all(`SELECT user_id FROM chat_members WHERE chat_id = ?`, [chatId], (err, members) => {
      if (!err && members) {
        members.forEach(m => {
          const userSocketId = onlineUsers.get(m.user_id.toString());
          if (userSocketId) io.to(userSocketId).emit('chat_updated', { chatId });
        });
      }
      res.json({ success: true });
    });
  });
});

// Get chat info (including posts_restricted)
app.get('/api/chats/:id', (req, res) => {
  const chatId = req.params.id;
  db.get(
    `SELECT c.*, u.display_name as creator_name FROM chats c LEFT JOIN users u ON c.created_by = u.id WHERE c.id = ?`,
    [chatId],
    (err, chat) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(chat);
    }
  );
});

// Update channel settings
app.post('/api/chats/:id/settings', (req, res) => {
  const chatId = req.params.id;
  const { postsRestricted, commentsEnabled } = req.body;
  const userId = req.body.userId;

  // Verify user is admin
  db.get(
    `SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?`,
    [chatId, userId],
    (err, member) => {
      if (err || !member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Only admins can change channel settings' });
      }

      // Update settings
      const updates = [];
      const params = [];
      
      if (typeof postsRestricted !== 'undefined') {
        updates.push('posts_restricted = ?');
        params.push(postsRestricted);
      }
      if (typeof commentsEnabled !== 'undefined') {
        updates.push('comments_enabled = ?');
        params.push(commentsEnabled);
      }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No settings provided' });
      }

      params.push(chatId);
      db.run(
        `UPDATE chats SET ${updates.join(', ')} WHERE id = ?`,
        params,
        function(err) {
          if (err) return res.status(500).json({ error: 'Database error' });
          
          // Notify members about settings update
          db.all(
            `SELECT user_id FROM chat_members WHERE chat_id = ?`,
            [chatId],
            (err, members) => {
              if (!err && members) {
                members.forEach(m => {
                  const userSocketId = onlineUsers.get(m.user_id.toString());
                  if (userSocketId) {
                    io.to(userSocketId).emit('chat_settings_updated', {
                      chatId,
                      postsRestricted,
                      commentsEnabled
                    });
                  }
                });
              }
              res.json({ success: true });
            }
          );
        }
      );
    }
  );
});

// Get members of a chat with roles
app.get('/api/chats/:id/members', (req, res) => {
  const chatId = req.params.id;
  db.all(
    `SELECT cm.user_id as id, u.username, u.display_name as displayName, u.avatar_url as avatarUrl, cm.role
     FROM chat_members cm
     JOIN users u ON cm.user_id = u.id
     WHERE cm.chat_id = ?`,
    [chatId],
    (err, members) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(members);
    }
  );
});

// Assign or revoke admin role for a member
app.post('/api/chats/:id/set-admin', (req, res) => {
  const chatId = req.params.id;
  const { userId, makeAdmin } = req.body;
  if (!userId || typeof makeAdmin === 'undefined') return res.status(400).json({ error: 'userId and makeAdmin are required' });

  const role = makeAdmin ? 'admin' : 'member';
  db.run(
    `UPDATE chat_members SET role = ? WHERE chat_id = ? AND user_id = ?`,
    [role, chatId, userId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });

      // Notify chat members via sockets
      io.to(`chat_${chatId}`).emit('member_role_updated', { chatId: Number(chatId), userId: Number(userId), role });
      res.json({ success: true });
    }
  );
});

// Update chat settings (e.g., restrict posting to admins)
app.post('/api/chats/:id/settings', (req, res) => {
  const chatId = req.params.id;
  const { postsRestricted } = req.body;
  const val = postsRestricted ? 1 : 0;
  db.run(
    `UPDATE chats SET posts_restricted = ? WHERE id = ?`,
    [val, chatId],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      io.to(`chat_${chatId}`).emit('chat_settings_updated', { chatId: Number(chatId), postsRestricted: !!postsRestricted });
      res.json({ success: true });
    }
  );
});

// Получить сообщения чата
app.get('/api/messages', (req, res) => {
  const { chatId, userId } = req.query;
  
  if (!chatId || !userId) {
    return res.status(400).json({ error: 'Chat ID and User ID are required' });
  }
  
  console.log('💭 Fetching messages for chat:', chatId, 'user:', userId);
  
  // Проверяем что пользователь участник чата
  db.get(
    `SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?`,
    [chatId, userId],
    (err, isMember) => {
      if (err || !isMember) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Получаем сообщения
      db.all(
        `SELECT m.*, u.username, u.display_name as displayName, u.avatar_url as avatarUrl
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.chat_id = ?
         ORDER BY m.timestamp ASC`,
        [chatId],
        (err, messages) => {
          if (err) {
            console.error('❌ Error fetching messages:', err);
            return res.status(500).json({ error: 'Database error' });
          }

          console.log(`✅ Found ${messages.length} messages for chat ${chatId}`);

          // Получаем информацию о last_read_at для участников, чтобы пометить, кто прочитал какие сообщения
          db.all(`SELECT user_id, last_read_at FROM chat_members WHERE chat_id = ?`, [chatId], (err, reads) => {
            if (err) {
              console.error('❌ Error fetching chat member read times:', err);
              // fallback: send messages without read info
              if (messages.length > 0) {
                db.run(
                  `UPDATE chat_members SET last_read_at = CURRENT_TIMESTAMP WHERE chat_id = ? AND user_id = ?`,
                  [chatId, userId]
                );
              }
              return res.json(messages);
            }

            // Для каждого сообщения собираем массив user_id, которые прочитали это сообщение
            const messagesWithRead = messages.map(m => {
              const msgTime = new Date(m.timestamp).getTime();
              const readBy = (reads || []).filter(r => {
                if (!r.last_read_at) return false;
                return new Date(r.last_read_at).getTime() >= msgTime;
              }).map(r => r.user_id);
              return { ...m, readBy };
            });

            // Обновляем время последнего прочтения текущего пользователя
            if (messages.length > 0) {
              db.run(
                `UPDATE chat_members SET last_read_at = CURRENT_TIMESTAMP WHERE chat_id = ? AND user_id = ?`,
                [chatId, userId]
              );
            }

            res.json(messagesWithRead);
          });
        }
      );
    }
  );
});

// Получить реакции для сообщения
app.get('/api/messages/:id/reactions', (req, res) => {
  const messageId = req.params.id;

  db.all(
    `SELECT r.id, r.emoji, r.user_id as userId, u.display_name as userName, u.avatar_url as avatarUrl, r.created_at as createdAt
     FROM reactions r
     JOIN users u ON r.user_id = u.id
     WHERE r.message_id = ?`,
    [messageId],
    (err, reactions) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(reactions);
    }
  );
});

// Добавить реакцию к сообщению (или игнорировать, если уже есть)
app.post('/api/messages/:id/reactions', (req, res) => {
  const messageId = req.params.id;
  const { userId, emoji } = req.body;

  if (!userId || !emoji) return res.status(400).json({ error: 'userId and emoji are required' });

  db.run(
    `INSERT OR IGNORE INTO reactions (message_id, user_id, emoji) VALUES (?, ?, ?)`,
    [messageId, userId, emoji],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });

      const reactionId = this.lastID;

      // Notify via Socket.IO to the chat room (if message exists we can fetch its chat_id)
      db.get(`SELECT chat_id FROM messages WHERE id = ?`, [messageId], (err, row) => {
        if (!err && row && row.chat_id) {
          io.to(`chat_${row.chat_id}`).emit('reaction_added', { messageId, userId, emoji });
        }
      });

      res.json({ success: true, id: reactionId });
    }
  );
});

// Удалить реакцию от пользователя
app.delete('/api/messages/:id/reactions', (req, res) => {
  const messageId = req.params.id;
  const { userId, emoji } = req.body;

  if (!userId || !emoji) return res.status(400).json({ error: 'userId and emoji are required' });

  db.run(
    `DELETE FROM reactions WHERE message_id = ? AND user_id = ? AND emoji = ?`,
    [messageId, userId, emoji],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });

      // Optionally notify clients
      db.get(`SELECT chat_id FROM messages WHERE id = ?`, [messageId], (err, row) => {
        if (!err && row && row.chat_id) {
          io.to(`chat_${row.chat_id}`).emit('reaction_removed', { messageId, userId, emoji });
        }
      });

      res.json({ success: true });
    }
  );
});

// Удаление сообщения (локально или для всех)
app.delete('/api/messages/:id', express.json(), (req, res) => {
  const messageId = req.params.id;
  const { userId, forEveryone } = req.body;

  if (!userId) return res.status(400).json({ error: 'userId is required' });

  db.get(`SELECT id, chat_id, sender_id FROM messages WHERE id = ?`, [messageId], (err, msg) => {
    if (err || !msg) return res.status(404).json({ error: 'Message not found' });

    const chatId = msg.chat_id;
    const senderId = msg.sender_id;
    // Helper to delete message and notify
    const proceedDelete = () => {
      db.run(`DELETE FROM messages WHERE id = ?`, [messageId], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        // Notify via socket that message was deleted
        io.to(`chat_${chatId}`).emit('message_deleted', { messageId: Number(messageId), chatId: Number(chatId) });
        res.json({ success: true });
      });
    };

    if (forEveryone) {
      // For deletions for everyone: allow in direct chats for any participant; in groups/channels allow sender or admin
      db.get(`SELECT type FROM chats WHERE id = ?`, [chatId], (err, chat) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        const chatType = chat?.type || 'group';

        if (chatType === 'direct') {
          // check requester is a member of the chat
          db.get(`SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?`, [chatId, userId], (err, isMember) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (isMember) proceedDelete();
            else return res.status(403).json({ error: 'Not a participant of this chat' });
          });
        } else {
          // group/channel: only sender or admin can delete for everyone
          db.get(`SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?`, [chatId, userId], (err, member) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (Number(userId) === Number(senderId) || (member && member.role === 'admin')) {
              proceedDelete();
            } else {
              return res.status(403).json({ error: 'Not allowed to delete for everyone' });
            }
          });
        }
      });
    } else {
      // delete only for self (we'll delete record only if sender)
      if (Number(userId) === Number(senderId)) {
        proceedDelete();
      } else {
        return res.status(403).json({ error: 'Not allowed to delete this message' });
      }
    }
  });
});

// Поиск пользователей для новых чатов
app.get('/api/search-users', (req, res) => {
  const { query, currentUserId } = req.query;
  
  if (!query || query.trim() === '') {
    return res.json([]);
  }
  
  const searchQuery = `%${query}%`;
  
  db.all(
    `SELECT id, username, display_name as displayName, avatar_url as avatarUrl 
     FROM users 
     WHERE id != ? 
     AND (username LIKE ? OR display_name LIKE ?)
     LIMIT 20`,
    [currentUserId, searchQuery, searchQuery],
    (err, users) => {
      if (err) {
        console.error('❌ Search error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(users);
    }
  );
});

    // Получить профиль пользователя по id
    app.get('/api/users/:id', (req, res) => {
      const userId = req.params.id;
      db.get(
        `SELECT id, username, display_name as displayName, avatar_url as avatarUrl, bio, is_online as isOnline, last_seen as lastSeen FROM users WHERE id = ?`,
        [userId],
        (err, user) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          if (!user) return res.status(404).json({ error: 'User not found' });
          res.json(user);
        }
      );
    });

    // Обновить профиль пользователя
    app.post('/api/users/:id/update', (req, res) => {
      const userId = req.params.id;
      const { displayName, bio } = req.body;

      if (!userId) return res.status(400).json({ error: 'User ID is required' });
      if (!displayName) return res.status(400).json({ error: 'Display name is required' });
      if (displayName.length < 2) return res.status(400).json({ error: 'Display name must be at least 2 characters' });
      if (displayName.length > 32) return res.status(400).json({ error: 'Display name cannot be longer than 32 characters' });
      if (bio && bio.length > 500) return res.status(400).json({ error: 'Bio cannot be longer than 500 characters' });

      db.run(
        `UPDATE users SET display_name = ?, bio = ? WHERE id = ?`,
        [displayName, bio || null, userId],
        function(err) {
          if (err) return res.status(500).json({ error: 'Database error: ' + err.message });
          
          // Получаем обновленные данные
          db.get(
            `SELECT id, username, display_name as displayName, avatar_url as avatarUrl, bio FROM users WHERE id = ?`,
            [userId],
            (err, user) => {
              if (err) return res.status(500).json({ error: 'Error fetching updated user' });
              if (!user) return res.status(404).json({ error: 'User not found' });
              res.json(user);
            }
          );
        }
      );
    });

// Смена аватарки
app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const userId = req.body.userId;
  const avatarUrl = `/avatars/${req.file.filename}`;

  db.run(
    `UPDATE users SET avatar_url = ? WHERE id = ?`,
    [avatarUrl, userId],
    function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      res.json({ avatarUrl });
    }
  );
});

// Дебаг endpoint для проверки всех данных
app.get('/api/debug-data', (req, res) => {
  const { userId } = req.query;
  
  const result = {};
  
  // Получаем пользователей
  db.all(`SELECT * FROM users`, (err, users) => {
    result.users = users;
    
    // Получаем чаты
    db.all(`SELECT * FROM chats`, (err, chats) => {
      result.chats = chats;
      
      // Получаем участников чатов
      db.all(`SELECT * FROM chat_members`, (err, members) => {
        result.chat_members = members;
        
        // Получаем сообщения
        db.all(`SELECT * FROM messages`, (err, messages) => {
          result.messages = messages;
          
          // Если указан userId, получаем его чаты
          if (userId) {
            db.all(
              `SELECT chat_id FROM chat_members WHERE user_id = ?`,
              [userId],
              (err, userChats) => {
                result.user_chats = userChats;
                res.json(result);
              }
            );
          } else {
            res.json(result);
          }
        });
      });
    });
  });
});

// Загрузка медиа для сообщений (изображения, аудио, видео, документы)
app.post('/api/upload-media', uploadMedia.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const fileUrl = `/media/${req.file.filename}`;
  res.json({ url: fileUrl, originalName: req.file.originalname, mimeType: req.file.mimetype });
});

// Socket.IO логика
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  // Пользователь подключается
  socket.on('user_online', (userId) => {
    onlineUsers.set(userId.toString(), socket.id);
    socket.userId = userId;
    
    // Обновляем статус в БД
    db.run(`UPDATE users SET is_online = 1 WHERE id = ?`, [userId]);
    
    console.log(`🟢 User ${userId} is online`);
    
    // Присоединяем к комнатам своих чатов
    db.all(
      `SELECT chat_id FROM chat_members WHERE user_id = ?`,
      [userId],
      (err, chats) => {
        if (!err && chats) {
          chats.forEach(chat => {
            socket.join(`chat_${chat.chat_id}`);
            console.log(`User ${userId} joined chat_${chat.chat_id}`);
          });
        }
      }
    );
    
    // Отправляем актуальный список чатов
    socket.emit('get_chats', userId);
  });

  // Запрос списка чатов
  socket.on('get_chats', (userId) => {
    console.log('📋 User requested chats:', userId);
    
    if (!userId) return;
    
    const query = `
      SELECT 
        c.*,
        cm.role,
        last_msg.content as last_message,
        last_msg.timestamp as last_message_time,
        last_msg.sender_id as last_message_sender_id,
        sender.display_name as last_message_sender_name,
        CASE 
          WHEN c.type = 'direct' THEN (
            SELECT u.id 
            FROM chat_members cm2 
            JOIN users u ON cm2.user_id = u.id 
            WHERE cm2.chat_id = c.id AND cm2.user_id != ?
          )
          ELSE NULL
        END as other_user_id,
        CASE 
          WHEN c.type = 'direct' THEN (
            SELECT u.display_name 
            FROM chat_members cm2 
            JOIN users u ON cm2.user_id = u.id 
            WHERE cm2.chat_id = c.id AND cm2.user_id != ?
          )
          ELSE NULL
        END as other_user_name,
        CASE 
          WHEN c.type = 'direct' THEN (
            SELECT u.avatar_url 
            FROM chat_members cm2 
            JOIN users u ON cm2.user_id = u.id 
            WHERE cm2.chat_id = c.id AND cm2.user_id != ?
          )
          ELSE NULL
        END as other_user_avatar
      FROM chats c
      JOIN chat_members cm ON c.id = cm.chat_id AND cm.user_id = ?
      LEFT JOIN (
        SELECT m1.chat_id, m1.content, m1.timestamp, m1.sender_id
        FROM messages m1
        WHERE m1.id = (
          SELECT m2.id FROM messages m2 
          WHERE m2.chat_id = m1.chat_id 
          ORDER BY m2.timestamp DESC 
          LIMIT 1
        )
      ) last_msg ON last_msg.chat_id = c.id
      LEFT JOIN users sender ON last_msg.sender_id = sender.id
      ORDER BY COALESCE(last_msg.timestamp, c.created_at) DESC
    `;

    db.all(query, [userId, userId, userId, userId], (err, chats) => {
      if (err) {
        console.error('❌ Error fetching chats for socket:', err);
        return;
      }
      
      const formattedChats = chats.map(chat => {
        const baseChat = {
          id: chat.id,
          type: chat.type,
          name: chat.type === 'direct' ? chat.other_user_name : chat.name,
          description: chat.description,
          avatarUrl: chat.type === 'direct' ? chat.other_user_avatar : chat.avatar_url,
          channelId: chat.channel_id || chat.channelId || null,
          lastMessage: chat.last_message,
          lastMessageTime: chat.last_message_time,
          lastMessageSender: chat.last_message_sender_name,
          unreadCount: 0,
          role: chat.role
        };
        
        if (chat.type === 'direct') {
          baseChat.otherUser = {
            id: chat.other_user_id,
            displayName: chat.other_user_name,
            avatarUrl: chat.other_user_avatar
          };
        }
        
        return baseChat;
      });
      
      socket.emit('chats_list', formattedChats);
      console.log(`📨 Sent ${formattedChats.length} chats to user ${userId}`);
    });
  });

  // Typing indicator from client: broadcast to other participants in chat
  socket.on('typing', ({ chatId, userId }) => {
    if (!chatId || !userId) return;
    socket.to(`chat_${chatId}`).emit('user_typing', { chatId, userId });
  });

  socket.on('stop_typing', ({ chatId, userId }) => {
    if (!chatId || !userId) return;
    socket.to(`chat_${chatId}`).emit('user_stop_typing', { chatId, userId });
  });

  // Mark messages in chat as read by user -> update last_read_at and notify others
  socket.on('mark_read', ({ chatId, userId }) => {
    if (!chatId || !userId) return;
    db.run(`UPDATE chat_members SET last_read_at = CURRENT_TIMESTAMP WHERE chat_id = ? AND user_id = ?`, [chatId, userId], function(err) {
      if (err) {
        console.error('❌ Error updating last_read_at', err);
        return;
      }

      // Notify other participants about read receipt
      io.to(`chat_${chatId}`).emit('read_receipt', { chatId, userId, timestamp: new Date().toISOString() });
    });
  });

  // Отправка сообщения - ФИКС МГНОВЕННОГО ОТОБРАЖЕНИЯ
socket.on('send_message', (data) => {
  const { chatId, senderId, content } = data;
  
  console.log('📨 Sending message:', { chatId, senderId, content });
  
  if (!chatId || !senderId || !content) {
    return socket.emit('message_error', { error: 'Missing required fields' });
  }
  
  // Проверяем существование чата
  db.get(`SELECT * FROM chats WHERE id = ?`, [chatId], (err, chat) => {
    if (err || !chat) {
      console.error('❌ Chat not found:', chatId);
      return socket.emit('message_error', { error: 'Chat not found' });
    }
    
    // If this is a channel OR the chat is restricted to admins, only allow admins to post
    if (chat.type === 'channel' || chat.posts_restricted) {
      db.get(`SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?`, [chatId, senderId], (err, member) => {
        if (err || !member || member.role !== 'admin') {
          console.warn('⛔ User not allowed to post in chat', senderId, chatId);
          return socket.emit('message_error', { error: 'Only admins can post in this chat' });
        }

        // continuer with inserting message
        insertMessage();
      });
    } else {
      insertMessage();
    }
    
    function insertMessage() {
      // Сохраняем сообщение в БД (поддержка message_type)
      const messageType = data.messageType || 'text';
      db.run(
        `INSERT INTO messages (chat_id, sender_id, content, message_type) VALUES (?, ?, ?, ?)`,
        [chatId, senderId, content, messageType],
        function(err) {
          if (err) {
            console.error('❌ Error saving message:', err);
            return socket.emit('message_error', { error: 'Failed to save message' });
          }
          
          const messageId = this.lastID;
          console.log('✅ Message saved with ID:', messageId);
          
          // Получаем полную информацию о сообщении
          db.get(
            `SELECT m.*, u.username, u.display_name as displayName, u.avatar_url as avatarUrl
             FROM messages m
             JOIN users u ON m.sender_id = u.id
             WHERE m.id = ?`,
            [messageId],
            (err, message) => {
              if (err) {
                console.error('❌ Error fetching message:', err);
                return;
              }
              
              // Обновляем время последнего сообщения в чате
              db.run(
                `UPDATE chats SET last_message_at = CURRENT_TIMESTAMP WHERE id = ?`,
                [chatId]
              );
              
              // Получаем всех участников чата
              db.all(
                `SELECT user_id FROM chat_members WHERE chat_id = ?`,
                [chatId],
                (err, members) => {
                  if (!err && members) {
                    console.log(`📢 Delivering message to ${members.length} members`);
                    
                    // ОТПРАВЛЯЕМ СООБЩЕНИЕ ВСЕМ УЧАСТНИКАМ ЧАТА
                    members.forEach(member => {
                      const memberSocketId = onlineUsers.get(member.user_id.toString());
                      if (memberSocketId) {
                        // Отправляем сообщение
                        io.to(memberSocketId).emit('receive_message', message);
                        console.log('✅ Message delivered to user:', member.user_id);
                      }
                    });
                    
                    // ОБНОВЛЯЕМ СПИСОК ЧАТОВ У ВСЕХ УЧАСТНИКОВ
                    members.forEach(member => {
                      const memberSocketId = onlineUsers.get(member.user_id.toString());
                      if (memberSocketId) {
                        io.to(memberSocketId).emit('update_chats');
                        console.log('🔄 Chat list updated for user:', member.user_id);
                      }
                    });
                  }
                }
              );
            }
          );
        }
      );
    }
    
  });
});
// API для получения списка заблокированных пользователей
app.get('/api/users/blocked', async (req, res) => {
  const { userId } = req.query;

  if (!userId) {
    return res.status(400).json({ error: 'Missing user ID' });
  }

  try {
    const blockedUsers = await new Promise((resolve, reject) => {
      db.all(
        'SELECT blocked_user_id FROM blocked_users WHERE user_id = ?',
        [userId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.blocked_user_id));
        }
      );
    });

    res.json({ blockedUsers });
  } catch (err) {
    console.error('Error fetching blocked users:', err);
    res.status(500).json({ error: 'Failed to fetch blocked users' });
  }
});

// Новые socket события для real-time обновлений
socket.on('join_chats', (userId) => {
  console.log('🔗 User joining chat rooms:', userId);
  
  if (!userId) return;
  
  // Присоединяем пользователя ко всем его чатам
  db.all(
    `SELECT chat_id FROM chat_members WHERE user_id = ?`,
    [userId],
    (err, chats) => {
      if (!err && chats) {
        chats.forEach(chat => {
          socket.join(`chat_${chat.chat_id}`);
          console.log(`✅ User ${userId} joined chat_${chat.chat_id}`);
        });
      }
    }
  );
});

// Запрос истории сообщений через socket
socket.on('get_messages', (data) => {
  const { chatId, userId } = data;
  
  console.log('💭 Fetching messages via socket for chat:', chatId);
  
  if (!chatId || !userId) return;
  
  db.all(
    `SELECT m.*, u.username, u.display_name as displayName, u.avatar_url as avatarUrl
     FROM messages m
     JOIN users u ON m.sender_id = u.id
     WHERE m.chat_id = ?
     ORDER BY m.timestamp ASC`,
    [chatId],
    (err, messages) => {
      if (err) {
        console.error('❌ Error fetching messages via socket:', err);
        return;
      }
      
      socket.emit('messages_history', { chatId, messages });
      console.log(`✅ Sent ${messages.length} messages for chat ${chatId}`);
    }
  );
});

  // Пользователь отключается
  socket.on('disconnect', () => {
    if (socket.userId) {
      onlineUsers.delete(socket.userId.toString());
      
      // Обновляем статус в БД
      db.run(
        `UPDATE users SET is_online = 0, last_seen = CURRENT_TIMESTAMP WHERE id = ?`,
        [socket.userId]
      );
      
      console.log(`🔴 User ${socket.userId} disconnected`);
    }
  });

  // Delete message via socket
  socket.on('delete_message', (data) => {
    const { messageId, forEveryone } = data;
    const requesterId = socket.userId;
    if (!messageId || !requesterId) return;

    db.get(`SELECT id, chat_id, sender_id FROM messages WHERE id = ?`, [messageId], (err, msg) => {
      if (err || !msg) return;
      const chatId = msg.chat_id;
      const senderId = msg.sender_id;

      const doDelete = () => {
        db.run(`DELETE FROM messages WHERE id = ?`, [messageId], function(err) {
          if (!err) {
            io.to(`chat_${chatId}`).emit('message_deleted', { messageId: Number(messageId), chatId: Number(chatId) });
          }
        });
      };

      if (forEveryone) {
        // allow in direct chats for any participant; in groups/channels allow sender or admin
        db.get(`SELECT type FROM chats WHERE id = ?`, [chatId], (err, chat) => {
          if (err) return;
          const chatType = chat?.type || 'group';
          if (chatType === 'direct') {
            db.get(`SELECT 1 FROM chat_members WHERE chat_id = ? AND user_id = ?`, [chatId, requesterId], (err, isMember) => {
              if (!err && isMember) doDelete();
            });
          } else {
            db.get(`SELECT role FROM chat_members WHERE chat_id = ? AND user_id = ?`, [chatId, requesterId], (err, member) => {
              if (err) return;
              if (Number(requesterId) === Number(senderId) || (member && member.role === 'admin')) {
                doDelete();
              }
            });
          }
        });
      } else {
        if (Number(requesterId) === Number(senderId)) doDelete();
      }
    });
  });
  // No operation change
});

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🚀 KRX Server running on port ${PORT}`);
  console.log(`💬 Chat system ready`);
  console.log(`💾 Database: SQLite`);
  console.log(`📡 Socket.IO server initialized`);
  console.log(`🌐 CORS enabled for: http://localhost:3000`);
});
