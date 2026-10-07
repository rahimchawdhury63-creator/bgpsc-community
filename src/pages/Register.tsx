import { useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useI18nStore } from '../lib/stores/i18n';
import type { UserRole } from '../types/database';

type Step = 1 | 2 | 3 | 4;

interface FormData {
  // Step 1
  full_name: string;
  email: string;
  handle: string;
  // Step 2 (student)
  current_class: number;
  section: string;
  roll: number;
  nid_or_brc: string;
  dob: string;
  // Step 2 (teacher)
  experience_years: number;
  teaches: { class: number; section: string; subject: string }[];
  department: string;
  // Step 2 (alumni)
  current_institution: string;
  current_class_alumni: string;
  old_class: number;
  old_section: string;
  old_roll: number;
  passing_year: number;
  notes: string;
  // Step 2 (guardian)
  phone: string;
  relationship: string;
  occupation: string;
  children: string[];
  // Step 3
  id_front: string;
  id_back: string;
  // Step 4
  password: string;
}

export default function Register() {
  const { t } = useI18nStore();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole | null>(null);
  const [step, setStep] = useState<Step>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [, setApplicationId] = useState<string | null>(null);

  const [formData, setFormData] = useState<FormData>({
    full_name: '',
    email: '',
    handle: '',
    current_class: 3,
    section: 'A',
    roll: 1,
    nid_or_brc: '',
    dob: '',
    experience_years: 0,
    teaches: [],
    department: '',
    current_institution: '',
    current_class_alumni: '',
    old_class: 12,
    old_section: '',
    old_roll: 1,
    passing_year: 2024,
    notes: '',
    phone: '',
    relationship: '',
    occupation: '',
    children: [],
    id_front: '',
    id_back: '',
    password: '',
  });

  const updateField = (field: keyof FormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileUpload = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><image href="${base64}" width="800" height="600"/></svg>`;
        resolve(svg);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }, []);

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });

      if (authError) throw authError;

      // Upload secure documents
      const docIds: string[] = [];
      
      if (formData.id_front) {
        const { data: doc1 } = await supabase
          .from('secure_documents')
          .insert({
            owner_id: authData.user!.id,
            purpose: role === 'teacher' ? 'teacher_id' : 'id_front',
            mime_original: 'image/jpeg',
            sha256: await crypto.subtle.digest('SHA-256', new TextEncoder().encode(formData.id_front)).then(buf => 
              Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
            ),
            svg_text: formData.id_front,
            size_bytes: formData.id_front.length,
          })
          .select('id')
          .single();
        if (doc1) docIds.push(doc1.id);
      }

      if (formData.id_back) {
        const { data: doc2 } = await supabase
          .from('secure_documents')
          .insert({
            owner_id: authData.user!.id,
            purpose: 'id_back',
            mime_original: 'image/jpeg',
            sha256: await crypto.subtle.digest('SHA-256', new TextEncoder().encode(formData.id_back)).then(buf => 
              Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
            ),
            svg_text: formData.id_back,
            size_bytes: formData.id_back.length,
          })
          .select('id')
          .single();
        if (doc2) docIds.push(doc2.id);
      }

      // Build payload
      const payload: Record<string, any> = {
        full_name: formData.full_name,
        email: formData.email,
        handle: formData.handle.toLowerCase(),
        document_ids: docIds,
      };

      if (role === 'student') {
        payload.current_class = formData.current_class;
        payload.section = formData.section;
        payload.roll = formData.roll;
        payload.nid_or_brc = formData.nid_or_brc;
        payload.dob = formData.dob;
      } else if (role === 'teacher') {
        payload.experience_years = formData.experience_years;
        payload.teaches = formData.teaches;
        payload.department = formData.department;
      } else if (role === 'alumni') {
        payload.current_institution = formData.current_institution;
        payload.current_class = formData.current_class_alumni;
        payload.old_class = formData.old_class;
        payload.old_section = formData.old_section;
        payload.old_roll = formData.old_roll;
        payload.passing_year = formData.passing_year;
        payload.notes = formData.notes;
      } else if (role === 'guardian') {
        payload.phone = formData.phone;
        payload.relationship = formData.relationship;
        payload.occupation = formData.occupation;
        payload.children = formData.children;
      }

      // Submit application
      const { data: appId, error: appError } = await supabase.rpc('submit_application', {
        p_role: role!,
        p_payload: payload,
      });

      if (appError) throw appError;

      setApplicationId(appId);
      navigate(`/status?id=${appId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const passwordStrength = (pwd: string): number => {
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (pwd.length >= 12) score++;
    return score;
  };

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="card w-full max-w-md">
          <div className="text-center">
            <img src="/brand/logo.png" alt="BGPSC" className="mx-auto h-20 w-20" />
            <h1 className="mt-4 text-2xl font-bold">{t('auth.register')}</h1>
            <p className="text-gray-600 dark:text-gray-400">আপনার ভূমিকা নির্বাচন করুন</p>
          </div>

          <div className="mt-6 space-y-3">
            {[
              { role: 'student' as UserRole, label: t('register.student'), icon: '📚' },
              { role: 'teacher' as UserRole, label: t('register.teacher'), icon: '👨‍🏫' },
              { role: 'alumni' as UserRole, label: t('register.alumni'), icon: '🎓' },
              { role: 'guardian' as UserRole, label: t('register.guardian'), icon: '👨‍👩‍👧' },
            ].map(opt => (
              <button
                key={opt.role}
                onClick={() => setRole(opt.role)}
                className="flex w-full items-center gap-3 rounded-lg border border-gray-200 p-4 text-left transition-colors hover:border-brand-500 hover:bg-brand-50 dark:border-gray-700 dark:hover:border-brand-500 dark:hover:bg-brand-900/20"
              >
                <span className="text-2xl">{opt.icon}</span>
                <span className="font-medium">{opt.label}</span>
              </button>
            ))}
          </div>

          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            {t('auth.hasAccount')}{' '}
            <Link to="/login" className="font-medium text-brand-600 hover:underline dark:text-brand-400">
              {t('auth.login')}
            </Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="card w-full max-w-lg">
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <button onClick={() => role && step > 1 ? setStep((step - 1) as Step) : setRole(null)} className="text-brand-600">
              ← {step > 1 ? t('register.prev') : 'Back'}
            </button>
            <span className="text-sm text-gray-500">
              {t('register.step')} {step} / 4
            </span>
          </div>
          <div className="mt-2 flex gap-1">
            {[1, 2, 3, 4].map(s => (
              <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-brand-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
            ))}
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Step 1: Basic info */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">ব্যক্তিগত তথ্য</h2>
            <div>
              <label className="label">{t('register.fullName')}</label>
              <input
                type="text"
                value={formData.full_name}
                onChange={(e) => updateField('full_name', e.target.value)}
                className="input mt-1"
                required
              />
            </div>
            <div>
              <label className="label">{t('auth.email')}</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
                className="input mt-1"
                required
              />
            </div>
            <div>
              <label className="label">{t('register.handle')}</label>
              <input
                type="text"
                value={formData.handle}
                onChange={(e) => updateField('handle', e.target.value.replace(/[^a-z0-9_]/g, ''))}
                className="input mt-1"
                pattern="^[a-z0-9_]{3,20}$"
                required
              />
              <p className="mt-1 text-xs text-gray-500">3-20 characters, lowercase letters, numbers, underscores only</p>
            </div>
            <button
              onClick={() => setStep(2)}
              className="btn btn-primary w-full"
              disabled={!formData.full_name || !formData.email || !formData.handle}
            >
              {t('register.next')}
            </button>
          </div>
        )}

        {/* Step 2: Role-specific info */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">
              {role === 'student' && 'শিক্ষার্থীর তথ্য'}
              {role === 'teacher' && 'শিক্ষকের তথ্য'}
              {role === 'alumni' && 'প্রাক্তন শিক্ষার্থীর তথ্য'}
              {role === 'guardian' && 'অভিভাবকের তথ্য'}
            </h2>

            {role === 'student' && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">{t('register.class')}</label>
                    <select
                      value={formData.current_class}
                      onChange={(e) => updateField('current_class', parseInt(e.target.value))}
                      className="input mt-1"
                    >
                      {Array.from({ length: 10 }, (_, i) => i + 3).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label">{t('register.section')}</label>
                    <select
                      value={formData.section}
                      onChange={(e) => updateField('section', e.target.value)}
                      className="input mt-1"
                    >
                      {['A', 'B', 'C', 'D'].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">{t('register.roll')}</label>
                  <input
                    type="number"
                    value={formData.roll}
                    onChange={(e) => updateField('roll', parseInt(e.target.value))}
                    className="input mt-1"
                    min="1"
                  />
                </div>
                <div>
                  <label className="label">{t('register.nid')}</label>
                  <input
                    type="text"
                    value={formData.nid_or_brc}
                    onChange={(e) => updateField('nid_or_brc', e.target.value)}
                    className="input mt-1"
                    pattern="^[0-9]{10,17}$"
                  />
                </div>
                <div>
                  <label className="label">{t('register.dob')}</label>
                  <input
                    type="date"
                    value={formData.dob}
                    onChange={(e) => updateField('dob', e.target.value)}
                    className="input mt-1"
                  />
                </div>
              </>
            )}

            {role === 'teacher' && (
              <>
                <div>
                  <label className="label">অভিজ্ঞতা (বছর)</label>
                  <input
                    type="number"
                    value={formData.experience_years}
                    onChange={(e) => updateField('experience_years', parseInt(e.target.value))}
                    className="input mt-1"
                    min="0"
                  />
                </div>
                <div>
                  <label className="label">বিভাগ</label>
                  <input
                    type="text"
                    value={formData.department}
                    onChange={(e) => updateField('department', e.target.value)}
                    className="input mt-1"
                  />
                </div>
              </>
            )}

            {role === 'alumni' && (
              <>
                <div>
                  <label className="label">বর্তমান প্রতিষ্ঠান</label>
                  <input
                    type="text"
                    value={formData.current_institution}
                    onChange={(e) => updateField('current_institution', e.target.value)}
                    className="input mt-1"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">পাসের বছর</label>
                    <input
                      type="number"
                      value={formData.passing_year}
                      onChange={(e) => updateField('passing_year', parseInt(e.target.value))}
                      className="input mt-1"
                      min="1993"
                    />
                  </div>
                  <div>
                    <label className="label">পুরনো শ্রেণী</label>
                    <input
                      type="number"
                      value={formData.old_class}
                      onChange={(e) => updateField('old_class', parseInt(e.target.value))}
                      className="input mt-1"
                    />
                  </div>
                </div>
              </>
            )}

            {role === 'guardian' && (
              <>
                <div>
                  <label className="label">ফোন নম্বর</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className="input mt-1"
                    placeholder="+8801XXXXXXXXX"
                  />
                </div>
                <div>
                  <label className="label">সম্পর্ক</label>
                  <input
                    type="text"
                    value={formData.relationship}
                    onChange={(e) => updateField('relationship', e.target.value)}
                    className="input mt-1"
                  />
                </div>
                <div>
                  <label className="label">পেশা</label>
                  <input
                    type="text"
                    value={formData.occupation}
                    onChange={(e) => updateField('occupation', e.target.value)}
                    className="input mt-1"
                  />
                </div>
              </>
            )}

            <button onClick={() => setStep(3)} className="btn btn-primary w-full">
              {t('register.next')}
            </button>
          </div>
        )}

        {/* Step 3: Document upload */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">ডকুমেন্ট আপলোড</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              আপনার আইডি কার্ডের ছবি আপলোড করুন। এটি নিরাপদে সংরক্ষণ করা হবে।
            </p>
            <div>
              <label className="label">{t('register.idFront')}</label>
              <input
                type="file"
                accept="image/*"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const svg = await handleFileUpload(file);
                    updateField('id_front', svg);
                  }
                }}
                className="input mt-1"
              />
            </div>
            {role !== 'teacher' && (
              <div>
                <label className="label">{t('register.idBack')}</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const svg = await handleFileUpload(file);
                      updateField('id_back', svg);
                    }
                  }}
                  className="input mt-1"
                />
              </div>
            )}
            <button
              onClick={() => setStep(4)}
              className="btn btn-primary w-full"
              disabled={!formData.id_front}
            >
              {t('register.next')}
            </button>
          </div>
        )}

        {/* Step 4: Password */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold">পাসওয়ার্ড সেট করুন</h2>
            <div>
              <label className="label">{t('auth.password')}</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => updateField('password', e.target.value)}
                className="input mt-1"
                minLength={8}
                required
              />
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <div
                    key={i}
                    className={`h-1 flex-1 rounded-full ${
                      i <= passwordStrength(formData.password)
                        ? passwordStrength(formData.password) >= 3 ? 'bg-green-500' : 'bg-yellow-500'
                        : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  />
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Strength: {passwordStrength(formData.password)}/5
              </p>
            </div>
            <button
              onClick={handleSubmit}
              className="btn btn-primary w-full"
              disabled={loading || passwordStrength(formData.password) < 3}
            >
              {loading ? t('common.loading') : t('register.submit')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
