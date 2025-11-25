
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Card } from './ui/Card';

export const Login: React.FC<{ onLogin: (user: string, pass: string) => Promise<boolean> }> = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    const success = await onLogin(username, password);
    setIsLoading(false);
    if (success) {
      navigate('/');
    } else {
      setError('Неверные имя пользователя или пароль.');
    }
  };

  return (
    <div className="relative flex items-center justify-center min-h-screen bg-white dark:bg-gray-950 p-4 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-100/30 via-white to-white dark:from-primary-900/10 dark:via-gray-950 dark:to-gray-950"></div>
        <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary-100 dark:bg-primary-900/50 mb-4">
                 <svg className="h-8 w-auto text-primary-600 dark:text-primary-300" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 9.068l.44-2.396M11.25 9.068l-3.41 1.936m3.41-1.936l1.936 3.41m-1.936-3.41a4.5 4.5 0 013.182-.968h.063a4.5 4.5 0 013.478 5.432l-1.29 7.234a.75.75 0 01-1.42-.25l-1.29-7.234a2.25 2.25 0 00-2.208-1.956H9.413a2.25 2.25 0 00-2.208 1.956l-1.29 7.234a.75.75 0 01-1.42-.25l-1.29-7.234A4.5 4.5 0 016.12 6.132h.063a4.5 4.5 0 013.182.968z" />
                 </svg>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
              Tire Storage CRM
            </h2>
             <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Войдите в свою учетную запись</p>
        </div>
        <Card>
          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              id="username"
              label="Имя пользователя"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              placeholder="Admin"
            />
            <Input
              id="password"
              label="Пароль"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              placeholder="Admin123"
            />
            {error && <p className="text-sm text-red-600 dark:text-red-500">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={isLoading}>
              {isLoading ? 'Вход...' : 'Войти'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};