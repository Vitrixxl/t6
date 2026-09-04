import type { MobilityProfile } from '../../contracts';
import { api, treatyRequest } from './client';

export function saveProfile(profile: MobilityProfile): Promise<MobilityProfile> {
    return treatyRequest(api.me.profile.put(profile));
}
