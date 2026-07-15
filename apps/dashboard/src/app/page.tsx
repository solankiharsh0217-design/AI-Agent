import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';

export default async function Home() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  return (
    <main className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">AI Agent Platform</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Link href="/agents" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Agents</h2>
            <p className="text-gray-600">Create and manage your AI agents</p>
          </Link>

          <Link href="/knowledge" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Knowledge</h2>
            <p className="text-gray-600">Upload and manage your knowledge base</p>
          </Link>

          <Link href="/conversations" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Conversations</h2>
            <p className="text-gray-600">View conversation history</p>
          </Link>

          <Link href="/widgets" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Widgets</h2>
            <p className="text-gray-600">Configure chat and voice widgets</p>
          </Link>

          <Link href="/analytics" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Analytics</h2>
            <p className="text-gray-600">View usage and performance metrics</p>
          </Link>

          <Link href="/settings" className="block p-6 bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow">
            <h2 className="text-xl font-semibold mb-2">Settings</h2>
            <p className="text-gray-600">Manage your account and billing</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
