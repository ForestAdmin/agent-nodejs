export type SequelizeDatasourceOptions = {
  liveQueryConnections?: string;
  actions?: {
    /**
     * If true, add an action to restore soft deleted records.
     * If an array of strings is provided, add an action to restore soft deleted records only for the specified collections.
     */
    restoreSoftDeleted?: boolean | string[];
    /** If true, add an action will permanently delete records.
     * If an array of strings is provided, add an action to permanently delete records only for the specified collections.
     */
    hardDelete?: boolean | string[];
  };
};
