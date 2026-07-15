'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { api } from '@/lib/api';

interface PhoneNumber {
  id: string;
  phoneNumber: string;
  friendlyName: string;
  status: string;
  agentId: string | null;
  agentName: string | null;
  provider: string;
  createdAt: string;
}

interface Agent {
  id: string;
  name: string;
}

interface Call {
  id: string;
  phoneNumber: string;
  direction: string;
  status: string;
  duration: number;
  startedAt: string;
  endedAt: string | null;
  agentName: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  provisioning: 'bg-yellow-100 text-yellow-800',
  released: 'bg-gray-100 text-gray-800',
  failed: 'bg-red-100 text-red-800',
};

const CALL_STATUS_COLORS: Record<string, string> = {
  completed: 'bg-green-100 text-green-800',
  'in-progress': 'bg-blue-100 text-blue-800',
  failed: 'bg-red-100 text-red-800',
  busy: 'bg-yellow-100 text-yellow-800',
  'no-answer': 'bg-gray-100 text-gray-800',
};

export default function PhonePage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newNumber, setNewNumber] = useState('');
  const [newFriendlyName, setNewFriendlyName] = useState('');
  const [addingNumber, setAddingNumber] = useState(false);

  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [releasingId, setReleasingId] = useState<string | null>(null);

  useEffect(() => {
    if (isLoaded && !isSignedIn) router.push('/sign-in');
  }, [isLoaded, isSignedIn]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const [numbersData, agentsData, callsData] = await Promise.allSettled([
        api.phone.listNumbers(),
        api.agents.list(),
        api.phone.listCalls(),
      ]);

      if (numbersData.status === 'fulfilled') setNumbers(numbersData.value);
      if (agentsData.status === 'fulfilled') setAgents(agentsData.value);
      if (callsData.status === 'fulfilled') setCalls(callsData.value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load phone data');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [isLoaded, isSignedIn]);

  if (!isLoaded || !isSignedIn) return <div className="p-8">Loading...</div>;

  async function handleAddNumber(e: React.FormEvent) {
    e.preventDefault();
    if (!newNumber.trim()) return;
    try {
      setAddingNumber(true);
      setError(null);
      await api.phone.createNumber({
        phoneNumber: newNumber,
        friendlyName: newFriendlyName || undefined,
      });
      setNewNumber('');
      setNewFriendlyName('');
      setShowAddForm(false);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add phone number');
    } finally {
      setAddingNumber(false);
    }
  }

  async function handleAssignAgent(numberId: string, agentId: string) {
    try {
      setAssigningId(numberId);
      setError(null);
      await api.phone.assignAgent(numberId, agentId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign agent');
    } finally {
      setAssigningId(null);
    }
  }

  async function handleRelease(numberId: string) {
    if (!confirm('Are you sure you want to release this phone number?')) return;
    try {
      setReleasingId(numberId);
      setError(null);
      await api.phone.releaseNumber(numberId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to release number');
    } finally {
      setReleasingId(null);
    }
  }

  function formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="py-10">
        <header>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <h1 className="text-3xl font-bold text-gray-900">Phone Numbers</h1>
              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {showAddForm ? 'Cancel' : '+ Add Phone Number'}
              </button>
            </div>
          </div>
        </header>
        <main>
          <div className="max-w-7xl mx-auto sm:px-6 lg:px-8">
            <div className="px-4 py-8 sm:px-0">

              {loading && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-sm text-gray-500">Loading phone data...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => { setError(null); loadData(); }}
                    className="mt-2 text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && (
                <>
                  {/* Add Phone Number Form */}
                  {showAddForm && (
                    <div className="bg-white shadow rounded-lg p-6 mb-6">
                      <h2 className="text-lg font-medium text-gray-900 mb-4">Add Phone Number</h2>
                      <form onSubmit={handleAddNumber} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700">
                              Phone Number
                            </label>
                            <input
                              type="text"
                              id="phoneNumber"
                              value={newNumber}
                              onChange={(e) => setNewNumber(e.target.value)}
                              placeholder="+1 (555) 123-4567"
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label htmlFor="friendlyName" className="block text-sm font-medium text-gray-700">
                              Friendly Name
                            </label>
                            <input
                              type="text"
                              id="friendlyName"
                              value={newFriendlyName}
                              onChange={(e) => setNewFriendlyName(e.target.value)}
                              placeholder="Sales Line"
                              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="submit"
                            disabled={addingNumber}
                            className="px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            {addingNumber ? 'Adding...' : 'Add Number'}
                          </button>
                        </div>
                      </form>
                    </div>
                  )}

                  {/* Phone Numbers List */}
                  <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Your Phone Numbers</h2>
                    </div>
                    {numbers.length === 0 ? (
                      <div className="px-6 py-12 text-center text-sm text-gray-500">
                        No phone numbers yet. Add one to get started.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Friendly Name</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned Agent</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Provider</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {numbers.map((num) => (
                              <tr key={num.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {num.phoneNumber}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {num.friendlyName || '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[num.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                    {num.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {num.status === 'active' ? (
                                    <select
                                      value={num.agentId ?? ''}
                                      onChange={(e) => handleAssignAgent(num.id, e.target.value)}
                                      disabled={assigningId === num.id}
                                      className="border border-gray-300 rounded-md shadow-sm py-1 px-2 text-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:opacity-50"
                                    >
                                      <option value="">Unassigned</option>
                                      {agents.map((agent) => (
                                        <option key={agent.id} value={agent.id}>
                                          {agent.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-gray-400">—</span>
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {num.provider}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                  {num.status === 'active' && (
                                    <button
                                      onClick={() => handleRelease(num.id)}
                                      disabled={releasingId === num.id}
                                      className="text-red-600 hover:text-red-500 disabled:opacity-50"
                                    >
                                      {releasingId === num.id ? 'Releasing...' : 'Release'}
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Call History */}
                  <div className="bg-white shadow rounded-lg overflow-hidden">
                    <div className="px-6 py-4 border-b border-gray-200">
                      <h2 className="text-lg font-medium text-gray-900">Call History</h2>
                    </div>
                    {calls.length === 0 ? (
                      <div className="px-6 py-12 text-center text-sm text-gray-500">
                        No calls recorded yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone Number</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Direction</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Agent</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Started</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {calls.map((call) => (
                              <tr key={call.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                  {call.phoneNumber}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${call.direction === 'inbound' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                                    {call.direction}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${CALL_STATUS_COLORS[call.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                    {call.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                  {formatDuration(call.duration)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {call.agentName ?? '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {formatDate(call.startedAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
