import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RiKey2Line, RiCheckLine, RiCloseLine, RiBrainLine, RiGithubFill, RiTerminalBoxLine } from 'react-icons/ri';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { useState, useEffect } from 'react';
import { Button } from '#/components/Button';
import { Input } from '#/components/Input';
import { Select, SelectItem } from '#/components/Select';

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

const AVAILABLE_MODELS = [
  { id: 'google-gemini/gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite (Recommended & Fastest)' },
  { id: 'google-gemini/gemini-3-1-pro-preview', name: 'Gemini 3.1 Pro Preview (Deep Reasoning)' },
  { id: 'google-gemini/gemini-3-6-flash', name: 'Gemini 3.6 Flash' },
  { id: 'google-gemini/gemini-1.5-flash', name: 'Gemini 1.5 Flash (Generous Free Tier)' },
  { id: 'google-gemini/gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
  { id: 'anthropic/claude-sonnet-4-6', name: 'Anthropic Claude Sonnet 4.6' },
  { id: 'openai/gpt-4o', name: 'OpenAI GPT-4o' },
];

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
    control,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-mock-rise">
      <div className="w-full max-w-lg border border-white/[0.1] bg-[#15171d] shadow-2xl p-6 flex flex-col max-h-[90vh] rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#118af3]/15 text-[#118af3] border border-[#118af3]/25">
                <RiKey2Line className="text-sm" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-white">
                BYOK Model & Key Configuration
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              Configure model routing, API tokens, and TrueForge local harness connections.
            </p>
          </div>

          <button
            className="flex h-7 w-7 items-center justify-center rounded-lg text-neutral-400 hover:text-white hover:bg-white/[0.06] transition"
            onClick={onClose}
          >
            <RiCloseLine className="text-lg" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto pt-4 pr-1">
          {/* Active Model Selector */}
          <div>
            <Controller
              name="selectedModel"
              control={control}
              render={({ field }) => (
                <Select
                  label="Active LLM Model"
                  placeholder="Choose model..."
                  value={field.value}
                  onChange={(e: any) => field.onChange(e?.target?.value || e)}
                >
                  {AVAILABLE_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name}
                    </SelectItem>
                  ))}
                </Select>
              )}
            />
          </div>

          {/* Gemini API Key */}
          <div className="space-y-1">
            <Input
              type="password"
              label={
                <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <RiBrainLine className="text-[#118af3]" /> Google Gemini API Key
                </span>
              }
              placeholder="AIzaSy..."
              {...register('geminiApiKey')}
            />
          </div>

          {/* GitHub Token */}
          <div className="space-y-1">
            <Input
              type="password"
              label={
                <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <RiGithubFill className="text-white" /> GitHub Personal Access Token (PAT)
                </span>
              }
              placeholder="ghp_..."
              {...register('githubToken')}
            />
          </div>

          {/* TrueForge Base URL */}
          <div className="space-y-1">
            <Input
              type="text"
              label={
                <span className="flex items-center gap-1.5 text-xs text-neutral-400">
                  <RiTerminalBoxLine className="text-emerald-400" /> TrueForge Harness Server Base URL
                </span>
              }
              placeholder="http://localhost:8790"
              {...register('trueforgeBaseUrl')}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-white/[0.08]">
            {saveSuccessMsg ? (
              <span className="font-mono text-xs text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/25">
                <RiCheckLine /> Settings Saved!
              </span>
            ) : (
              <span />
            )}

            <div className="flex gap-2">
              <Button
                variant="secondary"
                className="tembo-btn-secondary h-8 px-4 text-xs"
                onClick={onClose}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                isLoading={updateSettingsMutation.isPending}
                className="tembo-btn-primary h-8 px-4 text-xs font-bold shadow-md"
              >
                Save Settings
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
