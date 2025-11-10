import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../contexts/AppContext';
import { Chat, Message } from '../types/types';
import { ChatList } from './ChatList';
import { UserSearch } from './UserSearch';
import { CreateGroupModal } from './CreateGroupModal';
import ProfileModal from './ProfileModal';
import { UserProfileSidebar } from './UserProfileSidebar';
import { MessageIcon } from './icons/MessageIcon';
import { HappyEmoji, LoveEmoji, ThumbsUpEmoji, EMOJI_MAP } from './icons/EmojiIcons';

export const ChatInterface: React.FC = () => {
  // Previous state and context code...

  // Простая коллекция эмодзи для picker'а
  const EMOJI_LIST = ['❤️'] as const;

  // Обновлённая функция toggleReaction
  const toggleReaction = async (messageId: number, emoji: keyof typeof EMOJI_MAP) => {
    if (!user) return;

    // Проверяем, поставил ли пользователь уже эту реакцию
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
        const removed = messages.map((m: Message) => 
          m.id === messageId ? 
            { ...m, reactions: (m.reactions || []).filter((r: any) => !(r.userId === user.id && r.emoji === emoji)) } 
            : m
        );
        setMessages(removed);
      } else {
        // Добавляем реакцию
        await fetch(`http://localhost:5001/api/messages/${messageId}/reactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: user.id, emoji })
        });

        // Оптимистически обновляем UI
        const added = messages.map((m: Message) => 
          m.id === messageId ? 
            { ...m, reactions: [...(m.reactions || []), { id: Date.now(), userId: user.id, userName: user.displayName, avatarUrl: user.avatarUrl, emoji, createdAt: new Date().toISOString() }] } 
            : m
        );
        setMessages(added);
      }
    } catch (err) {
      console.error('Reaction error', err);
    } finally {
      setOpenEmojiPickerFor(null);
    }
  };