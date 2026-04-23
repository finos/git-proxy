# Cypress E2E Test Plan

## Goal
Cover all functionality and UI elements on each page to minimize UI-related bugs and regression.

## Existing Coverage

| Page | Test File | Coverage |
|------|-----------|----------|
| Login | `login.cy.js` | Logo, inputs, valid/invalid login, redirect |
| Repo List | `repo.cy.js` | Add repo, duplicate error, anonymous/regular/admin permissions, clone tooltip |
| Push Actions | `docker/pushActions.cy.js` | Approve, Reject, Cancel, unauthorized attempts, dialog cancel |
| Auto-Approved Push | `autoApproved.cy.js` | Auto-approved message, tooltip timestamp |
| Push Details | `push-details.cy.js` | Pending/Approved/Rejected/Canceled states, tabs, card body, steps, error state, navigation |

---

## Prerequisites: Bug Fixes & Infrastructure

### Bug Fixes Required

| Bug | Location | Fix |
|-----|----------|-----|
| Error tab sends wrong query param | `src/ui/views/PushRequests/components/PushesTable.tsx:64` | Change `errored` → `error` to match DB field |
| Broken CardBody selector in test | `cypress/e2e/push-details.cy.js:84` | Add `data-testid="push-details-card-body"` to `PushDetails.tsx` `<CardBody>` |

### Test Data Cleanup Infrastructure

**Problem:** `cy.createPush()` creates permanent push records via real git operations, but there is no API to delete a push. Tests accumulate data forever.

**Solution:**
1. Add `src/service/routes/test.ts` with test-only endpoints (gated by `NODE_ENV === 'test'`):
   - `DELETE /api/v1/test/push/:id` — calls `db.deletePush(id)` (admin auth)
   - `DELETE /api/v1/test/user/:username` — calls `db.deleteUser(username)` (admin auth)
2. Conditionally mount in `src/service/routes/index.ts` when `NODE_ENV === 'test'`
3. Add custom commands to `cypress/support/commands.js`:
   - `cy.deleteTestPush(pushId)`
   - `cy.deleteTestUser(username)`
4. Backfill cleanup into existing leaky test files:
   - `push-details.cy.js` — add `afterEach` push cleanup
   - `docker/pushActions.cy.js` — add `afterEach` push cleanup + `after` user cleanup

### UI Instrumentation Needed

Systematically add `data-testid` and accessibility attributes to untested pages for robust, maintainable selectors:

| File | Attributes to Add |
|------|-------------------|
| `src/ui/views/PushDetails/PushDetails.tsx` | `data-testid="push-details-card-body"` on `<CardBody>` |
| `src/ui/views/PushRequests/PushRequests.tsx` | `data-testid="push-requests-tabs"` on tabs container |
| `src/ui/views/PushRequests/components/PushesTable.tsx` | `data-testid="push-row-<id>"` on each `<TableRow>`, `data-testid="pushes-table"` on table |
| `src/ui/views/RepoDetails/RepoDetails.tsx` | `data-testid="repo-info-card"`, `data-testid="reviewers-table"`, `data-testid="contributors-table"`, `data-testid="add-reviewer-btn"`, `data-testid="add-contributor-btn"`, `data-testid="code-clone-btn"` |
| `src/ui/views/RepoDetails/Components/AddUser.tsx` | `data-testid="add-user-dialog"`, `data-testid="add-user-select"`, `data-testid="add-user-confirm-btn"` |
| `src/ui/views/RepoDetails/Components/DeleteRepoDialog.tsx` | `data-testid="delete-repo-dialog"`, `data-testid="delete-repo-confirm-input"`, `data-testid="delete-repo-confirm-btn"` |
| `src/ui/views/User/UserProfile.tsx` | `data-testid="profile-name"`, `data-testid="profile-role"`, `data-testid="profile-email"`, `data-testid="profile-gitAccount"`, `data-testid="profile-admin-status"`, `data-testid="gitAccount-input"`, `data-testid="update-profile-btn"` |
| `src/ui/views/UserList/Components/UserList.tsx` | `data-testid="user-list-table"`, `data-testid="user-row-<username>"` on each row |
| `src/ui/views/Settings/Settings.tsx` | `data-testid="jwt-token-input"`, `data-testid="jwt-token-toggle"`, `data-testid="jwt-save-btn"`, `data-testid="jwt-clear-btn"`, `data-testid="settings-snackbar"` |
| `src/ui/components/Sidebar/Sidebar.tsx` | `aria-current="page"` on active `<NavLink>` |
| `src/ui/components/Navbars/Navbar.tsx` | `data-testid="navbar"` |
| `src/ui/components/Footer/Footer.tsx` | `data-testid="footer"` |
| `src/ui/components/Search/Search.tsx` | `data-testid="search-input"` |
| `src/ui/components/Pagination/Pagination.tsx` | `data-testid="pagination-previous"`, `data-testid="pagination-next"`, `data-testid="pagination-info"` |
| `src/ui/components/Filtering/Filtering.tsx` | `data-testid="filter-dropdown"`, `data-testid="filter-option-<name>"`, `data-testid="filter-sort-toggle"` |
| `src/ui/views/Extras/NotFound.tsx` | `data-testid="not-found-page"` |
| `src/ui/views/Extras/NotAuthorized.tsx` | `data-testid="not-authorized-page"` |

---

## Phase 1: High-Complexity Pages

### 1. Push Details — Tabs & Content Rendering ✅ DONE
**Route:** `/dashboard/push/:id`
**File:** `cypress/e2e/push-details.cy.js`
**Strategy:** Real API for 10/11 tests, intercept only for error state. Cleanup added via `afterEach`.

- [x] 1.1 — Pending push shows Pending status with action buttons *(real API)*
- [x] 1.2 — Card body renders: Timestamp, Remote Head link, Commit SHA link, Repository link, Branch link *(real API)*
- [x] 1.3 — Commits tab renders commit data table with correct columns *(real API)*
- [x] 1.4 — Changes tab renders diff content via diff2html *(real API)*
- [x] 1.5 — Steps tab renders steps timeline with summary chips *(real API)*
- [x] 1.6 — Steps accordions expand and show content/logs *(real API)*
- [x] 1.7 — Rejected push shows rejection info with reason *(real API)*
- [x] 1.8 — Approved push shows attestation info *(real API)*
- [x] 1.9 — Error state renders error message when API fails *(intercept — can't trigger real 500)*
- [x] 1.10 — Canceled push shows Canceled status *(real API)*
- [x] 1.11 — Action buttons navigate back to push list after completing action *(real API)*

### 2. Repo Details — User Management
**Route:** `/dashboard/repo/:id`
**File:** `cypress/e2e/repo-details.cy.js`
**Strategy:** Real API for all tests. Create a test repo via `cy.request POST /api/v1/repo` in `before`, clean up in `after`.

- [ ] 2.1 — Repo info renders: project, name, URL links
- [ ] 2.2 — Reviewers table renders user list with links
- [ ] 2.3 — Contributors table renders user list with links
- [ ] 2.4 — Admin can add reviewer via "Add Reviewer" button
- [ ] 2.5 — Admin can remove reviewer
- [ ] 2.6 — Admin can add contributor via "Add Contributor" button
- [ ] 2.7 — Admin can remove contributor
- [ ] 2.8 — Delete repo dialog opens, confirms, navigates to repo list
- [ ] 2.9 — Non-admin cannot see add/remove/delete buttons
- [ ] 2.10 — Code clone button renders with correct URL

### 3. Push Requests — Tab Filtering
**Route:** `/dashboard/push`
**File:** `cypress/e2e/push-requests.cy.js`
**Strategy:** Shared dataset created once in `before()`, cleaned up in `after()`. Uses real pushes for Pending/Approved/Rejected/Canceled, intercept for Error tab. *Comment in code explaining shared dataset for PR reviewers.*

- [ ] 3.1 — All 6 tabs render (All, Pending, Approved, Canceled, Rejected, Error)
- [ ] 3.2 — Pending tab filters to show only pending pushes *(real API)*
- [ ] 3.3 — Approved tab filters to show only approved pushes *(real API)*
- [ ] 3.4 — Canceled tab filters to show only canceled pushes *(real API)*
- [ ] 3.5 — Rejected tab filters to show only rejected pushes *(real API)*
- [ ] 3.6 — Error tab filters to show only errored pushes *(intercept — requires UI bugfix + synthetic error push)*
- [ ] 3.7 — Push table rows are clickable and navigate to Push Details *(real API)*

### 4. Repo List — Search, Filter, Pagination
**Route:** `/dashboard/repo`
**File:** `cypress/e2e/repo-list.cy.js`
**Strategy:** Create 6+ test repos via fast API (`cy.request POST /api/v1/repo`) in `before()`, clean up in `after()`. Pagination is tested here only (shared `Pagination` component). Search/filter use client-side logic.

- [ ] 4.1 — Search filters repos by name
- [ ] 4.2 — Search filters repos by project
- [ ] 4.3 — Clear search resets to all repos
- [ ] 4.4 — Filter dropdown sorts by Date Modified, Date Created, Alphabetical
- [ ] 4.5 — Pagination renders and navigates between pages
- [ ] 4.6 — Repo rows are clickable and navigate to Repo Details

### 5. Profile Page
**Route:** `/dashboard/profile`
**File:** `cypress/e2e/profile.cy.js`
**Strategy:** Real API for all tests.

- [ ] 5.1 — Displays user info: name, role, email, GitHub username, admin status
- [ ] 5.2 — User can edit their own GitHub username
- [ ] 5.3 — Admin can edit another user's GitHub username (via `/dashboard/user/:id`)
- [ ] 5.4 — Non-admin viewing another user's profile cannot edit

### 6. User List (Admin)
**Route:** `/dashboard/admin/user`
**File:** `cypress/e2e/user-list.cy.js`
**Strategy:** Real API. *Note: Create/delete user UI does not exist; tests cover only read access.*

- [ ] 6.1 — Renders list of all users
- ~~6.2 — Admin can create a new user~~ *(UI not implemented — removed from scope)*
- ~~6.3 — Admin can delete a user~~ *(UI not implemented — removed from scope)*
- [ ] 6.4 — Non-admin cannot access user list

### 7. Settings Page
**Route:** `/dashboard/admin/settings`
**File:** `cypress/e2e/settings.cy.js`
**Strategy:** Uses `localStorage` for JWT persistence. No backend API calls for save/clear.

- [ ] 7.1 — JWT token field renders with show/hide toggle
- [ ] 7.2 — Save button persists token and shows snackbar
- [ ] 7.3 — Clear button removes token and shows snackbar
- [ ] 7.4 — Token persists across page reload

### 8. Navigation & Shell
**File:** `cypress/e2e/navigation.cy.js`
**Strategy:** Mix of real navigation and intercepts.

- [ ] 8.1 — Sidebar renders all visible links (Repositories, Dashboard, My Account, Users, Settings)
- [ ] 8.2 — Sidebar links navigate correctly
- [ ] 8.3 — Active sidebar item highlights *(uses `aria-current="page"`)*
- [ ] 8.4 — Navbar renders correctly
- [ ] 8.5 — Footer renders
- [ ] 8.6 — Unauthenticated user is redirected to `/login`
- [ ] 8.7 — `/` redirects to `/dashboard/repo`

### 9. Error Pages
**File:** `cypress/e2e/error-pages.cy.js`
**Strategy:** Direct navigation. No API needed.

- [ ] 9.1 — Unknown route shows 404 page
- [ ] 9.2 — Unauthorized route shows NotAuthorized page

---

## Implementation Notes

### Hybrid Approach: Real API First, Intercepts as Fallback

- **Prefer real API calls** — leverage existing custom commands (`cy.createPush()`, `cy.createUser()`, `cy.addUserPushPermission()`, etc.) to create real data and test real UI rendering
- **Use `cy.intercept()` only when real API is impractical** — e.g., mocking 500 errors, testing edge-case data shapes (empty commits, specific step errors/blocks), or simulating OIDC flows
- **Shared datasets for read-only filtering tests** — acceptable when tests only assert on rendering, not mutations. Document with inline comments.
- Use `cy.session()` for login (already available in custom commands)
- Follow existing file naming convention: `cypress/e2e/<name>.cy.js`
- Include Apache 2.0 license header in all new files
- Each test file should document which tests use real API vs intercepts (see `push-details.cy.js` as reference)

### Cleanup Discipline

- Every test that creates a push via `cy.createPush()` must clean it up via `cy.deleteTestPush()` in `afterEach` or `after`
- Every test that creates a user via `cy.createUser()` should clean it up via `cy.deleteTestUser()` in `after`
- `repo-list.cy.js` creates repos via `cy.request POST /api/v1/repo`; clean up via `cy.deleteRepo()` in `after`
- Do not rely on database wipes between CI runs; keep local repeated runs safe
