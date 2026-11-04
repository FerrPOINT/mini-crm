// Database contract from supabase/migrations/202611040001_crm.sql.
type Role = 'manager' | 'executor';
type Status = 'new' | 'in_progress' | 'in_review' | 'accepted' | 'rework';
type ProfileRow = { id: string; full_name: string; role: Role };
type SiteRow = {
  id: string;
  name: string;
  address: string;
  created_at: string;
  deleted_at: string | null;
};
type TaskRow = {
  id: string;
  title: string;
  description: string;
  site_id: string;
  assignee_id: string;
  status: Status;
  author_id: string;
  created_at: string;
  deleted_at: string | null;
};
type HistoryRow = {
  id: number;
  task_id: string;
  actor_id: string;
  from_status: Status | null;
  to_status: Status;
  comment: string | null;
  created_at: string;
};
type Relation<Name extends string, Column extends string, Table extends string> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Table;
  referencedColumns: ['id'];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileRow;
        Update: Partial<ProfileRow>;
        Relationships: [];
      };
      sites: {
        Row: SiteRow;
        Insert: Pick<SiteRow, 'name' | 'address'>;
        Update: Partial<Pick<SiteRow, 'name' | 'address'>>;
        Relationships: [];
      };
      tasks: {
        Row: TaskRow;
        Insert: Pick<TaskRow, 'title' | 'description' | 'site_id' | 'assignee_id'>;
        Update: Partial<Pick<TaskRow, 'title' | 'description' | 'site_id' | 'assignee_id'>>;
        Relationships: [
          Relation<'tasks_site_id_fkey', 'site_id', 'sites'>,
          Relation<'tasks_assignee_id_fkey', 'assignee_id', 'profiles'>,
          Relation<'tasks_author_id_fkey', 'author_id', 'profiles'>,
        ];
      };
      task_history: {
        Row: HistoryRow;
        Insert: never;
        Update: never;
        Relationships: [
          Relation<'task_history_task_id_fkey', 'task_id', 'tasks'>,
          Relation<'task_history_actor_id_fkey', 'actor_id', 'profiles'>,
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      transition_task: {
        Args: {
          p_task_id: string;
          p_expected_status: Status;
          p_next_status: Status;
          p_comment?: string | null;
        };
        Returns: TaskRow;
      };
      delete_task: { Args: { p_task_id: string }; Returns: undefined };
      delete_site: { Args: { p_site_id: string }; Returns: undefined };
    };
    Enums: { app_role: Role; task_status: Status };
    CompositeTypes: Record<string, never>;
  };
};
