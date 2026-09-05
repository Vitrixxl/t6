import { useMutation } from '@tanstack/react-query';
import { downloadAccountExport } from '../lib/api/account-export';

export function useExportAccount() {
    // L’export se relit à chaque clic et ne conserve aucune donnée personnelle en cache.
    return useMutation({ mutationFn: downloadAccountExport, gcTime: 0 });
}
