import { affineFetch } from '../fetch-utils';

export async function adminGql<T>(
  query: string,
  variables?: Record<string, unknown>
): Promise<T> {
  const response = await affineFetch('/graphql', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ query, variables }),
  });
  const body = (await response.json()) as {
    data?: T;
    errors?: Array<{ message?: string }>;
  };
  if (body.errors?.length) {
    throw new Error(body.errors[0]?.message ?? 'GraphQL error');
  }
  if (!body.data) {
    throw new Error('Empty GraphQL response');
  }
  return body.data;
}
