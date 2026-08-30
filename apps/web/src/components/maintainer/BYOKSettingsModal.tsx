import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RiKey2Line, RiCheckLine, RiBrainLine, RiGithubFill, RiTerminalBoxLine, RiDiscordLine } from 'react-icons/ri';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { useState, useEffect } from 'react';
import { Modal } from '@heroui/react';
import { Button } from '#/components/Button';
import { Input } from '#/components/Input';
import { Select, SelectItem } from '#/components/Select';
import { MODELS, DEFAULT_MODEL } from '#/lib/models';

const settingsSchema = z.object({
  geminiApiKey: z.string().optional(),
  anthropicApiKey: z.string().optional(),
  openaiApiKey: z.string().optional(),
  githubToken: z.string().optional(),
  selectedModel: z.string().optional(),
  trueforgeBaseUrl: z.string().optional(),
  discordGuildId: z.string().optional(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

interface BYOKSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSettings?: SettingsFormValues & { lastVisitAt?: string | null };
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

  const { register, handleSubmit, control, reset } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      geminiApiKey: '',
      anthropicApiKey: '',
      openaiApiKey: '',
      githubToken: '',
      selectedModel: DEFAULT_MODEL,
      trueforgeBaseUrl: 'http://localhost:8790',
      discordGuildId: '',
    },
  });

  useEffect(() => {
    if (isOpen && initialSettings) {
      reset({
        geminiApiKey: initialSettings.geminiApiKey || '',
        anthropicApiKey: initialSettings.anthropicApiKey || '',
        openaiApiKey: initialSettings.openaiApiKey || '',
        githubToken: initialSettings.githubToken || '',
        selectedModel: initialSettings.selectedModel || DEFAULT_MODEL,
        trueforgeBaseUrl: initialSettings.trueforgeBaseUrl || 'http://localhost:8790',
        discordGuildId: initialSettings.discordGuildId || '',
      });
    }
  }, [isOpen, initialSettings, reset]);

  const onSubmit = (values: SettingsFormValues) => {
    updateSettingsMutation.mutate(values);
  };

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }} variant="blur">
      <Modal.Container size="md">
        <Modal.Dialog className="bg-background border">
          <Modal.CloseTrigger />
          <Modal.Header>
            <Modal.Icon className="bg-accent-soft text-accent-soft-foreground">
              <RiKey2Line className="size-5" />
            </Modal.Icon>
            <Modal.Heading>BYOK Model & Key Configuration</Modal.Heading>
            <p className="text-sm text-muted mt-1">
              Configure model routing, API tokens, and integrations.
            </p>
          </Modal.Header>
          <Modal.Body>
            <form id="byok-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
                    {MODELS.map((m) => (
                      <SelectItem key={m.key} value={m.key}>
                        {m.label}
                      </SelectItem>
                    ))}
                  </Select>
                )}
              />

              <Input
                type="password"
                label={
                  <span className="flex items-center gap-1.5 text-xs">
                    <RiBrainLine className="text-accent" /> Google Gemini API Key
                  </span>
                }
                placeholder="AIzaSy..."
                {...register('geminiApiKey')}
              />

              <Input
                type="password"
                label={
                  <span className="flex items-center gap-1.5 text-xs">
                    <RiGithubFill /> GitHub Personal Access Token
                  </span>
                }
                placeholder="ghp_..."
                {...register('githubToken')}
              />

              <Input
                type="text"
                label={
                  <span className="flex items-center gap-1.5 text-xs">
                    <RiTerminalBoxLine className="text-success" /> TrueForge Harness URL
                  </span>
                }
                placeholder="http://localhost:8790"
                {...register('trueforgeBaseUrl')}
              />

              <Input
                type="text"
                label={
                  <span className="flex items-center gap-1.5 text-xs">
                    <RiDiscordLine className="text-[#5865F2]" /> Discord Server ID
                  </span>
                }
                placeholder="123456789012345678"
                description="Right-click your Discord server → Copy Server ID (enable Developer Mode in Discord settings first)"
                {...register('discordGuildId')}
              />
            </form>
          </Modal.Body>
          <Modal.Footer>
            {saveSuccessMsg && (
              <span className="text-xs text-success flex items-center gap-1 mr-auto">
                <RiCheckLine /> Saved!
              </span>
            )}
            <Button variant="secondary" onPress={onClose}>Cancel</Button>
            <Button
              type="submit"
              form="byok-form"
              isLoading={updateSettingsMutation.isPending}
              variant='secondary'
            >
              Save Settings
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
