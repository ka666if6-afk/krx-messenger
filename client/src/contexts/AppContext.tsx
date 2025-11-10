import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Chat, Message, EmojiType } from '../types/types';
import io, { Socket } from 'socket.io-client';
import { SOCKET_URL, API_URL } from '../config/api';

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  socket: Socket | null;
  darkMode: boolean;
  toggleDarkMode: () => void;
  chats: Chat[];
  setChats: React.Dispatch<React.SetStateAction<Chat[]>>;
  currentChat: Chat | null;
  setCurrentChat: React.Dispatch<React.SetStateAction<Chat | null>>;
  messages: Message[];
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  loadChats: () => Promise<void>;
  loadMessages: (chatId: number) => Promise<void>;
  sendMessage: (content: string, chatId: number, messageType?: string) => void;
  toggleMute: (chatId: number) => void;
  notifyEnabled: boolean;
  toggleNotify: (enabled?: boolean) => void;
  soundEnabled: boolean;
  toggleSound: (enabled?: boolean) => void;
  typingUsers: Record<number, number[]>;
  checkBlockStatus: (userId: number) => Promise<boolean>;
  blockedUsers: Set<number>;
  refreshBlockedUsers: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // user state (start null on server to avoid hydration mismatch)
  const [user, _setUser] = useState<User | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<Set<number>>(new Set());

  // Обновление списка заблокированных пользователей
  const refreshBlockedUsers = async () => {
    if (!user) return;
    try {
      const response = await fetch(`${API_URL}/api/users/blocked?userId=${user.id}`);
      if (!response.ok) throw new Error('Failed to fetch blocked users');
      const data = await response.json();
      setBlockedUsers(new Set(data.blockedUsers));
    } catch (err) {
      console.error('Failed to refresh blocked users:', err);
    }
  };

  // Проверка блокировки пользователя
  const checkBlockStatus = async (userId: number): Promise<boolean> => {
    if (!user) return false;
    try {
      const response = await fetch(
        `${API_URL}/api/users/block-status/${userId}?checkedById=${user.id}`
      );
      if (!response.ok) throw new Error('Failed to check block status');
      const data = await response.json();
      return data.isBlocked;
    } catch (err) {
      console.error('Block status check error:', err);
      return false;
    }
  };

  // wrapper to keep localStorage in sync
  const setUser = (u: User | null) => {
    try {
      if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        if (u) localStorage.setItem('krx_user', JSON.stringify(u));
        else localStorage.removeItem('krx_user');
      }
    } catch (e) {
      console.warn('Failed to persist user to localStorage', e);
    }
    _setUser(u);
  };

  // On client mount read persisted user to restore session (avoids server/client markup mismatch)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('krx_user');
      if (raw) {
        const parsed = JSON.parse(raw) as User;
        _setUser(parsed);
      }
    } catch (e) {
      // ignore parse errors
    }
  }, []);

  // Загружаем список заблокированных пользователей при загрузке и смене пользователя
  useEffect(() => {
    if (user) {
      refreshBlockedUsers();
    }
  }, [user]);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined' && localStorage.getItem('theme') === 'dark';
  });
  const [chats, setChats] = useState<Chat[]>([]);
  const [currentChat, setCurrentChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<number, number[]>>({}); // chatId -> array of userIds
  const [notifyEnabled, setNotifyEnabled] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = localStorage.getItem('krx_notify_enabled');
        return raw ? JSON.parse(raw) : false;
      }
    } catch (e) { }
    return false;
  });
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      if (typeof window !== 'undefined') {
        const raw = typeof localStorage !== 'undefined' && localStorage.getItem('krx_sound_enabled');
        return raw ? JSON.parse(raw) : true;
      }
    } catch (e) { }
    return true;
  });
  // On-client muted chats stored in localStorage (client preference)
  // We persist per-chat muted state in localStorage under 'krx_muted_chats'

  // Функция отправки сообщения
  const sendMessage = (content: string, chatId: number, messageType?: string, isComment?: boolean) => {
    if (!socket || !user) return;

    const messageData: any = {
      chatId,
      senderId: user.id,
      content: content.trim(),
      isComment: isComment || false
    };
    if (messageType) messageData.messageType = messageType;

    console.log('📤 Sending message:', messageData);
    socket.emit('send_message', messageData);

    // ОПТИМИСТИЧЕСКОЕ ОБНОВЛЕНИЕ - сразу показываем сообщение
    const optimisticMessage: Message = {
      id: Date.now(), // Временный ID
      chatId,
      senderId: user.id,
      content: content.trim(),
      messageType: messageData.messageType || 'text',
      isRead: false,
      timestamp: new Date().toISOString(),
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl
    };

    setMessages(prev => [...prev, optimisticMessage]);
  };

  // Normalize server message shape to client Message interface (camelCase)
  const normalizeMessage = (m: any): Message => {
    return {
      id: Number(m.id),
      chatId: Number(m.chat_id ?? m.chatId),
      senderId: Number(m.sender_id ?? m.senderId),
      // ensure media urls are absolute so audio/img/video load correctly from client
      content: (() => {
        const raw = m.content ?? '';
        if (typeof raw === 'string' && raw.startsWith('/')) return `${API_URL}${raw}`;
        return raw;
      })(),
      messageType: m.message_type ?? m.messageType ?? 'text',
      isRead: (m.is_read === 1) || m.isRead || false,
      timestamp: m.timestamp ?? m.created_at ?? new Date().toISOString(),
      username: m.username ?? m.userName ?? '',
      displayName: m.displayName ?? m.display_name ?? '',
      avatarUrl: (() => {
        const a = m.avatarUrl ?? m.avatar_url ?? undefined;
        if (typeof a === 'string' && a.startsWith('/')) return `${API_URL}${a}`;
        return a;
      })(),
      reactions: m.reactions ?? []
    };
  };

  useEffect(() => {
    if (user) {
      console.log('🔄 Attempting to connect to socket server:', SOCKET_URL);
      
      // Create socket with enhanced configuration
      const newSocket = io(SOCKET_URL, {
        transports: ['websocket'],
        forceNew: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 10000,
        extraHeaders: {
          "Access-Control-Allow-Origin": "*"
        },
        withCredentials: true,
        auth: {
          userId: user.id
        }
      });

      // Socket connection events
      newSocket.on('connect', () => {
        console.log('✅ Socket connected successfully, ID:', newSocket.id);
        
        // Send initial events after successful connection
        newSocket.emit('user_online', user.id);
        newSocket.emit('join_chats', user.id);
        newSocket.emit('get_chats', user.id);
      });

      newSocket.on('connect_error', (error) => {
        console.error('❌ Socket connection error:', error);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('🔌 Socket disconnected:', reason);
      });

      newSocket.io.on('reconnect', (attempt) => {
        console.log('🔄 Socket reconnected after', attempt, 'attempts');
      });

      newSocket.io.on('reconnect_error', (error) => {
        console.error('❌ Socket reconnection error:', error);
      });

      newSocket.io.on('reconnect_failed', () => {
        console.error('❌ Socket reconnection failed after 5 attempts');
      });
      
      // 📩 ПОЛУЧЕНИЕ НОВЫХ СООБЩЕНИЙ В РЕАЛЬНОМ ВРЕМЕНИ
        newSocket.on('receive_message', (rawMsg: any) => {
          const message = normalizeMessage(rawMsg);
          console.log('📩 Received new message:', message);

          if (currentChat && message.chatId === currentChat.id) {
            setMessages(prev => {
              // Remove optimistic duplicate messages: match by senderId + content + close timestamp
              const filtered = prev.filter(m => {
                try {
                  if (Number(m.senderId) === Number(message.senderId) && m.content === message.content) {
                    const tPrev = new Date(m.timestamp).getTime();
                    const tMsg = new Date(message.timestamp).getTime();
                    if (Math.abs(tPrev - tMsg) < 15000) {
                      // drop optimistic
                      return false;
                    }
                  }
                } catch (e) {
                  // keep if any parse error
                }
                return true;
              });
              return [...filtered, message];
            });
          }

          // If message for other chat, increment unread count and optionally show notification
          if (!currentChat || message.chatId !== currentChat.id) {
            console.log('💡 New message in different chat');
            setChats(prev => prev.map(c => {
              if (Number(c.id) === Number(message.chatId)) {
                return {
                  ...c,
                  unreadCount: (c.unreadCount || 0) + 1,
                  lastMessage: message.content,
                  lastMessageTime: message.timestamp,
                  lastMessageSender: message.displayName
                };
              }
              return c;
            }));

            // find chat and check muted flag
            try {
              const chat = chats.find(ch => Number(ch.id) === Number(message.chatId));
              const isMuted = chat?.muted;
              // show browser notification if global notifications enabled, chat is not muted and permission granted
              if (notifyEnabled && typeof window !== 'undefined' && !isMuted && 'Notification' in window && Notification.permission === 'granted') {
                const title = chat?.type === 'direct' ? (chat.otherUser?.displayName || 'New message') : (chat?.name || 'New message');
                const body = `${message.displayName}: ${typeof message.content === 'string' ? message.content.slice(0, 120) : ''}`;
                try {
                  new Notification(title, { body, icon: message.avatarUrl });
                } catch (e) {
                  console.warn('Notification error', e);
                }
              }

              // play sound if enabled and chat not muted
              if (soundEnabled && !isMuted) {
                try { playNotificationSound(); } catch (e) { /* ignore */ }
              }
            } catch (e) {
              // ignore
            }
          }
        });

      // 🧩 Реакции на сообщения (реaltime)
      newSocket.on('reaction_added', (data: { messageId: number, userId: number, emoji: string }) => {
        setMessages(prev => prev.map(m => {
          if (m.id === Number(data.messageId)) {
            const existing = m.reactions || [];
            // Add reaction with correct type
            return {
              ...m,
              reactions: [...existing, { id: Date.now(), userId: data.userId, userName: '', emoji: data.emoji as EmojiType, createdAt: new Date().toISOString() }]
            };
          }
          return m;
        }));
      });

      newSocket.on('reaction_removed', (data: { messageId: number, userId: number, emoji: string }) => {
        setMessages(prev => prev.map(m => {
          if (m.id === Number(data.messageId)) {
            const existing = m.reactions || [];
            return { ...m, reactions: existing.filter(r => !(r.userId === data.userId && r.emoji === data.emoji)) };
          }
          return m;
        }));
      });

      // Типинг индикаторы
      newSocket.on('user_typing', (data: { chatId: number, userId: number }) => {
        setTypingUsers(prev => {
          const arr = new Set(prev[data.chatId] || []);
          arr.add(data.userId);
          return { ...prev, [data.chatId]: Array.from(arr) };
        });
      });

      newSocket.on('user_stop_typing', (data: { chatId: number, userId: number }) => {
        setTypingUsers(prev => {
          const list = (prev[data.chatId] || []).filter(id => id !== data.userId);
          return { ...prev, [data.chatId]: list };
        });
      });

      // Read receipts
      newSocket.on('read_receipt', (data: { chatId: number, userId: number, timestamp: string }) => {
        console.log('📗 Read receipt', data);
        // if server notifies this user that messages were read, clear unread for that chat
        try {
          if (data.userId === user.id) {
            setChats(prev => prev.map(c => c.id === data.chatId ? { ...c, unreadCount: 0 } : c));
          }
        } catch (e) { /* ignore */ }
      });

      // 🆕 ПОЛУЧЕНИЕ НОВЫХ ГРУПП
      newSocket.on('new_group', (newGroup: Chat) => {
        console.log('🆕 Received new group:', newGroup);
        setChats(prev => {
          // Проверяем нет ли уже такой группы
          const exists = prev.find(chat => chat.id === newGroup.id);
          if (!exists) {
            return [newGroup, ...prev];
          }
          return prev;
        });
      });

      // 🆕 ПОЛУЧЕНИЕ НОВЫХ КАНАЛОВ
      newSocket.on('new_channel', (newChannel: Chat) => {
        console.log('🆕 Received new channel:', newChannel);
        setChats(prev => {
          const exists = prev.find(chat => chat.id === newChannel.id);
          if (!exists) return [newChannel, ...prev];
          return prev;
        });
      });

      // 🔄 ОБНОВЛЕНИЕ СПИСКА ЧАТОВ
      newSocket.on('update_chats', () => {
        console.log('🔄 Updating chats list');
        newSocket.emit('get_chats', user.id);
      });

      // 📋 ПОЛУЧЕНИЕ СПИСКА ЧАТОВ
      newSocket.on('chats_list', (chatsData: Chat[]) => {
        console.log('📋 Received chats list:', chatsData.length, 'chats');
        // apply persisted muted flags
        try {
          const raw = typeof window !== 'undefined' && typeof localStorage !== 'undefined' ? localStorage.getItem('krx_muted_chats') : null;
          const mutedIds: number[] = raw ? JSON.parse(raw) : [];
          const mapped = chatsData.map(c => ({ ...c, muted: mutedIds.includes(c.id) }));
          setChats(mapped);
        } catch (e) {
          setChats(chatsData);
        }
      });

      // 💬 ПОЛУЧЕНИЕ ИСТОРИИ СООБЩЕНИЙ
      newSocket.on('messages_history', (data: { chatId: number, messages: Message[] }) => {
        if (currentChat && data.chatId === currentChat.id) {
          console.log('💬 Received messages history:', data.messages.length, 'messages');
           const normalized = data.messages.map(normalizeMessage);
           setMessages(normalized);
        }
      });

  setSocket(newSocket);
      loadChats(); // Дублируем загрузку через REST API

      return () => {
        newSocket.disconnect();
      };
    }
  }, [user, currentChat]);

  // Simple WebAudio beep for notification sound (short beep)
  const playNotificationSound = () => {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.value = 880; // A5
      g.gain.value = 0.0015; // low volume
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => {
        o.stop();
        try { ctx.close(); } catch (e) { /* ignore */ }
      }, 120);
    } catch (e) {
      // ignore
    }
  };

  const toggleNotify = (enabled?: boolean) => {
    const next = typeof enabled === 'boolean' ? enabled : !notifyEnabled;
    setNotifyEnabled(next);
    try {
      if (typeof window !== 'undefined') localStorage.setItem('krx_notify_enabled', JSON.stringify(next));
    } catch (e) {}
    if (next && typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      try { Notification.requestPermission(); } catch (e) { /* ignore */ }
    }
  };

  const toggleSound = (enabled?: boolean) => {
    const next = typeof enabled === 'boolean' ? enabled : !soundEnabled;
    setSoundEnabled(next);
    try { if (typeof window !== 'undefined') localStorage.setItem('krx_sound_enabled', JSON.stringify(next)); } catch (e) {}
  };

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const newMode = !prev;
      localStorage.setItem('theme', newMode ? 'dark' : 'light');
      return newMode;
    });
  };

  // Проверка состояния разрешений для уведомлений
  const checkNotificationPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission === 'granted';
    }
    return false;
  };

  // Загрузка чатов через REST API
  const loadChats = async () => {
    if (!user) return;
    
    try {
      const response = await fetch(`http://localhost:5001/api/chats?userId=${user.id}`);
      if (response.ok) {
        const chatsData = await response.json();
        setChats(chatsData);
        console.log('✅ Loaded chats via REST:', chatsData.length);
      }
    } catch (error) {
      console.error('❌ Error loading chats:', error);
    }
  };

  // Загрузка сообщений
  const loadMessages = async (chatId: number) => {
    if (!user) return;
    
    try {
      const response = await fetch(`http://localhost:5001/api/messages?chatId=${chatId}&userId=${user.id}`);
      if (response.ok) {
        const messagesData = await response.json();
        // For each message fetch reactions (small optimization: parallel requests)
        const messagesWithReactions = await Promise.all(messagesData.map(async (m: any) => {
          // normalize server shape first
          const normalized = normalizeMessage(m);
          try {
            const r = await fetch(`http://localhost:5001/api/messages/${m.id}/reactions`);
            if (r.ok) {
              const reactions = await r.json();
              return { ...normalized, reactions };
            }
          } catch (err) {
            // ignore
          }
          return { ...normalized, reactions: [] };
        }));

        setMessages(messagesWithReactions);
        console.log('✅ Loaded messages:', messagesData.length);
        
        // Также запрашиваем через socket для real-time
        if (socket) {
          socket.emit('get_messages', { chatId, userId: user.id });
        }
      }
    } catch (error) {
      console.error('❌ Error loading messages:', error);
    }
  };

  const toggleMute = (chatId: number) => {
    setChats(prev => {
      const updated = prev.map(c => c.id === chatId ? { ...c, muted: !c.muted } : c);
      try {
        const mutedIds = updated.filter(c => c.muted).map(c => c.id);
        if (typeof window !== 'undefined') localStorage.setItem('krx_muted_chats', JSON.stringify(mutedIds));
      } catch (e) {
        // ignore
      }
      return updated;
    });
  };

  // Apply theme on initialization
  useEffect(() => {
    document.body.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return (
    <AppContext.Provider value={{ 
      user, 
      setUser, 
      socket, 
      darkMode, 
      toggleDarkMode,
      chats,
      setChats,
      currentChat,
      setCurrentChat,
      messages,
      setMessages,
      toggleMute,
      notifyEnabled,
      toggleNotify,
      soundEnabled,
      toggleSound,
      typingUsers,
      loadChats,
      loadMessages,
      sendMessage,
      checkBlockStatus,
      blockedUsers,
      refreshBlockedUsers
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};