export interface SearchMetadataResult {
  source: string;
  id: string;
  title: string;
  authors: string[];
  year?: number;
  description?: string;
  genres: string[];
  publisher?: string;
  coverUrl?: string; // Standardized proxy URL for UI display
  externalId?: string; // Raw ID from the source
  coverUploadUrl?: string; // Raw URL for uploading to the server
}

export interface SearchProvider {
  /**
   * Search for metadata/covers
   */
  search(query: string, limit?: number): Promise<{ results: SearchMetadataResult[]; warning?: string }>;

  /**
   * Get name of the source (e.g. 'Google Books', 'Open Library')
   */
  getSourceName(): string;

  /**
   * Get unique ID for the source
   */
  getSourceId(): string;
}
