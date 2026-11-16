-- DDP-203 Phase B: isolated WKMS integration fixture schema.
-- Derived from the user's shared PostgreSQL schema: wkms_tasks, wkms_event_outbox and task enums.
-- Deliberately limited to the disposable fds-ddp203-postgres/front_desk_test database.
\set ON_ERROR_STOP on
DO $$ BEGIN
  IF current_database() <> 'front_desk_test' THEN
    RAISE EXCEPTION 'Wrong database %', current_database();
  END IF;
  IF to_regclass('public.bookings') IS NULL OR to_regclass('public.rooms') IS NULL THEN
    RAISE EXCEPTION 'FDS fixture tables absent';
  END IF;
  IF to_regclass('public.wkms_tasks') IS NOT NULL OR to_regclass('public.wkms_event_outbox') IS NOT NULL THEN
    RAISE EXCEPTION 'WKMS integration test tables already exist; refuse overwrite';
  END IF;
END $$;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_type WHERE typname = 'task_category' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.task_category AS ENUM ('ROOM_CLEANING','EXTRA_TOWELS','WATER_BOTTLES','MAINTENANCE','LAUNDRY','FOOD_DELIVERY','OTHER');
  END IF;
  IF NOT EXISTS (SELECT FROM pg_type WHERE typname = 'task_priority' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.task_priority AS ENUM ('HIGH','NORMAL');
  END IF;
  IF NOT EXISTS (SELECT FROM pg_type WHERE typname = 'task_status' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.task_status AS ENUM ('UNASSIGNED','ASSIGNED','IN_PROGRESS','COMPLETED','ESCALATED');
  END IF;
  IF NOT EXISTS (SELECT FROM pg_type WHERE typname = 'task_source' AND typnamespace = 'public'::regnamespace) THEN
    CREATE TYPE public.task_source AS ENUM ('GUEST_APP','FRONT_DESK','CHECKOUT_TRIGGER','KMS');
  END IF;
END $$;
CREATE TABLE public.wkms_tasks (
  task_id uuid DEFAULT public.uuid_generate_v4() PRIMARY KEY,
  room_number varchar(10) NOT NULL REFERENCES public.rooms(room_number) ON DELETE RESTRICT,
  category public.task_category NOT NULL,
  description text,
  priority public.task_priority NOT NULL DEFAULT 'NORMAL',
  status public.task_status NOT NULL DEFAULT 'UNASSIGNED',
  assigned_worker_id uuid,
  booking_id uuid REFERENCES public.bookings(booking_id) ON DELETE RESTRICT,
  service_request_id uuid UNIQUE,
  food_order_id uuid UNIQUE,
  submitted_at timestamptz NOT NULL DEFAULT NOW(),
  completed_at timestamptz,
  source public.task_source NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_task_completion CHECK (
    (status = 'COMPLETED' AND completed_at IS NOT NULL) OR
    (status <> 'COMPLETED' AND completed_at IS NULL)
  ),
  CONSTRAINT chk_task_source_reference CHECK (
    ((source IN ('GUEST_APP', 'FRONT_DESK')) AND service_request_id IS NOT NULL AND food_order_id IS NULL) OR
    (source = 'KMS' AND category = 'FOOD_DELIVERY' AND food_order_id IS NOT NULL AND service_request_id IS NULL) OR
    (source = 'CHECKOUT_TRIGGER' AND booking_id IS NOT NULL AND service_request_id IS NULL AND food_order_id IS NULL)
  )
);
CREATE INDEX idx_ddp203_tasks_booking ON public.wkms_tasks(booking_id);
CREATE INDEX idx_ddp203_tasks_status ON public.wkms_tasks(status,submitted_at);
CREATE TABLE public.wkms_event_outbox (
  event_id text PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.wkms_tasks(task_id) ON DELETE RESTRICT,
  event_type varchar(100) NOT NULL,
  routing_key varchar(150) NOT NULL,
  payload jsonb NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PUBLISHED')),
  attempt_count integer NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
  last_attempt_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  published_at timestamptz
);
CREATE INDEX idx_ddp203_outbox_pending ON public.wkms_event_outbox(created_at) WHERE status = 'PENDING';
