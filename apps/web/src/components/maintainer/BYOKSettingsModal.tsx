import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RiKey2Line } from 'react-icons/ri';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { useState, useEffect } from 'react';

const settingsSchema = z.object({
  geminiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  githubToken: z.string().optional(),
  selectedModel: z.string().optional(),
  trueforgeBaseUrl: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface BYOKSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings?: SettingsFormValues;
  onSuccess?: () => void;
}

export function BYOKSettingsModal({ isOpen, onClose, initialSettings, onSuccess }: BYOKSettingsModalProps) {
  const queryClient = useQueryClient();
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  const updateSettingsMutation = useMutation(
    orpc.maintainer.updateSettings.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getSettings.key() });
        setSaveSuccessMsg(true);
        if (onSuccess) onSuccess();
        setTimeout(() => {
          setSaveSuccessMsg(false);
          onClose();
        }, 1200);
      },
      onError: (err) => {
        console.error('Update settings failed:', err);
      },
    })
  );

  const {
    register,
    handleSubmit,
    reset,
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      geminiApiKey: '',
      anthropicApiKey: '',
      openaiApiKey: '',
      githubToken: '',
      selectedModel: 'google-gemini/gemini-3.1-flash-lite',
      trueforgeBaseUrl: 'http://localhost:8790',
    },
  });

  useEffect(() => {
    if (isOpen && initialSettings) {
      reset({
        geminiApiKey: initialSettings.geminiApiKey || '',
        anthropicApiKey: initialSettings.anthropicApiKey || '',
        openaiApiKey: initialSettings.openaiApiKey || '',
        githubToken: initialSettings.githubToken || '',
        selectedModel: initialSettings.selectedModel || 'google-gemini/gemini-3.1-flash-lite',
        trueforgeBaseUrl: initialSettings.trueforgeBaseUrl || 'http://localhost:8790',
      });
    }
  }, [isOpen, initialSettings, reset]);

  if (!isOpen) return null;

  const onSubmit = (values: SettingsFormValues) => {
    updateSettingsMutation.mutate(values);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <RiKey2Line className="text-cyan-400" /> BYOK Model & Key Settings
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Select Active Model</label>
            <select
              {...register('selectedModel')}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none"
            >
              <option value="google-gemini/gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Recommended)</option>
              <option value="google-gemini/gemini-3-1-pro-preview">Gemini 3.1 Pro Preview</option>
              <option value="google-gemini/gemini-3-6-flash">Gemini 3.6 Flash</option>
              <option value="anthropic/claude-sonnet-4-6">Anthropic Claude Sonnet 4.6</option>
              <option value="openai/gpt-4o">OpenAI GPT-4o</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Google AI Studio API Key (Gemini)</label>
            <input
              type="password"
              placeholder="AIzaSy..."
              {...register('geminiApiKey')}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">GitHub Personal Access Token (PAT)</label>
            <input
              type="password"
              placeholder="ghp_..."
              {...register('githubToken')}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">TrueForge Harness Base URL</label>
            <input
              type="text"
              placeholder="http://localhost:8790"
              {...register('trueforgeBaseUrl')}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            {saveSuccessMsg ? (
              <span className="text-xs text-emerald-400 font-semibold">✓ Settings Saved!</span>
            ) : (
              <span></span>
            )}

            <button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="rounded-lg bg-cyan-600 hover:bg-cyan-500 px-5 py-2 text-xs font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
