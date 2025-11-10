import React, { useEffect, useState } from 'react';
import { User } from '../types/types';
import { useApp } from '../contexts/AppContext';

interface Props {
  isOpen: boolean;
  userId: number | null;
  onClose: () => void;
}

export const UserProfileModal: React.FC<Props> = ({ isOpen, userId, onClose }) => {
  const { user: currentUser, checkBlockStatus, refreshBlockedUsers } = useApp();
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  // Загрузка профиля и статуса блокировки
  useEffect(() => {
    if (!isOpen || !userId || !currentUser) return;
    
    setLoading(true);
    setError(null);

    // Загружаем профиль и статус блокировки параллельно
    Promise.all([
      // Загрузка профиля
      fetch(`http://localhost:5001/api/users/${userId}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to load profile');
          return res.json();
        }),
      
      // Проверка статуса блокировки
      fetch(`http://localhost:5001/api/users/block-status/${userId}?checkedById=${currentUser.id}`)
        .then(res => {
          if (!res.ok) throw new Error('Failed to check block status');
          return res.json();
        })
    ])
    .then(([profileData, blockData]) => {
      // Normalize keys to User type
      setProfile({
        id: profileData.id,
        username: profileData.username,
        displayName: profileData.displayName || profileData.display_name || '',
        avatarUrl: profileData.avatarUrl || profileData.avatar_url || null,
        bio: profileData.bio || '',
        isOnline: !!profileData.isOnline,
        lastSeen: profileData.lastSeen || profileData.last_seen || null,
      });
      
      setIsBlocked(blockData.isBlocked);
    })
    .catch(err => {
      console.error('Profile/block status load error', err);
      setError('Failed to load profile data');
    })
    .finally(() => setLoading(false));
  }, [isOpen, userId, currentUser]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl w-80">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">User profile</h2>
          <button onClick={onClose} className="text-gray-500">✕</button>
        </div>

        {loading && <div>Loading...</div>}
        {error && <div className="text-sm text-red-500">{error}</div>}

        {profile && (
          <div className="space-y-3">
            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
                {!isBlocked && profile.avatarUrl ? (
                  <img 
                    src={profile.avatarUrl.startsWith('/') ? `http://localhost:5001${profile.avatarUrl}` : profile.avatarUrl}
                    alt={profile.displayName}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xl text-gray-600">
                    {isBlocked ? '🚫' : profile.displayName?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div>
                <div className="font-medium">{profile.displayName}</div>
                <div className="text-sm text-gray-500">@{profile.username}</div>
                {/* Show online status only if not blocked */}
                {!isBlocked && (
                  <div className="text-xs text-gray-400 mt-1">
                    {profile.isOnline ? (
                      <span className="text-green-500">в сети</span>
                    ) : profile.lastSeen ? (
                      (() => {
                        try {
                          const last = new Date(profile.lastSeen).getTime();
                          const days = (Date.now() - last) / (1000 * 60 * 60 * 24);
                          return days > 30 ? 'был давно' : 'был недавно';
                        } catch (e) {
                          return 'был недавно';
                        }
                      })()
                    ) : (
                      'был недавно'
                    )}
                  </div>
                )}
                {isBlocked && (
                  <div className="text-xs text-red-500 mt-1">
                    Пользователь заблокирован
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-600">Bio</div>
              <div className="mt-1 text-sm text-gray-800 dark:text-gray-200">{profile.bio || 'No bio'}</div>
            </div>

            {/* Блокировка и другие действия */}
            <div className="flex flex-col space-y-2 pt-4">
              {currentUser && currentUser.id !== profile.id && (
                <button
                  onClick={async () => {
                    if (!currentUser || blockLoading) return;
                    
                    setBlockLoading(true);
                    try {
                      const response = await fetch(
                        `http://localhost:5001/api/users/${isBlocked ? 'unblock' : 'block'}/${profile.id}`,
                        {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            [`${isBlocked ? 'unblocked' : 'blocked'}ById`]: currentUser.id
                          })
                        }
                      );
                      
                      if (!response.ok) throw new Error('Failed to update block status');
                      
                      setIsBlocked(!isBlocked);
                    } catch (err) {
                      console.error('Block/unblock error:', err);
                      setError('Failed to update block status');
                    } finally {
                      setBlockLoading(false);
                    }
                  }}
                  disabled={blockLoading}
                  className={`w-full p-2 rounded font-medium transition-colors ${
                    isBlocked
                      ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                      : 'bg-red-500 hover:bg-red-600 text-white'
                  } disabled:opacity-50`}
                >
                  {blockLoading ? 'Updating...' : isBlocked ? 'Разблокировать' : 'Заблокировать'}
                </button>
              )}
              <button
                onClick={onClose}
                className="w-full bg-gray-500 hover:bg-gray-600 text-white p-2 rounded font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileModal;
