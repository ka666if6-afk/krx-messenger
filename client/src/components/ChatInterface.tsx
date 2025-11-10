import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Chat, Message, EmojiType } from '../types/types';
import { ChatList } from './ChatList';
import { UserSearch } from './UserSearch';
import { CreateGroupModal } from './CreateGroupModal';
import ProfileModal from './ProfileModal';
import { UserProfileSidebar } from './UserProfileSidebar';
import { MessageIcon } from './icons/MessageIcon';
import { ProfileIcon, ThemeIcon, AttachmentIcon, SendIcon, MicrophoneIcon, SettingsIcon } from './icons/InterfaceIcons';
import SettingsModal from './SettingsModal';

export const ChatInterface: React.FC = () => {
  const { 
    user, 
    setUser,
    socket, 
    darkMode, 
    toggleDarkMode,
    chats,
    currentChat,
    setCurrentChat,
    setChats,
    messages,
    setMessages,
    sendMessage,
    loadMessages,
    loadChats,
    toggleMute,
    typingUsers 
  } = useApp();
  
  const { t } = useLanguage();
  
  const [newMessage, setNewMessage] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showCreateChannel, setShowCreateChannel] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [isNewChatMenuOpen, setIsNewChatMenuOpen] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [openEmojiPickerFor, setOpenEmojiPickerFor] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const recordingTimerRef = useRef<number | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState<number>(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [audioErrorIds, setAudioErrorIds] = useState<number[]>([]);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [groupPostsRestricted, setGroupPostsRestricted] = useState<boolean>(false);
  const [commentsEnabled, setCommentsEnabled] = useState<boolean>(true);
  const [groupNameEdit, setGroupNameEdit] = useState<string>('');
  const [groupAvatarFile, setGroupAvatarFile] = useState<File | null>(null);
  const [channelIdEdit, setChannelIdEdit] = useState<string>('');
  const [isUpdatingChannel, setIsUpdatingChannel] = useState<boolean>(false);
  // Context menu state for messages
  const [contextMenu, setContextMenu] = useState<{ visible: boolean; x: number; y: number; messageId?: number | null }>({ visible: false, x: 0, y: 0, messageId: null });
  const [showForwardPicker, setShowForwardPicker] = useState(false);
  const [forwardingMessageId, setForwardingMessageId] = useState<number | null>(null);
  const [pinnedMessageId, setPinnedMessageId] = useState<number | null>(null);
  const contextMenuRef = useRef<HTMLDivElement | null>(null);
  const menuButtonRef = useRef<HTMLButtonElement | null>(null);

  // Автоскролл к новым сообщениям
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Загрузка сообщений при смене чата
  useEffect(() => {
    if (currentChat && user) {
      loadMessages(currentChat.id);
    } else {
      setMessages([]);
    }
  }, [currentChat, user]);

  const handleUserSelect = async (selectedUser: any) => {
    if (!user) return;
    
    try {
      const response = await fetch('http://localhost:5001/api/direct-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          otherUserId: selectedUser.id
        })
      });
      
      if (response.ok) {
        const chat = await response.json();
        setCurrentChat(chat);
        loadChats();
        setShowUserSearch(false);
      }
    } catch (error) {
      console.error('Error creating direct chat:', error);
    }
  };

  const handleChatSelect = (chat: Chat) => {
    setCurrentChat(chat);
    // mark as read locally
    if (setChats) {
      setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: 0 } : c));
    }
    // notify server we read messages (optional)
    if (socket && user) {
      try { socket.emit('mark_read', { chatId: chat.id, userId: user.id }); } catch(e){}
    }
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newMessage.trim() || !currentChat || !user) return;

    // Check channel restrictions
    if (currentChat.type === 'channel') {
      const isAdmin = currentChat.role === 'admin';
      const isComment = false; // TODO: Add comment UI and logic
      
      if (!isAdmin && !isComment) {
        alert('Only admins can post in channels');
        return;
      }

      if (isComment && !commentsEnabled) {
        alert('Comments are disabled in this channel');
        return;
      }
    }

    // Используем новую функцию sendMessage из контекста
    sendMessage(newMessage, currentChat.id);
    setNewMessage('');

    // stop typing after send
    if (socket && user) socket.emit('stop_typing', { chatId: currentChat.id, userId: user.id });
  };

  const uploadFileAndSend = async (file: File) => {
    if (!user || !currentChat) return;
    setUploadError(null);
    setIsUploading(true);
    setUploadProgress(0);

    // Use XHR to get progress events
    const form = new FormData();
    form.append('file', file);

    try {
      const uploadUrl = 'http://localhost:5001/api/upload-media';
      const result = await new Promise<{ url: string; originalName?: string; mimeType?: string }>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadUrl, true);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
          }
        };

        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                const json = JSON.parse(xhr.responseText);
                resolve(json);
              } catch (err) {
                reject(new Error('Invalid JSON from upload'));
              }
            } else {
              reject(new Error(`Upload failed with status ${xhr.status}`));
            }
          }
        };

        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(form);
      });

      const url = `http://localhost:5001${result.url}`;

      // Determine type
      const mime = file.type || '';
      let messageType = 'file';
      if (mime.startsWith('image/')) messageType = 'image';
      else if (mime.startsWith('video/')) messageType = 'video';
      else if (mime.startsWith('audio/')) messageType = 'audio';

      sendMessage(url, currentChat.id, messageType);
    } catch (err: any) {
      console.error('Upload error', err);
      setUploadError(err?.message || 'Upload failed');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      // cleanup preview after a short delay so user sees result
      setTimeout(() => {
        setSelectedFile(null);
        setPreviewUrl(null);
      }, 800);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      // If it's an image, create preview
      if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }

      // start upload immediately and show progress
      uploadFileAndSend(file);
    }
    e.currentTarget.value = '';
  };

  // Revoke preview URL when changed
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  // Socket listeners for member/setting updates
  useEffect(() => {
    if (!socket) return;
    socket.on('member_role_updated', (data: any) => {
      if (!currentChat) return;
      if (Number(data.chatId) === Number(currentChat.id)) {
        fetchGroupMembers();
      }
    });

    socket.on('chat_settings_updated', (data: any) => {
      if (!currentChat) return;
      if (Number(data.chatId) === Number(currentChat.id)) {
        if (typeof data.postsRestricted !== 'undefined') {
          setGroupPostsRestricted(!!data.postsRestricted);
        }
        if (typeof data.commentsEnabled !== 'undefined') {
          setCommentsEnabled(!!data.commentsEnabled);
        }
      }
    });

    return () => {
      socket.off('member_role_updated');
      socket.off('chat_settings_updated');
    };
  }, [socket, currentChat]);

  const fetchGroupMembers = async () => {
    if (!currentChat) return;
    try {
      const res = await fetch(`http://localhost:5001/api/chats/${currentChat.id}/members`);
      if (res.ok) {
        const data = await res.json();
        // normalize avatar urls
        const normalized = data.map((m: any) => ({
          ...m,
          avatarUrl: m.avatarUrl ? (m.avatarUrl.startsWith('/') ? `http://localhost:5001${m.avatarUrl}` : m.avatarUrl) : null
        }));
        setGroupMembers(normalized);
      }
    } catch (err) {
      console.error('Error fetching group members', err);
    }
  };

  const fetchChatInfo = async () => {
    if (!currentChat) return;
    try {
      const res = await fetch(`http://localhost:5001/api/chats/${currentChat.id}`);
      if (res.ok) {
        const data = await res.json();
        setGroupPostsRestricted(!!data.posts_restricted);
        setCommentsEnabled(data.comments_enabled !== false);
        setGroupNameEdit(data.name || '');
        if (currentChat.type === 'channel') {
          setChannelIdEdit(data.channel_id || String(currentChat.id));
        }
      }
    } catch (err) {
      console.error('Error fetching chat info', err);
    }
  };

  const openGroupSettings = async () => {
    await fetchChatInfo();
    await fetchGroupMembers();
    setShowGroupSettings(true);
  };

  // Load pinned message for current chat from localStorage
  useEffect(() => {
    if (!currentChat) {
      setPinnedMessageId(null);
      return;
    }
    try {
      const key = `pinned_chat_${currentChat.id}`;
      const pid = localStorage.getItem(key);
      setPinnedMessageId(pid ? Number(pid) : null);
    } catch (err) {
      console.error('Error loading pinned message', err);
    }
  }, [currentChat]);

  // Close context menu on global click unless clicking inside the menu or on the menu button
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      if (!target) return setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
      if (contextMenuRef.current && contextMenuRef.current.contains(target)) return;
      if (target.closest && target.closest('.msg-menu-button')) return;
      setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  // Handle server broadcasted deletion
  useEffect(() => {
    if (!socket) return;
    socket.on('message_deleted', (data: any) => {
      const { messageId, chatId } = data || {};
      if (!messageId) return;
      setMessages(messages.filter((m: any) => Number(m.id) !== Number(messageId)));
    });
    return () => { socket.off('message_deleted'); };
  }, [socket]);

  const handleAddMember = async (u: any) => {
    if (!currentChat) return;
    try {
      const res = await fetch(`http://localhost:5001/api/chats/${currentChat.id}/add-members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: [u.id] })
      });
      if (res.ok) {
        fetchGroupMembers();
      }
    } catch (err) {
      console.error('Error adding member', err);
    }
  };

  const handleToggleAdmin = async (memberId: number, makeAdmin: boolean) => {
    if (!currentChat) return;
    try {
      const res = await fetch(`http://localhost:5001/api/chats/${currentChat.id}/set-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberId, makeAdmin })
      });
      if (res.ok) fetchGroupMembers();
    } catch (err) { console.error('Error setting admin', err); }
  };

  const handleTogglePostsRestricted = async () => {
    if (!currentChat) return;
    try {
      const newVal = !groupPostsRestricted;
      const res = await fetch(`http://localhost:5001/api/chats/${currentChat.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postsRestricted: newVal })
      });
      if (res.ok) setGroupPostsRestricted(newVal);
    } catch (err) { console.error('Error updating settings', err); }
  };

  const handleGroupAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setGroupAvatarFile(f);
  };

  const handleUpdateChannelId = async () => {
    if (!currentChat || !channelIdEdit || isUpdatingChannel) return;
    
    try {
      setIsUpdatingChannel(true);
      const res = await fetch(`http://localhost:5001/api/chats/${currentChat.id}/update-id`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newId: channelIdEdit,
          userId: user?.id
        })
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to update channel ID');
        return;
      }

      loadChats(); // Refresh chat list
      alert('Channel ID updated successfully');
    } catch (err) {
      console.error('Error updating channel ID:', err);
      alert('Failed to update channel ID');
    } finally {
      setIsUpdatingChannel(false);
    }
  };

  const handleUpdateChannelName = async () => {
    if (!currentChat || !groupNameEdit || isUpdatingChannel) return;
    
    try {
      setIsUpdatingChannel(true);
      const res = await fetch(`http://localhost:5001/api/chats/${currentChat.id}/edit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: groupNameEdit,
          userId: user?.id
        })
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.message || 'Failed to update channel name');
        return;
      }

      loadChats(); // Refresh chat list
      alert('Channel name updated successfully');
    } catch (err) {
      console.error('Error updating channel name:', err);
      alert('Failed to update channel name');
    } finally {
      setIsUpdatingChannel(false);
    }
  };

  const handleToggleCommentsEnabled = async (enabled: boolean) => {
    if (!currentChat) return;
    try {
      const res = await fetch(`http://localhost:5001/api/chats/${currentChat.id}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          commentsEnabled: enabled,
          userId: user?.id
        })
      });
      if (res.ok) {
        setCommentsEnabled(enabled);
      }
    } catch (err) { console.error('Error updating channel settings', err); }
  };

  const saveGroupEdits = async () => {
    if (!currentChat) return;
    try {
      const form = new FormData();
      form.append('name', groupNameEdit);
      if (groupAvatarFile) form.append('avatar', groupAvatarFile);
      const res = await fetch(`http://localhost:5001/api/chats/${currentChat.id}/edit`, {
        method: 'POST',
        body: form
      });
      if (res.ok) {
        // refresh chats and members
        loadChats();
        fetchGroupMembers();
        setShowGroupSettings(false);
      }
    } catch (err) { console.error('Error saving group edits', err); }
  };

  const startRecording = async () => {
    if (!navigator.mediaDevices) return alert('Media devices not supported');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStreamRef.current = stream;
      const mr = new MediaRecorder(stream);
      mediaRecorderRef.current = mr;
      chunksRef.current = [];

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      mr.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
          await uploadFileAndSend(file);
        } catch (err) {
          console.error('Error processing recorded audio', err);
        } finally {
          // Release mic tracks
          if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(t => t.stop());
            micStreamRef.current = null;
          }
        }
      };

      mr.start();
      setIsRecording(true);
      // start timer
      setRecordingSeconds(0);
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds(s => s + 1);
      }, 1000) as unknown as number;
    } catch (err) {
      console.error('Recording error', err);
    }
  };

  const openUserProfile = (userId: number) => {
    setProfileUserId(userId);
    setShowUserProfile(true);
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    // stop timer
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setRecordingSeconds(0);
  };

  // cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        window.clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    };
  }, []);

  // Close new chat menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const menu = document.getElementById('new-chat-menu');
      const button = document.getElementById('new-chat-button');
      if (menu && button && !menu.contains(event.target as Node) && !button.contains(event.target as Node)) {
        setIsNewChatMenuOpen(false);
      }
    };

    if (isNewChatMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [isNewChatMenuOpen]);

  // Простая коллекция эмодзи для picker'а
  const EMOJI_LIST = ['�','❤️','�'] as const;

  // Typing debounce
  let typingTimeout: any = null;
  const onInputChange = (value: string) => {
    setNewMessage(value);
    if (!socket || !user || !currentChat) return;
    socket.emit('typing', { chatId: currentChat.id, userId: user.id });
    if (typingTimeout) clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
      socket.emit('stop_typing', { chatId: currentChat.id, userId: user.id });
    }, 2000);
  };

  const toggleReaction = async (messageId: number, emoji: EmojiType) => {
    if (!user) return;

    // Check if user has already reacted with this emoji
    const msg = messages.find(m => m.id === messageId);
    const userReacted = msg?.reactions?.some(r => r.userId === user.id && r.emoji === emoji);

    try {
      if (userReacted) {
        // Удаляем реакцию
        await fetch(`http://localhost:5001/api/messages/${messageId}/reactions`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, emoji })
        });

        // Оптимистически обновляем UI
  const removed = messages.map((m: Message) => m.id === messageId ? { ...m, reactions: (m.reactions || []).filter((r: any) => !(r.userId === user.id && r.emoji === emoji)) } : m);
  setMessages(removed);
      } else {
        // Добавляем реакцию
        await fetch(`http://localhost:5001/api/messages/${messageId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, emoji })
        });

  const added = messages.map((m: Message) => m.id === messageId ? { ...m, reactions: [...(m.reactions || []), { id: Date.now(), userId: user.id, userName: user.displayName, avatarUrl: user.avatarUrl, emoji, createdAt: new Date().toISOString() }] } : m);
  setMessages(added);
      }

    } catch (err) {
      console.error('Reaction error', err);
    } finally {
      setOpenEmojiPickerFor(null);
    }
  };

  // Context menu actions
  const openMessageContextMenu = (e: React.MouseEvent, messageId: number) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ visible: true, x: e.clientX, y: e.clientY, messageId });
  };

  const handleDeleteMessage = async (messageId: number, forEveryone: boolean) => {
    if (!user) return;
    try {
      if (!forEveryone) {
        // Delete for me: local-only removal from UI
        setMessages(messages.filter((m: any) => Number(m.id) !== Number(messageId)));
        setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
        return;
      }

      const res = await fetch(`http://localhost:5001/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, forEveryone })
      });

      if (res.ok) {
        // Update local messages optimistically (server will broadcast deletion as well)
        setMessages(messages.filter((m: any) => Number(m.id) !== Number(messageId)));
        if (socket) socket.emit('delete_message', { messageId, forEveryone });
      } else {
        const text = await res.text();
        console.error('Failed to delete message', text);
        alert('Failed to delete message: ' + text);
      }
    } catch (err) {
      console.error('Delete error', err);
    } finally {
      setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
    }
  };

  const handleForwardOpen = (messageId: number) => {
    setForwardingMessageId(messageId);
    setShowForwardPicker(true);
    setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
  };

  const handleForwardToUser = async (selectedUser: any) => {
    if (!user || !forwardingMessageId) return;
    // Find message to forward
    const msg = messages.find(m => Number(m.id) === Number(forwardingMessageId));
    if (!msg) return;
    try {
      // Ensure direct chat exists (reuse handleUserSelect logic)
      const response = await fetch('http://localhost:5001/api/direct-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, otherUserId: selectedUser.id })
      });
      if (!response.ok) throw new Error('Failed to get/create chat');
      const chat = await response.json();
      // send forwarded message content to that chat
      // prefix with original author
      const contentPrefix = msg.displayName ? `${msg.displayName}: ` : '';
      const sendContent = msg.messageType === 'text' ? `${contentPrefix}${msg.content}` : msg.content;
      sendMessage(sendContent, chat.id, msg.messageType);
      setShowForwardPicker(false);
      setForwardingMessageId(null);
    } catch (err) {
      console.error('Forward error', err);
    }
  };

  const handleCopyMessage = (messageId: number) => {
    const msg = messages.find(m => Number(m.id) === Number(messageId));
    if (!msg) return;
    const toCopy = msg.messageType === 'text' ? msg.content : msg.content || '';
    if (navigator.clipboard && toCopy) {
      navigator.clipboard.writeText(toCopy).catch(err => console.error('Copy failed', err));
    }
    setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
  };

  const handleTogglePin = (messageId: number) => {
    if (!currentChat) return;
    const key = `pinned_chat_${currentChat.id}`;
    if (pinnedMessageId === messageId) {
      localStorage.removeItem(key);
      setPinnedMessageId(null);
    } else {
      localStorage.setItem(key, String(messageId));
      setPinnedMessageId(messageId);
    }
    setContextMenu({ visible: false, x: 0, y: 0, messageId: null });
  };

  const createGroup = async (groupData: any) => {
    try {
      const response = await fetch('http://localhost:5001/api/create-group', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...groupData,
          createdBy: user?.id
        })
      });

      if (response.ok) {
        const newGroup = await response.json();
        // Группа автоматически добавится через socket событие
        setShowCreateGroup(false);
      }
    } catch (error) {
      console.error('Error creating group:', error);
    }
  };

  const createChannel = async (channelData: any) => {
    try {
      const form = new FormData();
      form.append('name', channelData.name);
      form.append('description', channelData.description || '');
      form.append('createdBy', String(user?.id));
      form.append('members', JSON.stringify(channelData.members || []));
  if (channelData.channelId) form.append('channelId', channelData.channelId);

      const response = await fetch('http://localhost:5001/api/create-channel', {
        method: 'POST',
        body: form
      });

      const payload = await response.json().catch(() => null);
      if (response.ok) {
        const newChannel = payload;
        setShowCreateChannel(false);
        // Channel will usually be added via socket event; refresh as fallback
        loadChats();
        return newChannel;
      } else {
        // Surface server error to caller (modal) by throwing — modal will display inline
        const message = payload && (payload.error || payload.message) ? (payload.error || payload.message) : `Channel creation failed (status ${response.status})`;
        console.error('Create channel error:', message, payload);
        throw new Error(message);
      }
    } catch (error) {
      console.error('Error creating channel:', error);
      // rethrow so caller (modal) can show inline error
      throw error;
    }
  };

  const updateProfile = async (updates: { displayName: string; bio: string }) => {
    if (!user) return;

    try {
      const response = await fetch(`http://localhost:5001/api/users/${user.id}/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          ...updates
        })
      });

      if (response.ok) {
        const data = await response.json();
        // Обновляем локального пользователя с новыми данными
        setUser(user ? {
          ...user,
          displayName: data.displayName,
          bio: data.bio
        } : null);

        // Обновляем список чатов чтобы отобразить новое имя везде
        loadChats();
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      alert(error.message || 'Failed to update profile');
    }
  };

  const updateAvatar = (avatarUrl: string) => {
    console.log('New avatar:', avatarUrl);
    // Update context user so UI reflects new avatar
    if (setUser) {
      setUser(user ? { ...user, avatarUrl } : null);
    }
    // Refresh chats to update any avatar displayed in chat list/header
    loadChats();
  };

  return (
    <div className="flex h-screen bg-white dark:bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <MessageIcon className="w-6 h-6 mr-2 text-blue-500" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">KRX Messenger</h1>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowProfile(true)}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Profile"
              >
                <ProfileIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title="Toggle theme"
              >
                <ThemeIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
              </button>
            </div>
          </div>
        </div>
        
        {/* Список чатов */}
        <div className="flex-1 overflow-y-auto">
          <ChatList 
            chats={chats} 
            onChatSelect={handleChatSelect}
            currentChat={currentChat}
          />
        </div>

        {/* Bottom buttons */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex justify-center items-center space-x-4">
            <div className="relative">
              <button
                id="new-chat-button"
                onClick={() => setIsNewChatMenuOpen(!isNewChatMenuOpen)}
                className="w-10 h-10 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded-full transition-colors"
                title={t('newChat')}
              >
                <svg 
                  className="w-5 h-5"
                  viewBox="0 0 24 24" 
                  fill="none" 
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path 
                    d="M12 5V19M5 12H19" 
                    stroke="currentColor"
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  />
                </svg>
              </button>

              {isNewChatMenuOpen && (
                <div 
                  id="new-chat-menu" 
                  className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50"
                >
                  <button
                    onClick={() => {
                      setShowUserSearch(true);
                      setIsNewChatMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t('newChat')}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateGroup(true);
                      setIsNewChatMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t('newGroup')}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateChannel(true);
                      setIsNewChatMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t('newChannel')}
                  </button>
                </div>
              )}
            </div>
            
            <button
              onClick={() => setShowSettings(true)}
              className="w-10 h-10 flex items-center justify-center bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-full transition-colors"
              title={t('settings')}
            >
              <SettingsIcon className="w-5 h-5" />
            </button>

            <div className="relative">
              {isNewChatMenuOpen && (
                <div id="new-chat-menu" className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg py-1 z-50">
                  <button
                    onClick={() => {
                      setShowUserSearch(true);
                      setIsNewChatMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t('newChat')}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateGroup(true);
                      setIsNewChatMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t('newGroup')}
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateChannel(true);
                      setIsNewChatMenuOpen(false);
                    }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  >
                    {t('newChannel')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {currentChat ? (
          <>
            {/* Chat header */}
<div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
  <div className="flex items-center space-x-3">
    <div 
      className={`w-12 h-12 rounded-full flex items-center justify-center cursor-pointer hover:opacity-90 ${
        currentChat?.type === 'direct' ? 'bg-gray-300 dark:bg-gray-600' : 'bg-green-500'
      }`}
      onClick={() => {
        if (currentChat.type === 'direct' && currentChat.otherUser?.id) {
          setProfileUserId(currentChat.otherUser.id);
          setShowUserProfile(true);
        }
      }}
    >
      {currentChat?.avatarUrl ? (
        <img 
          src={`http://localhost:5001${currentChat.avatarUrl}`} 
          alt={currentChat?.name || 'Chat'}
          className="w-12 h-12 rounded-full"
        />
      ) : (
        <span className={`font-medium text-lg ${
          currentChat?.type === 'direct' 
            ? 'text-gray-600 dark:text-gray-300' 
            : 'text-white'
        }`}>
          {currentChat?.name?.[0]?.toUpperCase() || '?'}
        </span>
      )}
    </div>
    <div className="flex-1">
      <h2 className="font-semibold text-gray-900 dark:text-white text-lg">
        {currentChat?.name || 'Unknown Chat'}
      </h2>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        {currentChat?.type === 'direct' ? (
          // Show typing indicator if other user(s) (not current user) are typing; otherwise show presence (online / recent / long-ago)
          (() => {
            // Convert array-like object to array and filter out current user
            const otherTypingUsers = Object.keys(typingUsers).length > 0 && currentChat.id in typingUsers
              ? (typingUsers[currentChat.id] || []).filter(id => id !== user?.id)
              : [];
            
            if (otherTypingUsers.length > 0) {
              return (
                <span className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <span>печатает</span>
                  <span className="inline-flex items-center ml-2 space-x-1">
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0s' }} />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 bg-current rounded-full animate-pulse" style={{ animationDelay: '0.3s' }} />
                  </span>
                </span>
              );
            }

            const other = currentChat.otherUser;
            if (other?.isOnline) {
              return <span className="text-green-500">в сети</span>;
            }
            
            // If we have lastSeen, decide between recent vs long ago (threshold: 30 days)
            if (other?.lastSeen) {
              try {
                const last = new Date(other.lastSeen).getTime();
                const timeDiff = Date.now() - last;
                // Convert to days
                const days = timeDiff / (1000 * 60 * 60 * 24);
                
                if (days <= 0) return 'был недавно';
                return days > 30 ? 'был давно' : 'был недавно';
              } catch (e) {
                console.error('Error parsing lastSeen:', e);
                return 'был недавно';
              }
            }
            // Default if no lastSeen
            return 'был недавно';
          })()
        ) : (
          (currentChat?.description || `Group • ${chats.find(c => c.id === currentChat?.id)?.role === 'admin' ? 'Admin' : 'Member'}`)
        )}
      </p>
      {/* Group settings button */}
      {currentChat?.type === 'group' && (
        <div className="mt-1">
          <button
            onClick={openGroupSettings}
            className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-gray-700 dark:text-gray-200"
          >
            Group Settings ⚙️
          </button>
        </div>
      )}
      
    </div>
  </div>
</div>

            {/* Сообщения */}
            <div className={`flex-1 overflow-y-auto p-6 ${darkMode ? 'chat-bg-dark chat-pattern-dark' : 'chat-bg-light chat-pattern-light'}`}>
              {messages.length > 0 ? (
                <div className="space-y-4">
                  {/* Pinned message banner */}
                  {pinnedMessageId && messages.some(m => Number(m.id) === Number(pinnedMessageId)) && (
                    (() => {
                      const pm = messages.find(m => Number(m.id) === Number(pinnedMessageId));
                      return pm ? (
                        <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900 border-l-4 border-yellow-400 rounded">
                          <div className="text-xs text-yellow-700 dark:text-yellow-200 font-medium">Pinned</div>
                          <div className="text-sm mt-1">{pm.messageType === 'text' ? pm.content : pm.content}</div>
                        </div>
                      ) : null;
                    })()
                  )}

                  {messages.map((message) => {
                    const isOwnMessage = Number(message.senderId) === Number(user?.id);
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                      >
                          <div className={`max-w-xs lg:max-w-md ${isOwnMessage ? 'items-end' : 'items-start'} group relative`}> 
                          
                          {/* Имя отправителя для ЧУЖИХ сообщений (слева) */}
                          {!isOwnMessage && (
                            <div className="flex items-center space-x-2 mb-1">
                              <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center flex-shrink-0">
                                {message.avatarUrl ? (
                                  <img 
                                      src={`http://localhost:5001${message.avatarUrl}`} 
                                      alt={message.displayName}
                                      className="w-8 h-8 rounded-full cursor-pointer"
                                      onClick={() => openUserProfile(Number(message.senderId))}
                                    />
                                ) : (
                                  <span className="text-xs text-gray-600 dark:text-gray-300">
                                    {message.displayName[0].toUpperCase()}
                                  </span>
                                )}
                              </div>
                              <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
                                {message.displayName}
                              </span>
                            </div>
                          )}
                          
                          {/* "Пузырек" сообщения */}
                          <div
                            className={`px-4 py-3 rounded-2xl ${
                              isOwnMessage
                                ? 'bg-blue-500 text-white rounded-br-none'
                                : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-bl-none shadow-sm'
                            }`}
                          >
                            {message.messageType === 'image' ? (
                              <img src={message.content} alt="image" className="max-w-full rounded" />
                            ) : message.messageType === 'video' ? (
                              <video src={message.content} controls className="max-w-full rounded" />
                            ) : message.messageType === 'audio' ? (
                              <div className="flex items-center space-x-3">
                                <audio
                                  src={message.content}
                                  controls
                                  crossOrigin="anonymous"
                                  onLoadedMetadata={(e) => {
                                    const dur = e.currentTarget.duration;
                                    // Attach duration to message for display
                                    setMessages(messages.map(m => m.id === message.id ? { ...m, duration: dur } : m));
                                  }}
                                  onError={(e) => {
                                    console.error('Audio playback error for message', message.id, e);
                                    setAudioErrorIds(prev => prev.includes(message.id) ? prev : [...prev, message.id]);
                                  }}
                                />
                                <div className="text-xs text-gray-500">
                                  {audioErrorIds.includes(message.id) ? 'Playback error' : (message.duration ? new Date(message.duration * 1000).toISOString().substr(14, 5) : '')}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start">
                                <MessageIcon className={`w-5 h-5 mr-2 ${isOwnMessage ? 'text-blue-100' : 'text-gray-400'}`} />
                                <p className="break-words">{message.content}</p>
                              </div>
                            )}

                            <p className={`text-xs mt-1 ${isOwnMessage ? 'text-blue-100' : 'text-gray-500'}`}>
                              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>

                          {/* Reactions display + emoji picker trigger */}
                          <div className="mt-2 flex items-center space-x-2">
                            <div className="flex items-center space-x-2">
                              {(message.reactions || []).length > 0 ? (
                                // Group by emoji
                                Object.entries((message.reactions || []).reduce((acc: Record<EmojiType, Array<{id: number; userId: number; userName: string; avatarUrl?: string}>>, r) => {
                                  const emoji = r.emoji as EmojiType;
                                  acc[emoji] = acc[emoji] || [];
                                  acc[emoji].push(r);
                                  return acc;
                                }, {} as Record<EmojiType, Array<{id: number; userId: number; userName: string; avatarUrl?: string}>>))
                                .map(([emoji, items]) => {
                                  const count = items.length;
                                  const me = items.some(it => it.userId === user?.id);
                                  
                                  return (
                                    <button
                                      key={emoji}
                                      onClick={() => toggleReaction(message.id, emoji as EmojiType)}
                                      className={`px-2 py-1 rounded-full text-sm flex items-center space-x-1 ${me ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white'}`}
                                    >
                                      <span>{emoji}</span>
                                      <span className="text-xs">{count}</span>
                                    </button>
                                  );
                                })
                              ) : null}
                            </div>

                            <div>
                                <button
                                onClick={() => setOpenEmojiPickerFor(openEmojiPickerFor === message.id ? null : message.id)}
                                className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-xl"
                                title="React"
                              >
                                ❤️
                              </button>
                              {openEmojiPickerFor === message.id && (
                                <div className="absolute z-50 mt-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-2 shadow-lg">
                                  <div className="grid grid-cols-3 gap-2">
                                    {EMOJI_LIST.map((emoji) => (
                                        <button
                                          key={emoji}
                                          onClick={() => toggleReaction(message.id, emoji)}
                                          className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xl"
                                        >
                                          {emoji}
                                        </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Hover menu button (three dots) - visible on hover */}
                          <div className="absolute top-0 right-0 mt-1 mr-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              ref={menuButtonRef}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                // position menu near button
                                const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                                setContextMenu({ visible: true, x: Math.round(rect.left), y: Math.round(rect.bottom + 6), messageId: message.id });
                              }}
                              className="p-1 rounded-full bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-sm msg-menu-button"
                              title="More"
                            >
                              ⋯
                            </button>
                          </div>

                          {/* Имя отправителя для СВОИХ сообщений (справа) */}
                          {isOwnMessage && (
                            <div className="flex items-center justify-end space-x-2 mt-1">
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                You
                              </span>
                              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                                {user?.avatarUrl ? (
                                  <img 
                                    src={`http://localhost:5001${user.avatarUrl}`} 
                                    alt="You"
                                    className="w-8 h-8 rounded-full cursor-pointer"
                                    onClick={() => openUserProfile(Number(user.id))}
                                  />
                                ) : (
                                  <span className="text-xs text-white">
                                    {user?.displayName[0].toUpperCase()}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-4">💬</div>
                    <p className="text-lg font-medium mb-2">No messages yet</p>
                    <p className="text-sm">Send a message to start the conversation</p>
                  </div>
                </div>
              )}
            </div>

            {/* Форма отправки сообщения */}
            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              {/* Preview for selected image/file */}
              {previewUrl || selectedFile ? (
                <div className="mb-3">
                  <div className="flex items-center space-x-3">
                    {previewUrl ? (
                      <img src={previewUrl} alt={selectedFile?.name || 'preview'} className="w-24 h-24 object-cover rounded-md" />
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center bg-gray-100 dark:bg-gray-700 rounded-md text-sm text-gray-700 dark:text-gray-200 px-2 text-center">
                        {selectedFile?.name}
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <div className="text-sm text-gray-700 dark:text-gray-200">{selectedFile?.name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">{selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : ''}</div>
                      </div>

                      {isUploading && (
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                          <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${uploadProgress}%` }} />
                        </div>
                      )}

                      {uploadError && (
                        <div className="text-xs text-red-500 mt-2">{uploadError}</div>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedFile(null);
                          if (previewUrl) {
                            URL.revokeObjectURL(previewUrl);
                            setPreviewUrl(null);
                          }
                        }}
                        className="text-sm text-red-500 hover:underline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="flex space-x-3 items-center">
                <label htmlFor="file-input" className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer inline-flex items-center justify-center">
                  <AttachmentIcon className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                </label>
                {/* Record button */}
                <button
                  type="button"
                  onClick={() => { if (isRecording) stopRecording(); else startRecording(); }}
                  className={`p-2 rounded-full ml-1 inline-flex items-center justify-center ${isRecording ? 'bg-red-500 text-white' : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
                  title={isRecording ? 'Stop recording' : 'Record voice message'}
                >
                  <MicrophoneIcon className={`w-5 h-5 ${isRecording ? 'text-white' : 'text-gray-600 dark:text-gray-300'}`} />
                </button>
                {isRecording && (
                  <div className="text-xs text-red-500 ml-2">
                    ⏺ {new Date(recordingSeconds * 1000).toISOString().substr(14, 5)}
                  </div>
                )}
                <input id="file-input" type="file" onChange={handleFileInput} className="hidden" />

                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => onInputChange(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-full bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled={!currentChat}
                />

                <button
                  type="submit"
                  disabled={!newMessage.trim() || !currentChat}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white p-3 rounded-full transition-colors disabled:cursor-not-allowed inline-flex items-center justify-center"
                >
                  <SendIcon className="w-5 h-5 text-white" />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800">
            <div className="text-center max-w-md">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2">Welcome to KRX Messenger</h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Select a conversation from the sidebar or start a new one to begin messaging.
              </p>
              <div className="flex space-x-3 justify-center">
                <button
                  onClick={() => setShowUserSearch(true)}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Start Chat
                </button>
                <button
                  onClick={() => setShowCreateGroup(true)}
                  className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Create Group
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Модальные окна */}
      <SettingsModal
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {showUserSearch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Start New Chat</h2>
                <button
                  onClick={() => setShowUserSearch(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Start a one-on-one chat with someone</p>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
              <UserSearch 
                onUserSelect={handleUserSelect} 
                currentUserId={user?.id || 0} 
              />
            </div>
          </div>
        </div>
      )}

      {showGroupSettings && currentChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-96 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Group Settings</h2>
              <button onClick={() => setShowGroupSettings(false)} className="text-gray-500">✕</button>
            </div>

            <div className="space-y-4">
              <div>
                {/* Per-chat mute control (client-side) */}
                <div className="mb-3">
                  <label className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M15 8v8a3 3 0 01-3 3h-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        <path d="M4 10v4h3l4 4V6L7 10H4z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-sm">Mute notifications</span>
                    </div>
                    <input type="checkbox" checked={!!currentChat.muted} onChange={() => toggleMute(currentChat.id)} />
                  </label>
                </div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  {currentChat?.type === 'channel' ? 'Channel Name' : 'Group Name'}
                </label>
                <input value={groupNameEdit} onChange={(e) => setGroupNameEdit(e.target.value)} className="w-full p-2 border rounded" />
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                  {currentChat?.type === 'channel' ? 'Channel Avatar' : 'Group Avatar'}
                </label>
                <input type="file" accept="image/*" onChange={handleGroupAvatarChange} />
              </div>

              {currentChat?.type === 'channel' ? (
                <div className="space-y-6">
                  <div className="space-y-4 border-b border-gray-200 dark:border-gray-700 pb-4">
                    <div className="text-lg font-medium text-gray-900 dark:text-gray-100">Channel Information</div>
                    
                    {/* Channel ID */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Channel ID
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          value={channelIdEdit || currentChat.id}
                          onChange={(e) => setChannelIdEdit(e.target.value)}
                          className="w-full p-2 border rounded bg-gray-50 dark:bg-gray-700"
                          placeholder="e.g., my_channel"
                        />
                        <button
                          onClick={() => handleUpdateChannelId()}
                          className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title="Update Channel ID"
                        >
                          Save ID
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">This will be your channel's unique identifier</p>
                    </div>

                    {/* Channel Name */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Channel Name
                      </label>
                      <div className="flex items-center space-x-2">
                        <input
                          value={groupNameEdit}
                          onChange={(e) => setGroupNameEdit(e.target.value)}
                          className="w-full p-2 border rounded"
                          placeholder="Enter channel name"
                        />
                        <button
                          onClick={() => handleUpdateChannelName()}
                          className="px-3 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title="Update Channel Name"
                        >
                          Save
                        </button>
                      </div>
                    </div>

                    {/* Channel Avatar */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Channel Avatar
                      </label>
                      <div className="flex items-center space-x-4">
                        <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700">
                          {currentChat.avatarUrl ? (
                            <img
                              src={`http://localhost:5001${currentChat.avatarUrl}`}
                              alt="Channel avatar"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400">
                              {currentChat.name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleGroupAvatarChange}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                          />
                          <p className="text-xs text-gray-500 mt-1">Recommended size: 256x256 pixels</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Channel Functionality Settings */}
                  <div className="space-y-4">
                    <div className="text-lg font-medium text-gray-900 dark:text-gray-100">Channel Settings</div>
                    
                    <div className="space-y-3">
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={groupPostsRestricted}
                          disabled
                          className="cursor-not-allowed opacity-50"
                          title="Channel posts are always restricted to admins"
                        />
                        <span className="text-sm opacity-50">Only admins can post (Always enabled for channels)</span>
                      </label>
                      
                      <label className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          checked={commentsEnabled}
                          onChange={(e) => handleToggleCommentsEnabled(e.target.checked)}
                        />
                        <span className="text-sm">Allow comments on posts</span>
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="flex items-center space-x-2">
                    <input type="checkbox" checked={groupPostsRestricted} onChange={handleTogglePostsRestricted} />
                    <span className="text-sm">Only admins can post</span>
                  </label>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-2">Members</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {groupMembers.map(m => (
                    <div key={m.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-200 rounded-full overflow-hidden">
                          {m.avatarUrl ? <img src={m.avatarUrl} className="w-8 h-8 object-cover" /> : <div className="w-8 h-8 flex items-center justify-center">{m.displayName?.[0]}</div>}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{m.displayName}</div>
                          <div className="text-xs text-gray-500">@{m.username}</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button onClick={() => handleToggleAdmin(m.id, m.role !== 'admin')} className={`px-2 py-1 text-xs rounded ${m.role === 'admin' ? 'bg-yellow-100' : 'bg-gray-100'}`}>
                          {m.role === 'admin' ? 'Admin' : 'Make Admin'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">Add member</label>
                <UserSearch onUserSelect={handleAddMember} currentUserId={user?.id || 0} />
              </div>

              <div className="flex space-x-2 pt-4">
                <button onClick={() => setShowGroupSettings(false)} className="flex-1 bg-gray-500 hover:bg-gray-600 text-white p-2 rounded font-medium">Cancel</button>
                <button onClick={saveGroupEdits} className="flex-1 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded font-medium">Save</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Forward picker modal (used when forwarding a message) */}
      {showForwardPicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-96 max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Forward message to...</h2>
              <button onClick={() => { setShowForwardPicker(false); setForwardingMessageId(null); }} className="text-gray-500">✕</button>
            </div>
            <UserSearch onUserSelect={handleForwardToUser} currentUserId={user?.id || 0} />
          </div>
        </div>
      )}

      {/* Context menu */}
      {contextMenu.visible && contextMenu.messageId ? (() => {
        const msg = messages.find(m => Number(m.id) === Number(contextMenu.messageId));
        if (!msg) return null;
          const currentChatObj = currentChat;
          const myChatEntry = chats.find(c => c.id === currentChatObj?.id);
          const isAdmin = myChatEntry?.role === 'admin';
          const canDeleteEveryone = (currentChatObj?.type === 'direct') ? true : (Number(msg.senderId) === Number(user?.id) || isAdmin);
        const isPinned = pinnedMessageId === Number(msg.id);
        return (
          <div ref={contextMenuRef} style={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, zIndex: 60 }}>
            <div className="bg-white dark:bg-gray-800 border rounded shadow-lg w-48 py-1">
              <button onClick={() => handleForwardOpen(msg.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Forward</button>
              <button onClick={() => handleCopyMessage(msg.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Copy</button>
              <button onClick={() => handleTogglePin(msg.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">{isPinned ? 'Unpin' : 'Pin'}</button>
              <div className="border-t mt-1" />
              <button onClick={() => handleDeleteMessage(msg.id, false)} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700">Delete for me</button>
              <button
                onClick={() => {
                  if (!canDeleteEveryone) return alert('You are not allowed to delete for everyone');
                  if (!confirm('Delete this message for everyone?')) return;
                  handleDeleteMessage(msg.id, true);
                }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${!canDeleteEveryone ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                Delete for everyone
              </button>
            </div>
          </div>
        );
      })() : null}

      {user && (
        <>
          <CreateGroupModal
            isOpen={showCreateGroup}
            onClose={() => setShowCreateGroup(false)}
            onCreateGroup={createGroup}
            currentUser={user}
          />

          <CreateGroupModal
            isOpen={showCreateChannel}
            onClose={() => setShowCreateChannel(false)}
            mode="channel"
            onCreateGroup={createChannel}
            currentUser={user}
          />

          <ProfileModal
            isOpen={showProfile}
            onClose={() => setShowProfile(false)}
            user={user}
            onUpdateProfile={updateProfile}
            onAvatarUpdate={updateAvatar}
          />
          <UserProfileSidebar isOpen={showUserProfile} userId={profileUserId} onClose={() => setShowUserProfile(false)} />
        </>
      )}
      {/* User profile sidebar */}
      <UserProfileSidebar
        isOpen={showUserProfile}
        userId={profileUserId}
        onClose={() => {
          setShowUserProfile(false);
          setProfileUserId(null);
        }}
      />
    </div>
  );
};