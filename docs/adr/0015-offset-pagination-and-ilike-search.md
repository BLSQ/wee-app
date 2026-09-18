# 0015. Offset pagination and ILIKE search for long lists

**Status:** Proposed
**Date:** 2026-09-18

## Context

The device sync list fetched the fifty newest rows and offered no way to search or reorder them
(issue #19). The seeded database holds six thousand syncs and a deployment holds more, so the list
needs a way to reach a row that is not near the top without sending the whole table to the browser.

Two shapes were considered. A virtual table keeps one window of rows in the DOM and loads more as
the user scrolls, which reads well for uninterrupted scanning. Pagination cuts the table into pages
the server already knows how to produce. We took pagination: its state is two numbers, and the
workshop has to be able to read the query.

## Decision

- `listRecentSyncs` takes `limit` and `offset` and returns `{ rows, total }`. The tRPC procedure
  takes a 1-based `page` and converts it.
- Search is one term, matched with Postgres `ILIKE` against the device serial, the username, the
  facility name and the district name. There are no per-column filters.
- Sorting is offered on those same four text columns, and the list falls back to newest-first.
- Every predicate is built with Kysely's expression builder. List queries do not use a raw `sql`
  template for a column reference.

## Consequences

The pager knows how many pages there are, because `total` comes back with every page, and a search
narrows that count as well as the rows.

`OFFSET` makes Postgres walk the rows it skips, and each request runs a second `COUNT` over the same
four-table join. Both are cheap at this size. Revisit with keyset pagination, where a page asks for
the rows after the last one it saw, if the table grows large enough for a deep page to be slow.

A row inserted between two page requests can shift the window, so a sync may be skipped or seen
twice while paging. Accepted: this is a dashboard of past syncs, not a ledger.

`ILIKE` with a leading `%` cannot use a B-tree index, so search is a sequential scan. Revisit with a
trigram index (`pg_trgm`) or a `tsvector` column when search gets slow.

The rule about raw SQL was learned rather than chosen. The first search predicate was a raw `sql`
template that named `app_user`, a table the join had already aliased to `user`. `tsc` does not look
inside a raw `sql` template, so the type check passed and every search failed against the database.
The expression builder resolves the alias and checks the column against `Database`, which turns that
mistake into a build error. This narrows, but does not remove, the drift that 0003 accepts between
the hand-written `Database` interface and the migrations.
