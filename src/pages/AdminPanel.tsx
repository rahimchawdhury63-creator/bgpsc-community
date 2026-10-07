import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../lib/stores/auth';
import { useI18nStore } from '../lib/stores/i18n';
import { Navigate } from 'react-router-dom';
import type { RegistrationApplication, Profile } from '../types/database';
import { useState } from 'react';

export default function AdminPanel() {
  const { profile } = useAuthStore();
  const { t } = useI18nStore();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<'approvals' | 'users' | 'content'>('approvals');
  const [rejectReason, setRejectReason] = useState('');

  if (!profile || profile.role !== 'admin') {
    return <Navigate to="/" />;
  }

  const { data: applications } = useQuery({
    queryKey: ['applications', tab],
    queryFn: async () => {
      const { data } = await supabase
        .from('registration_applications')
        .select('*')
        .neq('status', 'approved')
        .order('submitted_at', { ascending: false });
      return data as RegistrationApplication[];
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (appId: string) => {
      await supabase.rpc('decide_application', {
        p_app_id: appId,
        p_approve: true,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ appId, reason }: { appId: string; reason: string }) => {
      await supabase.rpc('decide_application', {
        p_app_id: appId,
        p_approve: false,
        p_reason: reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['applications'] });
      setRejectReason('');
    },
  });

  const tabs = [
    { id: 'approvals', label: t('admin.approvals') },
    { id: 'users', label: t('admin.users') },
    { id: 'content', label: t('admin.content') },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">{t('admin.title')}</h1>

      <div className="card">
        <div className="flex gap-2">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id as any)}
              className={`rounded-lg px-4 py-2 font-medium transition-colors ${
                tab === t.id
                  ? 'bg-brand-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'approvals' && (
        <div className="space-y-4">
          {applications?.map(app => (
            <div key={app.id} className="card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold">{app.payload.full_name}</h3>
                  <p className="text-sm text-gray-500">
                    {app.payload.email} · {app.role} · Status: {app.status}
                  </p>
                </div>
                <span className="rounded-full bg-yellow-100 px-3 py-1 text-xs font-medium text-yellow-800">
                  {app.status}
                </span>
              </div>

              <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-800">
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(app.payload, null, 2)}
                </pre>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => approveMutation.mutate(app.id)}
                  className="btn btn-primary"
                  disabled={approveMutation.isPending}
                >
                  Approve
                </button>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Rejection reason (min 10 chars)"
                    className="input"
                    minLength={10}
                  />
                  <button
                    onClick={() => rejectMutation.mutate({ appId: app.id, reason: rejectReason })}
                    className="btn btn-secondary"
                    disabled={rejectReason.length < 10}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
