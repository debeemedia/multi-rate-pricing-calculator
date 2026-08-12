# Multi-Rate Pricing Calculator

A web application built with AdonisJS v6, TypeScript, and PostgreSQL that lets users manage documents, compute multi-rate line-item discounts and taxes server-side, maintain strict lifecycle immutability for finalized documents, and generate summary reports.

## Live Demo & Repository

Live App URL: [https://multi-rate-pricing-calculator-pp8y.onrender.com](https://multi-rate-pricing-calculator-pp8y.onrender.com)

Repository: [https://github.com/debeemedia/multi-rate-pricing-calculator](https://github.com/debeemedia/multi-rate-pricing-calculator)

## Features Implemented

- **Auth & Data Isolation:** Multi-tenant isolation ensuring users can only view, edit, or report on their own documents.
- **Server-Side Financial Engine:** Integer-based cent representation avoiding JavaScript IEEE 754 floating-point drift.
- **Strict Document Lifecycle:** Draft documents are fully editable; finalized documents become immutable across both UI and API levels.
- **Date-Bounded Summary Reporting:** Aggregates metrics (Total Documents, Revenue, Discounts, Tax) across customizable date ranges, with composite index on relevant columns (`user_id, issue_date, status`) for fast lookups.

## Calculation & Rounding Policy

### 1. Financial Precision Policy (Minor Units Storage)

To eliminate floating-point drift:

- All monetary values (`unit_price`, `subtotal`, `discount_amount`, `tax_amount`, and `line_total`) are stored as integers (BigInt) in minor units (e.g. cents) in PostgreSQL. For example, $100.00 is stored as 10000.
- The `discount_value` column is stored as an integer (BigInt). The application inspects `discount_type` (fixed vs percent) to handle the conversion:
  - If fixed: converted from major unit ($) to minor unit (cents) before storage.
  - If percent: stored directly as the percentage integer/decimal value (e.g., 10 for 10%).
- Tax percentages (`tax_rate`) are stored as decimal numeric types.
- Mathematical operations are calculated in minor units e.g. cents. Conversion back to major currency units (/ 100) occurs only when formatting strings for API JSON responses and HTML views.

### 2. Per-Line Order of Operations

For every line item, calculations execute in this strict order:

#### (i) Subtotal:

$$\text{Subtotal} = \text{Quantity} \times \text{Unit Price}$$

#### (ii) Discount Calculation & Validation:

- **Percentage Discount:**
  $$\text{Discount Amount} = \text{Round}\left(\frac{\text{Subtotal} \times \text{Percent}}{100}\right)$$
- **Fixed Discount:** Direct fixed cent amount.
- **Validation Rule:** Fixed discount **must not exceed** the line item's subtotal. If a fixed discount is greater than the subtotal, the API rejects the request with a `400 Bad Request` validation error e.g. `Fixed discount ($100.00) cannot exceed line subtotal ($50.00) for line: "Service fee"`.

#### (iii) Tax Calculation:

Tax is calculated after the discount on the net line amount:
$$\text{Discounted Subtotal} = \text{Subtotal} - \text{Discount Amount}$$
$$\text{Tax Amount} = \text{Round}\left(\frac{\text{Discounted Subtotal} \times \text{Tax Rate}}{100}\right)$$

#### (iv) Line Total:

$$\text{Line Total} = \text{Discounted Subtotal} + \text{Tax Amount}$$

#### (v) Rounding Standard:

Half-up rounding (`Math.round`) applied at the per-line boundary for tax and discount calculations before accumulating document totals.

## Sample Verification (Test Case)

Below is the test case executed by our test suite (`tests/unit/pricing_calculator.spec.ts`) against the assignment's exact sample dataset:

| Line Item       | Qty | Unit Price | Discount  | Tax | Subtotal | Discount Amt | After Discount | Tax Amt | Line Total |
| --------------- | --- | ---------- | --------- | --- | -------- | ------------ | -------------- | ------- | ---------- |
| **Widget A**    | 2   | $100.00    | 10%       | 5%  | $200.00  | $20.00       | $180.00        | $9.00   | $189.00    |
| **Widget B**    | 1   | $50.00     | -         | 5%  | $50.00   | $0.00        | $50.00         | $2.50   | $52.50     |
| **Service fee** | 1   | $200.00    | $20 fixed | -   | $200.00  | $20.00       | $180.00        | $0.00   | $180.00    |
| **TOTALS**      |     |            |           |     | $450.00  | $40.00       | $410.00        | $11.50  | $421.50    |

## Document Lifecycle & Immutability Rules

- **`draft` State:**
  - Full CRUD operations allowed on metadata and line items.
  - Transitions to `finalized` via POST `/documents/:id/finalize`.
- **`finalized` State:**
  - Immutability is enforced at the service/API layer, returning a `400 Bad Request` if `PUT/PATCH/DELETE` requests hit a finalized resource.
  - Line-item addition and deletion endpoints reject writes on finalized documents.

> **Document Duplication:** Document duplication (cloning a finalized document into a new draft) is currently **not supported**. All documents must be created directly or edited while in `draft` status.

> **Finalization Guardrails:** Finalization is rejected with a `400 Bad Request` if a document contains zero line items. Line item quantities and prices are validated upon line creation/update via VineJS schemas.

## Local Setup Instructions

### Prerequisites

- **Node.js:** `^20.x` or higher
- **PostgreSQL**: `^15.x` running locally or via Docker
- **Package Manager:** `npm`

### Step-by-Step Installation

**1. Clone the repository:**

```bash
git clone https://github.com/debeemedia/multi-rate-pricing-calculator

cd multi-rate-pricing-calculator
```

**2. Install dependencies:**

```bash
npm install
```

**3. Configure Environment Variables:**
Copy `.env.example` to `.env` and configure your database credentials:

```bash
cp .env.example .env
```

Ensure `.env` contains valid database configuration. Sample:

```
# Node
TZ=UTC
PORT=3333
HOST=localhost
NODE_ENV=development

# App
LOG_LEVEL=info
APP_KEY=your_generated_app_key
APP_URL=http://${HOST}:${PORT}

# Session
SESSION_DRIVER=cookie

# Database
DB_HOST=127.0.0.1
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_DATABASE=multi_rate_pricing_calculator
```

To generate `APP_KEY`, run this command and copy the generated key (e.g. `erM2q2G0RYqWT_BJ7IFjw4bZq-4_SUJI`):

```bash
node ace generate:key --show
```

**4. Run Database Migrations:**

```bash
node ace migration:run
```

**5. Run the Application:**

```bash
npm run dev
```

Access the web app at http://localhost:3333.

## API & Web View Architecture (Dual-Mode Responses)

The application controller architecture supports **both web browsers and REST API clients**:

- **Web Navigation (HTML Views):** Standard browser requests render server-side Edge templates (`view.render(...)`).
- **API Clients (JSON Responses):** Requests including an `Accept: application/json` header bypass template rendering and return pure JSON payloads with proper HTTP status codes (`200 OK`, `400 Bad Request`, `422 Unprocessable Entity`).

## Testing API Endpoints (Thunder Client / Postman)

You can inspect and test all API endpoints directly using **Thunder Client**, **Postman**, or **cURL**.

### Key Request Headers

To receive JSON responses instead of HTML web views:

```http
Accept: application/json
Content-Type: application/json
```

### Recommended: Thunder Client / Postman

1. Send a `POST` request to `/login` with your user credentials.
2. The client will automatically store the HTTP-only session cookie in its cookie jar.
3. Make subsequent requests (e.g., `GET /documents/reports/summary`) adding the header:

```http
Accept: application/json
```

> **Note on Authentication:** _Authentication uses HTTP-only cookie sessions. When testing authenticated routes in Thunder Client or Postman, ensure you run the Login request first so your cookie jar automatically stores and forwards the session cookie._

## Running Unit Tests

The calculation engine contains dedicated unit tests covering edge cases (zero values, mixed percentage and fixed discounts, tax rounding, exceeded subtotal).

To execute tests:

```bash
node ace test unit
```

## Assumptions & Engineering Tradeoffs

**1. Strict Fixed Discount Validation (Error over Clamping):**

- _**Decision:**_ If a fixed discount exceeds a line item’s subtotal, the backend throws a validation error e.g. `Fixed discount ($100.00) cannot exceed line subtotal ($50.00) for line: "Service fee"` rather than silently clamping the discount to equal the subtotal.

- _**Tradeoff:**_ Requires explicit user correction on invalid input, but prevents silent modification of financial figures that could confuse users.

**2. UTC Boundary Normalization for Reports:**

- _**Decision:**_ Date filter bounds (`startDate` and `endDate`) are parsed using UTC timezone logic and forcibly expanded: `startDate` defaults to `00:00:00.000` (start of current month) and `endDate` expands to `23:59:59.999` (end of current day).

- _**Tradeoff:**_ Guarantees SQL `BETWEEN` timestamps capture all documents issued on the selected end date without truncating records created later in the day, regardless of server timezone differences.

**3. Session-Based Cookie Authentication over JWT:**

- _**Decision:**_ Used AdonisJS's native session/cookie authentication layer (`@adonisjs/auth`) instead of stateless JWT tokens.

- _**Tradeoff**_: Simpler session revocation and CSRF protection out of the box for web view forms, though API clients must maintain cookies across requests.

## What I Would Improve Before Production

**1. Infrastructure & VPS Deployment (Docker & Containerization):**

- Migrate deployment from Render's free serverless tier to a dedicated Linux VPS (e.g. AWS EC2).
- Add a root `docker-compose.yml` to orchestrate the Node.js application service and PostgreSQL container, eliminating Render's free-tier cold-start spin-up latency and simplifying environment setup across environments.

**2. Integration & End-to-End (E2E) Test Suite:**

- While unit tests cover the calculation service exhaustively, adding integration test cases for all the API endpoints will ensure that the expected response structure is always returned. Adding browser tests with Playwright for full UI flows e.g. (sign up $\rightarrow$ document list $\rightarrow$ document creation $\rightarrow$ adding line items $\rightarrow$ finalization immutability check) would prevent regression bugs on view interactions.

**3. Asynchronous Export Generation:**

- Implement asynchronous background worker (e.g., BullMQ) for generating downloadable PDF invoices sent via email or direct download links.

**4. Comprehensive Documentation:**

- Detailed documentation of all API routes, including schema definitions for request payloads and structured success/error response bodies (`201 Created`, `200 OK`, `400 Bad Request`, `422 Unprocessable Entity`).

**5. Dedicated Frontend Styling & Asset Pipeline**

- Extract layout styles from inline HTML attributes into organized external CSS components to improve template readability and maintainability.
- Redesign the default AdonisJS starter homepage to align with the application’s design system and document dashboard UI, providing a cohesive brand experience across all public and authenticated views.
- Extract repeating layout blocks (e.g., summary metrics cards, status badges, flash message banners) into dedicated Edge UI components to reduce template duplication and streamline future feature updates.
