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

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;