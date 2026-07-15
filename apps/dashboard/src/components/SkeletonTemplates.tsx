'use client';

import { CardSkeleton, TableSkeleton, StatCardSkeleton, ListSkeleton, EmptyStateSkeleton } from './LoadingSkeleton';

export {
  CardSkeleton,
  TableSkeleton,
  StatCardSkeleton,
  ListSkeleton,
  EmptyStateSkeleton,
};

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        {[1, 2, 3, 4, 5].map((i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CardSkeleton />
        <CardSkeleton />
      </div>

      <CardSkeleton>
        <TableSkeleton rows={5} columns={4} />
      </CardSkeleton>
    </div>
  );
}

export function AgentsSkeleton() {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <StatCardSkeleton />
      </div>
      <div className="border-t border-gray-200">
        <ListSkeleton items={5} />
      </div>
    </div>
  );
}

export function KnowledgeSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-8">
      <CardSkeleton />
      <CardSkeleton />
      <ListSkeleton items={10} />
    </div>
  );
}

export function ConversationsSkeleton() {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <StatCardSkeleton />
      </div>
      <div className="border-t border-gray-200">
        <TableSkeleton rows={5} columns={3} />
      </div>
      <div className="px-4 py-3 border-t border-gray-200">
        <div className="flex justify-center">
          <div className="h-8 bg-gray-200 rounded w-24 animate-pulse" />
        </div>
      </div>
    </div>
  );
}

export function SettingsSkeleton() {
  return (
    <div className="max-w-2xl mx-auto p-8 space-y-6">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

export function WidgetsSkeleton() {
  return (
    <div className="max-w-4xl mx-auto p-8 space-y-6">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

export function BillingSkeleton() {
  return (
    <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 py-10 space-y-6">
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
      <CardSkeleton />
    </div>
  );
}

export function PhoneSkeleton() {
  return (
    <div className="max-w-7xl mx-auto sm:px-6 lg:px-8 py-10 space-y-6">
      <CardSkeleton />
      <CardSkeleton>
        <TableSkeleton rows={5} columns={5} />
      </CardSkeleton>
    </div>
  );
}