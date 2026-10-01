CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE booking_status AS ENUM (
  'PENDING',
  'CONFIRMED',
  'CHECKED_IN',
  'CHECKED_OUT',
  'CANCELLED'
);

CREATE TYPE booking_source AS ENUM (
  'WEBSITE',
  'WALK_IN',
  'BOOKING_LK'
);

CREATE TYPE room_status AS ENUM (
  'VACANT',
  'OCCUPIED',
  'REQUIRES_CLEANING',
  'UNDER_MAINTENANCE'
);

CREATE TYPE staff_role AS ENUM (
  'MANAGER',
  'RECEPTIONIST',
  'WORKER',
  'KITCHEN_STAFF',
  'KITCHEN_MANAGER'
);

CREATE TYPE promotion_discount_type AS ENUM (
  'PERCENTAGE',
  'FIXED_AMOUNT'
);

CREATE TYPE promotion_status AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

CREATE TYPE payment_method AS ENUM (
  'STRIPE',
  'CASH',
  'CARD_ON_SITE'
);

CREATE TYPE payment_status AS ENUM (
  'PENDING',
  'COMPLETED',
  'REFUNDED',
  'FAILED'
);

CREATE TYPE audit_event_category AS ENUM (
  'AUTHENTICATION',
  'FRONT_DESK_OPERATION',
  'PAYMENT',
  'STAFF_ACCOUNT_MANAGEMENT',
  'DATA_ACCESS',
  'TASK_SERVICE',
  'FOOD_ORDER'
);

CREATE TYPE audit_actor_type AS ENUM (
  'STAFF',
  'GUEST',
  'SYSTEM',
  'ANONYMOUS'
);

CREATE TABLE guests (
  guest_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  full_name VARCHAR(255) NOT NULL,

  email VARCHAR(320) NOT NULL UNIQUE,

  password_hash VARCHAR(255) NOT NULL,

  nic_or_passport VARCHAR(50),

  phone VARCHAR(20),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE room_types (
  room_type_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  type_name VARCHAR(100) NOT NULL UNIQUE,

  price_per_night INTEGER NOT NULL
    CHECK (price_per_night > 0),

  max_guests INTEGER NOT NULL
    CHECK (max_guests > 0),

  description TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE rooms (
  room_number VARCHAR(10) PRIMARY KEY,

  room_type_id UUID NOT NULL
    REFERENCES room_types(room_type_id)
    ON DELETE RESTRICT,

  floor INTEGER NOT NULL,

  status room_status NOT NULL DEFAULT 'VACANT',

  last_cleared_at TIMESTAMPTZ,

  notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE staff_users (
  worker_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  full_name VARCHAR(255) NOT NULL,

  vocation VARCHAR(100) NOT NULL,

  email VARCHAR(320) NOT NULL UNIQUE,

  phone VARCHAR(20),

  age INTEGER
    CHECK (age IS NULL OR age > 0),

  nic VARCHAR(50),

  username VARCHAR(100) NOT NULL UNIQUE,

  password_hash VARCHAR(255) NOT NULL,

  role staff_role NOT NULL,

  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE mad_promotion_codes (
  promo_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  code_string VARCHAR(50) NOT NULL UNIQUE,

  discount_type promotion_discount_type NOT NULL,

  discount_value INTEGER NOT NULL
    CHECK (discount_value > 0),

  valid_from TIMESTAMPTZ NOT NULL,

  valid_until TIMESTAMPTZ NOT NULL,

  max_redemptions INTEGER NOT NULL DEFAULT 100
    CHECK (max_redemptions > 0),

  current_redemptions INTEGER NOT NULL DEFAULT 0
    CHECK (current_redemptions >= 0),

  status promotion_status NOT NULL DEFAULT 'ACTIVE',

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_promotion_dates
    CHECK (valid_until > valid_from),

  CONSTRAINT chk_promotion_redemptions
    CHECK (current_redemptions <= max_redemptions),

  CONSTRAINT chk_percentage_discount
    CHECK (
      discount_type <> 'PERCENTAGE'
      OR discount_value <= 100
    )
);

CREATE TABLE bookings (
  booking_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  guest_id UUID
    REFERENCES guests(guest_id)
    ON DELETE RESTRICT,

  room_type_id UUID NOT NULL
    REFERENCES room_types(room_type_id)
    ON DELETE RESTRICT,

  room_number VARCHAR(10)
    REFERENCES rooms(room_number)
    ON DELETE RESTRICT,

  promo_id UUID
    REFERENCES mad_promotion_codes(promo_id)
    ON DELETE SET NULL,

  check_in_date DATE NOT NULL,

  check_out_date DATE NOT NULL,

  status booking_status NOT NULL DEFAULT 'PENDING',

  total_amount INTEGER NOT NULL
    CHECK (total_amount > 0),

  source booking_source NOT NULL DEFAULT 'WEBSITE',

  special_requests TEXT,

  num_guests INTEGER NOT NULL DEFAULT 1
    CHECK (num_guests > 0),

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_booking_dates
    CHECK (check_out_date > check_in_date)
);

CREATE TABLE payments (
  payment_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  booking_id UUID NOT NULL
    REFERENCES bookings(booking_id)
    ON DELETE RESTRICT,

  payment_method payment_method NOT NULL,

  amount INTEGER NOT NULL
    CHECK (amount > 0),

  payment_status payment_status NOT NULL DEFAULT 'PENDING',

  stripe_ref VARCHAR(255) UNIQUE,

  paid_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE foss_sessions (
  session_id UUID
    PRIMARY KEY DEFAULT uuid_generate_v4(),

  booking_id UUID
    NOT NULL UNIQUE
    REFERENCES bookings(booking_id)
    ON DELETE RESTRICT,

  room_number VARCHAR(10)
    NOT NULL
    REFERENCES rooms(room_number)
    ON DELETE RESTRICT,

  session_token VARCHAR(500)
    NOT NULL UNIQUE,

  is_active BOOLEAN
    NOT NULL DEFAULT TRUE,

  created_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW(),

  expires_at TIMESTAMPTZ
    NOT NULL,

  CONSTRAINT chk_foss_session_expiry
    CHECK (expires_at > created_at)
);

CREATE TABLE audit_logs (
  log_id UUID
    PRIMARY KEY DEFAULT uuid_generate_v4(),

  event_category audit_event_category
    NOT NULL,

  actor_type audit_actor_type
    NOT NULL,

  staff_user_id UUID
    REFERENCES staff_users(worker_id)
    ON DELETE RESTRICT,

  guest_id UUID
    REFERENCES guests(guest_id)
    ON DELETE RESTRICT,

  foss_session_id UUID
    REFERENCES foss_sessions(session_id)
    ON DELETE RESTRICT,

  action VARCHAR(100)
    NOT NULL,

  entity_type VARCHAR(100)
    NOT NULL,

  entity_id VARCHAR(255),

  details JSONB,

  ip_address VARCHAR(45),

  created_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW(),

  updated_at TIMESTAMPTZ
    NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_audit_staff_actor
    CHECK (
      actor_type <> 'STAFF'
      OR staff_user_id IS NOT NULL
    ),

  CONSTRAINT chk_audit_guest_actor
    CHECK (
      actor_type <> 'GUEST'
      OR guest_id IS NOT NULL
      OR foss_session_id IS NOT NULL
    )
);

CREATE INDEX idx_audit_logs_category
  ON audit_logs(event_category);

CREATE INDEX idx_audit_logs_staff
  ON audit_logs(staff_user_id);

CREATE INDEX idx_audit_logs_guest
  ON audit_logs(guest_id);

CREATE INDEX idx_audit_logs_session
  ON audit_logs(foss_session_id);

CREATE INDEX idx_audit_logs_entity
  ON audit_logs(entity_type, entity_id);

CREATE INDEX idx_audit_logs_created_at
  ON audit_logs(created_at);

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;