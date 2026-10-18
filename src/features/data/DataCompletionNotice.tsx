import { useDataStatus, updateDataStatus } from './operationStatus';
import { NoticeCard } from '@/features/notices/NoticeCard';
import { useNoticeTimeout } from '@/features/notices/useNoticeTimeout';
export default function DataCompletionNotice() {
  const { notice, revision } = useDataStatus();
  const dismiss = () => updateDataStatus({ notice: '' });
  useNoticeTimeout(notice ? `${revision}:${notice}` : '', dismiss);
  if (!notice) return null;
  return <NoticeCard message={notice} action="Done" actionLabel="Dismiss data completion notice" onAction={dismiss} />;
}
