# Add Pagination to Data-Heavy Pages

The user reported that navigating to menus other than the dashboard feels slow, as the page takes time to load all content. Currently, several data-heavy pages render their entire dataset at once (e.g., all students, all records) which causes significant DOM lag and feels sluggish.

To fix this and make the application "lighter and faster" by "only displaying a small part of it," we will implement client-side pagination on the most data-heavy pages.

## Proposed Changes

We will use the existing UI components (`src/components/ui/pagination.tsx`) and add standard client-side pagination logic to these specific pages:

### `src/pages/ManageStudents.tsx`
- Add a `currentPage` state.
- Slice the `filteredStudents` array to show only 50 items per page.
- Add the `Pagination` component to the bottom of the list/table.
- Reset `currentPage` to 1 whenever filters change.

### `src/pages/RekapGlobal.tsx`
- Add a `currentPage` state.
- Slice the `filtered` array to show only 50 items per page.
- Add the `Pagination` component to the bottom.
- Reset `currentPage` to 1 whenever filters change.

### `src/pages/RekapSertifikat.tsx`
- Add a `currentPage` state.
- Slice the `filtered` array to show 50 items per page.
- Add the `Pagination` component to the bottom.
- Reset `currentPage` to 1 whenever filters change.

### `src/pages/ManageUsers.tsx`
- Add a `currentPage` state.
- Slice `filteredProfiles` to show 50 items per page.
- Add the `Pagination` component.

### `src/pages/ClassStudents.tsx` & `src/pages/SearchStudents.tsx`
- Add similar pagination logic to limit the number of rendered items and speed up the UI.

## Reusable Hook Option
To avoid duplicating pagination logic across 6 files, we will create a simple custom hook `src/hooks/usePagination.ts` (or just inline it if it's very simple) to handle page changes, sliced data, and total pages calculation. 
For simplicity and avoiding prop-drilling, we can write a reusable `<DataTablePagination />` component that wraps the `Pagination` UI.

## Verification Plan

### Manual Verification
- The user can click through the pages (Manage Students, Rekap Global, etc.) and verify that they load instantly.
- The UI should display 50 rows per page instead of hundreds.
- The pagination controls (Next/Prev, page numbers) should correctly navigate through the data.
- Changing search filters should reset the pagination back to page 1.

## User Review Required

> [!IMPORTANT]
> - The default limit will be set to **50 items per page**. Is this an acceptable amount, or would you prefer a different default (e.g., 20 or 100)?
> - We will use client-side pagination (the data is still fully downloaded, but only 50 are shown on the screen at a time). This solves the UI lag immediately without needing complex backend changes. Is this approach good for you?
