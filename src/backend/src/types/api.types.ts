export interface PaginationMeta {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}

export interface ApiSuccess<T> {
  data: T;
  meta: Record<string, never> | PaginationMeta;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
  };
}
