import { useApp } from '../src/contexts/AppContext';
import { LoginForm } from '../src/components/LoginForm';
import { ChatInterface } from '../src/components/ChatInterface';

export default function Home() {
  const { user } = useApp();

  return user ? <ChatInterface /> : <LoginForm />;
}