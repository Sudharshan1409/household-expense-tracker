import useSWR, { SWRConfiguration } from 'swr';
import { fetchAuthSession } from 'aws-amplify/auth';

/**
 * A generic fetcher that automatically gets the Cognito token
 * and calls the provided server action.
 */
export const authFetcher = async <T, Args extends any[]>([action, householdId, ...args]: [
  action: (token: string, householdId: string, ...args: Args) => Promise<T>,
  householdId: string,
  ...args: Args
]): Promise<T> => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  
  if (!token) {
    throw new Error('No authentication token available');
  }

  return action(token, householdId, ...args);
};

/**
 * A custom hook that wraps SWR to handle AWS Amplify authentication.
 * 
 * @param action The server action to call
 * @param householdId The active household ID (if null, fetching is paused)
 * @param args Additional arguments to pass to the server action
 * @param config Optional SWR configuration
 */
export function useAuthSWR<T, Args extends any[]>(
  action: (token: string, householdId: string, ...args: Args) => Promise<T>,
  householdId: string | null | undefined,
  args: Args = [] as unknown as Args,
  config?: SWRConfiguration<T>
) {
  // If householdId is missing, return null key to pause fetching
  const key = householdId ? [action, householdId, ...args] : null;

  return useSWR<T, Error>(
    key,
    // @ts-ignore - TypeScript struggles with tuple spread in generic signatures
    authFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      ...config,
    }
  );
}

export const authGlobalFetcher = async <T, Args extends any[]>([action, ...args]: [
  action: (token: string, ...args: Args) => Promise<T>,
  ...args: Args
]): Promise<T> => {
  const session = await fetchAuthSession();
  const token = session.tokens?.idToken?.toString();
  
  if (!token) {
    throw new Error('No authentication token available');
  }

  return action(token, ...args);
};

export function useAuthSWRGlobal<T, Args extends any[]>(
  action: (token: string, ...args: Args) => Promise<T>,
  args: Args = [] as unknown as Args,
  config?: SWRConfiguration<T>
) {
  const key = [action, ...args];
  return useSWR<T, Error>(
    key,
    // @ts-ignore
    authGlobalFetcher,
    {
      revalidateOnFocus: true,
      revalidateOnReconnect: true,
      dedupingInterval: 2000,
      ...config,
    }
  );
}
