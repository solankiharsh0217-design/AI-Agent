'use client';

import { useAuth } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { PageContainer, PageHeader } from '@/components/ui';

// Extend Window interface for Razorpay
declare global {
  interface Window {
    Razorpay: any;
  }
}

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  pricing: {
    basePrice: number;
    currency: string;
    interval: string;
  };
  limits: {
    maxAgents: number;
    maxKnowledgeBases: number;
    maxMonthlyMessages: number;
    maxMonthlyVoiceMinutes: number;
    maxMonthlyPhoneMinutes: number;
    maxStorageMb: number;
  };
}

interface Subscription {
  id: string;
  planId: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  plan?: Plan;
}

interface Invoice {
  id: string;
  number: string;
  status: string;
  amountDue: number;
  amountPaid: number;
  currency: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string | null;
  paidAt: string | null;
  hostedInvoiceUrl: string | null;
}

interface Usage {
  event: string;
  totalQuantity: number;
  totalCost: number;
}

const USAGE_LABELS: Record<string, string> = {
  llm_call: 'LLM Calls',
  stt: 'Speech-to-Text (seconds)',
  tts: 'Text-to-Speech (seconds)',
  embedding: 'Embeddings',
  storage: 'Storage (GB)',
};

const STATUS_COLORS: Record<string, string> = {
  paid: 'bg-green-100 text-green-800',
  open: 'bg-yellow-100 text-yellow-800',
  draft: 'bg-gray-100 text-gray-800',
  void: 'bg-gray-100 text-slate-500',
  uncollectible: 'bg-red-100 text-red-800',
};

const PLAN_COLORS: Record<string, string> = {
  free: 'bg-gray-100 text-gray-800',
  starter: 'bg-blue-100 text-blue-800',
  pro: 'bg-purple-100 text-purple-800',
  enterprise: 'bg-indigo-100 text-indigo-800',
};

export default function BillingPage() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState(false);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push('/sign-in');
    }
  }, [isLoaded, isSignedIn]);

  // Load Razorpay script
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.Razorpay) {
      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.async = true;
      script.onload = () => setRazorpayLoaded(true);
      document.body.appendChild(script);
      return () => {
        document.body.removeChild(script);
      };
    } else if (typeof window !== 'undefined' && window.Razorpay) {
      setRazorpayLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (isLoaded && isSignedIn) {
      loadBillingData();
    }
  }, [isLoaded, isSignedIn]);

  async function loadBillingData() {
    try {
      setLoading(true);
      setError(null);
      const [subData, invoiceData, usageData, planData] = await Promise.allSettled([
        api.billing.getSubscription(),
        api.billing.getInvoices(),
        api.billing.getUsage(),
        api.billing.getPlans(),
      ]);

      const errors: string[] = [];
      if (subData.status === 'fulfilled') setSubscription(subData.value);
      else if (subData.reason) errors.push(`Subscription: ${subData.reason}`);
      if (invoiceData.status === 'fulfilled') setInvoices(invoiceData.value);
      else if (invoiceData.reason) errors.push(`Invoices: ${invoiceData.reason}`);
      if (usageData.status === 'fulfilled') setUsage(usageData.value);
      else if (usageData.reason) errors.push(`Usage: ${usageData.reason}`);
      if (planData.status === 'fulfilled') setPlans(planData.value);
      else if (planData.reason) errors.push(`Plans: ${planData.reason}`);
      if (errors.length > 0) setError('Some data failed to load: ' + errors.join('; '));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }

  async function handleUpgrade(planSlug: string) {
    if (!razorpayLoaded) {
      setError('Razorpay is still loading. Please try again in a moment.');
      return;
    }

    const plan = plans.find(p => p.slug === planSlug);
    if (!plan) {
      setError('Plan not found');
      return;
    }

    // Free plan doesn't need Razorpay
    if (planSlug === 'free') {
      try {
        setUpgrading(true);
        await api.billing.upgradePlan(planSlug);
        await loadBillingData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to upgrade plan');
      } finally {
        setUpgrading(false);
      }
      return;
    }

    try {
      setUpgrading(true);
      setError(null);

      // Get Razorpay subscription details from backend
      const checkoutData = await api.billing.upgradePlan(planSlug);

      if (!checkoutData.subscriptionId || !checkoutData.keyId) {
        throw new Error('Invalid checkout data from server');
      }

      // Open Razorpay checkout modal
      const options = {
        key: checkoutData.keyId,
        subscription_id: checkoutData.subscriptionId,
        name: 'AI Agent Platform',
        description: `Subscription to ${plan.name} plan`,
        image: '/favicon.ico',
        handler: async function (response: any) {
          // Payment successful - reload billing data
          await loadBillingData();
        },
        modal: {
          ondismiss: function() {
            setUpgrading(false);
            setError('Payment was not completed. Please try again.');
          }
        },
        theme: {
          color: '#6366F1'
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setError('Payment failed: ' + (response.error?.description || 'Unknown error'));
        setUpgrading(false);
      });
      rzp.open();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to initiate checkout');
      setUpgrading(false);
    }
  }

  async function handleCancelSubscription() {
    if (!confirm('Are you sure you want to cancel your subscription?')) return;
    try {
      await api.billing.cancelSubscription();
      await loadBillingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel subscription');
    }
  }

  async function handleReactivateSubscription() {
    if (!confirm('Reactivate your subscription? This will cancel the scheduled cancellation.')) return;
    try {
      setUpgrading(true);
      await api.billing.reactivateSubscription();
      await loadBillingData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate subscription');
    } finally {
      setUpgrading(false);
    }
  }

  function getUsagePercentage(metric: Usage): number {
    return 0;
  }

  function getUsageBarColor(percentage: number): string {
    return 'bg-indigo-500';
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  function formatCurrency(amount: number, currency: string = 'USD'): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount / 100);
  }

  const currentPlanName = subscription?.plan?.slug ?? 'free';

  return (
    <PageContainer>
      <PageHeader title="Billing" description="Manage your plan, usage, and invoices." />
      <div>
        <div>
          <div>

              {loading && (
                <div className="text-center py-12">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                  <p className="mt-2 text-sm text-slate-500">Loading billing data...</p>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
                  <p className="text-sm text-red-700">{error}</p>
                  <button
                    onClick={() => { setError(null); loadBillingData(); }}
                    className="mt-2 text-sm font-medium text-red-600 hover:text-red-500"
                  >
                    Retry
                  </button>
                </div>
              )}

              {!loading && !error && (
                <>
                  {/* Current Plan */}
                  <div className="card p-6 mb-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-medium text-slate-900">Current Plan</h2>
                        <div className="mt-2 flex items-center gap-3">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${PLAN_COLORS[currentPlanName] ?? 'bg-gray-100 text-gray-800'}`}>
                            {subscription?.plan?.name ?? 'Free'}
                          </span>
                          <span className={`text-xs font-medium ${subscription?.status === 'active' ? 'text-green-600' : 'text-yellow-600'}`}>
                            {subscription?.status === 'active' ? 'Active' : subscription?.status ?? 'N/A'}
                          </span>
                        </div>
                        {subscription?.currentPeriodEnd && (
                          <p className="mt-1 text-sm text-slate-500">
                            Renews on {formatDate(subscription.currentPeriodEnd)}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-3">
                        {subscription?.cancelAtPeriodEnd ? (
                          <button
                            onClick={handleReactivateSubscription}
                            disabled={upgrading}
                            className="px-4 py-2 border border-green-300 text-sm font-medium rounded-md text-green-700 bg-white hover:bg-green-50 disabled:opacity-50"
                          >
                            Reactivate
                          </button>
                        ) : (
                          <button
                            onClick={handleCancelSubscription}
                            disabled={upgrading}
                            className="px-4 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                          >
                            Cancel Subscription
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Usage Summary */}
                  <div className="card p-6 mb-6">
                    <h2 className="text-lg font-medium text-slate-900 mb-4">Usage This Period</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {usage.map((item) => {
                        const label = USAGE_LABELS[item.event] ?? item.event.replace(/_/g, ' ');
                        return (
                          <div key={item.event} className="border border-slate-200 rounded-lg p-4">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-slate-700">{label}</span>
                              <span className="text-xs text-slate-500">{item.totalCost > 0 ? '$' + item.totalCost.toFixed(4) : ''}</span>
                            </div>
                            <div className="flex items-baseline gap-1 mb-2">
                              <span className="text-2xl font-semibold text-slate-900">
                                {(item.totalQuantity || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Plan Cards */}
                  {plans.length > 0 && (
                    <div className="card p-6 mb-6">
                      <h2 className="text-lg font-medium text-slate-900 mb-4">Available Plans</h2>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {plans.map((plan) => {
                          const isCurrent = plan.slug === currentPlanName;
                          return (
                            <div
                              key={plan.id}
                              className={`border rounded-lg p-4 ${isCurrent ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}`}
                            >
                              <h3 className="text-base font-semibold text-slate-900">{plan.name}</h3>
                              <p className="mt-1 text-sm text-slate-500">{plan.description}</p>
                              <p className="mt-3 text-2xl font-bold text-slate-900">
                                {plan.pricing.basePrice === 0 ? 'Free' : `$${plan.pricing.basePrice}`}
                                {plan.pricing.basePrice > 0 && (
                                  <span className="text-sm font-normal text-slate-500">/{plan.pricing.interval}</span>
                                )}
                              </p>
                              <ul className="mt-4 space-y-2 text-sm text-slate-600">
                                <li>{plan.limits.maxAgents} agents</li>
                                <li>{plan.limits.maxMonthlyMessages.toLocaleString()} messages/mo</li>
                                <li>{plan.limits.maxMonthlyVoiceMinutes} voice min/mo</li>
                                <li>{plan.limits.maxStorageMb} MB storage</li>
                              </ul>
                              <button
                                onClick={() => handleUpgrade(plan.slug)}
                                disabled={isCurrent || upgrading}
                                className={`mt-4 w-full px-4 py-2 text-sm font-medium rounded-md disabled:opacity-50 ${
                                  isCurrent
                                    ? 'bg-indigo-100 text-indigo-700 cursor-default'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                }`}
                              >
                                {isCurrent ? 'Current Plan' : 'Upgrade'}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Invoice History */}
                  <div className="card overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-200">
                      <h2 className="text-lg font-medium text-slate-900">Invoice History</h2>
                    </div>
                    {invoices.length === 0 ? (
                      <div className="px-6 py-12 text-center text-sm text-slate-500">
                        No invoices yet.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                          <thead className="bg-slate-50">
                            <tr>
                              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Invoice</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Period</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                              <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Amount</th>
                              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Paid</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-slate-200">
                            {invoices.map((invoice) => (
                              <tr key={invoice.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                  {invoice.hostedInvoiceUrl ? (
                                    <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-500">
                                      {invoice.number}
                                    </a>
                                  ) : (
                                    invoice.number
                                  )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                  {formatDate(invoice.periodStart)} – {formatDate(invoice.periodEnd)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[invoice.status] ?? 'bg-gray-100 text-gray-800'}`}>
                                    {invoice.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-slate-900">
                                  {formatCurrency(invoice.amountDue, invoice.currency)}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                  {invoice.paidAt ? formatDate(invoice.paidAt) : '—'}
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
      </div>
    </PageContainer>
  );
}
