import { QueryResult, QueryResultRow } from 'pg';
export declare function query<T extends QueryResultRow = QueryResultRow>(text: string, params?: unknown[]): Promise<QueryResult<T>>;
