# SakuPas API

Base path: `/api/v1`. Except for registration and login, routes require a bearer
token in `Authorization: Bearer <token>`.

Successful requests use:

```json
{"success":true,"message":"...","data":{}}
```

Validation errors return HTTP 422 with a `{ "message", "errors" }` response.
Unauthenticated or invalid-token requests return HTTP 401 JSON. Errors do not
include secrets or bearer tokens.

## Authentication and profile

| Method | Path | Auth | Request |
|---|---|---:|---|
| POST | `/register` | No | `name`, `email`, `password`, `password_confirmation` |
| POST | `/login` | No | `email`, `password` |
| POST | `/logout` | Yes | — |
| GET | `/user` | Yes | — |
| PUT | `/user` | Yes | `name`, `email` |

Registration and login return `{ user, token }` in `data`. Logout invalidates the
current token.

## Dashboard

| Method | Path | Auth | Query |
|---|---|---:|---|
| GET | `/dashboard` | Yes | — |
| GET | `/dashboard/cash-flow` | Yes | `month`, `year` (optional) |
| GET | `/dashboard/expense-distribution` | Yes | `month`, `year` (optional) |
| GET | `/dashboard/safe-to-spend` | Yes | — |

## Accounts

| Method | Path | Auth | Request |
|---|---|---:|---|
| GET | `/accounts` | Yes | — |
| POST | `/accounts` | Yes | `name`, `account_type`, `balance`, optional `description` |
| GET | `/accounts/{account}` | Yes | — |
| PUT/PATCH | `/accounts/{account}` | Yes | Same fields as create |
| DELETE | `/accounts/{account}` | Yes | — |

## Categories

| Method | Path | Auth | Request |
|---|---|---:|---|
| GET | `/categories` | Yes | — |
| POST | `/categories` | Yes | `name`, `type`, optional `sublabel`, `icon`, `color` |
| DELETE | `/categories/{category}` | Yes | — |

## Transactions

| Method | Path | Auth | Request |
|---|---|---:|---|
| GET | `/transactions` | Yes | Optional `search`, `category_id`, `category_slug`, `type`, `month`, `start_date`, `end_date`, `page`, `per_page` |
| POST | `/transactions` | Yes | `account_id`, `category_id`, `type`, `amount`, `description`, `transaction_date`; optional `payment_method`, `notes` |
| GET | `/transactions/{transaction}` | Yes | — |
| PUT/PATCH | `/transactions/{transaction}` | Yes | Same fields as create |
| DELETE | `/transactions/{transaction}` | Yes | — |

Income and expense creation/update/deletion adjusts the corresponding account
balance in the same PostgreSQL transaction as the transaction record.

## PayLater

| Method | Path | Auth | Request |
|---|---|---:|---|
| GET | `/paylater` | Yes | — |
| POST | `/paylater` | Yes | `provider_name`, `total_amount`, `due_date`; optional `description`, `installment_info` |
| GET | `/paylater/{paylater}` | Yes | — |
| PUT | `/paylater/{paylater}` | Yes | Same fields as create |
| DELETE | `/paylater/{paylater}` | Yes | — |
| POST | `/paylater/{paylater}/toggle-paid` | Yes | Optional `account_id` |
| GET | `/paylater/{paylater}/repayments` | Yes | — |
| POST | `/paylater/{paylater}/repayments` | Yes | `amount`; optional `account_id`, `repayment_date`, `notes` |

## Budgets

| Method | Path | Auth | Request |
|---|---|---:|---|
| GET | `/budgets` | Yes | Optional `month`, `year` |
| POST | `/budgets` | Yes | `category_id`, `amount`; optional `month`, `year` |
| DELETE | `/budgets/{budget}` | Yes | — |

## Mode Hemat

| Method | Path | Auth | Request |
|---|---|---:|---|
| GET | `/mode-hemat` | Yes | — |
| POST | `/mode-hemat/activate` | Yes | — |
| POST | `/mode-hemat/deactivate` | Yes | — |

## Health

`GET /up` returns `{ "healthy": true }` and does not depend on database availability.
