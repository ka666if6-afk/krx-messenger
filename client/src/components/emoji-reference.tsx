// Временный файл с правильными эмодзи
const EMOJI_LIST = ['👍','❤️','👎'] as const;

// Пример использования в компоненте:
{EMOJI_LIST.map((emoji) => (
    <button
        key={emoji}
        onClick={() => toggleReaction(message.id, emoji)}
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xl"
    >
        {emoji}
    </button>
))}