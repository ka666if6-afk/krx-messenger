export interface User {
  id: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  isOnline?: boolean;
  lastSeen?: string;
  email?: string;
  blocked?: boolean; // Whether this user is blocked by the current user
}

export interface Chat {
  id: number;
  type: 'direct' | 'group' | 'channel';
  name: string;
  description?: string;
  avatarUrl?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  lastMessageSender?: string;
  unreadCount: number;
  muted?: boolean; // client-side mute setting
  role?: string;
  otherUser?: User; // Для личных чатов
  postsRestricted?: boolean; // Only admins can post
  commentsEnabled?: boolean; // For channels - can users comment on posts
}

export type EmojiType = '👍' | '❤️' | '😄' | '😮' | '😢' | '👏';

export type Reaction = {
  id: number;
  userId: number;
  userName: string;
  avatarUrl?: string;
  emoji: EmojiType;
  createdAt: string;
};

export interface Message {
  id: number;
  chatId: number;
  senderId: number;
  content: string;
  messageType: string;
  isRead: boolean;
  timestamp: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
  reactions?: Reaction[];
  duration?: number; // seconds for audio messages
}

export interface CreateGroupData {
  name: string;
  description: string;
  members: number[];
}