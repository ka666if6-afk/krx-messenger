import React, { useState, useEffect } from 'react';
import { User } from '../types/types';
import { useApp } from '../contexts/AppContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onUpdateProfile: (updates: { displayName: string; bio: string }) => Promise<void>;
  onAvatarUpdate: (avatarUrl: string) => void;
}

export default function ProfileModal({ user, isOpen, onClose, onUpdateProfile, onAvatarUpdate }: ProfileModalProps) {
  const { setUser, socket, notifyEnabled, toggleNotify, soundEnabled, toggleSound } = useApp();
  const [isEditing, setIsEditing] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [displayName, setDisplayName] = useState(user.displayName);
  const [bio, setBio] = useState<string>(user.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Обновляем локальные поля когда обновляется user из пропсов
  useEffect(() => {
    setDisplayName(user.displayName);
    setBio(user.bio || '');
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Проверяем размер файла (макс 5MB, соответствует серверному лимиту)
    if (file.size > 5 * 1024 * 1024) {
      alert('File size too large. Maximum 5MB allowed.');
      return;
    }

    try {
      const form = new FormData();
      form.append('avatar', file);
      form.append('userId', String(user.id));

      const response = await fetch('http://localhost:5001/api/upload-avatar', {
        method: 'POST',
        body: form
      });

      if (response.ok) {
        const data = await response.json();
        onAvatarUpdate(data.avatarUrl);
      } else {
        console.error('Avatar upload failed', response.statusText);
        alert('Error uploading avatar');
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      alert('Error uploading avatar');
    }
  };

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await onUpdateProfile({ displayName, bio });
      setIsEditing(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () => {
    try {
      // If there's a socket connection, disconnect it
      if (socket) {
        try {
          socket.emit('user_offline', user.id);
        } catch (e) {
          // ignore
        }
        try {
          socket.disconnect();
        } catch (e) {
          // ignore
        }
      }

      // Clear user from context/localStorage
      setUser(null);

      // Redirect to home/login page
      if (typeof window !== 'undefined') window.location.href = '/';
    } catch (err) {
      console.error('Logout error', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-96">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">Profile</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4">
          {/* Avatar */}
          <div className="flex flex-col items-center">
            <div className="w-20 h-20 bg-gray-300 dark:bg-gray-600 rounded-full flex items-center justify-center mb-2 relative overflow-hidden">
              {user.avatarUrl ? (
                <img 
                  src={`http://localhost:5001${user.avatarUrl}`} 
                  alt="" 
                  className="w-20 h-20 rounded-full object-cover" 
                />
              ) : (
                <span className="text-2xl text-gray-600 dark:text-gray-300">
                  {user.displayName[0].toUpperCase()}
                </span>
              )}
              <label className="absolute bottom-0 right-0 bg-blue-500 text-white p-1 rounded-full cursor-pointer text-xs hover:bg-blue-600">
                📷
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
              </label>
            </div>
            <span className="text-sm text-gray-500 dark:text-gray-400">Click camera to change avatar</span>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Display Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            ) : (
              <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded">{user.displayName}</p>
            )}
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Username
            </label>
            <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
              @{user.username}
            </p>
          </div>

          {/* Bio */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bio
            </label>
            {isEditing ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                rows={3}
                placeholder="Tell us about yourself..."
              />
            ) : (
              <p className="p-2 bg-gray-100 dark:bg-gray-700 rounded min-h-[60px]">
                {bio || 'No bio yet...'}
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
              <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex space-x-2 pt-4">
            {isEditing ? (
              <>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setError(null);
                    // Восстанавливаем исходные значения
                    setDisplayName(user.displayName);
                    setBio(user.bio || '');
                  }}
                  disabled={isSaving}
                  className="flex-1 bg-gray-500 hover:bg-gray-600 disabled:bg-gray-400 text-white p-2 rounded font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={isSaving || displayName.length < 2 || displayName.length > 32 || bio.length > 500}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-blue-400 text-white p-2 rounded font-medium flex items-center justify-center"
                >
                  {isSaving ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Saving...
                    </>
                  ) : 'Save'}
                </button>
              </>
            ) : (
              <button
                onClick={() => setIsEditing(true)}
                className="flex-1 bg-blue-500 hover:bg-blue-600 text-white p-2 rounded font-medium"
              >
                Edit Profile
              </button>
            )}
          </div>

          {/* Logout button (visible when not editing) */}
          {!isEditing && (
            <div className="pt-3">
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="w-full bg-red-500 hover:bg-red-600 text-white p-2 rounded font-medium"
              >
                Log out
              </button>
            </div>
          )}

          {/* Client-side validation hints */}
          {isEditing && (
            <div className="mt-3 text-xs space-y-1">
              {displayName.length < 2 && (
                <p className="text-yellow-600 dark:text-yellow-400">Display name must be at least 2 characters</p>
              )}
              {displayName.length > 32 && (
                <p className="text-red-600 dark:text-red-400">Display name cannot be longer than 32 characters</p>
              )}
              {bio && bio.length > 500 && (
                <p className="text-red-600 dark:text-red-400">Bio cannot be longer than 500 characters</p>
              )}
              <p className="text-gray-500 dark:text-gray-400">
                Characters remaining: Bio {500 - (bio?.length || 0)}
              </p>
            </div>
          )}

          {/* Notification settings (global) */}
          {!isEditing && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Desktop notifications</div>
                  <div className="text-xs text-gray-500">System notifications for new messages</div>
                </div>
                <input type="checkbox" checked={!!notifyEnabled} onChange={() => toggleNotify()} />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium">Sound notifications</div>
                  <div className="text-xs text-gray-500">Play a short sound for incoming messages</div>
                </div>
                <input type="checkbox" checked={!!soundEnabled} onChange={() => toggleSound()} />
              </div>
            </div>
          )}
        </div>

        {/* Logout confirmation modal (nested) */}
        {showLogoutConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-60">
            <div className="bg-white dark:bg-gray-800 p-5 rounded-lg w-80">
              <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Confirm logout</h3>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Are you sure you want to log out?</p>
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => setShowLogoutConfirm(false)}
                  className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={() => { setShowLogoutConfirm(false); handleLogout(); }}
                  className="px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded text-sm"
                >
                  Log out
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};