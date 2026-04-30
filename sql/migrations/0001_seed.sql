-- DDL seed script — Aurora DSQL-compatible (no foreign keys, no triggers, no TRUNCATE)

CREATE TABLE IF NOT EXISTS users (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    email       text        NOT NULL UNIQUE,
    display_name text,
    created_at  timestamp   NOT NULL DEFAULT now(),
    updated_at  timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS companies (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    org_number  text        UNIQUE,
    created_at  timestamp   NOT NULL DEFAULT now(),
    updated_at  timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_companies (
    user_id     uuid        NOT NULL,
    company_id  uuid        NOT NULL,
    role        text        NOT NULL DEFAULT 'member',
    PRIMARY KEY (user_id, company_id)
);

CREATE TABLE IF NOT EXISTS cards (
    id           uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id   uuid           NOT NULL,
    card_label   text           NOT NULL DEFAULT '',
    spend_limit  numeric(12,2)  NOT NULL DEFAULT 0,
    currency     char(3)        NOT NULL DEFAULT 'SEK',
    status       text           NOT NULL DEFAULT 'inactive',
    activated_at timestamp,
    created_at   timestamp      NOT NULL DEFAULT now(),
    updated_at   timestamp      NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_cards (
    user_id     uuid        NOT NULL,
    card_id     uuid        NOT NULL,
    company_id  uuid        NOT NULL,
    role        text        NOT NULL DEFAULT 'cardholder',
    assigned_at timestamp   NOT NULL DEFAULT now(),
    assigned_by uuid,
    PRIMARY KEY (user_id, card_id)
);

CREATE TABLE IF NOT EXISTS invoices (
    id          uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id  uuid           NOT NULL,
    amount      numeric(12,2)  NOT NULL,
    currency    char(3)        NOT NULL DEFAULT 'SEK',
    status      text           NOT NULL DEFAULT 'pending',
    due_date    date           NOT NULL,
    paid_at     timestamp,
    created_at  timestamp      NOT NULL DEFAULT now(),
    updated_at  timestamp      NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
    id            uuid           PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id       uuid           NOT NULL,
    invoice_id    uuid,
    amount        numeric(12,2)  NOT NULL,
    currency      char(3)        NOT NULL DEFAULT 'SEK',
    description   text,
    merchant_name text,
    status        text           NOT NULL DEFAULT 'pending',
    transacted_at timestamp      NOT NULL,
    created_at    timestamp      NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL,
    company_id  uuid,
    subject     text,
    message     text        NOT NULL,
    status      text        NOT NULL DEFAULT 'open',
    created_at  timestamp   NOT NULL DEFAULT now(),
    updated_at  timestamp   NOT NULL DEFAULT now()
);
