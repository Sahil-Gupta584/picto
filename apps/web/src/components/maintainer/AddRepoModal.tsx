import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { RiGitBranchLine, RiRefreshLine, RiLockLine, RiGlobeLine, RiCheckLine } from 'react-icons/ri';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { orpc } from '#/orpc/client';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
              <RiGitBranchLine className="text-cyan-400 text-lg" /> Connect GitHub Repository
            </h3>
            <p className="text-xs text-slate-400">Select one of your GitHub repositories or type owner/repo manually.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg font-bold cursor-pointer">
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 flex-1 overflow-y-auto pr-1">
          {/* Selectable Repositories List */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-300">Your GitHub Repositories</label>
              <button
                type="button"
                onClick={() => refetchAvailableRepos()}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
              >
                <RiRefreshLine className={isLoadingRepos ? 'animate-spin' : ''} />
                <span>Fetch Latest</span>
              </button>
            </div>

            {isLoadingRepos ? (
              <div className="p-6 text-center text-xs text-slate-500 rounded-xl bg-slate-950 border border-slate-800">
                Fetching repositories from GitHub API...
              </div>
            ) : availableRepos.length > 0 ? (
              <div className="max-h-48 overflow-y-auto rounded-xl bg-slate-950 border border-slate-800 p-2 space-y-1.5">
                {availableRepos.map((r) => {
                  const isSelected = selectedRepo === r.fullName;
                  return (
                    <div
                      key={r.id || r.fullName}
                      onClick={() => setValue('repoFullName', r.fullName, { shouldValidate: true })}
                      className={
                        'flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition border text-xs ' +
                        (isSelected
                          ? 'bg-cyan-950/60 border-cyan-500/80 text-white'
                          : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700 hover:text-white')
                      }
                    >
                      <div className="flex items-center gap-2 truncate">
                        {r.private ? (
                          <RiLockLine className="text-amber-400 shrink-0" title="Private Repository" />
                        ) : (
                          <RiGlobeLine className="text-slate-400 shrink-0" title="Public Repository" />
                        )}
                        <span className="font-mono font-semibold truncate">{r.fullName}</span>
                      </div>

                      {isSelected && (
                        <span className="flex items-center gap-1 text-[10px] font-bold text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800">
                          <RiCheckLine /> Selected
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-slate-500 rounded-xl bg-slate-950 border border-slate-800">
                No repositories returned. Ensure GitHub PAT is saved in "BYOK & Config", or type repo name manually below.
              </div>
            )}
          </div>

          {/* Manual Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Selected Repository (owner/name)</label>
            <input
              type="text"
              placeholder="e.g. octocat/hello-world"
              {...register('repoFullName')}
              className="w-full rounded-lg bg-slate-950 border border-slate-700 px-3 py-2 text-xs text-slate-100 focus:border-cyan-500 focus:outline-none font-mono"
            />
            {errors.repoFullName && (
              <p className="mt-1 text-[11px] text-red-400">{errors.repoFullName.message}</p>
            )}
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="autoFixEnabled"
              {...register('autoFixEnabled')}
              className="rounded bg-slate-950 border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
            />
            <label htmlFor="autoFixEnabled" className="text-xs text-slate-300 font-medium cursor-pointer">
              Enable Autonomous AI Triage & PR Generation
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={addRepoMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md transition disabled:opacity-50 cursor-pointer"
            >
              {addRepoMutation.isPending ? 'Connecting...' : 'Connect Repository'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
