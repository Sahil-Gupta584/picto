import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RiGitBranchLine, RiRefreshLine, RiLockLine, RiGlobeLine, RiCheckLine, RiCloseLine } from 'react-icons/ri';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';
import { Card, Spinner, Checkbox } from '@heroui/react';
import { Button } from '#/components/Button';
import { Input } from '#/components/Input';

const repoSchema = z.object({
  repoFullName: z
    .string()
    .min(1, 'Repository full name is required')
    .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/, 'Format must be owner/repository (e.g. octocat/hello-world)'),
  autoFixEnabled: z.boolean().optional(),
});

type RepoFormValues = z.infer<typeof repoSchema>;

interface AddRepoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AddRepoModal({ isOpen, onClose, onSuccess }: AddRepoModalProps) {
  const queryClient = useQueryClient();

  const { data: availableRepos = [], isLoading: isLoadingRepos, refetch: refetchAvailableRepos } = useQuery(
    orpc.maintainer.getAvailableGitHubRepos.queryOptions({
      enabled: isOpen,
    })
  );

  const addRepoMutation = useMutation(
    orpc.maintainer.addRepo.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: orpc.maintainer.getRepos.key() });
        reset();
        onSuccess();
        onClose();
      },
    })
  );

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    control,
    reset,
    formState: { errors },
  } = useForm<RepoFormValues>({
    resolver: zodResolver(repoSchema),
    defaultValues: {
      repoFullName: '',
      autoFixEnabled: true,
    },
  });

  const selectedRepo = watch('repoFullName');

  if (!isOpen) return null;

  const onSubmit = (values: RepoFormValues) => {
    addRepoMutation.mutate({
      repoFullName: values.repoFullName,
      autoFixEnabled: values.autoFixEnabled ?? true,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-mock-rise">
      <div className="w-full max-w-lg border border-white/[0.1] bg-[#15171d] shadow-2xl p-6 flex flex-col max-h-[90vh] rounded-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#118af3]/15 text-[#118af3] border border-[#118af3]/25">
                <RiGitBranchLine className="text-sm" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-white">
                Connect GitHub Repository
              </h2>
            </div>
            <p className="text-xs text-neutral-400">
              Select from authenticated GitHub repos or enter <code className="text-[#118af3] font-mono">owner/repo</code>.
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
          {/* Selectable Repositories List */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-neutral-400">Available Repositories</span>
              <button
                type="button"
                className="flex items-center gap-1 text-[11px] text-[#118af3] hover:text-[#40a9ff] transition"
                onClick={() => refetchAvailableRepos()}
              >
                <RiRefreshLine className={isLoadingRepos ? 'animate-spin' : ''} />
                <span>Fetch Latest</span>
              </button>
            </div>

            {isLoadingRepos ? (
              <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-[#0f1015] border border-white/[0.06] space-y-2">
                <Spinner size="sm" />
                <span className="text-xs text-neutral-400">Fetching GitHub repositories...</span>
              </div>
            ) : availableRepos.length > 0 ? (
              <div className="max-h-44 overflow-y-auto rounded-xl bg-[#0f1015] border border-white/[0.06] p-1.5 space-y-1">
                {availableRepos.map((r) => {
                  const isSelected = selectedRepo === r.fullName;
                  return (
                    <div
                      key={r.id || r.fullName}
                      onClick={() => setValue('repoFullName', r.fullName, { shouldValidate: true })}
                      className={
                        'flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition border text-xs ' +
                        (isSelected
                          ? 'bg-[#222530] border-[#118af3]/50 text-white shadow-sm'
                          : 'bg-[#15171d] border-white/[0.04] text-neutral-300 hover:border-white/10 hover:text-white')
                      }
                    >
                      <div className="flex items-center gap-2 truncate font-mono">
                        {r.private ? (
                          <RiLockLine className="text-[#f59e0b] shrink-0" />
                        ) : (
                          <RiGlobeLine className="text-neutral-400 shrink-0" />
                        )}
                        <span className="font-semibold truncate">{r.fullName}</span>
                      </div>

                      {isSelected && (
                        <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-1.5 py-0.2 rounded flex items-center gap-1">
                          <RiCheckLine /> Selected
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-neutral-500 rounded-xl bg-[#0f1015] border border-white/[0.06]">
                No repositories found. Enter repository name manually below.
              </div>
            )}
          </div>

          {/* Manual Input */}
          <div className="space-y-1">
            <Input
              label="Selected Repository (owner/name)"
              placeholder="e.g. octocat/hello-world"
              {...register('repoFullName')}
              isInvalid={!!errors.repoFullName}
              errorMessage={errors.repoFullName?.message}
            />
          </div>

          {/* AutoFix Checkbox */}
          <div className="pt-1">
            <Controller
              name="autoFixEnabled"
              control={control}
              render={({ field }) => (
                <Checkbox
                  isSelected={field.value}
                  onChange={(val: any) => field.onChange(typeof val === 'boolean' ? val : val?.target?.checked)}
                >
                  <span className="text-xs text-neutral-300">
                    Enable Autonomous AI Triage & PR Generation
                  </span>
                </Checkbox>
              )}
            />
          </div>

          {/* Footer Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t border-white/[0.08]">
            <Button
              variant="secondary"
              className="tembo-btn-secondary h-8 px-4 text-xs"
              onClick={onClose}
            >
              Cancel
            </Button>

            <Button
              type="submit"
              isLoading={addRepoMutation.isPending}
              className="tembo-btn-primary h-8 px-4 text-xs font-bold shadow-md"
            >
              Connect Repository
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
