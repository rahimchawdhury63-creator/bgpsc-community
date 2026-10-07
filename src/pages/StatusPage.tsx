import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import { useSearchParams } from 'react-router-dom';
import { useI18nStore } from '../lib/stores/i18n';
import type { RegistrationApplication } from '../types/database';

export default function StatusPage() {
  const [searchParams] = useSearchParams();
  const { t } = useI18nStore();
  const appId = searchParams.get('id');

  const { data: application } = useQuery({
    queryKey: ['application', appId],
    queryFn: async () => {
      if (!appId) return null;
      const { data } = await supabase
        .from('registration_applications')
        .select('*')
        .eq('id', appId)
        .single();
      return data as RegistrationApplication;
    },
    enabled: !!appId,
    refetchInterval: 5000,
  });

  if (!application) {
    return <div className="card text-center py-12">Application not found</div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="card text-center">
        <img src="/brand/logo.png" alt="BGPSC" className="mx-auto h-20 w-20" />
        <h1 className="mt-4 text-2xl font-bold">Registration Status</h1>
        <p className="text-gray-600 dark:text-gray-400">
          আপনার রেজিস্ট্রেশনের অবস্থা
        </p>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-medium">Status:</span>
          <span className={`rounded-full px-3 py-1 text-sm font-medium ${
            application.status === 'approved' ? 'bg-green-100 text-green-800' :
            application.status === 'rejected' ? 'bg-red-100 text-red-800' :
            application.status === 'under_review' ? 'bg-blue-100 text-blue-800' :
            'bg-yellow-100 text-yellow-800'
          }`}>
            {t(`status.${application.status}`)}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">Role:</span>
          <span>{application.role}</span>
        </div>

        <div className="flex items-center justify-between">
          <span className="font-medium">Submitted:</span>
          <span>{new Date(application.submitted_at).toLocaleString()}</span>
        </div>

        {application.reason && (
          <div className="rounded-lg bg-red-50 p-3 dark:bg-red-900/20">
            <p className="font-medium text-red-800 dark:text-red-400">Reason:</p>
            <p className="text-sm text-red-700 dark:text-red-300">{application.reason}</p>
          </div>
        )}

        {application.status === 'pending' && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            আপনার আবেদন পর্যালোচনার জন্য অপেক্ষা করছে। অনুগ্রহ করে অপেক্ষা করুন।
          </p>
        )}

        {application.status === 'approved' && (
          <p className="text-sm text-green-700 dark:text-green-400">
            আপনার আবেদন অনুমোদিত হয়েছে! আপনি এখন লগইন করতে পারেন।
          </p>
        )}
      </div>
    </div>
  );
}
