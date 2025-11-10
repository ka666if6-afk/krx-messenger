// Временный файл с правильными эмодзи
const EMOJI_LIST = ['👍','❤️','👎'] as const;

// Mock toggleReaction function for demonstration
const toggleReaction = (messageId: number, emoji: string) => {
    console.log(`Toggled reaction ${emoji} for message ${messageId}`);
};

// Пример использования в компоненте:
{EMOJI_LIST.map((emoji) => (
    <button
        key={emoji}
        onClick={() => toggleReaction(1, emoji)} // Example message ID
        className="p-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xl"
    >
        {emoji}
    </button>
))}