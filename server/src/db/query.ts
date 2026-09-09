import { QueryResult, QueryResultRow } from 'pg';
import { pool } from './pool';

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  try {
    return await pool.query<T>(text, params);
  } catch (error) {
    console.error('Database query error:', { text, params, error });
    throw error;
  }
}
