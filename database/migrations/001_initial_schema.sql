CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    email_verified_at TIMESTAMP NULL,
    password VARCHAR(255) NOT NULL,
    remember_token VARCHAR(100) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    email VARCHAR(255) PRIMARY KEY,
    token VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id BIGINT NULL REFERENCES users(id),
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    payload TEXT NOT NULL,
    last_activity INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id_index ON sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_last_activity_index ON sessions(last_activity);

CREATE TABLE IF NOT EXISTS personal_access_tokens (
    id BIGSERIAL PRIMARY KEY,
    tokenable_type VARCHAR(255) NOT NULL,
    tokenable_id BIGINT NOT NULL,
    name TEXT NOT NULL,
    token VARCHAR(64) NOT NULL UNIQUE,
    abilities TEXT NULL,
    last_used_at TIMESTAMP NULL,
    expires_at TIMESTAMP NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS personal_access_tokens_tokenable_type_tokenable_id_index
    ON personal_access_tokens(tokenable_type, tokenable_id);
CREATE INDEX IF NOT EXISTS personal_access_tokens_expires_at_index
    ON personal_access_tokens(expires_at);

CREATE TABLE IF NOT EXISTS accounts (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(255) NOT NULL DEFAULT 'bank',
    balance BIGINT NOT NULL DEFAULT 0,
    description TEXT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS accounts_user_id_index ON accounts(user_id);

CREATE TABLE IF NOT EXISTS categories (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL,
    type VARCHAR(255) NOT NULL DEFAULT 'expense',
    sublabel VARCHAR(255) NULL,
    icon VARCHAR(255) NOT NULL DEFAULT 'CircleDot',
    color VARCHAR(255) NOT NULL DEFAULT '#343F56',
    is_system BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS categories_user_id_index ON categories(user_id);
CREATE INDEX IF NOT EXISTS categories_type_index ON categories(type);

CREATE TABLE IF NOT EXISTS transactions (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id BIGINT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    type VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL,
    description VARCHAR(255) NOT NULL,
    transaction_date DATE NOT NULL,
    payment_method VARCHAR(255) NULL,
    notes TEXT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS transactions_user_id_transaction_date_index
    ON transactions(user_id, transaction_date);
CREATE INDEX IF NOT EXISTS transactions_user_id_type_index
    ON transactions(user_id, type);
CREATE INDEX IF NOT EXISTS transactions_account_id_index ON transactions(account_id);
CREATE INDEX IF NOT EXISTS transactions_category_id_index ON transactions(category_id);

CREATE TABLE IF NOT EXISTS pay_later_bills (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_name VARCHAR(255) NOT NULL,
    description VARCHAR(255) NULL,
    total_amount BIGINT NOT NULL,
    paid_amount BIGINT NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'pending',
    installment_info VARCHAR(255) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS pay_later_bills_user_id_due_date_index
    ON pay_later_bills(user_id, due_date);
CREATE INDEX IF NOT EXISTS pay_later_bills_user_id_status_index
    ON pay_later_bills(user_id, status);

CREATE TABLE IF NOT EXISTS pay_later_repayments (
    id BIGSERIAL PRIMARY KEY,
    pay_later_bill_id BIGINT NOT NULL REFERENCES pay_later_bills(id) ON DELETE CASCADE,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    account_id BIGINT NULL REFERENCES accounts(id) ON DELETE SET NULL,
    amount BIGINT NOT NULL,
    repayment_date DATE NOT NULL,
    notes VARCHAR(255) NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
CREATE INDEX IF NOT EXISTS pay_later_repayments_pay_later_bill_id_index
    ON pay_later_repayments(pay_later_bill_id);
CREATE INDEX IF NOT EXISTS pay_later_repayments_user_id_index ON pay_later_repayments(user_id);

CREATE TABLE IF NOT EXISTS budgets (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id BIGINT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    month SMALLINT NOT NULL,
    year SMALLINT NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    CONSTRAINT budgets_user_id_category_id_month_year_unique
        UNIQUE(user_id, category_id, month, year)
);
CREATE INDEX IF NOT EXISTS budgets_user_id_month_year_index ON budgets(user_id, month, year);

CREATE TABLE IF NOT EXISTS self_lock_settings (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    activated_at TIMESTAMP NULL,
    lifestyle_budget_cap BIGINT NOT NULL DEFAULT 100000,
    hide_shopping_recommendations BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL
);
