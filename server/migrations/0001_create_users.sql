-- depends:

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id bigint UNIQUE NOT NULL,
    telegram_username text,
    nickname text CHECK (char_length(nickname) BETWEEN 2 AND 30),
    gender text CHECK (gender IN ('male', 'female')),
    real_name text,
    department text,
    status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'banned')),
    is_admin boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);
